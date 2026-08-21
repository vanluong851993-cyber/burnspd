import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Upload,
  ShieldAlert,
  Wrench,
  Download,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { SPDParsedInfo, LockStatus } from '../types';

interface SafetyWriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetSlot: number;
  dataLength: number;
  spdInfo: SPDParsedInfo | null;
  lockStatus: LockStatus;
  isWriting: boolean;
  writeProgress: number;
  writeStep: string;
  onConfirmWrite: (autoFixCrc: boolean, createBackupFirst: boolean) => void;
  onBackupNow: () => void;
}

export const SafetyWriteModal: React.FC<SafetyWriteModalProps> = ({
  isOpen,
  onClose,
  targetSlot,
  dataLength,
  spdInfo,
  lockStatus,
  isWriting,
  writeProgress,
  writeStep,
  onConfirmWrite,
  onBackupNow
}) => {
  if (!isOpen) return null;

  const [autoFixCrc, setAutoFixCrc] = useState<boolean>(true);
  const [createBackupFirst, setCreateBackupFirst] = useState<boolean>(true);
  const [userConfirmed, setUserConfirmed] = useState<boolean>(false);

  const isCrcValid = spdInfo?.crcBase.isValid ?? true;
  const isLocked = lockStatus === LockStatus.LOCKED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none">
      <div className="bg-neutral-900 border border-amber-600/80 rounded-lg shadow-2xl w-full max-w-xl overflow-hidden text-neutral-200 font-mono text-xs">
        {/* Header with High-Visibility Warning Banner */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-950/80 border-b border-amber-700/80">
          <div className="flex items-center space-x-2 text-amber-300 font-bold">
            <AlertTriangle className="w-5 h-5 text-amber-400 animate-bounce" />
            <span className="text-sm">CONFIRM WRITE SPD TO EEPROM</span>
          </div>
          {!isWriting && (
            <button onClick={onClose} className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {isWriting ? (
            /* Flashing In-Progress Screen */
            <div className="py-8 space-y-4 text-center">
              <RefreshCw className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
              <div className="text-sm font-bold text-amber-300">{writeStep}</div>
              <div className="w-full bg-neutral-950 rounded-full h-3 overflow-hidden border border-neutral-800">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-200"
                  style={{ width: `${writeProgress}%` }}
                />
              </div>
              <div className="text-neutral-400 text-xs font-mono">{writeProgress}% Flashed & Verified</div>
              <div className="text-rose-400 text-[11px] font-bold animate-pulse">
                DO NOT DISCONNECT USB PROGRAMMER OR REMOVE RAM MODULE
              </div>
            </div>
          ) : (
            /* Safety Confirmation Checklist */
            <>
              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded space-y-2 text-xs">
                <div className="text-neutral-400 font-bold uppercase text-[11px] border-b border-neutral-800 pb-1">
                  Target RAM Module Specifications:
                </div>
                <div className="grid grid-cols-2 gap-2 text-neutral-300">
                  <div>• Slot: <span className="text-amber-400 font-bold">Slot {targetSlot} (I2C 0x{(0x50 + targetSlot).toString(16).toUpperCase()})</span></div>
                  <div>• Flash Size: <span className="text-white font-bold">{dataLength} Bytes</span></div>
                  <div>• Memory Type: <span className="text-sky-300 font-bold">{spdInfo?.memoryType || 'RAM'} {spdInfo?.formFactor || ''}</span></div>
                  <div>• Capacity: <span className="text-emerald-400 font-bold">{spdInfo?.organization.totalCapacityFormatted || 'N/A'}</span></div>
                  <div>• Part Number: <span className="text-amber-300 font-bold">{spdInfo?.modulePartNumber || 'N/A'}</span></div>
                  <div>• Speed: <span className="text-neutral-200">{spdInfo?.timings.speedRating || 'N/A'}</span></div>
                </div>
              </div>

              {/* CRC Safety Warning */}
              {!isCrcValid && (
                <div className="p-3 rounded bg-rose-950/80 border border-rose-700 space-y-2">
                  <div className="flex items-center space-x-2 text-rose-300 font-bold">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>CRC CHECKSUM INVALID WARNING</span>
                  </div>
                  <div className="text-rose-200 text-xs">
                    The active buffer has an invalid CRC checksum (Stored: 0x{spdInfo?.crcBase.stored.toString(16).toUpperCase().padStart(4, '0')} ≠ Calc: 0x{spdInfo?.crcBase.calculated.toString(16).toUpperCase().padStart(4, '0')}).
                    Flashing corrupted CRC will prevent BIOS from initializing the RAM module!
                  </div>
                  <label className="flex items-center space-x-2 text-amber-300 font-bold cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={autoFixCrc}
                      onChange={e => setAutoFixCrc(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    <span>Automatically recalculate and fix CRC bytes before writing (RECOMMENDED)</span>
                  </label>
                </div>
              )}

              {/* Hardware Lock Status Check */}
              {isLocked && (
                <div className="p-3 rounded bg-amber-950/80 border border-amber-700 text-amber-300 text-xs space-y-1">
                  <div className="font-bold flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    <span>ROM IS CURRENTLY LOCKED</span>
                  </div>
                  <div>Programmer will attempt to send UNLOCK sequence prior to flashing.</div>
                </div>
              )}

              {/* Backup Option */}
              <div className="flex items-center justify-between p-2.5 bg-neutral-950 border border-neutral-800 rounded">
                <label className="flex items-center space-x-2 text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createBackupFirst}
                    onChange={e => setCreateBackupFirst(e.target.checked)}
                    className="rounded accent-sky-500"
                  />
                  <span>Create automatic local backup dump before writing</span>
                </label>
                <button
                  type="button"
                  onClick={onBackupNow}
                  className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 text-[11px] underline"
                >
                  <Download className="w-3 h-3" />
                  <span>Download .bin backup now</span>
                </button>
              </div>

              {/* Final User Confirmation Checkbox */}
              <label className="flex items-start space-x-2.5 p-2 bg-neutral-950/80 border border-neutral-800 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={userConfirmed}
                  onChange={e => setUserConfirmed(e.target.checked)}
                  className="mt-0.5 rounded accent-amber-500"
                />
                <span className="text-neutral-300 text-xs">
                  I understand that writing incorrect SPD data or incorrect timings to memory module EEPROM may cause boot failure or memory initialization error. I want to proceed with programming.
                </span>
              </label>
            </>
          )}
        </div>

        {/* Footer Buttons */}
        {!isWriting && (
          <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium"
            >
              Cancel
            </button>

            <button
              id="btn-confirm-write"
              onClick={() => onConfirmWrite(autoFixCrc, createBackupFirst)}
              disabled={!userConfirmed}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-amber-600"
            >
              <Upload className="w-4 h-4" />
              <span>Program EEPROM Now</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
