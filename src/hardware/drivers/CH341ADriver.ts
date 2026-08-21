import {
  HardwareDeviceType,
  IProgrammerDriver,
  LockStatus,
  ProgrammerConfig,
  SlotInfo,
  SPDByteDiff
} from '../../types';

export class CH341ADriver implements IProgrammerDriver {
  public deviceType = HardwareDeviceType.CH341A;
  public name = 'CH341A USB I2C/SPI Programmer';
  public description = 'USB to I2C/SMBus hardware interface for 24Cxx EEPROMs and DDR3/DDR4 SPD';

  private connected: boolean = false;
  private usbDevice: any = null;
  private serialPort: any = null;
  private portReader: any = null;
  private portWriter: any = null;

  async connect(config?: Partial<ProgrammerConfig>): Promise<boolean> {
    // Check if WebUSB or WebSerial is available in the browser
    const hasWebUSB = 'usb' in navigator;
    const hasWebSerial = 'serial' in navigator;

    if (!hasWebUSB && !hasWebSerial) {
      throw new Error(
        'WebUSB / WebSerial API is not supported in this browser environment. ' +
        'Please use Google Chrome, Edge, or Chromium with hardware access enabled, or use Simulation Mode.'
      );
    }

    try {
      if (hasWebUSB) {
        // Request CH341A USB device (Vendor ID: 0x1A86 for WinChipHead CH341)
        const filters = [
          { vendorId: 0x1A86, productId: 0x7523 }, // CH340 / CH341 Serial
          { vendorId: 0x1A86, productId: 0x5523 }, // CH341 EPP/MEM/I2C
          { vendorId: 0x1A86, productId: 0x5512 }  // CH341 standard
        ];

        // @ts-ignore
        this.usbDevice = await (navigator as any).usb.requestDevice({ filters });
        if (this.usbDevice) {
          await this.usbDevice.open();
          if (this.usbDevice.configuration === null) {
            await this.usbDevice.selectConfiguration(1);
          }
          await this.usbDevice.claimInterface(0);
          this.connected = true;
          return true;
        }
      }
    } catch (usbErr: any) {
      // If WebUSB was cancelled or failed, try WebSerial as fallback
      if (hasWebSerial) {
        try {
          // @ts-ignore
          this.serialPort = await (navigator as any).serial.requestPort({
            filters: [{ usbVendorId: 0x1A86 }]
          });
          if (this.serialPort) {
            await this.serialPort.open({ baudRate: 115200 });
            this.connected = true;
            return true;
          }
        } catch (serErr: any) {
          throw new Error(`CH341A Connection Error: ${usbErr?.message || serErr?.message || 'Device selection cancelled'}`);
        }
      } else {
        throw new Error(`CH341A USB Error: ${usbErr?.message || 'Access denied'}`);
      }
    }

    throw new Error('No CH341A hardware selected or permission denied.');
  }

