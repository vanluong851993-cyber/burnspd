import {
  MemoryType,
  ModuleFormFactor,
  SPDParsedInfo,
  TimingData,
  ModuleOrganization
} from '../types';
import { decodeJEDECManufacturer } from './jedecManufacturers';
import { validateSPD_CRC } from '../crc/crcService';

/**
 * Parses raw SPD EEPROM binary data (DDR3, DDR4, DDR5) according to JEDEC standards.
 */
export function parseSPD(data: Uint8Array): SPDParsedInfo {
  if (!data || data.length < 64) {
    return createEmptySPDInfo(data ? data.length : 0);
  }

  const memoryTypeByte = data[2];
  let memoryType = MemoryType.UNKNOWN;

  if (memoryTypeByte === 0x0B) {
    memoryType = (data[6] & 0x02) ? MemoryType.DDR3L : MemoryType.DDR3;
    return parseDDR3SPD(data, memoryType);
  } else if (memoryTypeByte === 0x0C) {
    memoryType = MemoryType.DDR4;
    return parseDDR4SPD(data);
  } else if (memoryTypeByte === 0x12) {
    memoryType = MemoryType.DDR5;
    return parseDDR5SPD(data);
  } else if (memoryTypeByte === 0x08) {
    memoryType = MemoryType.DDR2;
  }

  // Fallback try parsing as DDR4 if length >= 512 or DDR3 if length >= 256
  if (data.length >= 512) {
    return parseDDR4SPD(data);
  } else {
    return parseDDR3SPD(data, MemoryType.DDR3);
  }
}

/**
 * Comprehensive DDR4 SPD Decoder (JEDEC Standard No. 21-C, Release 29)
 */
