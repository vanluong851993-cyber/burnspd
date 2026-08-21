import React from 'react';
import {
  Play,
  Square,
  Download,
  Upload,
  CheckCircle,
  Wrench,
  Undo2,
  Redo2,
  GitCompare,
  Lock,
  Unlock,
  FolderOpen,
  Save,
  HelpCircle,
  Cpu,
  Layers,
  FileCode,
  Sparkles
} from 'lucide-react';
import { ConnectionStatus, MemoryType, LockStatus } from '../types';

interface TopToolbarProps {
  connectionStatus: ConnectionStatus;
  isSimulation: boolean;
  canUndo: boolean;
  canRedo: boolean;
  memoryType: MemoryType;
  isModified: boolean;
  crcValid: boolean;
  lockStatus: LockStatus;
  onConnect: () => void;
  onDisconnect: () => void;
  onReadSPD: () => void;
  onWriteSPD: () => void;
  onVerify: () => void;
  onFixCRC: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCompare: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onOpenFile: () => void;
  onSaveFile: (format: 'bin' | 'hex' | 'spd' | 'txt') => void;
  onOpenSampleModal: () => void;
  onOpenGuideModal: () => void;
  onToggleSimulation: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  connectionStatus,
  isSimulation,
  canUndo,
  canRedo,
  memoryType,
  isModified,
  crcValid,
  lockStatus,
  onConnect,
  onDisconnect,
  onReadSPD,
  onWriteSPD,
  onVerify,
  onFixCRC,
  onUndo,
  onRedo,
  onCompare,
  onLock,
  onUnlock,
  onOpenFile,
  onSaveFile,
  onOpenSampleModal,
  onOpenGuideModal,
  onToggleSimulation
}) => {
  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;
  const isBusy = connectionStatus === ConnectionStatus.BUSY;

  return (
    <header className="bg-neutral-900 border-b border-neutral-800 text-neutral-200 select-none shadow-md">
      {/* Top Application Title & System Status Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800/80 bg-neutral-950 text-xs">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 font-mono font-bold text-amber-400">
            <Cpu className="w-4 h-4 text-amber-500 animate-pulse" />
            <span className="tracking-wider">SPD PROGRAMMER PRO</span>
            <span className="px-1.5 py-0.2 bg-neutral-800 text-neutral-400 rounded text-[10px] font-normal border border-neutral-700">
              v3.2 JEDEC EEPROM
            </span>
          </div>

          <div className="h-3 w-px bg-neutral-800" />

          {/* Mode Pill */}
          {isSimulation ? (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/60 text-amber-300 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>SIMULATION MODE (Safe Testing)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-600/60 text-emerald-300 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>HARDWARE MODE (Real USB)</span>
            </div>
          )}

          {isModified && (
            <span className="px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700 text-amber-300 font-mono text-[10px]">
              ● MODIFIED
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleSimulation}
            className={`px-2 py-0.5 rounded text-xs font-mono transition-colors border ${
              isSimulation
                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                : 'bg-amber-900/40 hover:bg-amber-800/60 text-amber-300 border-amber-700'
            }`}
            title="Toggle between Virtual Hardware Simulator and Physical USB Hardware Drivers"
          >
            {isSimulation ? 'Switch to Hardware Driver' : 'Switch to Simulation'}
          </button>

          <button
            onClick={onOpenGuideModal}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            <span>Pinouts & Drivers</span>
          </button>
        </div>
      </div>

      {/* Main Industrial Toolbar Controls */}
      <div className="flex items-center justify-between px-2 py-1.5 gap-2 overflow-x-auto">
        {/* Left Section: Connection & Core Operations */}
        <div className="flex items-center space-x-1">
          {/* Connect / Disconnect Button */}
          {!isConnected ? (
            <button
              id="btn-connect"
              onClick={onConnect}
              disabled={isBusy}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow transition-all active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Connect</span>
            </button>
          ) : (
            <button
              id="btn-disconnect"
              onClick={onDisconnect}
              disabled={isBusy}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-600 text-white font-medium text-xs shadow transition-all active:scale-95 disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Disconnect</span>
            </button>
          )}

          <div className="h-6 w-px bg-neutral-700/60 mx-1" />

          {/* READ SPD */}
          <button
            id="btn-read-spd"
            onClick={onReadSPD}
            disabled={!isConnected || isBusy}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white font-medium text-xs shadow transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-sky-700"
            title="Read SPD EEPROM from target RAM slot"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="font-semibold">Read SPD</span>
          </button>

          {/* WRITE SPD */}
          <button
            id="btn-write-spd"
            onClick={onWriteSPD}
            disabled={!isConnected || isBusy}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-amber-600"
            title="Flash and program SPD EEPROM on target RAM slot"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="font-semibold">Write SPD</span>
          </button>

          {/* VERIFY */}
          <button
            id="btn-verify-spd"
            onClick={onVerify}
            disabled={!isConnected || isBusy}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs border border-neutral-700 shadow-sm transition-all active:scale-95 disabled:opacity-40"
            title="Compare active buffer with physical RAM EEPROM"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verify</span>
          </button>

          <div className="h-6 w-px bg-neutral-700/60 mx-1" />

          {/* FIX CRC */}
          <button
            id="btn-fix-crc"
            onClick={onFixCRC}
            className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded font-medium text-xs border transition-all active:scale-95 ${
              crcValid
                ? 'bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border-neutral-700'
                : 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border-rose-600 animate-pulse'
            }`}
            title={crcValid ? 'CRC is valid. Click to re-calculate.' : 'CRC MISMATCH! Click to fix CRC bytes automatically.'}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{crcValid ? 'Recalc CRC' : 'Fix CRC'}</span>
          </button>

          {/* UNDO / REDO */}
          <div className="flex items-center space-x-0.5 bg-neutral-800/80 rounded border border-neutral-700/80 p-0.5">
            <button
              id="btn-undo"
              onClick={onUndo}
              disabled={!canUndo}
              className="p-1 rounded hover:bg-neutral-700 text-neutral-300 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Undo byte modification (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              id="btn-redo"
              onClick={onRedo}
              disabled={!canRedo}
              className="p-1 rounded hover:bg-neutral-700 text-neutral-300 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Redo byte modification (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* COMPARE */}
          <button
            id="btn-compare"
            onClick={onCompare}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs border border-neutral-700 transition-all active:scale-95"
            title="Compare active SPD against file or baseline snapshot"
          >
            <GitCompare className="w-3.5 h-3.5 text-purple-400" />
            <span>Compare</span>
          </button>

          {/* LOCK / UNLOCK */}
          <div className="flex items-center space-x-0.5 bg-neutral-800/80 rounded border border-neutral-700/80 p-0.5">
            <button
              id="btn-unlock"
              onClick={onUnlock}
              disabled={!isConnected || isBusy}
              className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-neutral-700 text-neutral-300 text-xs disabled:opacity-30"
              title="Send UNLOCK sequence to EEPROM"
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Unlock</span>
            </button>
            <button
              id="btn-lock"
              onClick={onLock}
              disabled={!isConnected || isBusy}
              className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-neutral-700 text-neutral-300 text-xs disabled:opacity-30"
              title="Enable Hardware / Software Write Protection"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Lock ROM</span>
            </button>
          </div>
        </div>

        {/* Right Section: File Operations & Sample Library */}
        <div className="flex items-center space-x-1.5">
          {/* Samples Library */}
          <button
            id="btn-samples"
            onClick={onOpenSampleModal}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 text-xs font-medium transition-all"
            title="Load verified JEDEC DDR3/DDR4/XMP sample SPD dumps"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>SPD Library</span>
          </button>

          <div className="h-6 w-px bg-neutral-700/60 mx-0.5" />

          {/* Open SPD File */}
          <button
            id="btn-open-file"
            onClick={onOpenFile}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-all"
            title="Open SPD file (.bin, .hex, .spd, .txt)"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Open SPD</span>
          </button>

          {/* Save SPD Dropdown */}
          <div className="relative group">
            <button
              id="btn-save-spd"
              onClick={() => onSaveFile('bin')}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-all"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span>Save SPD (.bin)</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
