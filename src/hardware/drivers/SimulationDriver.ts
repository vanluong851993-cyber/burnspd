import {
  HardwareDeviceType,
  IProgrammerDriver,
  LockStatus,
  MemoryType,
  ProgrammerConfig,
  SlotInfo,
  SPDByteDiff
} from '../../types';
import { SAMPLE_SPD_LIBRARY } from '../../spd/sampleDumps';

export class SimulationDriver implements IProgrammerDriver {
  public deviceType = HardwareDeviceType.SIMULATION;
  public name = 'Virtual Simulation Engine';
  public description = 'Simulated 8-Slot SPD Programmer for testing, development, and offline editing';

  private connected: boolean = false;
  private virtualSlots: {
    data: Uint8Array;
    lockStatus: LockStatus;
    detected: boolean;
    type: MemoryType;
  }[] = [];

  constructor() {
    this.initVirtualSlots();
  }

  private initVirtualSlots() {
    this.virtualSlots = [
      // Slot 0: Samsung DDR4-3200 8GB
      {
        data: new Uint8Array(SAMPLE_SPD_LIBRARY[0].bytes),
        lockStatus: LockStatus.UNLOCKED,
        detected: true,
        type: MemoryType.DDR4
      },
      // Slot 1: SK Hynix DDR4-2666 16GB
      {
        data: new Uint8Array(SAMPLE_SPD_LIBRARY[1].bytes),
        lockStatus: LockStatus.UNLOCKED,
        detected: true,
        type: MemoryType.DDR4
      },
      // Slot 2: Empty
      {
        data: new Uint8Array(512),
        lockStatus: LockStatus.UNKNOWN,
        detected: false,
        type: MemoryType.UNKNOWN
      },
      // Slot 3: Samsung DDR3L-1600 4GB
      {
        data: new Uint8Array(SAMPLE_SPD_LIBRARY[5].bytes),
        lockStatus: LockStatus.LOCKED,
        detected: true,
        type: MemoryType.DDR3L
      },
      // Slots 4-7: Empty
      ...Array.from({ length: 4 }).map(() => ({
        data: new Uint8Array(512),
        lockStatus: LockStatus.UNKNOWN,
        detected: false,
        type: MemoryType.UNKNOWN
      }))
    ];
  }

  async connect(config?: Partial<ProgrammerConfig>): Promise<boolean> {
    await this.delay(350);
    this.connected = true;
    return true;
  }