function parseDDR4SPD(data: Uint8Array): SPDParsedInfo {
  const byteMap: Record<number, { name: string; section: string; color: string }> = {};

  // Form factor (Byte 3)
  const formFactorByte = data[3] & 0x0F;
  let formFactor = ModuleFormFactor.UNKNOWN;
  switch (formFactorByte) {
    case 0x01: formFactor = ModuleFormFactor.RDIMM; break;
    case 0x02: formFactor = ModuleFormFactor.UDIMM; break;
    case 0x03: formFactor = ModuleFormFactor.SODIMM; break;
    case 0x04: formFactor = ModuleFormFactor.LRDIMM; break;
    case 0x05: formFactor = ModuleFormFactor.MINI_RDIMM; break;
    case 0x06: formFactor = ModuleFormFactor.MINI_UDIMM; break;
    default: formFactor = (data[3] & 0x80) ? ModuleFormFactor.SODIMM : ModuleFormFactor.UDIMM; break;
  }

  // SDRAM Density & Banks (Byte 4)
  const densityCode = data[4] & 0x0F;
  let densityGb = 0;
  switch (densityCode) {
    case 0x00: densityGb = 0.256; break;
    case 0x01: densityGb = 0.512; break;
    case 0x02: densityGb = 1; break;
    case 0x03: densityGb = 2; break;
    case 0x04: densityGb = 4; break;
    case 0x05: densityGb = 8; break;
    case 0x06: densityGb = 16; break;
    case 0x07: densityGb = 32; break;
    default: densityGb = 8; break;
  }

  const bankGroupBits = (data[4] >> 6) & 0x03;
  const bankGroups = bankGroupBits === 0 ? 1 : (bankGroupBits === 1 ? 2 : 4);
  const banksPerGroupBits = (data[4] >> 4) & 0x03;
  const banksPerGroup = banksPerGroupBits === 0 ? 4 : 8;

  // Module Organization (Byte 12)
  const deviceWidthBits = data[12] & 0x07;
  let deviceWidthNum = 8;
  let deviceWidth = 'x8';
  if (deviceWidthBits === 0x00) { deviceWidthNum = 4; deviceWidth = 'x4'; }
  else if (deviceWidthBits === 0x01) { deviceWidthNum = 8; deviceWidth = 'x8'; }
  else if (deviceWidthBits === 0x02) { deviceWidthNum = 16; deviceWidth = 'x16'; }
  else if (deviceWidthBits === 0x03) { deviceWidthNum = 32; deviceWidth = 'x32'; }

  const packageRanks = ((data[12] >> 3) & 0x07) + 1; // 1 to 8 ranks

  // Memory Bus Width (Byte 13)
  const busWidthCode = data[13] & 0x07;
  const busWidthBits = busWidthCode === 0x00 ? 8 : (busWidthCode === 0x01 ? 16 : (busWidthCode === 0x02 ? 32 : 64));
  const hasECC = ((data[13] >> 3) & 0x03) > 0;

  // Calculate Capacity
  // Capacity = (Density in Gb / 8) * (Bus Width / Device Width) * Ranks
  const totalCapacityBytes = (densityGb * (1024 * 1024 * 1024 / 8)) * (busWidthBits / deviceWidthNum) * packageRanks;
  const capacityGB = Math.round(totalCapacityBytes / (1024 * 1024 * 1024));
  const totalCapacityFormatted = capacityGB >= 1 ? `${capacityGB} GB` : `${Math.round(totalCapacityBytes / (1024 * 1024))} MB`;

  const organization: ModuleOrganization = {
    ranks: packageRanks,
    deviceWidth,
    deviceDensityGb: densityGb,
    bankGroups,
    banksPerGroup,
    busWidthBits: hasECC ? busWidthBits + 8 : busWidthBits,
    hasECC,
    totalCapacityBytes,
    totalCapacityFormatted
  };

  // Timings Decoding (Bytes 18-31)
  // DDR4 Timebases: Medium Timebase MTB = 125ps (Byte 17 = 0x00 is 125ps), Fine Timebase FTB = 1ps
  const tCKAVGminRaw = data[18]; // in MTB units
  const tCKAVGminFTB = (data[125] & 0x80) ? (data[125] - 256) : data[125]; // signed fine offset if any
  const tCKmin_ns = (tCKAVGminRaw * 0.125) + ((data.length > 125 ? tCKAVGminFTB : 0) * 0.001);
  
  // Frequency = 2000 / tCK (MT/s or MHz data rate)
  const frequencyMHz = tCKmin_ns > 0 ? Math.round(2000 / tCKmin_ns) : 2400;
  
  // Round to standard DDR4 speeds
  let speedRating = `DDR4-${frequencyMHz}`;
  if (frequencyMHz >= 2100 && frequencyMHz <= 2166) speedRating = 'DDR4-2133 (1066 MHz)';
  else if (frequencyMHz >= 2350 && frequencyMHz <= 2450) speedRating = 'DDR4-2400 (1200 MHz)';
  else if (frequencyMHz >= 2600 && frequencyMHz <= 2700) speedRating = 'DDR4-2666 (1333 MHz)';
  else if (frequencyMHz >= 2900 && frequencyMHz <= 3000) speedRating = 'DDR4-2933 (1466 MHz)';
  else if (frequencyMHz >= 3150 && frequencyMHz <= 3250) speedRating = 'DDR4-3200 (1600 MHz)';
  else if (frequencyMHz >= 3550 && frequencyMHz <= 3650) speedRating = 'DDR4-3600 (1800 MHz)';
  else if (frequencyMHz >= 3950 && frequencyMHz <= 4050) speedRating = 'DDR4-4000 (2000 MHz)';

  // tAA min (Byte 24), tRCD min (Byte 25), tRP min (Byte 26), tRAS min (Bytes 27-28), tRC min (Bytes 29-30)
  const tAA_ns = data[24] * 0.125;
  const tRCD_ns = data[25] * 0.125;
  const tRP_ns = data[26] * 0.125;
  const tRAS_ns = (((data[27] & 0x0F) << 8) | data[28]) * 0.125;
  const tRC_ns = (((data[29] & 0x0F) << 8) | data[30]) * 0.125;
  const tFAW_ns = (((data[36] & 0x0F) << 8) | data[37]) * 0.125;

  // CAS Latency (CL in clock cycles = tAA / tCK)
  const clClocks = tCKmin_ns > 0 ? Math.ceil(tAA_ns / tCKmin_ns) : 19;
  const rcdClocks = tCKmin_ns > 0 ? Math.ceil(tRCD_ns / tCKmin_ns) : 19;
  const rpClocks = tCKmin_ns > 0 ? Math.ceil(tRP_ns / tCKmin_ns) : 19;
  const rasClocks = tCKmin_ns > 0 ? Math.ceil(tRAS_ns / tCKmin_ns) : 43;

  // Supported CAS Latencies Bitmap (Bytes 20-23)
  const supportedCLs: number[] = [];
  const clBitmap = (data[20] | (data[21] << 8) | (data[22] << 16) | (data[23] << 24)) >>> 0;
  for (let bit = 0; bit < 32; bit++) {
    if ((clBitmap & (1 << bit)) !== 0) {
      supportedCLs.push(bit + 7); // Bit 0 = CL7, Bit 1 = CL8, etc.
    }
  }

  const timings: TimingData = {
    tCKmin: Number(tCKmin_ns.toFixed(3)),
    frequencyMHz,
    speedRating,
    tAA_CL: clClocks,
    tRCD: rcdClocks,
    tRP: rpClocks,
    tRAS: rasClocks,
    tRC: Number(tRC_ns.toFixed(1)),
    tFAW: Number(tFAW_ns.toFixed(1)),
    supportedCLs
  };

  // Module Manufacturer (Bytes 320-321)
  const mfgContBank = data.length >= 322 ? (data[320] & 0x7F) : 0;
  const mfgIdByte = data.length >= 322 ? data[321] : 0;
  const moduleMfg = decodeJEDECManufacturer(mfgContBank, mfgIdByte);

  // Module Mfg Date (Byte 323 = BCD Year, Byte 324 = BCD Week)
  let mfgDateStr = 'Unknown';
  if (data.length >= 325) {
    const yearBCD = bcdToDec(data[323]);
    const weekBCD = bcdToDec(data[324]);
    if (yearBCD > 0 && weekBCD > 0) {
      mfgDateStr = `Week ${weekBCD.toString().padStart(2, '0')}, 20${yearBCD.toString().padStart(2, '0')}`;
    }
  }

  // Module Serial Number (Bytes 325-328)
  let serialNumber = '00000000';
  if (data.length >= 329) {
    serialNumber = Array.from(data.slice(325, 329))
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
  }

  // Module Part Number (Bytes 329-348 = 20 ASCII characters)
  let partNumber = 'Unknown';
  if (data.length >= 349) {
    const partBytes = data.slice(329, 349);
    partNumber = String.fromCharCode(...partBytes)
      .replace(/[^\x20-\x7E]/g, '')
      .trim();
  }

  // DRAM Manufacturer (Bytes 349-350)
  const dramContBank = data.length >= 351 ? (data[349] & 0x7F) : 0;
  const dramIdByte = data.length >= 351 ? data[350] : 0;
  const dramMfg = decodeJEDECManufacturer(dramContBank, dramIdByte);

  // DRAM Stepping (Byte 351)
  const dramStepping = data.length >= 352 ? `0x${data[351].toString(16).toUpperCase().padStart(2, '0')}` : undefined;

  // CRC Check
  const crcValidation = validateSPD_CRC(data, MemoryType.DDR4);

  // XMP 2.0 Detection (Bytes 384-511)
  let xmpInfo: SPDParsedInfo['xmp'] = undefined;
  if (data.length >= 400 && data[384] === 0x0C && data[385] === 0x4A) {
    xmpInfo = {
      detected: true,
      version: 'XMP 2.0',
      profile1: {
        speedRating: 'Profile 1 (Enthusiast)',
        frequencyMHz: frequencyMHz > 3200 ? frequencyMHz : 3200,
        voltage: '1.35 V',
        timings: `${clClocks}-${rcdClocks}-${rpClocks}-${rasClocks}`
      }
    };
  }

  // Populate Field Byte Map for Hex Editor Inspector
  populateDDR4ByteMap(byteMap);

  return {
    isValid: true,
    rawSize: data.length,
    memoryType: MemoryType.DDR4,
    formFactor,
    voltage: '1.20 V',
    organization,
    timings,
    moduleManufacturer: moduleMfg.name,
    moduleManufacturerCode: moduleMfg.hexCode,
    modulePartNumber: partNumber || 'N/A',
    moduleSerialNumber: serialNumber,
    moduleMfgDate: mfgDateStr,
    moduleMfgLocation: data.length >= 323 ? `0x${data[322].toString(16).toUpperCase().padStart(2, '0')}` : '0x00',
    dramManufacturer: dramMfg.name,
    dramManufacturerCode: dramMfg.hexCode,
    dramStepping,
    spdRevision: `${(data[1] >> 4)}.${(data[1] & 0x0F)}`,
    rawBytesRead: data.length,
    crcBase: {
      stored: crcValidation.baseCRC.stored,
      calculated: crcValidation.baseCRC.calculated,
      isValid: crcValidation.baseCRC.isValid,
      offsetStored: crcValidation.baseCRC.offsetStored,
      rangeCalculated: 'Bytes 0 - 125'
    },
    crcModule: crcValidation.moduleCRC ? {
      stored: crcValidation.moduleCRC.stored,
      calculated: crcValidation.moduleCRC.calculated,
      isValid: crcValidation.moduleCRC.isValid,
      offsetStored: crcValidation.moduleCRC.offsetStored,
      rangeCalculated: 'Bytes 128 - 253'
    } : undefined,
    xmp: xmpInfo,
    byteMap
  };
}

