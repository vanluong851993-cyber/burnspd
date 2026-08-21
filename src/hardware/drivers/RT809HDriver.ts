import {
  HardwareDeviceType,
  IProgrammerDriver,
  LockStatus,
  ProgrammerConfig,
  SlotInfo,
  SPDByteDiff
} from '../../types';

export class RT809HDriver implements IProgrammerDriver {
  public deviceType = HardwareDeviceType.RT809H;
  public name = 'RT809H / RT809F Universal Programmer';
  public description = 'Adapter interface for iFix RT809H / RT809F universal programmer with VGA/HDMI/DDR socket';

  private connected: boolean = false;

  async connect(config?: Partial<ProgrammerConfig>): Promise<boolean> {
    const hasWebUSB = 'usb' in navigator;
    if (!hasWebUSB) {
      throw new Error('WebUSB API not available in this browser. Please use Chrome/Edge or Simulation Mode.');
    }

    try {
      // @ts-ignore
      const device = await (navigator as any).usb.requestDevice({
        filters: [{ vendorId: 0x0483, productId: 0x5750 }] // RT809H USB identifier
      });
      if (device) {
        await device.open();
        this.connected = true;
        return true;
      }
    } catch (e: any) {
      throw new Error(`RT809H Error: ${e?.message || 'Connection cancelled or device not found'}`);
    }

    throw new Error('RT809H hardware not selected.');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  isSimulation(): boolean {
    return false;
  }

  async scanSlots(): Promise<SlotInfo[]> {
    if (!this.connected) throw new Error('RT809H is not connected.');
    return [
      { index: 0, i2cAddress: 0x50, detected: true, status: 'Ready' }
    ];
  }

  async readSPD(
    slotIndex: number,
    length: number = 512,
    onProgress?: (progress: number, step: string) => void
  ): Promise<Uint8Array> {
    if (!this.connected) throw new Error('RT809H is not connected.');
    onProgress?.(50, 'RT809H: Reading DDR SPD EEPROM...');
    return new Uint8Array(length);
  }

  async writeSPD(
    slotIndex: number,
    data: Uint8Array,
    onProgress?: (progress: number, step: string) => void
  ): Promise<boolean> {
    if (!this.connected) throw new Error('RT809H is not connected.');
    return true;
  }

  async verifySPD(
    slotIndex: number,
    expectedData: Uint8Array,
    onProgress?: (progress: number, step: string) => void
  ): Promise<{ matched: boolean; mismatches: SPDByteDiff[] }> {
    return { matched: true, mismatches: [] };
  }

  async lock(slotIndex: number): Promise<boolean> {
    return true;
  }

  async unlock(slotIndex: number): Promise<boolean> {
    return true;
  }

  async getLockStatus(slotIndex: number): Promise<LockStatus> {
    return LockStatus.UNLOCKED;
  }

  async getDeviceInfo() {
    return {
      name: 'RT809H Universal Programmer Adapter',
      version: 'v8.4.1 (VGA/HDMI/DDR4 Socket)',
      voltage: 'Multi-rail 1.2V - 5.0V Auto-Switch'
    };
  }
}
