import {
  ConnectionStatus,
  HardwareDeviceType,
  IProgrammerDriver,
  LockStatus,
  LogLevel,
  ProgrammerConfig,
  SlotInfo,
  SPDByteDiff
} from '../types';
import { SimulationDriver } from './drivers/SimulationDriver';
import { CH341ADriver } from './drivers/CH341ADriver';
import { SPDUSBDriver } from './drivers/SPDUSBDriver';
import { RT809HDriver } from './drivers/RT809HDriver';
import { ESP32BridgeDriver } from './drivers/ESP32BridgeDriver';

export class ProgrammerManager {
  private static instance: ProgrammerManager;

  private drivers: Map<HardwareDeviceType, IProgrammerDriver> = new Map();
  private currentDeviceType: HardwareDeviceType = HardwareDeviceType.SIMULATION;
  private currentDriver: IProgrammerDriver;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private currentSlots: SlotInfo[] = [];
  private selectedSlotIndex: number = 0;

  // Event callbacks
  private onStatusChange?: (status: ConnectionStatus) => void;
  private onLog?: (level: LogLevel, message: string, details?: string) => void;
  private onSlotsUpdated?: (slots: SlotInfo[]) => void;

  private constructor() {
    // Register all drivers
    const simDriver = new SimulationDriver();
    this.drivers.set(HardwareDeviceType.SIMULATION, simDriver);
    this.drivers.set(HardwareDeviceType.CH341A, new CH341ADriver());
    this.drivers.set(HardwareDeviceType.SPDBURN_USB, new SPDUSBDriver());
    this.drivers.set(HardwareDeviceType.RT809H, new RT809HDriver());
    this.drivers.set(HardwareDeviceType.ESP32_BRIDGE, new ESP32BridgeDriver());

    this.currentDriver = simDriver;
  }

  public static getInstance(): ProgrammerManager {
    if (!ProgrammerManager.instance) {
      ProgrammerManager.instance = new ProgrammerManager();
    }
    return ProgrammerManager.instance;
  }

  public setCallbacks(
    onStatusChange: (status: ConnectionStatus) => void,
    onLog: (level: LogLevel, message: string, details?: string) => void,
    onSlotsUpdated: (slots: SlotInfo[]) => void
  ) {
    this.onStatusChange = onStatusChange;
    this.onLog = onLog;
    this.onSlotsUpdated = onSlotsUpdated;
  }

  public getDeviceType(): HardwareDeviceType {
    return this.currentDeviceType;
  }

  public setDeviceType(type: HardwareDeviceType) {
    if (this.connectionStatus === ConnectionStatus.CONNECTED) {
      this.disconnect();
    }
    this.currentDeviceType = type;
    const driver = this.drivers.get(type);
    if (driver) {
      this.currentDriver = driver;
      this.log(LogLevel.INFO, `Hardware selector switched to: ${driver.name}`);
    }
  }

  public getDriver(): IProgrammerDriver {
    return this.currentDriver;
  }

  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  public isConnected(): boolean {
    return this.connectionStatus === ConnectionStatus.CONNECTED && this.currentDriver.isConnected();
  }

  public isSimulation(): boolean {
    return this.currentDriver.isSimulation();
  }

  public getSelectedSlot(): number {
    return this.selectedSlotIndex;
  }

  public setSelectedSlot(slotIndex: number) {
    this.selectedSlotIndex = slotIndex;
    this.log(LogLevel.INFO, `Target active slot changed to Slot ${slotIndex} (I2C 0x${(0x50 + slotIndex).toString(16).toUpperCase()})`);
  }

  public getSlots(): SlotInfo[] {
    return this.currentSlots;
  }

  public async connect(config?: Partial<ProgrammerConfig>): Promise<boolean> {
    try {
      this.updateStatus(ConnectionStatus.CONNECTING);
      this.log(LogLevel.INFO, `Initiating connection to ${this.currentDriver.name}...`);

      const success = await this.currentDriver.connect(config);
      if (success) {
        this.updateStatus(ConnectionStatus.CONNECTED);
        this.log(LogLevel.SUCCESS, `Successfully connected to ${this.currentDriver.name}`);

        if (this.currentDriver.isSimulation()) {
          this.log(LogLevel.WARNING, 'Running in [SIMULATION MODE]. Virtual hardware slots active for safe testing.');
        }

        // Auto scan slots on connect
        await this.scanSlots();
        return true;
      } else {
        this.updateStatus(ConnectionStatus.DISCONNECTED);
        this.log(LogLevel.ERROR, `Failed to connect to ${this.currentDriver.name}`);
        return false;
      }
    } catch (error: any) {
      this.updateStatus(ConnectionStatus.ERROR);
      this.log(LogLevel.ERROR, `Connection failed: ${error?.message || error}`);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      this.log(LogLevel.INFO, `Disconnecting ${this.currentDriver.name}...`);
      await this.currentDriver.disconnect();
      this.updateStatus(ConnectionStatus.DISCONNECTED);
      this.log(LogLevel.INFO, 'Hardware interface disconnected.');
    } catch (e: any) {
      this.updateStatus(ConnectionStatus.DISCONNECTED);
    }
  }