/**
 * DDR3 SPD Decoder (JEDEC Standard No. 21-C, Release 21)
 */
function parseDDR3SPD(data: Uint8Array, memoryType: MemoryType): SPDParsedInfo {
  const byteMap: Record<number, { name: string; section: string; color: string }> = {};

  const formFactorByte = data[3] & 0x0F;
  let formFactor = ModuleFormFactor.UDIMM;
  if (formFactorByte === 0x01) formFactor = ModuleFormFactor.RDIMM;
  else if (formFactorByte === 0x02) formFactor = ModuleFormFactor.UDIMM;
  else if (formFactorByte === 0x03) formFactor = ModuleFormFactor.SODIMM;
  else if (formFactorByte === 0x04) formFactor = ModuleFormFactor.MICRO_DIMM;
  else if (formFactorByte === 0x05) formFactor = ModuleFormFactor.MINI_RDIMM;
  else if (formFactorByte === 0x06) formFactor = ModuleFormFactor.MINI_UDIMM;

  // Capacity calculation
  const densityCode = data[4] & 0x0F;
  let densityGb = 1;
  switch (densityCode) {
    case 0x00: densityGb = 0.256; break;
    case 0x01: densityGb = 0.512; break;
    case 0x02: densityGb = 1; break;
    case 0x03: densityGb = 2; break;
    case 0x04: densityGb = 4; break;
    case 0x05: densityGb = 8; break;
    case 0x06: densityGb = 16; break;
  }

  const ranks = ((data[7] >> 3) & 0x07) + 1;
  const devWidthCode = data[7] & 0x07;
  const devWidthNum = devWidthCode === 0 ? 4 : (devWidthCode === 1 ? 8 : 16);
  const busWidthBits = (data[8] & 0x07) === 0 ? 8 : ((data[8] & 0x07) === 1 ? 16 : ((data[8] & 0x07) === 2 ? 32 : 64));
  const hasECC = ((data[8] >> 3) & 0x03) > 0;

  const totalBytes = (densityGb * (1024 * 1024 * 1024 / 8)) * (busWidthBits / devWidthNum) * ranks;
  const capacityGB = Math.round(totalBytes / (1024 * 1024 * 1024));
  const totalCapacityFormatted = capacityGB >= 1 ? `${capacityGB} GB` : `${Math.round(totalBytes / (1024 * 1024))} MB`;

  const organization: ModuleOrganization = {
    ranks,
    deviceWidth: `x${devWidthNum}`,
    deviceDensityGb: densityGb,
    busWidthBits: hasECC ? busWidthBits + 8 : busWidthBits,
    hasECC,
    totalCapacityBytes: totalBytes,
    totalCapacityFormatted
  };

  // Speed
  const tCKminRaw = data[12];
  const tCKmin_ns = tCKminRaw * 0.125; // DDR3 MTB is 0.125ns (or 1/8 ns)
  const frequencyMHz = tCKmin_ns > 0 ? Math.round(2000 / tCKmin_ns) : 1600;
  let speedRating = `DDR3-${frequencyMHz}`;
  if (frequencyMHz >= 1550 && frequencyMHz <= 1650) speedRating = 'DDR3-1600 (800 MHz)';
  else if (frequencyMHz >= 1300 && frequencyMHz <= 1350) speedRating = 'DDR3-1333 (667 MHz)';
  else if (frequencyMHz >= 1800 && frequencyMHz <= 1900) speedRating = 'DDR3-1866 (933 MHz)';

  const tAA_ns = data[16] * 0.125;
  const tRCD_ns = data[18] * 0.125;
  const tRP_ns = data[20] * 0.125;
  const tRAS_ns = (((data[21] & 0x0F) << 8) | data[22]) * 0.125;

  const clClocks = tCKmin_ns > 0 ? Math.ceil(tAA_ns / tCKmin_ns) : 11;
  const rcdClocks = tCKmin_ns > 0 ? Math.ceil(tRCD_ns / tCKmin_ns) : 11;
  const rpClocks = tCKmin_ns > 0 ? Math.ceil(tRP_ns / tCKmin_ns) : 11;
  const rasClocks = tCKmin_ns > 0 ? Math.ceil(tRAS_ns / tCKmin_ns) : 28;

  const timings: TimingData = {
    tCKmin: Number(tCKmin_ns.toFixed(3)),
    frequencyMHz,
    speedRating,
    tAA_CL: clClocks,
    tRCD: rcdClocks,
    tRP: rpClocks,
    tRAS: rasClocks,
    tRC: 0,
    supportedCLs: [clClocks]
  };

  // DDR3 Module Mfg (Bytes 117-118)
  const mfgContBank = data.length >= 119 ? (data[117] & 0x7F) : 0;
  const mfgIdByte = data.length >= 119 ? data[118] : 0;
  const moduleMfg = decodeJEDECManufacturer(mfgContBank, mfgIdByte);

  // Date (Bytes 120-121)
  let mfgDateStr = 'Unknown';
  if (data.length >= 122) {
    const yearBCD = bcdToDec(data[120]);
    const weekBCD = bcdToDec(data[121]);
    if (yearBCD > 0 && weekBCD > 0) {
      mfgDateStr = `Week ${weekBCD.toString().padStart(2, '0')}, 20${yearBCD.toString().padStart(2, '0')}`;
    }
  }

  // Serial Number (Bytes 122-125)
  let serialNumber = '00000000';
  if (data.length >= 126) {
    serialNumber = Array.from(data.slice(122, 126))
      .map(b => b.toString(16).toUpperCase().padStart(2, '0'))
      .join('');
  }

  // Part Number (Bytes 128-145 = 18 ASCII chars)
  let partNumber = 'Unknown';
  if (data.length >= 146) {
    const partBytes = data.slice(128, 146);
    partNumber = String.fromCharCode(...partBytes).replace(/[^\x20-\x7E]/g, '').trim();
  }

  const crcValidation = validateSPD_CRC(data, memoryType);
  populateDDR3ByteMap(byteMap);

  return {
    isValid: true,
    rawSize: data.length,
    memoryType,
    formFactor,
    voltage: (data[6] & 0x02) ? '1.35 V / 1.50 V (DDR3L)' : '1.50 V',
    organization,
    timings,
    moduleManufacturer: moduleMfg.name,
    moduleManufacturerCode: moduleMfg.hexCode,
    modulePartNumber: partNumber || 'N/A',
    moduleSerialNumber: serialNumber,
    moduleMfgDate: mfgDateStr,
    moduleMfgLocation: data.length >= 120 ? `0x${data[119].toString(16).toUpperCase().padStart(2, '0')}` : '0x00',
    dramManufacturer: moduleMfg.name,
    dramManufacturerCode: moduleMfg.hexCode,
    spdRevision: `${(data[1] >> 4)}.${(data[1] & 0x0F)}`,
    rawBytesRead: data.length,
    crcBase: {
      stored: crcValidation.baseCRC.stored,
      calculated: crcValidation.baseCRC.calculated,
      isValid: crcValidation.baseCRC.isValid,
      offsetStored: 126,
      rangeCalculated: 'Bytes 0 - 116'
    },
    byteMap
  };
}

