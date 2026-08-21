import React from 'react';
import { ConnectionStatus, MemoryType, LockStatus, HardwareDeviceType } from '../types';

interface StatusBarProps {
  hardwareName: string;
  connectionStatus: ConnectionStatus;
  isSimulation: boolean;
  selectedSlot: number;
  memoryType: MemoryType;
  byteSize: number;
  crcValid: boolean;
  crcHex: string;
  isModified: boolean;
  lockStatus: LockStatus;
  selectedOffset: number;
  selectedByteValue: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  hardwareName,
  connectionStatus,
  isSimulation,
  selectedSlot,
  memoryType,
  byteSize,
  crcValid,
  crcHex,
  isModified,
  lockStatus,
  selectedOffset,
  selectedByteValue
}) => {
  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;

  return (
    <footer className="bg-neutral-950 border-t border-neutral-800/80 px-3 py-1 text-neutral-300 font-mono text-[11px] select-none flex flex-wrap items-center justify-between gap-2 shadow-inner">
      {/* Left Strip */}
      <div className="flex items-center space-x-3">
        {/* Hardware & Connection */}
        <div className="flex items-center space-x-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              connectionStatus === ConnectionStatus.CONNECTED
                ? (isSimulation ? 'bg-amber-400' : 'bg-emerald-400')
                : connectionStatus === ConnectionStatus.BUSY
                ? 'bg-sky-400 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <span className="font-bold text-neutral-200">{hardwareName}</span>
          <span className="text-neutral-500">[{connectionStatus}]</span>
        </div>

        <span className="text-neutral-700">|</span>

        {/* Slot */}
        <div>
          <span className="text-neutral-500">Slot: </span>
          <span className="text-amber-300 font-bold">Slot {selectedSlot} (0x{(0x50 + selectedSlot).toString(16).toUpperCase()})</span>
        </div>

        <span className="text-neutral-700">|</span>

        {/* SPD Type & Size */}
        <div>
          <span className="text-neutral-500">SPD: </span>
          <span className="text-sky-300 font-bold">{memoryType !== MemoryType.UNKNOWN ? memoryType : 'Generic'}</span>
          <span className="text-neutral-400 ml-1">({byteSize} Bytes)</span>
        </div>

        <span className="text-neutral-700">|</span>

        {/* CRC Status */}
        <div className="flex items-center space-x-1">
          <span className="text-neutral-500">CRC: </span>
          {crcValid ? (
            <span className="text-emerald-400 font-bold">PASS ({crcHex})</span>
          ) : (
            <span className="text-rose-400 font-bold animate-pulse">FAIL ({crcHex})</span>
          )}
        </div>

        <span className="text-neutral-700">|</span>

        {/* Modified */}
        <div>
          <span className="text-neutral-500">Modified: </span>
          <span className={isModified ? 'text-amber-400 font-bold' : 'text-neutral-400'}>
            {isModified ? 'YES' : 'NO'}
          </span>
        </div>

        <span className="text-neutral-700">|</span>

        {/* Lock Status */}
        <div>
          <span className="text-neutral-500">Lock: </span>
          <span className={lockStatus === LockStatus.LOCKED ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
            {lockStatus}
          </span>
        </div>
      </div>

      {/* Right Strip: Cursor Position & Value */}
      <div className="flex items-center space-x-3 text-neutral-400">
        <div>
          <span>Offset: </span>
          <span className="text-amber-300 font-bold">0x{selectedOffset.toString(16).toUpperCase().padStart(4, '0')}</span>
          <span className="text-neutral-500 text-[10px]"> ({selectedOffset})</span>
        </div>

        <div>
          <span>Val: </span>
          <span className="text-sky-300 font-bold">0x{selectedByteValue.toString(16).toUpperCase().padStart(2, '0')}</span>
          <span className="text-emerald-300 ml-1">({selectedByteValue})</span>
          <span className="text-purple-300 ml-1">[{selectedByteValue.toString(2).padStart(8, '0')}]</span>
        </div>

        <div className="px-1.5 py-0.2 bg-neutral-900 border border-neutral-800 rounded text-neutral-300 font-bold">
          Ready
        </div>
      </div>
    </footer>
  );
};
