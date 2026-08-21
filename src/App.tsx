import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ConnectionStatus,
  HardwareDeviceType,
  LockStatus,
  LogEntry,
  LogLevel,
  MemoryType,
  SampleSPD,
  SlotInfo,
  SPDByteDiff
} from './types';
import { ProgrammerManager } from './hardware/ProgrammerManager';
import { parseSPD } from './spd/spdParser';
import { fixSPD_CRC } from './crc/crcService';
import { SAMPLE_SPD_LIBRARY } from './spd/sampleDumps';

// Components
import { TopToolbar } from './components/TopToolbar';
import { HardwarePanel } from './components/HardwarePanel';
import { SpdInfoPanel } from './components/SpdInfoPanel';
import { HexEditor } from './components/HexEditor';
import { LogConsole } from './components/LogConsole';
import { StatusBar } from './components/StatusBar';
import { CompareModal } from './components/CompareModal';
import { VerifyModal } from './components/VerifyModal';
import { SafetyWriteModal } from './components/SafetyWriteModal';
import { SampleModal } from './components/SampleModal';
import { HardwareGuideModal } from './components/HardwareGuideModal';

export default function App() {
  // Main Data States (default to first sample for instant live preview)
  const defaultSample = SAMPLE_SPD_LIBRARY[0];
  const [data, setData] = useState<Uint8Array>(new Uint8Array(defaultSample.bytes));
  const [originalData, setOriginalData] = useState<Uint8Array>(new Uint8Array(defaultSample.bytes));
  const [selectedOffset, setSelectedOffset] = useState<number>(0);

  // Undo / Redo History Stacks
  const [undoStack, setUndoStack] = useState<Uint8Array[]>([]);
  const [redoStack, setRedoStack] = useState<Uint8Array[]>([]);

  // Hardware & Connection States
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [deviceType, setDeviceType] = useState<HardwareDeviceType>(HardwareDeviceType.SIMULATION);
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [voltage, setVoltage] = useState<string>('3.3V');
  const [lockStatus, setLockStatus] = useState<LockStatus>(LockStatus.UNLOCKED);

  // Modals
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState<boolean>(false);
  const [isSafetyWriteOpen, setIsSafetyWriteOpen] = useState<boolean>(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState<boolean>(false);

  // Operations Progress
  const [opStep, setOpStep] = useState<string>('');
  const [opProgress, setOpProgress] = useState<number>(0);
  const [verifyResult, setVerifyResult] = useState<{ matched: boolean; mismatches: SPDByteDiff[] } | null>(null);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: 'log-0',
      timestamp: new Date().toLocaleTimeString(),
      level: LogLevel.INFO,
      message: 'SPD Programmer Pro initialized. Virtual simulation engine ready.'
    },
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString(),
      level: LogLevel.SUCCESS,
      message: 'Loaded default sample: Samsung 8GB DDR4-3200 SO-DIMM (512 Bytes).'
    }
  ]);

  const addLog = useCallback((level: LogLevel, message: string, details?: string) => {
    setLogs(prev => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        details
      }
    ]);
  }, []);

  // Initialize Programmer Manager Callbacks
  useEffect(() => {
    const manager = ProgrammerManager.getInstance();
    manager.setCallbacks(
      (status) => setConnectionStatus(status),
      (level, msg, details) => addLog(level, msg, details),
      (newSlots) => setSlots(newSlots)
    );
  }, [addLog]);

  // Derived parsed SPD info
  const spdInfo = useMemo(() => {
    try {
      return parseSPD(data);
    } catch (e) {
      return null;
    }
  }, [data]);

  // Check if buffer is modified compared to original read
  const isModified = useMemo(() => {
    if (data.length !== originalData.length) return true;
    for (let i = 0; i < data.length; i++) {
      if (data[i] !== originalData[i]) return true;
    }
    return false;
  }, [data, originalData]);

  // Push state to undo history
  const pushUndo = useCallback((currentData: Uint8Array) => {
    setUndoStack(prev => [...prev.slice(-40), new Uint8Array(currentData)]);
    setRedoStack([]);
  }, []);

  // Byte Editing
  const handleByteChange = useCallback((offset: number, newValue: number) => {
    if (offset < 0 || offset >= data.length) return;
    pushUndo(data);

    const updated = new Uint8Array(data);
    updated[offset] = newValue;
    setData(updated);
  }, [data, pushUndo]);

  const handleBytesChange = useCallback((changes: { offset: number; value: number }[]) => {
    pushUndo(data);
    const updated = new Uint8Array(data);
    changes.forEach(c => {
      if (c.offset >= 0 && c.offset < updated.length) {
        updated[c.offset] = c.value;
      }
    });
    setData(updated);
  }, [data, pushUndo]);

  // Undo / Redo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(u => u.slice(0, -1));
    setRedoStack(r => [...r, new Uint8Array(data)]);
    setData(prev);
    addLog(LogLevel.INFO, 'Undo action applied.');
  }, [undoStack, data, addLog]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(r => r.slice(0, -1));
    setUndoStack(u => [...u, new Uint8Array(data)]);
    setData(next);
    addLog(LogLevel.INFO, 'Redo action applied.');
  }, [redoStack, data, addLog]);

  // Fix CRC
  const handleFixCRC = useCallback(() => {
    const { updatedData, changedOffsets, baseCRC, moduleCRC } = fixSPD_CRC(data);
    if (changedOffsets.length > 0) {
      pushUndo(data);
      setData(updatedData);
      addLog(
        LogLevel.SUCCESS,
        `CRC FIXED: Updated bytes at offsets [${changedOffsets.map(o => `0x${o.toString(16).toUpperCase()}`).join(', ')}]. Base CRC: 0x${baseCRC.toString(16).toUpperCase().padStart(4, '0')}${moduleCRC !== undefined ? `, Module CRC: 0x${moduleCRC.toString(16).toUpperCase().padStart(4, '0')}` : ''}.`
      );
    } else {
      addLog(LogLevel.INFO, `CRC is already 100% valid (0x${baseCRC.toString(16).toUpperCase().padStart(4, '0')}). No changes needed.`);
    }
  }, [data, pushUndo, addLog]);

  // Hardware Actions
  const handleConnect = async () => {
    const manager = ProgrammerManager.getInstance();
    try {
      await manager.connect({
        deviceType,
        selectedSlot,
        voltage: voltage as any
      });
      const lock = await manager.getDriver().getLockStatus(selectedSlot);
      setLockStatus(lock);
    } catch (e: any) {
      // Handled via logs
    }
  };

  const handleDisconnect = async () => {
    const manager = ProgrammerManager.getInstance();
    await manager.disconnect();
  };

  const handleScanSlots = async () => {
    const manager = ProgrammerManager.getInstance();
    try {
      setIsScanning(true);
      await manager.scanSlots();
    } catch (e) {
      // handled
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectDeviceType = (type: HardwareDeviceType) => {
    setDeviceType(type);
    const manager = ProgrammerManager.getInstance();
    manager.setDeviceType(type);
  };

  const handleSelectSlot = (slotIdx: number) => {
    setSelectedSlot(slotIdx);
    const manager = ProgrammerManager.getInstance();
    manager.setSelectedSlot(slotIdx);
  };

  // Read SPD
  const handleReadSPD = async () => {
    const manager = ProgrammerManager.getInstance();
    try {
      setOpStep('Starting Read SPD...');
      setOpProgress(0);

      const readBuffer = await manager.readSPD(selectedSlot, 512, (p, step) => {
        setOpProgress(p);
        setOpStep(step);
      });

      pushUndo(data);
      setData(new Uint8Array(readBuffer));
      setOriginalData(new Uint8Array(readBuffer));
      setSelectedOffset(0);

      addLog(LogLevel.SUCCESS, `READ SPD SUCCESS: Loaded ${readBuffer.length} bytes into Hex Editor.`);
    } catch (error: any) {
      addLog(LogLevel.ERROR, `READ SPD FAILED: ${error?.message || error}`);
    }
  };

  // Write SPD Trigger & Confirmation
  const handleOpenWriteModal = () => {
    setIsSafetyWriteOpen(true);
  };

  const handleConfirmWrite = async (autoFixCrc: boolean, createBackupFirst: boolean) => {
    const manager = ProgrammerManager.getInstance();
    try {
      let dataToWrite = new Uint8Array(data);

      if (autoFixCrc && spdInfo && !spdInfo.crcBase.isValid) {
        const fixed = fixSPD_CRC(dataToWrite);
        dataToWrite = fixed.updatedData;
        setData(dataToWrite);
        addLog(LogLevel.INFO, 'Automatically fixed CRC bytes prior to burning.');
      }

      if (createBackupFirst) {
        handleSaveFile('bin', `SPD_BACKUP_SLOT${selectedSlot}_${Date.now()}.bin`);
      }

      setOpStep('Flashing EEPROM...');
      setOpProgress(0);

      const success = await manager.writeSPD(selectedSlot, dataToWrite, (p, step) => {
        setOpProgress(p);
        setOpStep(step);
      });

      if (success) {
        setOriginalData(new Uint8Array(dataToWrite));
        setIsSafetyWriteOpen(false);
      }
    } catch (e: any) {
      addLog(LogLevel.ERROR, `WRITE FAILED: ${e?.message || e}`);
    }
  };

  // Verify SPD
  const handleVerify = async () => {
    const manager = ProgrammerManager.getInstance();
    setIsVerifyOpen(true);
    setOpStep('Initiating Verification...');
    setOpProgress(0);
    setVerifyResult(null);

    try {
      const result = await manager.verifySPD(selectedSlot, data, (p, step) => {
        setOpProgress(p);
        setOpStep(step);
      });
      setVerifyResult(result);
    } catch (e: any) {
      addLog(LogLevel.ERROR, `VERIFY FAILED: ${e?.message || e}`);
    }
  };

  // Lock / Unlock
  const handleLock = async () => {
    const manager = ProgrammerManager.getInstance();
    try {
      await manager.lock(selectedSlot);
      setLockStatus(LockStatus.LOCKED);
    } catch (e) {
      // handled
    }
  };

  const handleUnlock = async () => {
    const manager = ProgrammerManager.getInstance();
    try {
      await manager.unlock(selectedSlot);
      setLockStatus(LockStatus.UNLOCKED);
    } catch (e) {
      // handled
    }
  };

  // File Operations
  const handleOpenFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bin,.hex,.spd,.txt';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        let buffer: Uint8Array;
        if (file.name.endsWith('.txt') || file.name.endsWith('.hex')) {
          // Attempt parsing hex text
          const text = new TextDecoder().decode(reader.result as ArrayBuffer);
          const hexTokens = text.replace(/[^0-9A-Fa-f]/g, ' ').trim().split(/\s+/);
          const byteArr: number[] = [];
          for (const tok of hexTokens) {
            if (tok.length === 2) byteArr.push(parseInt(tok, 16));
          }
          buffer = byteArr.length >= 64 ? new Uint8Array(byteArr) : new Uint8Array(reader.result as ArrayBuffer);
        } else {
          buffer = new Uint8Array(reader.result as ArrayBuffer);
        }

        pushUndo(data);
        setData(buffer);
        setOriginalData(new Uint8Array(buffer));
        setSelectedOffset(0);
        addLog(LogLevel.SUCCESS, `Loaded file "${file.name}" (${buffer.length} bytes) into editor.`);
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
  };

  const handleSaveFile = (format: 'bin' | 'hex' | 'spd' | 'txt', customName?: string) => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + new Date().toTimeString().slice(0, 8).replace(/:/g, '');
    const filename = customName || `SPD_${spdInfo?.memoryType || 'RAM'}_${spdInfo?.modulePartNumber || 'DUMP'}_${dateStr}.${format}`;

    let blob: Blob;
    if (format === 'bin' || format === 'spd') {
      blob = new Blob([data], { type: 'application/octet-stream' });
    } else if (format === 'hex') {
      // Intel HEX or raw hex string
      const hexStr = (Array.from(data) as number[]).map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
      blob = new Blob([hexStr], { type: 'text/plain;charset=utf-8' });
    } else {
      // Formatted text dump
      let txt = `// SPD Programmer Pro Dump: ${spdInfo?.moduleManufacturer} ${spdInfo?.modulePartNumber}\n`;
      txt += `// Memory Type: ${spdInfo?.memoryType} | Capacity: ${spdInfo?.organization.totalCapacityFormatted} | Speed: ${spdInfo?.timings.speedRating}\n\n`;
      for (let i = 0; i < data.length; i += 16) {
        const slice = Array.from(data.slice(i, i + 16)) as number[];
        const hex = slice.map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        const ascii = slice.map((b: number) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
        txt += `0x${i.toString(16).toUpperCase().padStart(4, '0')} | ${hex.padEnd(48, ' ')} | ${ascii}\n`;
      }
      blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    addLog(LogLevel.SUCCESS, `Saved SPD file as "${filename}" (${data.length} bytes).`);
  };

  const handleSelectSample = (sample: SampleSPD) => {
    pushUndo(data);
    setData(new Uint8Array(sample.bytes));
    setOriginalData(new Uint8Array(sample.bytes));
    setSelectedOffset(0);
    addLog(LogLevel.SUCCESS, `Loaded sample SPD: ${sample.name} (${sample.partNumber}).`);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-950 text-neutral-200 overflow-hidden select-none font-sans">
      {/* 1. Industrial Top Toolbar */}
      <TopToolbar
        connectionStatus={connectionStatus}
        isSimulation={deviceType === HardwareDeviceType.SIMULATION}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        memoryType={spdInfo?.memoryType || MemoryType.UNKNOWN}
        isModified={isModified}
        crcValid={spdInfo?.crcBase.isValid ?? true}
        lockStatus={lockStatus}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onReadSPD={handleReadSPD}
        onWriteSPD={handleOpenWriteModal}
        onVerify={handleVerify}
        onFixCRC={handleFixCRC}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCompare={() => setIsCompareOpen(true)}
        onLock={handleLock}
        onUnlock={handleUnlock}
        onOpenFile={handleOpenFile}
        onSaveFile={(fmt) => handleSaveFile(fmt)}
        onOpenSampleModal={() => setIsSampleModalOpen(true)}
        onOpenGuideModal={() => setIsGuideModalOpen(true)}
        onToggleSimulation={() => {
          handleSelectDeviceType(
            deviceType === HardwareDeviceType.SIMULATION
              ? HardwareDeviceType.CH341A
              : HardwareDeviceType.SIMULATION
          );
        }}
      />

      {/* 2. Hardware and Slot Selector Bar */}
      <HardwarePanel
        currentDeviceType={deviceType}
        connectionStatus={connectionStatus}
        selectedSlot={selectedSlot}
        slots={slots}
        isScanning={isScanning}
        voltage={voltage}
        lockStatus={lockStatus}
        onSelectDeviceType={handleSelectDeviceType}
        onSelectSlot={handleSelectSlot}
        onScanSlots={handleScanSlots}
        onVoltageChange={setVoltage}
      />

      {/* 3. JEDEC SPD Decoded Specifications Panel */}
      <SpdInfoPanel spdInfo={spdInfo} onFixCRC={handleFixCRC} />

      {/* 4. Dedicated Industrial Hex Editor */}
      <div className="flex-1 min-h-0 bg-neutral-950">
        <HexEditor
          data={data}
          originalData={originalData}
          spdInfo={spdInfo}
          onByteChange={handleByteChange}
          onBytesChange={handleBytesChange}
          selectedOffset={selectedOffset}
          onSelectOffset={setSelectedOffset}
        />
      </div>

      {/* 5. System & Telemetry Log Console */}
      <LogConsole logs={logs} onClearLogs={() => setLogs([])} />

      {/* 6. Technical Status Bar */}
      <StatusBar
        hardwareName={
          deviceType === HardwareDeviceType.CH341A
            ? 'CH341A USB'
            : deviceType === HardwareDeviceType.SPDBURN_USB
            ? 'SPD Burn USB'
            : deviceType === HardwareDeviceType.ESP32_BRIDGE
            ? 'ESP32 Bridge'
            : deviceType === HardwareDeviceType.RT809H
            ? 'RT809H'
            : 'Simulation Core'
        }
        connectionStatus={connectionStatus}
        isSimulation={deviceType === HardwareDeviceType.SIMULATION}
        selectedSlot={selectedSlot}
        memoryType={spdInfo?.memoryType || MemoryType.UNKNOWN}
        byteSize={data.length}
        crcValid={spdInfo?.crcBase.isValid ?? true}
        crcHex={spdInfo ? `0x${spdInfo.crcBase.stored.toString(16).toUpperCase().padStart(4, '0')}` : 'N/A'}
        isModified={isModified}
        lockStatus={lockStatus}
        selectedOffset={selectedOffset}
        selectedByteValue={data[selectedOffset] !== undefined ? data[selectedOffset] : 0}
      />

      {/* Modals */}
      <CompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        currentData={data}
        originalReadData={originalData}
        onApplyCompareData={(newData) => {
          pushUndo(data);
          setData(newData);
          addLog(LogLevel.SUCCESS, 'Loaded compare data into active Hex Editor.');
        }}
      />

      <VerifyModal
        isOpen={isVerifyOpen}
        onClose={() => setIsVerifyOpen(false)}
        isVerifying={connectionStatus === ConnectionStatus.BUSY}
        verifyProgress={opProgress}
        verifyStep={opStep}
        verifyResult={verifyResult}
        totalBytes={data.length}
        onReverify={handleVerify}
      />

      <SafetyWriteModal
        isOpen={isSafetyWriteOpen}
        onClose={() => setIsSafetyWriteOpen(false)}
        targetSlot={selectedSlot}
        dataLength={data.length}
        spdInfo={spdInfo}
        lockStatus={lockStatus}
        isWriting={connectionStatus === ConnectionStatus.BUSY}
        writeProgress={opProgress}
        writeStep={opStep}
        onConfirmWrite={handleConfirmWrite}
        onBackupNow={() => handleSaveFile('bin', `SPD_BACKUP_SLOT${selectedSlot}_${Date.now()}.bin`)}
      />

      <SampleModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        onSelectSample={handleSelectSample}
      />

      <HardwareGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  );
}
