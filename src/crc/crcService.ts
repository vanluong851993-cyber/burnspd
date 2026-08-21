import { MemoryType } from '../types';

/**
 * JEDEC Standard CRC-16 Calculation
 * Polynomial: 0x1021 (X^16 + X^12 + X^5 + 1)
 * Initial Value: 0x0000
 */
export function calculateJEDEC_CRC16(data: Uint8Array, start: number, length: number): number {
  let crc = 0x0000;
  const end = Math.min(start + length, data.length);

  for (let i = start; i < end; i++) {
    crc = crc ^ (data[i] << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc & 0xFFFF;
}

export interface CRCValidationResult {
  memoryType: MemoryType;
  baseCRC: {
    stored: number;
    calculated: number;
    isValid: boolean;
    offsetStored: number; // e.g. 126
    startOffset: number;
    length: number;
  };
  moduleCRC?: {
    stored: number;
    calculated: number;
    isValid: boolean;
    offsetStored: number; // e.g. 254
    startOffset: number;
    length: number;
  };
  isAllValid: boolean;
}

/**
 * Validate CRC for DDR3 / DDR4 / DDR5 SPD data
 */
export function validateSPD_CRC(data: Uint8Array, memoryType?: MemoryType): CRCValidationResult {
  const type = memoryType || detectMemoryTypeFromData(data);

  if (type === MemoryType.DDR4) {
    // DDR4 Base Section: Bytes 0-125 (126 bytes)
    const baseCalculated = calculateJEDEC_CRC16(data, 0, 126);
    const baseStored = data.length >= 128 ? (data[126] | (data[127] << 8)) : 0;
    const baseValid = baseStored === baseCalculated;

    // DDR4 Module Section: Bytes 128-253 (126 bytes)
    let moduleStored = 0;
    let moduleCalculated = 0;
    let moduleValid = true;

    if (data.length >= 256) {
      moduleCalculated = calculateJEDEC_CRC16(data, 128, 126);
      moduleStored = data[254] | (data[255] << 8);
      moduleValid = moduleStored === moduleCalculated;
    }

    return {
      memoryType: type,
      baseCRC: {
        stored: baseStored,
        calculated: baseCalculated,
        isValid: baseValid,
        offsetStored: 126,
        startOffset: 0,
        length: 126
      },
      moduleCRC: data.length >= 256 ? {
        stored: moduleStored,
        calculated: moduleCalculated,
        isValid: moduleValid,
        offsetStored: 254,
        startOffset: 128,
        length: 126
      } : undefined,
      isAllValid: baseValid && moduleValid
    };
  }

  if (type === MemoryType.DDR3 || type === MemoryType.DDR3L) {
    // DDR3 Base Section: Bytes 0-116 (or 0-125 depending on byte 0 bit 7)
    // JEDEC standard DDR3 SPD: 0-116 (117 bytes) or 0-125
    const count = (data[0] & 0x80) === 0 ? 117 : 126;
    const baseCalculated = calculateJEDEC_CRC16(data, 0, count);
    const baseStored = data.length >= 128 ? (data[126] | (data[127] << 8)) : 0;
    const baseValid = baseStored === baseCalculated;

    return {
      memoryType: type,
      baseCRC: {
        stored: baseStored,
        calculated: baseCalculated,
        isValid: baseValid,
        offsetStored: 126,
        startOffset: 0,
        length: count
      },
      isAllValid: baseValid
    };
  }

  // DDR5 or fallback
  if (type === MemoryType.DDR5 && data.length >= 512) {
    const baseCalculated = calculateJEDEC_CRC16(data, 0, 510);
    const baseStored = data[510] | (data[511] << 8);
    return {
      memoryType: type,
      baseCRC: {
        stored: baseStored,
        calculated: baseCalculated,
        isValid: baseStored === baseCalculated,
        offsetStored: 510,
        startOffset: 0,
        length: 510
      },
      isAllValid: baseStored === baseCalculated
    };
  }

  // Fallback check
  const fallbackCalc = calculateJEDEC_CRC16(data, 0, Math.min(126, data.length));
  const fallbackStored = data.length >= 128 ? (data[126] | (data[127] << 8)) : 0;
  return {
    memoryType: type,
    baseCRC: {
      stored: fallbackStored,
      calculated: fallbackCalc,
      isValid: fallbackStored === fallbackCalc,
      offsetStored: 126,
      startOffset: 0,
      length: Math.min(126, data.length)
    },
    isAllValid: fallbackStored === fallbackCalc
  };
}

/**
 * Fix CRC values in-place on a copy of the SPD buffer without altering any other bytes!
 */
export function fixSPD_CRC(data: Uint8Array, memoryType?: MemoryType): { updatedData: Uint8Array; changedOffsets: number[]; baseCRC: number; moduleCRC?: number } {
  const result = new Uint8Array(data);
  const type = memoryType || detectMemoryTypeFromData(result);
  const changedOffsets: number[] = [];

  if (type === MemoryType.DDR4) {
    // Fix Base CRC (Bytes 126, 127)
    if (result.length >= 128) {
      const baseCRC = calculateJEDEC_CRC16(result, 0, 126);
      const lsb = baseCRC & 0xFF;
      const msb = (baseCRC >> 8) & 0xFF;

      if (result[126] !== lsb) {
        result[126] = lsb;
        changedOffsets.push(126);
      }
      if (result[127] !== msb) {
        result[127] = msb;
        changedOffsets.push(127);
      }

      let moduleCRCVal: number | undefined;
      // Fix Module CRC (Bytes 254, 255)
      if (result.length >= 256) {
        const moduleCRC = calculateJEDEC_CRC16(result, 128, 126);
        moduleCRCVal = moduleCRC;
        const modLsb = moduleCRC & 0xFF;
        const modMsb = (moduleCRC >> 8) & 0xFF;

        if (result[254] !== modLsb) {
          result[254] = modLsb;
          changedOffsets.push(254);
        }
        if (result[255] !== modMsb) {
          result[255] = modMsb;
          changedOffsets.push(255);
        }
      }

      return {
        updatedData: result,
        changedOffsets,
        baseCRC,
        moduleCRC: moduleCRCVal
      };
    }
  }

  if (type === MemoryType.DDR3 || type === MemoryType.DDR3L) {
    if (result.length >= 128) {
      const count = (result[0] & 0x80) === 0 ? 117 : 126;
      const baseCRC = calculateJEDEC_CRC16(result, 0, count);
      const lsb = baseCRC & 0xFF;
      const msb = (baseCRC >> 8) & 0xFF;

      if (result[126] !== lsb) {
        result[126] = lsb;
        changedOffsets.push(126);
      }
      if (result[127] !== msb) {
        result[127] = msb;
        changedOffsets.push(127);
      }

      return {
        updatedData: result,
        changedOffsets,
        baseCRC
      };
    }
  }

  if (type === MemoryType.DDR5 && result.length >= 512) {
    const baseCRC = calculateJEDEC_CRC16(result, 0, 510);
    const lsb = baseCRC & 0xFF;
    const msb = (baseCRC >> 8) & 0xFF;

    if (result[510] !== lsb) {
      result[510] = lsb;
      changedOffsets.push(510);
    }
    if (result[511] !== msb) {
      result[511] = msb;
      changedOffsets.push(511);
    }

    return {
      updatedData: result,
      changedOffsets,
      baseCRC
    };
  }

  // Fallback for generic
  if (result.length >= 128) {
    const baseCRC = calculateJEDEC_CRC16(result, 0, 126);
    result[126] = baseCRC & 0xFF;
    result[127] = (baseCRC >> 8) & 0xFF;
    changedOffsets.push(126, 127);
    return {
      updatedData: result,
      changedOffsets,
      baseCRC
    };
  }

  return {
    updatedData: result,
    changedOffsets: [],
    baseCRC: 0
  };
}

function detectMemoryTypeFromData(data: Uint8Array): MemoryType {
  if (!data || data.length < 3) return MemoryType.UNKNOWN;
  const typeByte = data[2];
  if (typeByte === 0x0B) return MemoryType.DDR3;
  if (typeByte === 0x0C) return MemoryType.DDR4;
  if (typeByte === 0x12) return MemoryType.DDR5;
  if (typeByte === 0x08) return MemoryType.DDR2;
  return MemoryType.DDR4; // default
}