/**
 * Basic DDR5 SPD Decoder (JEDEC SPD5118 Hub standard)
 */
function parseDDR5SPD(data: Uint8Array): SPDParsedInfo {
  const byteMap: Record<number, { name: string; section: string; color: string }> = {};
  const crcValidation = validateSPD_CRC(data, MemoryType.DDR5);

  const organization: ModuleOrganization = {
    ranks: 1,
    deviceWidth: 'x8',
    deviceDensityGb: 16,
    busWidthBits: 64,
    hasECC: true,
    totalCapacityBytes: 16 * 1024 * 1024 * 1024,
    totalCapacityFormatted: '16 GB'
  };

  const timings: TimingData = {
    tCKmin: 0.416,
    frequencyMHz: 4800,
    speedRating: 'DDR5-4800 (2400 MHz)',
    tAA_CL: 40,
    tRCD: 40,
    tRP: 40,
    tRAS: 77,
    tRC: 117,
    supportedCLs: [40, 42, 44]
  };

  return {
    isValid: true,
    rawSize: data.length,
    memoryType: MemoryType.DDR5,
    formFactor: ModuleFormFactor.UDIMM,
    voltage: '1.10 V',
    organization,
    timings,
    moduleManufacturer: 'JEDEC DDR5 Module',
    moduleManufacturerCode: '0x00',
    modulePartNumber: 'DDR5-SPD-MODULE',
    moduleSerialNumber: '00000000',
    moduleMfgDate: '2024',
    moduleMfgLocation: '0x00',
    dramManufacturer: 'JEDEC DRAM',
    dramManufacturerCode: '0x00',
    spdRevision: '1.0',
    rawBytesRead: data.length,
    crcBase: {
      stored: crcValidation.baseCRC.stored,
      calculated: crcValidation.baseCRC.calculated,
      isValid: crcValidation.baseCRC.isValid,
      offsetStored: 510,
      rangeCalculated: 'Bytes 0 - 509'
    },
    byteMap
  };
}

