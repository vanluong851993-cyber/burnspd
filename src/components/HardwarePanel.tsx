import React from 'react';
import {
  HardwareDeviceType,
  ConnectionStatus,
  SlotInfo,
  LockStatus
} from '../types';
import {
  RefreshCw,
  Zap,
  Shield,
  ShieldAlert,
  HardDrive,
  Radio,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface HardwarePanelProps {
  currentDeviceType: HardwareDeviceType;
  connectionStatus: ConnectionStatus;
  selectedSlot: number;
  slots: SlotInfo[];
  isScanning: boolean;
  voltage: string;
  lockStatus: LockStatus;
  onSelectDeviceType: (type: HardwareDeviceType) => void;
  onSelectSlot: (slotIndex: number) => void;
  onScanSlots: () => void;
  onVoltageChange: (voltage: string) => void;
}

export const HardwarePanel: React.FC<HardwarePanelProps> = ({
  currentDeviceType,
  connectionStatus,
  selectedSlot,
  slots,
  isScanning,
  voltage,
  lockStatus,
  onSelectDeviceType,
  onSelectSlot,
  onScanSlots,
  onVoltageChange
}) => {
  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;

  const hardwareTypes = [
    { type: HardwareDeviceType.SPDBURN_USB, label: 'SPD Burn (USB)', icon: Zap },
    { type: HardwareDeviceType.CH341A, label: 'CH341A', icon: HardDrive },
    { type: HardwareDeviceType.RT809H, label: 'RT809H/F', icon: Sliders },
    { type: HardwareDeviceType.ESP32_BRIDGE, label: 'ESP32 Bridge', icon: Radio },
    { type: HardwareDeviceType.SIMULATION, label: 'Simulation Mode', icon: RefreshCw }
  ];

  const currentSlotInfo = slots.find(s => s.index === selectedSlot);

  return (
    <div className="bg-neutral-900 border-b border-neutral-800 px-3 py-2 text-neutral-200 select-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Hardware Selector Buttons */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
            Hardware:
          </span>
          <div className="flex items-center space-x-1 bg-neutral-950 p-0.5 rounded-md border border-neutral-800">
            {hardwareTypes.map(h => {
              const Icon = h.icon;
              const isActive = currentDeviceType === h.type;
              return (
                <button
                  key={h.type}
                  onClick={() => onSelectDeviceType(h.type)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-neutral-800 text-amber-400 font-semibold shadow-sm border border-neutral-700'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-neutral-500'}`} />
                  <span>{h.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Slot Selection & Scan */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
              Target Slot:
            </span>
            <div className="flex items-center space-x-1">
              <select
                id="slot-selector"
                value={selectedSlot}
                onChange={e => onSelectSlot(Number(e.target.value))}
                className="bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1 text-xs font-mono text-amber-300 font-medium focus:outline-none focus:border-amber-500"
              >
                {Array.from({ length: 8 }).map((_, idx) => {
                  const sInfo = slots.find(s => s.index === idx);
                  const addrHex = `0x${(0x50 + idx).toString(16).toUpperCase()}`;
                  return (
                    <option key={idx} value={idx}>
                      Slot {idx} ({addrHex}) {sInfo?.detected ? `[${sInfo.type || 'Detected'}]` : '[Empty]'}
                    </option>
                  );
                })}
              </select>

              {/* Scan Button */}
              <button
                id="btn-scan-slots"
                onClick={onScanSlots}
                disabled={!isConnected || isScanning}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 transition-all active:scale-95 disabled:opacity-40"
                title="Scan I2C SMBus addresses 0x50-0x57 for active RAM SPD modules"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
              </button>
            </div>
          </div>

          <div className="h-5 w-px bg-neutral-800" />

          {/* Slot Quick Status Tag */}
          <div className="flex items-center space-x-2">
            {currentSlotInfo?.detected ? (
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-xs font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {currentSlotInfo.manufacturer ? `${currentSlotInfo.manufacturer} ` : ''}
                  {currentSlotInfo.capacity ? `${currentSlotInfo.capacity} ` : ''}
                  {currentSlotInfo.type || 'RAM'}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-neutral-500 text-xs font-mono">
                <AlertCircle className="w-3.5 h-3.5 text-neutral-500" />
                <span>Slot {selectedSlot}: No Module Detected</span>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-neutral-800" />

          {/* Voltage & Lock Protection Indicators */}
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-neutral-400 font-mono">VDDSPD:</span>
            <select
              value={voltage}
              onChange={e => onVoltageChange(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5 text-xs font-mono text-neutral-300 focus:outline-none"
            >
              <option value="3.3V">3.3V (DDR3/DDR4 Standard)</option>
              <option value="2.5V">2.5V (Low Voltage)</option>
              <option value="1.8V">1.8V (DDR5 Hub)</option>
              <option value="1.2V">1.2V (Direct SPD)</option>
            </select>

            {lockStatus === LockStatus.LOCKED ? (
              <span className="flex items-center space-x-1 text-amber-400 text-xs font-mono bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-700/60">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>WP: LOCKED</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-emerald-400 text-xs font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-700/60">
                <Shield className="w-3.5 h-3.5" />
                <span>WP: WRITE OK</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
