import React, { useState } from 'react';
import { X, GitCompare, ArrowRight, Check, AlertTriangle, FileCode, Sparkles } from 'lucide-react';
import { SPDByteDiff, SPDParsedInfo } from '../types';
import { parseSPD } from '../spd/spdParser';
import { SAMPLE_SPD_LIBRARY } from '../spd/sampleDumps';

interface CompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentData: Uint8Array;
  originalReadData: Uint8Array;
  onApplyCompareData: (newData: Uint8Array) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  isOpen,
  onClose,
  currentData,
  originalReadData,
  onApplyCompareData
}) => {
  if (!isOpen) return null;

  const [compareTarget, setCompareTarget] = useState<'original' | 'file' | 'sample'>('original');
  const [targetData, setTargetData] = useState<Uint8Array>(originalReadData);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_SPD_LIBRARY[0].id);

  // Compute Diffs
  const maxLen = Math.max(currentData.length, targetData.length);
  const diffs: SPDByteDiff[] = [];

  for (let i = 0; i < maxLen; i++) {
    const curVal = i < currentData.length ? currentData[i] : -1;
    const targetVal = i < targetData.length ? targetData[i] : -1;

    if (curVal !== targetVal) {
      diffs.push({
        offset: i,
        originalValue: curVal,
        currentValue: targetVal
      });
    }
  }

  const currentInfo = parseSPD(currentData);
  const targetInfo = parseSPD(targetData);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const buffer = new Uint8Array(reader.result as ArrayBuffer);
      setTargetData(buffer);
      setCompareTarget('file');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSelectSample = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    const sample = SAMPLE_SPD_LIBRARY.find(s => s.id === sampleId);
    if (sample) {
      setTargetData(new Uint8Array(sample.bytes));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-200 font-mono text-xs">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center space-x-2 text-purple-400 font-bold">
            <GitCompare className="w-4 h-4" />
            <span className="text-sm">SPD Data Compare & Difference Analyzer</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Source Selector Strip */}
        <div className="p-3 bg-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-neutral-400 font-semibold">Compare Active Buffer with:</span>
            <div className="flex items-center space-x-1 bg-neutral-950 p-0.5 rounded border border-neutral-800">
              <button
                onClick={() => { setCompareTarget('original'); setTargetData(originalReadData); }}
                className={`px-2.5 py-1 rounded text-xs transition-all ${
                  compareTarget === 'original' ? 'bg-neutral-800 text-amber-300 font-bold' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Original Initial Read
              </button>
              <button
                onClick={() => setCompareTarget('sample')}
                className={`px-2.5 py-1 rounded text-xs transition-all ${
                  compareTarget === 'sample' ? 'bg-neutral-800 text-amber-300 font-bold' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Sample Library
              </button>
              <label
                className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-all ${
                  compareTarget === 'file' ? 'bg-neutral-800 text-amber-300 font-bold' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Upload File (.bin/.spd)
                <input type="file" accept=".bin,.spd,.hex" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>

          {compareTarget === 'sample' && (
            <select
              value={selectedSampleId}
              onChange={e => handleSelectSample(e.target.value)}
              className="bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 focus:outline-none"
            >
              {SAMPLE_SPD_LIBRARY.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.partNumber})</option>
              ))}
            </select>
          )}

          {/* Stats Badge */}
          <div className="flex items-center space-x-2">
            {diffs.length === 0 ? (
              <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-bold">
                ✓ 100% IDENTICAL (0 Differences)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-700 text-rose-300 font-bold">
                ⚠️ {diffs.length} BYTE DIFFERENCE(S)
              </span>
            )}
          </div>
        </div>

        {/* High-Level SPD Spec Comparison Summary */}
        <div className="grid grid-cols-2 gap-px bg-neutral-800 border-b border-neutral-800 text-xs">
          <div className="bg-neutral-900 p-3 space-y-1">
            <div className="text-sky-400 font-bold border-b border-neutral-800 pb-1">
              CURRENT BUFFER (Active in Editor)
            </div>
            <div className="text-neutral-300 space-y-0.5">
              <div>Type: <span className="font-bold text-white">{currentInfo.memoryType} {currentInfo.formFactor}</span></div>
              <div>Capacity: <span className="text-emerald-400 font-bold">{currentInfo.organization.totalCapacityFormatted}</span></div>
              <div>Speed: <span className="text-amber-400">{currentInfo.timings.speedRating}</span></div>
              <div>Mfg / Part#: <span className="text-white">{currentInfo.moduleManufacturer}</span> - <span className="text-amber-300 font-bold">{currentInfo.modulePartNumber}</span></div>
              <div>CRC: <span className={currentInfo.crcBase.isValid ? 'text-emerald-400' : 'text-rose-400 font-bold'}>{currentInfo.crcBase.isValid ? 'PASS' : 'FAIL'}</span></div>
            </div>
          </div>

          <div className="bg-neutral-900 p-3 space-y-1">
            <div className="text-purple-400 font-bold border-b border-neutral-800 pb-1">
              COMPARE TARGET ({compareTarget.toUpperCase()})
            </div>
            <div className="text-neutral-300 space-y-0.5">
              <div>Type: <span className="font-bold text-white">{targetInfo.memoryType} {targetInfo.formFactor}</span></div>
              <div>Capacity: <span className="text-emerald-400 font-bold">{targetInfo.organization.totalCapacityFormatted}</span></div>
              <div>Speed: <span className="text-amber-400">{targetInfo.timings.speedRating}</span></div>
              <div>Mfg / Part#: <span className="text-white">{targetInfo.moduleManufacturer}</span> - <span className="text-amber-300 font-bold">{targetInfo.modulePartNumber}</span></div>
              <div>CRC: <span className={targetInfo.crcBase.isValid ? 'text-emerald-400' : 'text-rose-400 font-bold'}>{targetInfo.crcBase.isValid ? 'PASS' : 'FAIL'}</span></div>
            </div>
          </div>
        </div>

        {/* Detailed Byte Difference Table */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-neutral-400 font-bold mb-2 uppercase text-[11px]">
            Byte-Level Difference Listing ({diffs.length} entries):
          </div>

          {diffs.length === 0 ? (
            <div className="text-center py-10 text-neutral-500 italic">
              No differences found between active buffer and target data.
            </div>
          ) : (
            <div className="border border-neutral-800 rounded overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="p-2 w-24">Offset (HEX)</th>
                    <th className="p-2 w-20">Offset (DEC)</th>
                    <th className="p-2 w-32 text-sky-400">Current Value</th>
                    <th className="p-2 w-32 text-purple-400">Compare Value</th>
                    <th className="p-2">JEDEC Field Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono">
                  {diffs.map((d, i) => {
                    const fieldInfo = currentInfo.byteMap?.[d.offset] || targetInfo.byteMap?.[d.offset];
                    return (
                      <tr key={i} className="hover:bg-neutral-800/50">
                        <td className="p-2 text-amber-400 font-bold">
                          0x{d.offset.toString(16).toUpperCase().padStart(4, '0')}
                        </td>
                        <td className="p-2 text-neutral-400">{d.offset}</td>
                        <td className="p-2 text-sky-300 font-bold bg-sky-950/30">
                          {d.originalValue >= 0 ? `0x${d.originalValue.toString(16).toUpperCase().padStart(2, '0')} ('${d.originalValue >= 32 && d.originalValue <= 126 ? String.fromCharCode(d.originalValue) : '.'}')` : 'N/A'}
                        </td>
                        <td className="p-2 text-purple-300 font-bold bg-purple-950/30">
                          {d.currentValue >= 0 ? `0x${d.currentValue.toString(16).toUpperCase().padStart(2, '0')} ('${d.currentValue >= 32 && d.currentValue <= 126 ? String.fromCharCode(d.currentValue) : '.'}')` : 'N/A'}
                        </td>
                        <td className="p-2 text-neutral-300 font-sans">
                          {fieldInfo ? `${fieldInfo.section}: ${fieldInfo.name}` : 'Vendor / Generic Data'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium"
          >
            Close
          </button>

          {diffs.length > 0 && (
            <button
              onClick={() => {
                onApplyCompareData(new Uint8Array(targetData));
                onClose();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white font-semibold shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Compare Target Into Editor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