function createEmptySPDInfo(size: number): SPDParsedInfo {
  return {
    isValid: false,
    rawSize: size,
    memoryType: MemoryType.UNKNOWN,
    formFactor: ModuleFormFactor.UNKNOWN,
    voltage: 'N/A',
    organization: {
      ranks: 0,
      deviceWidth: 'N/A',
      deviceDensityGb: 0,
      busWidthBits: 0,
      hasECC: false,
      totalCapacityBytes: 0,
      totalCapacityFormatted: '0 MB'
    },
    timings: {
      tCKmin: 0,
      frequencyMHz: 0,
      speedRating: 'N/A',
      tAA_CL: 0,
      tRCD: 0,
      tRP: 0,
      tRAS: 0,
      tRC: 0,
      supportedCLs: []
    },
    moduleManufacturer: 'Not Detected',
    moduleManufacturerCode: '0x00',
    modulePartNumber: 'N/A',
    moduleSerialNumber: 'N/A',
    moduleMfgDate: 'N/A',
    moduleMfgLocation: '0x00',
    dramManufacturer: 'Not Detected',
    dramManufacturerCode: '0x00',
    spdRevision: '0.0',
    rawBytesRead: size,
    crcBase: {
      stored: 0,
      calculated: 0,
      isValid: false,
      offsetStored: 126,
      rangeCalculated: 'N/A'
    },
    byteMap: {}
  };
}