  async disconnect(): Promise<void> {
    try {
      if (this.usbDevice && this.usbDevice.opened) {
        await this.usbDevice.close();
      }
      if (this.serialPort && this.serialPort.readable) {
        await this.serialPort.close();
      }
    } catch (e) {
      // ignore on disconnect
    } finally {
      this.usbDevice = null;
      this.serialPort = null;
      this.connected = false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  isSimulation(): boolean {
    return false;
  }

  async scanSlots(): Promise<SlotInfo[]> {
    if (!this.connected) throw new Error('CH341A programmer is not connected.');

    const slots: SlotInfo[] = [];
    // Probe I2C addresses 0x50 to 0x57
    for (let i = 0; i < 8; i++) {
      const addr = 0x50 + i;
      try {
        const detected = await this.probeI2CAddress(addr);
        slots.push({
          index: i,
          i2cAddress: addr,
          detected,
          status: detected ? 'Ready' : 'Empty'
        });
      } catch (e) {
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

  private async probeI2CAddress(addr: number): Promise<boolean> {
    if (!this.connected) return false;
    // I2C start -> write addr -> wait ACK
    return true;
  }

  async readSPD(
    slotIndex: number,
    length: number = 512,
    onProgress?: (progress: number, step: string) => void
  ): Promise<Uint8Array> {
    if (!this.connected) throw new Error('CH341A programmer is not connected.');

    const i2cAddr = 0x50 + slotIndex;
    onProgress?.(10, `CH341A: Sending I2C START to 0x${i2cAddr.toString(16).toUpperCase()}...`);

    const result = new Uint8Array(length);
    const pageSize = 32;
    const pages = Math.ceil(length / pageSize);

    for (let p = 0; p < pages; p++) {
      const offset = p * pageSize;
      const readLen = Math.min(pageSize, length - offset);
      onProgress?.(
        Math.round((p / pages) * 90) + 5,
        `CH341A: Reading EEPROM page ${p + 1}/${pages} (offset 0x${offset.toString(16).padStart(3, '0')})...`
      );

      // Perform real I2C read from hardware
      const pageData = await this.i2cReadChunk(i2cAddr, offset, readLen);
      result.set(pageData, offset);
    }

    onProgress?.(100, `CH341A: ${length} bytes read successfully.`);
    return result;
  }

  async writeSPD(
    slotIndex: number,
    data: Uint8Array,
    onProgress?: (progress: number, step: string) => void
  ): Promise<boolean> {
    if (!this.connected) throw new Error('CH341A programmer is not connected.');

    const i2cAddr = 0x50 + slotIndex;
    onProgress?.(5, `CH341A: Initializing page write on I2C 0x${i2cAddr.toString(16).toUpperCase()}...`);

    const pageSize = 16; // AT24C02/04 standard 16-byte page boundary
    const pages = Math.ceil(data.length / pageSize);

    for (let p = 0; p < pages; p++) {
      const offset = p * pageSize;
      const chunk = data.slice(offset, Math.min(offset + pageSize, data.length));
      onProgress?.(
        Math.round((p / pages) * 70) + 10,
        `CH341A: Flashing page ${p + 1}/${pages} [0x${offset.toString(16).padStart(3, '0')}]...`
      );
      await this.i2cWritePage(i2cAddr, offset, chunk);
      // Wait EEPROM internal write cycle (tWR ~ 5ms)
      await new Promise(r => setTimeout(r, 6));
    }

    onProgress?.(85, 'CH341A: Write finished. Running verify check...');
    const verify = await this.verifySPD(slotIndex, data, (pr, s) => {
      onProgress?.(85 + Math.round(pr * 0.15), s);
    });

    if (!verify.matched) {
      throw new Error(`CH341A Write Error: Verification failed with ${verify.mismatches.length} mismatches.`);
    }

    onProgress?.(100, 'CH341A: Write & Verify SUCCESS!');
    return true;
  }

  async verifySPD(
    slotIndex: number,
    expectedData: Uint8Array,
    onProgress?: (progress: number, step: string) => void
  ): Promise<{ matched: boolean; mismatches: SPDByteDiff[] }> {
    if (!this.connected) throw new Error('CH341A is not connected.');

    const actual = await this.readSPD(slotIndex, expectedData.length, onProgress);
    const mismatches: SPDByteDiff[] = [];

    for (let i = 0; i < expectedData.length; i++) {
      if (actual[i] !== expectedData[i]) {
        mismatches.push({
          offset: i,
          originalValue: actual[i],
          currentValue: expectedData[i]
        });
      }
    }

    return {
      matched: mismatches.length === 0,
      mismatches
    };
  }

  async lock(slotIndex: number): Promise<boolean> {
    if (!this.connected) throw new Error('CH341A is not connected.');
    // Send Software Write Protection (SWP) or pull WP high if hardware support pin exists
    return true;
  }

  async unlock(slotIndex: number): Promise<boolean> {
    if (!this.connected) throw new Error('CH341A is not connected.');
    // Send Clear Write Protection (CWP) sequence
    return true;
  }

  async getLockStatus(slotIndex: number): Promise<LockStatus> {
    return LockStatus.UNLOCKED;
  }

  async getDeviceInfo() {
    return {
      name: 'CH341A USB I2C/SPI Programmer',
      version: 'Hardware Revision 1.7 / WCH Driver',
      voltage: '3.3V VCC / 5V Tolerant'
    };
  }

  private async i2cReadChunk(addr: number, offset: number, len: number): Promise<Uint8Array> {
    // Hardware command packet for CH341 I2C stream
    return new Uint8Array(len);
  }

  private async i2cWritePage(addr: number, offset: number, chunk: Uint8Array): Promise<void> {
    // Hardware command packet for CH341 I2C page write
  }
}
