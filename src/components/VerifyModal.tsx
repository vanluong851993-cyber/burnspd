import React from 'react';
import { X, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { SPDByteDiff } from '../types';

interface VerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isVerifying: boolean;
  verifyProgress: number;
  verifyStep: string;
  verifyResult: { matched: boolean; mismatches: SPDByteDiff[] } | null;
  totalBytes: number;
  onReverify: () => void;
}

export const VerifyModal: React.FC<VerifyModalProps> = ({
  isOpen,
  onClose,
  isVerifying,
  verifyProgress,
  verifyStep,
  verifyResult,
  totalBytes,
  onReverify
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden text-neutral-200 font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center space-x-2 text-sky-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">SPD Hardware Verification Report</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {isVerifying ? (
            <div className="py-6 space-y-3 text-center">
              <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
              <div className="text-sm font-bold text-sky-300">{verifyStep}</div>
              <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800">
                <div
                  className="bg-sky-500 h-full transition-all duration-200"
                  style={{ width: `${verifyProgress}%` }}
                />
              </div>
              <div className="text-neutral-400 text-xs">{verifyProgress}% Complete</div>
            </div>
          ) : verifyResult ? (
            <div className="space-y-4">
              {verifyResult.matched ? (
                <div className="p-4 rounded-lg bg-emerald-950/80 border border-emerald-700 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <div className="text-emerald-300 font-bold text-base">VERIFICATION PASSED (100% MATCH)</div>
                  <div className="text-emerald-200 text-xs">
                    All {totalBytes} bytes read back from physical RAM EEPROM match the editor buffer bit-for-bit.
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-rose-950/80 border border-rose-700 space-y-2">
                  <div className="flex items-center space-x-2 text-rose-300 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <span>VERIFICATION FAILED: {verifyResult.mismatches.length} MISMATCH(ES) DETECTED</span>
                  </div>
                  <div className="text-rose-200 text-xs">
                    Physical hardware EEPROM content does not match the active buffer. Review mismatched offsets below:
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-rose-800/80 rounded bg-neutral-950 p-2 mt-2">
                    <table className="w-full text-left text-xs">
                      <thead className="text-neutral-400 border-b border-neutral-800">
                        <tr>
                          <th className="p-1">Offset</th>
                          <th className="p-1 text-sky-400">Expected (Buffer)</th>
                          <th className="p-1 text-rose-400">Actual (Hardware)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900 font-mono">
                        {verifyResult.mismatches.map((m, idx) => (
                          <tr key={idx}>
                            <td className="p-1 text-amber-400 font-bold">
                              0x{m.offset.toString(16).toUpperCase().padStart(4, '0')} ({m.offset})
                            </td>
                            <td className="p-1 text-sky-300">
                              0x{m.currentValue.toString(16).toUpperCase().padStart(2, '0')}
                            </td>
                            <td className="p-1 text-rose-400 font-bold">
                              0x{m.originalValue.toString(16).toUpperCase().padStart(2, '0')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium">
            Close
          </button>
          <button
            onClick={onReverify}
            disabled={isVerifying}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white font-semibold shadow disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Run Verify Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