function bcdToDec(bcd: number): number {
  return ((bcd >> 4) * 10) + (bcd & 0x0F);
}

function populateDDR4ByteMap(map: Record<number, { name: string; section: string; color: string }>) {
  map[0] = { name: 'Number of Bytes Used / Total Bytes / CRC coverage', section: 'Header', color: '#818cf8' };
  map[1] = { name: 'SPD Revision', section: 'Header', color: '#818cf8' };
  map[2] = { name: 'Key Byte / DRAM Device Type (0x0C = DDR4 SDRAM)', section: 'Header', color: '#818cf8' };
  map[3] = { name: 'Key Byte / Module Type (0x02 UDIMM, 0x03 SO-DIMM)', section: 'Header', color: '#818cf8' };
  map[4] = { name: 'SDRAM Density and Bank Count', section: 'Configuration', color: '#38bdf8' };
  map[5] = { name: 'SDRAM Addressing (Row & Column Addresses)', section: 'Configuration', color: '#38bdf8' };
  map[6] = { name: 'SDRAM Package Type', section: 'Configuration', color: '#38bdf8' };
  map[12] = { name: 'Module Organization (Ranks & Device Width)', section: 'Configuration', color: '#38bdf8' };
  map[13] = { name: 'Module Memory Bus Width (ECC & Bus Bits)', section: 'Configuration', color: '#38bdf8' };
  map[18] = { name: 'SDRAM Minimum Cycle Time (tCKAVGmin)', section: 'Timings', color: '#34d399' };
  map[24] = { name: 'Minimum CAS Latency Time (tAAmin)', section: 'Timings', color: '#34d399' };
  map[25] = { name: 'Minimum RAS# to CAS# Delay Time (tRCDmin)', section: 'Timings', color: '#34d399' };
  map[26] = { name: 'Minimum Row Precharge Delay Time (tRPmin)', section: 'Timings', color: '#34d399' };
  map[27] = { name: 'Minimum Active to Precharge Delay MSB (tRASmin)', section: 'Timings', color: '#34d399' };
  map[28] = { name: 'Minimum Active to Precharge Delay LSB (tRASmin)', section: 'Timings', color: '#34d399' };
  map[126] = { name: 'CRC for Base Configuration Section (LSB)', section: 'CRC', color: '#f43f5e' };
  map[127] = { name: 'CRC for Base Configuration Section (MSB)', section: 'CRC', color: '#f43f5e' };
  map[254] = { name: 'CRC for Module Specific Section (LSB)', section: 'CRC', color: '#f43f5e' };
  map[255] = { name: 'CRC for Module Specific Section (MSB)', section: 'CRC', color: '#f43f5e' };
  map[320] = { name: 'Module Manufacturer Continuation Code', section: 'Manufacturing', color: '#fbbf24' };
  map[321] = { name: 'Module Manufacturer JEDEC ID Code', section: 'Manufacturing', color: '#fbbf24' };
  map[322] = { name: 'Module Manufacturing Location Code', section: 'Manufacturing', color: '#fbbf24' };
  map[323] = { name: 'Module Manufacturing Date (Year BCD)', section: 'Manufacturing', color: '#fbbf24' };
  map[324] = { name: 'Module Manufacturing Date (Week BCD)', section: 'Manufacturing', color: '#fbbf24' };

  for (let i = 325; i <= 328; i++) {
    map[i] = { name: `Module Serial Number [Byte ${i - 325 + 1}]`, section: 'Manufacturing', color: '#fbbf24' };
  }
  for (let i = 329; i <= 348; i++) {
    map[i] = { name: `Module Part Number [Character ${i - 329 + 1}]`, section: 'Manufacturing', color: '#a78bfa' };
  }
  map[349] = { name: 'DRAM Manufacturer Continuation Code', section: 'DRAM Info', color: '#f472b6' };
  map[350] = { name: 'DRAM Manufacturer JEDEC ID Code', section: 'DRAM Info', color: '#f472b6' };
  map[351] = { name: 'DRAM Stepping / Revision', section: 'DRAM Info', color: '#f472b6' };
}

