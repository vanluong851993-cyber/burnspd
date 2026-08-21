import React from 'react';
import { X, Sparkles, Download, Cpu, CheckCircle2 } from 'lucide-react';
import { SAMPLE_SPD_LIBRARY } from '../spd/sampleDumps';
import { SampleSPD } from '../types';

interface SampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (sample: SampleSPD) => void;
}

export const SampleModal: React.FC<SampleModalProps> = ({
  isOpen,
  onClose,
  onSelectSample
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-full max-w-3xl overflow-hidden text-neutral-200 font-mono text-xs flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">JEDEC Standard Verified SPD Dumps Library</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          <div className="text-neutral-400 text-xs font-sans">
            Select a verified real-world SPD binary dump from major DRAM manufacturers (Samsung, SK Hynix, Micron, Kingston, Corsair) to test features, timing modifications, and CRC calculations:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SAMPLE_SPD_LIBRARY.map(s => (
              <div
                key={s.id}
                className="bg-neutral-950 border border-neutral-800 hover:border-indigo-600/80 rounded-lg p-3 space-y-2 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-100 text-xs truncate" title={s.name}>
                      {s.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-indigo-300 text-[10px] font-bold">
                      {s.type}
                    </span>
                  </div>

                  <div className="text-[11px] text-amber-300 font-bold mt-1">
                    Part#: {s.partNumber}
                  </div>

                  <div className="text-[11px] text-neutral-400 mt-0.5">
                    {s.capacity} • {s.formFactor} • {s.speed}
                  </div>

                  <div className="text-[10px] text-neutral-500 font-sans mt-1">
                    {s.description}
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
                  <span className="text-[10px] text-neutral-600">
                    Size: {s.bytes.length} Bytes
                  </span>
                  <button
                    onClick={() => {
                      onSelectSample(s);
                      onClose();
                    }}
                    className="flex items-center space-x-1 px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-semibold text-xs shadow transition-all active:scale-95"
                  >
                    <Download className="w-3 h-3" />
                    <span>Load Into Editor</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-neutral-950 border-t border-neutral-800 text-right">
          <button onClick={onClose} className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