  async disconnect(): Promise<void> {
    await this.delay(100);
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  isSimulation(): boolean {
    return true;
  }

  async scanSlots(): Promise<SlotInfo[]> {
    if (!this.connected) throw new Error('Programmer not connected.');
    await this.delay(300);

    const slots: SlotInfo[] = [];
    for (let i = 0; i < 8; i++) {
      const v = this.virtualSlots[i];
      const addr = 0x50 + i;

      if (v.detected) {
        slots.push({
          index: i,
          i2cAddress: addr,
          detected: true,
          type: v.type,
          capacity: v.type === MemoryType.DDR3L ? '4 GB' : (i === 1 ? '16 GB' : '8 GB'),
          partNumber: i === 0 ? 'M471A1K43EB1-CWE' : (i === 1 ? 'HMA82GU6CJR8N-VK' : 'M471B5173QH0-YK0'),
          manufacturer: i === 1 ? 'SK Hynix' : 'Samsung',
          status: v.lockStatus === LockStatus.LOCKED ? 'Protected' : 'Ready'
        });
      } else {
        slots.push({
          index: i,
          i2cAddress: addr,
          detected: false,
          status: 'Empty'
        });
      }
    }
    return slots;
  }

  async readSPD(
    slotIndex: number,
    length: number = 512,
    onProgress?: (progress: number, step: string) => void
  ): Promise<Uint8Array> {
    if (!this.connected) throw new Error('Programmer not connected.');
    if (slotIndex < 0 || slotIndex >= this.virtualSlots.length) {
      throw new Error(`Invalid slot index ${slotIndex}`);
    }

    const slot = this.virtualSlots[slotIndex];
    if (!slot.detected) {
      throw new Error(`No memory module detected in Slot ${slotIndex} (I2C 0x${(0x50 + slotIndex).toString(16).toUpperCase()}) - NACK received.`);
    }

    onProgress?.(5, 'Addressing I2C EEPROM at 0x' + (0x50 + slotIndex).toString(16).toUpperCase() + '...');
    await this.delay(120);

    const totalBytes = Math.min(length, slot.data.length);
    const blockSize = 64;
    const blocks = Math.ceil(totalBytes / blockSize);
    const result = new Uint8Array(totalBytes);

    for (let b = 0; b < blocks; b++) {
      const start = b * blockSize;
      const end = Math.min(start + blockSize, totalBytes);
      onProgress?.(
        Math.round((b / blocks) * 85) + 10,
        `Reading block ${b + 1}/${blocks} (0x${start.toString(16).padStart(3, '0')} - 0x${(end - 1).toString(16).padStart(3, '0')})...`
      );
      await this.delay(70);
      result.set(slot.data.slice(start, end), start);
    }

    onProgress?.(100, 'Read complete. Validating CRC...');
    await this.delay(60);

    return result;
  }

  async writeSPD(
    slotIndex: number,
    data: Uint8Array,
    onProgress?: (progress: number, step: string) => void
  ): Promise<boolean> {
    if (!this.connected) throw new Error('Programmer not connected.');
    if (slotIndex < 0 || slotIndex >= this.virtualSlots.length) {
      throw new Error(`Invalid slot index ${slotIndex}`);
    }

    const slot = this.virtualSlots[slotIndex];
    if (!slot.detected) {
      throw new Error(`Cannot write: Slot ${slotIndex} is empty.`);
    }

    if (slot.lockStatus === LockStatus.LOCKED) {
      throw new Error(`EEPROM Write Protected: Slot ${slotIndex} is LOCKED. Please unlock ROM before writing.`);
    }

    onProgress?.(5, 'Acquiring SMBus lock and unlocking page buffer...');
    await this.delay(150);

    const blockSize = 32; // Typical EEPROM page write size (16 or 32 bytes)
    const totalBytes = Math.min(data.length, slot.data.length);
    const blocks = Math.ceil(totalBytes / blockSize);

    for (let b = 0; b < blocks; b++) {
      const start = b * blockSize;
      const end = Math.min(start + blockSize, totalBytes);
      onProgress?.(
        Math.round((b / blocks) * 60) + 10,
        `Flashing Page ${b + 1}/${blocks} [Offset 0x${start.toString(16).padStart(3, '0')}]...`
      );
      await this.delay(60);
      slot.data.set(data.slice(start, end), start);
    }

    onProgress?.(75, 'Flashing complete. Executing hardware read-back verify...');
    await this.delay(150);

    // Verify written data
    const verifyResult = await this.verifySPD(slotIndex, data, (p, s) => {
      onProgress?.(75 + Math.round(p * 0.25), s);
    });

    if (!verifyResult.matched) {
      throw new Error(`Write Verification Failed: ${verifyResult.mismatches.length} byte mismatches detected.`);
    }

    onProgress?.(100, 'Write & Verification successful!');
    return true;
  }

  async verifySPD(
    slotIndex: number,
    expectedData: Uint8Array,
    onProgress?: (progress: number, step: string) => void
  ): Promise<{ matched: boolean; mismatches: SPDByteDiff[] }> {
    if (!this.connected) throw new Error('Programmer not connected.');
    const slot = this.virtualSlots[slotIndex];
    if (!slot.detected) throw new Error(`Slot ${slotIndex} is empty.`);

    onProgress?.(10, 'Reading EEPROM data for verification...');
    await this.delay(100);

    const mismatches: SPDByteDiff[] = [];
    const len = Math.min(expectedData.length, slot.data.length);

    for (let i = 0; i < len; i++) {
      if (slot.data[i] !== expectedData[i]) {
        mismatches.push({
          offset: i,
          originalValue: slot.data[i],
          currentValue: expectedData[i]
        });
      }
    }

    onProgress?.(100, `Verification finished: ${mismatches.length === 0 ? 'MATCH' : mismatches.length + ' differences'}`);
    return {
      matched: mismatches.length === 0,
      mismatches
    };
  }

  async lock(slotIndex: number): Promise<boolean> {
    if (!this.connected) throw new Error('Programmer not connected.');
    await this.delay(200);
    this.virtualSlots[slotIndex].lockStatus = LockStatus.LOCKED;
    return true;
  }

  async unlock(slotIndex: number): Promise<boolean> {
    if (!this.connected) throw new Error('Programmer not connected.');
    await this.delay(200);
    this.virtualSlots[slotIndex].lockStatus = LockStatus.UNLOCKED;
    return true;
  }

  async getLockStatus(slotIndex: number): Promise<LockStatus> {
    return this.virtualSlots[slotIndex]?.lockStatus ?? LockStatus.UNKNOWN;
  }

  async getDeviceInfo() {
    return {
      name: 'Virtual SPD Programmer Hardware Core',
      version: 'v2.6.4-SIM',
      serial: 'SIM-SPD-8942-01',
      voltage: '3.3V / 1.2V SPD'
    };
  }

  /**
   * Helper to set virtual slot data for custom test cases
   */
  setSlotData(slotIndex: number, data: Uint8Array, type: MemoryType) {
    if (this.virtualSlots[slotIndex]) {
      this.virtualSlots[slotIndex].data = new Uint8Array(data);
      this.virtualSlots[slotIndex].detected = true;
      this.virtualSlots[slotIndex].type = type;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