  public async scanSlots(): Promise<SlotInfo[]> {
    if (!this.isConnected()) {
      this.log(LogLevel.WARNING, 'Cannot scan: Hardware not connected.');
      return [];
    }

    try {
      this.log(LogLevel.INFO, 'Scanning I2C / SMBus addresses 0x50 - 0x57 for memory modules...');
      const slots = await this.currentDriver.scanSlots();
      this.currentSlots = slots;
      this.onSlotsUpdated?.(slots);

      const detectedCount = slots.filter(s => s.detected).length;
      this.log(LogLevel.SUCCESS, `Scan complete: Found ${detectedCount} active RAM module(s) across ${slots.length} slots.`);

      slots.forEach(s => {
        if (s.detected) {
          this.log(
            LogLevel.INFO,
            `  • Slot ${s.index} (0x${s.i2cAddress.toString(16).toUpperCase()}): ${s.type || 'RAM'} | ${s.capacity || ''} | ${s.manufacturer || ''} ${s.partNumber || ''} [${s.status}]`
          );
        }
      });

      return slots;
    } catch (error: any) {
      this.log(LogLevel.ERROR, `Slot scan failed: ${error?.message || error}`);
      throw error;
    }
  }

  public async readSPD(
    slotIndex: number = this.selectedSlotIndex,
    length: number = 512,
    onProgress?: (progress: number, step: string) => void
  ): Promise<Uint8Array> {
    if (!this.isConnected()) {
      throw new Error('Hardware is not connected. Please click "Connect" first.');
    }

    try {
      this.updateStatus(ConnectionStatus.BUSY);
      this.log(LogLevel.INFO, `Initiating SPD read on Slot ${slotIndex} (I2C address 0x${(0x50 + slotIndex).toString(16).toUpperCase()}), size ${length} bytes...`);

      const data = await this.currentDriver.readSPD(slotIndex, length, (p, step) => {
        onProgress?.(p, step);
      });

      this.updateStatus(ConnectionStatus.CONNECTED);
      this.log(LogLevel.SUCCESS, `READ SPD SUCCESS: Received ${data.length} bytes from Slot ${slotIndex}.`);
      return data;
    } catch (error: any) {
      this.updateStatus(ConnectionStatus.CONNECTED);
      this.log(LogLevel.ERROR, `READ SPD FAILED: ${error?.message || error}`);
      throw error;
    }
  }

  public async writeSPD(
    slotIndex: number = this.selectedSlotIndex,
    data: Uint8Array,
    onProgress?: (progress: number, step: string) => void
  ): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Hardware is not connected. Cannot write SPD.');
    }

    try {
      this.updateStatus(ConnectionStatus.BUSY);
      this.log(LogLevel.WARNING, `Starting EEPROM flash write to Slot ${slotIndex} (${data.length} bytes)...`);

      const success = await this.currentDriver.writeSPD(slotIndex, data, onProgress);
      this.updateStatus(ConnectionStatus.CONNECTED);

      if (success) {
        this.log(LogLevel.SUCCESS, `WRITE SPD SUCCESS: Slot ${slotIndex} flashed and verified successfully.`);
        return true;
      } else {
        this.log(LogLevel.ERROR, `WRITE SPD FAILED: Verification or hardware error on Slot ${slotIndex}.`);
        return false;
      }
    } catch (error: any) {
      this.updateStatus(ConnectionStatus.CONNECTED);
      this.log(LogLevel.ERROR, `WRITE SPD FAILED: ${error?.message || error}`);
      throw error;
    }
  }

  public async verifySPD(
    slotIndex: number = this.selectedSlotIndex,
    expectedData: Uint8Array,
    onProgress?: (progress: number, step: string) => void
  ): Promise<{ matched: boolean; mismatches: SPDByteDiff[] }> {
    if (!this.isConnected()) {
      throw new Error('Hardware is not connected. Cannot verify SPD.');
    }

    try {
      this.updateStatus(ConnectionStatus.BUSY);
      this.log(LogLevel.INFO, `Verifying Slot ${slotIndex} against buffer (${expectedData.length} bytes)...`);

      const result = await this.currentDriver.verifySPD(slotIndex, expectedData, onProgress);
      this.updateStatus(ConnectionStatus.CONNECTED);

      if (result.matched) {
        this.log(LogLevel.SUCCESS, `VERIFY SUCCESS: 100% match (${expectedData.length} bytes identical).`);
      } else {
        this.log(LogLevel.ERROR, `VERIFY FAILED: ${result.mismatches.length} byte difference(s) detected.`);
      }

      return result;
    } catch (error: any) {
      this.updateStatus(ConnectionStatus.CONNECTED);
      this.log(LogLevel.ERROR, `VERIFY ERROR: ${error?.message || error}`);
      throw error;
    }
  }

  public async lock(slotIndex: number = this.selectedSlotIndex): Promise<boolean> {
    if (!this.isConnected()) throw new Error('Not connected');
    this.log(LogLevel.WARNING, `Sending LOCK ROM command to EEPROM on Slot ${slotIndex}...`);
    const success = await this.currentDriver.lock(slotIndex);
    if (success) {
      this.log(LogLevel.SUCCESS, `LOCK SUCCESS: Slot ${slotIndex} write protection enabled.`);
      await this.scanSlots();
    }
    return success;
  }

  public async unlock(slotIndex: number = this.selectedSlotIndex): Promise<boolean> {
    if (!this.isConnected()) throw new Error('Not connected');
    this.log(LogLevel.INFO, `Sending UNLOCK ROM sequence to EEPROM on Slot ${slotIndex}...`);
    const success = await this.currentDriver.unlock(slotIndex);
    if (success) {
      this.log(LogLevel.SUCCESS, `UNLOCK SUCCESS: Slot ${slotIndex} is now writable.`);
      await this.scanSlots();
    }
    return success;
  }

  public async getDeviceInfo() {
    return this.currentDriver.getDeviceInfo();
  }

  private updateStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
    this.onStatusChange?.(status);
  }

  public log(level: LogLevel, message: string, details?: string) {
    this.onLog?.(level, message, details);
  }
}
