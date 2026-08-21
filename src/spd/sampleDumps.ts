import { MemoryType, SampleSPD } from '../types';

/**
 * Creates a valid DDR4 512-byte SPD binary dump for testing & simulation
 */
function createDDR4Sample(
  speedRating: '2400' | '2666' | '3200' | '3600',
  capacityGB: 8 | 16 | 32,
  isSODIMM: boolean,
  manufacturerName: 'Samsung' | 'SK Hynix' | 'Micron' | 'Kingston' | 'Corsair',
  partNumber: string,
  serialHex: string
): Uint8Array {
  const data = new Uint8Array(512);

  // Byte 0: Bytes used (0x23 = 512 bytes total, 384 used, CRC covers 0-125)
  data[0] = 0x23;
  // Byte 1: Revision 1.1
  data[1] = 0x11;
  // Byte 2: DRAM Type (0x0C = DDR4 SDRAM)
  data[2] = 0x0C;
  // Byte 3: Module Type (0x02 = UDIMM, 0x03 = SO-DIMM)
  data[3] = isSODIMM ? 0x03 : 0x02;

  // Byte 4: SDRAM Density & Banks (0x85 = 8Gb, 4 bank groups, 4 banks/group)
  if (capacityGB === 8) {
    data[4] = 0x85; // 8Gb die
    data[12] = isSODIMM ? 0x09 : 0x01; // 1 Rank, x8 (or 1R x16)
  } else if (capacityGB === 16) {
    data[4] = 0x85; // 8Gb die
    data[12] = 0x09; // 2 Ranks, x8
  } else {
    data[4] = 0x86; // 16Gb die
    data[12] = 0x09; // 2 Ranks, x8
  }

  // Byte 5: Row/Col addressing (0x29 = 16 rows, 10 cols)
  data[5] = 0x29;
  // Byte 6: Package type (0x00 = Monolithic)
  data[6] = 0x00;
  // Byte 13: Bus width (0x03 = 64-bit non-ECC)
  data[13] = 0x03;
  // Byte 14: Thermal sensor present (0x80)
  data[14] = 0x80;

  // Byte 18: tCKAVG min (MTB 125ps units)
  // 3200 MT/s -> tCK = 0.625ns -> 5 * 0.125 = 5 (0x05)
  // 2666 MT/s -> tCK = 0.750ns -> 6 * 0.125 = 6 (0x06)
  // 2400 MT/s -> tCK = 0.833ns -> raw approximation
  // 3600 MT/s -> tCK = 0.555ns
  if (speedRating === '3200') {
    data[18] = 0x05; // 0.625ns
    data[20] = 0x00; data[21] = 0x18; data[22] = 0x80; data[23] = 0x00; // Supported CLs (CL19, CL20, CL22)
    data[24] = 0x6E; // tAA min (13.75ns)
    data[25] = 0x6E; // tRCD min
    data[26] = 0x6E; // tRP min
    data[27] = 0x01; data[28] = 0x00; // tRAS min (32ns)
    data[29] = 0x01; data[30] = 0x6E; // tRC min (45.75ns)
    data[36] = 0x00; data[37] = 0xD8; // tFAW
  } else if (speedRating === '2666') {
    data[18] = 0x06; // 0.750ns
    data[20] = 0x00; data[21] = 0x1C; data[22] = 0x00; data[23] = 0x00; // CL17, CL18, CL19
    data[24] = 0x71; // tAA min (14.16ns)
    data[25] = 0x71; // tRCD min
    data[26] = 0x71; // tRP min
    data[27] = 0x01; data[28] = 0x00;
    data[29] = 0x01; data[30] = 0x71;
  } else if (speedRating === '3600') {
    data[18] = 0x05;
    data[20] = 0x00; data[21] = 0x00; data[22] = 0x80; data[23] = 0x01; // High CL support
    data[24] = 0x64; // tAA min
    data[25] = 0x64;
    data[26] = 0x64;
    data[27] = 0x01; data[28] = 0x10;
    data[29] = 0x01; data[30] = 0x74;
    
    // Inject XMP 2.0 Magic Header at Byte 384
    data[384] = 0x0C; // XMP ID byte 1
    data[385] = 0x4A; // XMP ID byte 2
    data[386] = 0x02; // XMP 2.0
    data[387] = 0x01; // Profile 1 enabled
  } else {
    // 2400
    data[18] = 0x07;
    data[20] = 0x00; data[21] = 0x08; data[22] = 0x00; data[23] = 0x00; // CL17
    data[24] = 0x78;
    data[25] = 0x78;
    data[26] = 0x78;
    data[27] = 0x01; data[28] = 0x00;
    data[29] = 0x01; data[30] = 0x78;
  }

  // Module Manufacturer (Bytes 320-321)
  if (manufacturerName === 'Samsung') {
    data[320] = 0x00; // Bank 1
    data[321] = 0xCE; // Samsung ID
    data[349] = 0x00; data[350] = 0xCE; // DRAM Samsung
  } else if (manufacturerName === 'SK Hynix') {
    data[320] = 0x00; // Bank 1
    data[321] = 0xAD; // SK Hynix ID
    data[349] = 0x00; data[350] = 0xAD;
  } else if (manufacturerName === 'Micron') {
    data[320] = 0x00; // Bank 1
    data[321] = 0x2C; // Micron ID
    data[349] = 0x00; data[350] = 0x2C;
  } else if (manufacturerName === 'Kingston') {
    data[320] = 0x01; // Bank 2
    data[321] = 0x98; // Kingston ID
    data[349] = 0x00; data[350] = 0xAD; // Hynix DRAM
  } else if (manufacturerName === 'Corsair') {
    data[320] = 0x02; // Bank 3
    data[321] = 0x9E; // Corsair ID
    data[349] = 0x00; data[350] = 0x2C; // Micron DRAM
  }

  // Mfg Location (Byte 322)
  data[322] = 0x01;
  // Mfg Date (Byte 323 = Year 22, Byte 324 = Week 36)
  data[323] = 0x22;
  data[324] = 0x36;

  // Serial Number (Bytes 325-328)
  for (let i = 0; i < 4; i++) {
    data[325 + i] = parseInt(serialHex.substr(i * 2, 2), 16) || 0x4A;
  }

  // Part Number (Bytes 329-348 ASCII)
  for (let i = 0; i < 20; i++) {
    data[329 + i] = i < partNumber.length ? partNumber.charCodeAt(i) : 0x20;
  }

  // Calculate & Write Valid Base CRC (Bytes 126-127)
  let crcBase = 0x0000;
  for (let i = 0; i < 126; i++) {
    crcBase = crcBase ^ (data[i] << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crcBase & 0x8000) !== 0) {
        crcBase = ((crcBase << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crcBase = (crcBase << 1) & 0xFFFF;
      }
    }
  }
  data[126] = crcBase & 0xFF;
  data[127] = (crcBase >> 8) & 0xFF;

  // Calculate & Write Valid Module CRC (Bytes 254-255)
  let crcMod = 0x0000;
  for (let i = 128; i < 254; i++) {
    crcMod = crcMod ^ (data[i] << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crcMod & 0x8000) !== 0) {
        crcMod = ((crcMod << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crcMod = (crcMod << 1) & 0xFFFF;
      }
    }
  }
  data[254] = crcMod & 0xFF;
  data[255] = (crcMod >> 8) & 0xFF;

  return data;
}

