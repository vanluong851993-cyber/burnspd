import React from 'react';
import { SPDParsedInfo, MemoryType } from '../types';
import {
  Cpu,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  Wrench,
  Zap,
  Info,
  Calendar,
  Hash,
  Layers,
  Sparkles
} from 'lucide-react';

interface SpdInfoPanelProps {
  spdInfo: SPDParsedInfo | null;
  onFixCRC: () => void;
}

export const SpdInfoPanel: React.FC<SpdInfoPanelProps> = ({ spdInfo, onFixCRC }) => {
  if (!spdInfo || !spdInfo.isValid) {
    return (
      <div className="bg-neutral-900/90 border-b border-neutral-800 p-4 text-center select-none">
        <div className="flex items-center justify-center space-x-2 text-neutral-400 text-xs font-mono">
          <Info className="w-4 h-4 text-sky-400" />
          <span>No SPD data loaded. Click "Read SPD" from hardware or "Open SPD" / "SPD Library" to view decoded specifications.</span>
        </div>
      </div>
    );
  }

  const {
    memoryType,
    formFactor,
    voltage,
    organization,
    timings,
    moduleManufacturer,
    moduleManufacturerCode,
    modulePartNumber,
    moduleSerialNumber,
    moduleMfgDate,
    dramManufacturer,
    crcBase,
    crcModule,
    xmp
  } = spdInfo;

  return (
    <div className="bg-neutral-900 border-b border-neutral-800 text-neutral-200 text-xs select-none">
      {/* Top Quick Badges Strip */}
      <div className="px-3 py-1.5 bg-neutral-950/70 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-neutral-400 font-semibold uppercase text-[11px]">SPD Profile:</span>
          <span className="px-2 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-700/60 font-bold">
            {memoryType} {formFactor}
          </span>
          <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold">
            {organization.totalCapacityFormatted}
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-bold">
            {timings.speedRating}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
            {voltage}
          </span>
        </div>

        {/* CRC Quick Summary & Fix Button */}
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-neutral-400 text-[11px]">Base CRC:</span>
          {crcBase.isValid ? (
            <span className="flex items-center space-x-1 text-emerald-400 px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-800 text-[11px]">
              <CheckCircle2 className="w-3 h-3" />
              <span>PASS (0x{crcBase.stored.toString(16).toUpperCase().padStart(4, '0')})</span>
            </span>
          ) : (
            <div className="flex items-center space-x-1.5">
              <span className="flex items-center space-x-1 text-rose-400 px-1.5 py-0.2 rounded bg-rose-950/80 border border-rose-700 text-[11px] font-bold">
                <XCircle className="w-3 h-3" />
                <span>FAIL (0x{crcBase.stored.toString(16).toUpperCase().padStart(4, '0')} ≠ Calc 0x{crcBase.calculated.toString(16).toUpperCase().padStart(4, '0')})</span>
              </span>
              <button
                onClick={onFixCRC}
                className="flex items-center space-x-1 px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold shadow"
              >
                <Wrench className="w-2.5 h-2.5" />
                <span>Fix CRC</span>
              </button>
            </div>
          )}

          {crcModule && (
            <>
              <span className="text-neutral-500 text-[11px]">| Mod CRC:</span>
              {crcModule.isValid ? (
                <span className="text-emerald-400 text-[11px]">PASS</span>
              ) : (
                <span className="text-rose-400 text-[11px] font-bold">FAIL</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Multi-Column Decoded Technical Specification */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-neutral-800">
        {/* Column 1: Module Identity & Manufacturer */}
        <div className="bg-neutral-900 p-2.5 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-sky-400 font-mono font-semibold text-[11px] border-b border-neutral-800 pb-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>MODULE IDENTITY</span>
          </div>

          <div className="grid grid-cols-3 gap-1 font-mono text-[11px]">
            <span className="text-neutral-400">Module Mfg:</span>
            <span className="col-span-2 text-neutral-100 font-semibold truncate" title={moduleManufacturer}>
              {moduleManufacturer}
            </span>

            <span className="text-neutral-400">JEDEC Code:</span>
            <span className="col-span-2 text-neutral-300 font-mono">
              {moduleManufacturerCode}
            </span>

            <span className="text-neutral-400">Part Number:</span>
            <span className="col-span-2 text-amber-300 font-bold truncate" title={modulePartNumber}>
              {modulePartNumber}
            </span>

            <span className="text-neutral-400">Serial No:</span>
            <span className="col-span-2 text-neutral-300 font-mono tracking-wider">
              {moduleSerialNumber}
            </span>

            <span className="text-neutral-400">Mfg Date:</span>
            <span className="col-span-2 text-neutral-300">
              {moduleMfgDate}
            </span>
          </div>
        </div>

        {/* Column 2: DRAM Chips & Organization */}
        <div className="bg-neutral-900 p-2.5 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-mono font-semibold text-[11px] border-b border-neutral-800 pb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>DRAM ARCHITECTURE</span>
          </div>

          <div className="grid grid-cols-3 gap-1 font-mono text-[11px]">
            <span className="text-neutral-400">DRAM Mfg:</span>
            <span className="col-span-2 text-neutral-100 font-semibold truncate">
              {dramManufacturer}
            </span>

            <span className="text-neutral-400">Capacity:</span>
            <span className="col-span-2 text-emerald-300 font-bold">
              {organization.totalCapacityFormatted} ({organization.deviceDensityGb} Gb Density)
            </span>

            <span className="text-neutral-400">Ranks:</span>
            <span className="col-span-2 text-neutral-200">
              {organization.ranks} Rank(s), {organization.deviceWidth} Width
            </span>

            <span className="text-neutral-400">Bus Width:</span>
            <span className="col-span-2 text-neutral-300">
              {organization.busWidthBits}-bit {organization.hasECC ? '(with ECC)' : '(Non-ECC)'}
            </span>

            <span className="text-neutral-400">Voltage:</span>
            <span className="col-span-2 text-neutral-300">
              {voltage} (VDD / VPP)
            </span>
          </div>
        </div>

        {/* Column 3: Speeds, Frequencies & Timings */}
        <div className="bg-neutral-900 p-2.5 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-amber-400 font-mono font-semibold text-[11px] border-b border-neutral-800 pb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>SPEED & JEDEC TIMINGS</span>
          </div>

          <div className="grid grid-cols-3 gap-1 font-mono text-[11px]">
            <span className="text-neutral-400">Speed Grade:</span>
            <span className="col-span-2 text-amber-300 font-bold">
              {timings.speedRating}
            </span>

            <span className="text-neutral-400">Cycle Time:</span>
            <span className="col-span-2 text-neutral-300">
              tCKmin = {timings.tCKmin} ns ({timings.frequencyMHz} MT/s)
            </span>

            <span className="text-neutral-400">Base Timings:</span>
            <span className="col-span-2 text-neutral-100 font-semibold">
              CL{timings.tAA_CL} - {timings.tRCD} - {timings.tRP} - {timings.tRAS}
            </span>

            <span className="text-neutral-400">tRC / tFAW:</span>
            <span className="col-span-2 text-neutral-300">
              tRC: {timings.tRC} ns | tFAW: {timings.tFAW || 'N/A'} ns
            </span>

            <span className="text-neutral-400">Supported CL:</span>
            <span className="col-span-2 text-neutral-400 text-[10px] truncate" title={timings.supportedCLs.join(', ')}>
              {timings.supportedCLs.map(c => `CL${c}`).join(', ')}
            </span>
          </div>
        </div>

        {/* Column 4: Profiles / CRC Diagnostic */}
        <div className="bg-neutral-900 p-2.5 space-y-1.5">
          <div className="flex items-center space-x-1.5 text-purple-400 font-mono font-semibold text-[11px] border-b border-neutral-800 pb-1">
            <Activity className="w-3.5 h-3.5" />
            <span>EXTENSIONS & INTEGRITY</span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            {xmp?.detected ? (
              <div className="p-1.5 rounded bg-purple-950/60 border border-purple-800/80">
                <div className="flex items-center space-x-1 text-purple-300 font-bold text-[10px]">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>{xmp.version} Enthusiast Profile</span>
                </div>
                <div className="text-[10px] text-purple-200 mt-0.5">
                  {xmp.profile1?.speedRating} @ {xmp.profile1?.voltage} ({xmp.profile1?.timings})
                </div>
              </div>
            ) : (
              <div className="text-neutral-400 text-[10px] italic">
                Standard JEDEC SPD Profile (No XMP Profile detected)
              </div>
            )}

            <div className="pt-1 text-[10px] text-neutral-400 space-y-0.5">
              <div>• Base CRC (0x7E-0x7F): <span className={crcBase.isValid ? 'text-emerald-400' : 'text-rose-400 font-bold'}>{crcBase.isValid ? 'VALID' : 'INVALID MISMATCH'}</span></div>
              {crcModule && <div>• Module CRC (0xFE-0xFF): <span className={crcModule.isValid ? 'text-emerald-400' : 'text-rose-400 font-bold'}>{crcModule.isValid ? 'VALID' : 'INVALID'}</span></div>}
              <div>• Total SPD EEPROM: {spdInfo.rawSize} Bytes</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