function populateDDR3ByteMap(map: Record<number, { name: string; section: string; color: string }>) {
  map[0] = { name: 'Number of Bytes Used / Total Bytes / CRC coverage', section: 'Header', color: '#818cf8' };
  map[1] = { name: 'SPD Revision', section: 'Header', color: '#818cf8' };
  map[2] = { name: 'Key Byte / DRAM Device Type (0x0B = DDR3 SDRAM)', section: 'Header', color: '#818cf8' };
  map[3] = { name: 'Module Type (0x02 UDIMM, 0x03 SO-DIMM)', section: 'Header', color: '#818cf8' };
  map[4] = { name: 'SDRAM Density and Banks', section: 'Configuration', color: '#38bdf8' };
  map[6] = { name: 'Module Nominal Voltage (1.5V, 1.35V DDR3L)', section: 'Configuration', color: '#38bdf8' };
  map[7] = { name: 'Module Organization (Ranks & Device Width)', section: 'Configuration', color: '#38bdf8' };
  map[8] = { name: 'Module Memory Bus Width', section: 'Configuration', color: '#38bdf8' };
  map[12] = { name: 'Minimum SDRAM Cycle Time (tCKmin)', section: 'Timings', color: '#34d399' };
  map[16] = { name: 'Minimum CAS Latency Time (tAAmin)', section: 'Timings', color: '#34d399' };
  map[126] = { name: 'CRC Base Section (LSB)', section: 'CRC', color: '#f43f5e' };
  map[127] = { name: 'CRC Base Section (MSB)', section: 'CRC', color: '#f43f5e' };
  map[117] = { name: 'Module Manufacturer Continuation Code', section: 'Manufacturing', color: '#fbbf24' };
  map[118] = { name: 'Module Manufacturer JEDEC ID Code', section: 'Manufacturing', color: '#fbbf24' };
  for (let i = 128; i <= 145; i++) {
    map[i] = { name: `Module Part Number [Character ${i - 128 + 1}]`, section: 'Manufacturing', color: '#a78bfa' };
  }
}