/**
 * Creates a valid DDR3 256-byte SPD binary dump
 */
function createDDR3Sample(
  capacityGB: 4 | 8,
  isDDR3L: boolean,
  isSODIMM: boolean,
  partNumber: string,
  serialHex: string
): Uint8Array {
  const data = new Uint8Array(256);

  data[0] = 0x92; // 256 bytes total, 176 used
  data[1] = 0x13; // SPD Rev 1.3
  data[2] = 0x0B; // DDR3
  data[3] = isSODIMM ? 0x03 : 0x02; // Form factor
  data[4] = capacityGB === 8 ? 0x04 : 0x03; // 4Gb die or 2Gb die
  data[6] = isDDR3L ? 0x02 : 0x00; // Voltage: 1.35V operable
  data[7] = 0x09; // 2 Ranks, x8
  data[8] = 0x03; // 64-bit non-ECC
  data[12] = 0x0A; // tCKmin = 1.25ns (DDR3-1600)
  data[16] = 0x6E; // tAAmin (13.75ns = CL11)
  data[18] = 0x6E; // tRCDmin
  data[20] = 0x6E; // tRPmin
  data[21] = 0x01; data[22] = 0x18; // tRASmin (35ns)

  // Module Mfg: Samsung
  data[117] = 0x00;
  data[118] = 0xCE;
  data[120] = 0x18; // 2018
  data[121] = 0x24; // Week 24

  // Serial Number
  for (let i = 0; i < 4; i++) {
    data[122 + i] = parseInt(serialHex.substr(i * 2, 2), 16) || 0x22;
  }

  // Part Number
  for (let i = 0; i < 18; i++) {
    data[128 + i] = i < partNumber.length ? partNumber.charCodeAt(i) : 0x20;
  }

  // CRC
  let crc = 0x0000;
  for (let i = 0; i < 117; i++) {
    crc = crc ^ (data[i] << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  data[126] = crc & 0xFF;
  data[127] = (crc >> 8) & 0xFF;

  return data;
}

export const SAMPLE_SPD_LIBRARY: SampleSPD[] = [
  {
    id: 'samsung-ddr4-3200-8gb-sodimm',
    name: 'Samsung 8GB DDR4-3200 SO-DIMM',
    type: MemoryType.DDR4,
    formFactor: 'SO-DIMM (Laptop)',
    capacity: '8 GB',
    speed: 'DDR4-3200 (CL22-22-22)',
    partNumber: 'M471A1K43EB1-CWE',
    description: 'Standard JEDEC 1.2V 8GB SO-DIMM laptop memory module by Samsung Electronics.',
    bytes: createDDR4Sample('3200', 8, true, 'Samsung', 'M471A1K43EB1-CWE', '84C59102')
  },
  {
    id: 'hynix-ddr4-2666-16gb-udimm',
    name: 'SK Hynix 16GB DDR4-2666 UDIMM',
    type: MemoryType.DDR4,
    formFactor: 'UDIMM (Desktop)',
    capacity: '16 GB',
    speed: 'DDR4-2666 (CL19-19-19)',
    partNumber: 'HMA82GU6CJR8N-VK',
    description: 'Desktop 2Rx8 16GB JEDEC standard module by SK Hynix.',
    bytes: createDDR4Sample('2666', 16, false, 'SK Hynix', 'HMA82GU6CJR8N-VK', '50B91A4F')
  },
  {
    id: 'micron-ddr4-3200-8gb-sodimm',
    name: 'Micron 8GB DDR4-3200 SO-DIMM',
    type: MemoryType.DDR4,
    formFactor: 'SO-DIMM (Laptop)',
    capacity: '8 GB',
    speed: 'DDR4-3200 (CL22-22-22)',
    partNumber: 'MTA4ATF1G64HZ-3G2E2',
    description: 'Standard 1Rx16 low-power SO-DIMM laptop module by Micron Technology.',
    bytes: createDDR4Sample('3200', 8, true, 'Micron', 'MTA4ATF1G64HZ-3G2E2', '7C12EE89')
  },
  {
    id: 'kingston-ddr4-3600-16gb-xmp',
    name: 'Kingston FURY Beast 16GB DDR4-3600 (XMP 2.0)',
    type: MemoryType.DDR4,
    formFactor: 'UDIMM (Desktop)',
    capacity: '16 GB',
    speed: 'DDR4-3600 XMP (CL17-21-21)',
    partNumber: 'KF3600C17D4/16GX',
    description: 'Gaming performance module with Intel XMP 2.0 enthusiast overclock profile.',
    bytes: createDDR4Sample('3600', 16, false, 'Kingston', 'KF3600C17D4/16GX', '99FE0041')
  },
  {
    id: 'corsair-ddr4-3200-8gb-udimm',
    name: 'Corsair Vengeance LPX 8GB DDR4-3200',
    type: MemoryType.DDR4,
    formFactor: 'UDIMM (Desktop)',
    capacity: '8 GB',
    speed: 'DDR4-3200 (CL16-18-18)',
    partNumber: 'CMK16GX4M2B3200C16',
    description: 'Popular enthusiast DDR4 module by Corsair Memory.',
    bytes: createDDR4Sample('3200', 8, false, 'Corsair', 'CMK16GX4M2B3200C16', '3349AB10')
  },
  {
    id: 'samsung-ddr3l-1600-4gb-sodimm',
    name: 'Samsung 4GB DDR3L-1600 SO-DIMM',
    type: MemoryType.DDR3L,
    formFactor: 'SO-DIMM (Laptop)',
    capacity: '4 GB',
    speed: 'DDR3-1600 (CL11-11-11)',
    partNumber: 'M471B5173QH0-YK0',
    description: '1.35V / 1.5V dual-voltage DDR3L laptop RAM by Samsung.',
    bytes: createDDR3Sample(4, true, true, 'M471B5173QH0-YK0', '1A882C7E')
  }
];
