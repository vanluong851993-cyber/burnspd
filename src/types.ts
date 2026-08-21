export enum MemoryType {
  DDR3 = 'DDR3',
  DDR3L = 'DDR3L',
  DDR4 = 'DDR4',
  DDR5 = 'DDR5',
  DDR2 = 'DDR2',
  UNKNOWN = 'UNKNOWN'
}

export enum ModuleFormFactor {
  UDIMM = 'UDIMM (Desktop)',
  SODIMM = 'SO-DIMM (Laptop)',
  RDIMM = 'RDIMM (Registered Server)',
  LRDIMM = 'LRDIMM (Load-Reduced)',
  MINI_UDIMM = 'Mini-UDIMM',
  MINI_RDIMM = 'Mini-RDIMM',
  MICRO_DIMM = 'Micro-DIMM',
  UNKNOWN = 'Unknown Form Factor'
}

export enum HardwareDeviceType {
  SIMULATION = 'SIMULATION',
  CH341A = 'CH341A',
  SPDBURN_USB = 'SPDBURN_USB',
  RT809H = 'RT809H',
  ESP32_BRIDGE = 'ESP32_BRIDGE',
  WEBSERIAL_GENERIC = 'WEBSERIAL_GENERIC'
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  BUSY = 'BUSY',
  ERROR = 'ERROR'
}

export enum LockStatus {
  UNLOCKED = 'UNLOCKED',
  LOCKED = 'LOCKED',
  PERMANENTLY_LOCKED = 'PERMANENTLY_LOCKED',
  UNKNOWN = 'UNKNOWN'
}

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  PROTOCOL = 'PROTOCOL'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
}

export interface SlotInfo {
  index: number;
  i2cAddress: number; // e.g. 0x50, 0x51, 0x52, 0x53
  detected: boolean;
  type?: MemoryType;
  capacity?: string;
  partNumber?: string;
  manufacturer?: string;
  status: 'Ready' | 'Empty' | 'Busy' | 'Protected' | 'Error';
}

export interface JEDECManufacturer {
  bank: number;
  byte: number;
  name: string;
  code: string;
}

export interface TimingData {
  tCKmin: number; // ns
  frequencyMHz: number;
  speedRating: string; // e.g. DDR4-3200
  tAA_CL: number; // CAS Latency in clocks / ns
  tRCD: number; // ns
  tRP: number; // ns
  tRAS: number; // ns
  tRC: number; // ns
  tFAW?: number; // ns
  tRRD_S?: number; // ns
  tRRD_L?: number; // ns
  tRFC1?: number; // ns
  tRFC2?: number; // ns
  tRFC4?: number; // ns
  supportedCLs: number[];
}

export interface ModuleOrganization {
  ranks: number;
  deviceWidth: string; // e.g. "x8", "x16", "x4"
  deviceDensityGb: number; // e.g. 8 Gb
  bankGroups?: number;
  banksPerGroup?: number;
  busWidthBits: number; // 64 or 72 (ECC)
  hasECC: boolean;
  totalCapacityBytes: number;
  totalCapacityFormatted: string; // e.g. "8 GB", "16 GB"
  dieCount?: number;
}

export interface SPDParsedInfo {
  isValid: boolean;
  rawSize: number;
  memoryType: MemoryType;
  formFactor: ModuleFormFactor;
  voltage: string; // e.g. "1.20 V", "1.50 V / 1.35 V"
  organization: ModuleOrganization;
  timings: TimingData;
  moduleManufacturer: string;
  moduleManufacturerCode: string;
  modulePartNumber: string;
  moduleSerialNumber: string;
  moduleMfgDate: string; // Week YY e.g. "Week 34, 2021"
  moduleMfgLocation: string;
  dramManufacturer: string;
  dramManufacturerCode: string;
  dramStepping?: string;
  spdRevision: string;
  rawBytesRead: number;
  
  // CRC Information
  crcBase: {
    stored: number;
    calculated: number;
    isValid: boolean;
    offsetStored: number;
    rangeCalculated: string;
  };
  crcModule?: {
    stored: number;
    calculated: number;
    isValid: boolean;
    offsetStored: number;
    rangeCalculated: string;
  };

  // Extended Profile
  xmp?: {
    detected: boolean;
    version: string;
    profile1?: {
      speedRating: string;
      frequencyMHz: number;
      voltage: string;
      timings: string;
    };
    profile2?: {
      speedRating: string;
      frequencyMHz: number;
      voltage: string;
      timings: string;
    };
  };

  // Field byte maps for hex editor highlighting
  byteMap: Record<number, { name: string; section: string; color: string }>;
}

export interface SPDByteDiff {
  offset: number;
  originalValue: number;
  currentValue: number;
  fieldName?: string;
}

export interface ProgrammerConfig {
  deviceType: HardwareDeviceType;
  portName?: string;
  baudRate?: number;
  i2cSpeedKhz?: number;
  selectedSlot: number;
  autoVerifyOnWrite: boolean;
  autoFixCrcOnWrite: boolean;
  voltage: '3.3V' | '2.5V' | '1.8V' | '1.2V';
  enableSimulation: boolean;
  simulationSlotCount: number;
}

export interface IProgrammerDriver {
  deviceType: HardwareDeviceType;
  name: string;
  description: string;
  connect(config?: Partial<ProgrammerConfig>): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  isSimulation(): boolean;
  scanSlots(): Promise<SlotInfo[]>;
  readSPD(slotIndex: number, length?: number, onProgress?: (progress: number, step: string) => void): Promise<Uint8Array>;
  writeSPD(slotIndex: number, data: Uint8Array, onProgress?: (progress: number, step: string) => void): Promise<boolean>;
  verifySPD(slotIndex: number, expectedData: Uint8Array, onProgress?: (progress: number, step: string) => void): Promise<{ matched: boolean; mismatches: SPDByteDiff[] }>;
  lock(slotIndex: number): Promise<boolean>;
  unlock(slotIndex: number): Promise<boolean>;
  getLockStatus(slotIndex: number): Promise<LockStatus>;
  getDeviceInfo(): Promise<{ name: string; version: string; serial?: string; voltage?: string }>;
}

export interface SampleSPD {
  id: string;
  name: string;
  type: MemoryType;
  formFactor: string;
  capacity: string;
  speed: string;
  partNumber: string;
  description: string;
  bytes: Uint8Array;
}
