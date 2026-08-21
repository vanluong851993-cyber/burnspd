import { JEDECManufacturer } from '../types';

/**
 * JEDEC Standard JEP106 Manufacturer Identification Codes
 * Bank number + hex byte identifier with parity
 */
export const JEDEC_MANUFACTURERS: Record<string, string> = {
  // Bank 1 (Continuation count = 0)
  '0:01': 'AMD',
  '0:02': 'AMI',
  '0:04': 'Fujitsu',
  '0:07': 'Hitachi',
  '0:0B': 'Nanya Technology',
  '0:15': 'Philips',
  '0:1F': 'Atmel',
  '0:20': 'STMicroelectronics',
  '0:2C': 'Micron Technology',
  '0:3D': 'Tektronix',
  '0:40': 'Motorola',
  '0:49': 'Texas Instruments',
  '0:51': 'Qimonda',
  '0:52': 'Sony',
  '0:89': 'Intel',
  '0:97': 'Texas Instruments',
  '0:98': 'Toshiba',
  '0:AD': 'SK Hynix',
  '0:C1': 'Infineon',
  '0:C2': 'Macronix',
  '0:C8': 'Apacer Technology',
  '0:CE': 'Samsung Electronics',
  '0:EF': 'Winbond Electronics',

  // Bank 2 (Continuation count = 1)
  '1:01': 'Cirrus Logic',
  '1:15': 'SanDisk',
  '1:24': 'Micronas',
  '1:32': 'OmniVision',
  '1:4F': 'Transcend Information',
  '1:7A': 'Apacer',
  '1:94': 'SimpleTech',
  '1:98': 'Kingston Technology',
  '1:BA': 'Super Talent',
  '1:C8': 'Agilent',
  '1:FE': 'Elpida Memory',

  // Bank 3 (Continuation count = 2)
  '2:0B': 'Nanya Technology Corp',
  '2:1C': 'Centon Electronics',
  '2:25': 'Kingmax Semiconductor',
  '2:70': 'Buffalo Technology',
  '2:83': 'GeIL (Golden Emperor)',
  '2:9E': 'Corsair Memory',
  '2:C8': 'Team Group Inc.',
  '2:FE': 'Patriot Memory',

  // Bank 4 (Continuation count = 3)
  '3:23': 'Crucial Technology',
  '3:25': 'Mushkin Enhanced Memory',
  '3:26': 'OCZ Technology',
  '3:43': 'Smart Modular Technologies',
  '3:83': 'GeIL',
  '3:B0': 'Ramaxel Technology',
  '3:C1': 'A-DATA Technology',
  '3:FE': 'Silicon Power',

  // Bank 5 (Continuation count = 4)
  '4:26': 'Silicon Motion',
  '4:51': 'Qimonda AG',
  '4:8A': 'Powerchip (PSC)',
  '4:B0': 'Ramaxel',
  '4:C8': 'Team Group',
  '4:CB': 'ADATA Technology',
  '4:CD': 'G.Skill International',
  '4:EF': 'Winbond',

  // Bank 6 (Continuation count = 5)
  '5:51': 'Klevv (Essencore)',
  '5:57': 'Gloway',
  '5:9B': 'Asgard',
  '5:B0': 'Ramaxel Technology',
  '5:C2': 'Maxsun',
  '5:D4': 'Inno3D',

  // Bank 7 (Continuation count = 6)
  '6:32': 'Netac Technology',
  '6:C2': 'Colorful',
  '6:CB': 'Longsys (Lexar)',

  // Bank 8 (Continuation count = 7)
  '7:51': 'Essencore (KLEVV)',
  '7:85': 'Kimtigo',
  '7:C8': 'CXMT (ChangXin Memory)',
  '7:C9': 'YMTC (Yangtze Memory)',
};

/**
 * Decode JEDEC Manufacturer from continuation count (or raw bytes) + ID byte
 * In DDR4:
 * Byte 320: Continuation Code count (bit 0-6)
 * Byte 321: Manufacturer Code (LSB with parity bit 7)
 */
export function decodeJEDECManufacturer(continuationBank: number, rawIdByte: number): { name: string; hexCode: string } {
  // Strip odd parity bit 7 for matching if needed
  const cleanId = rawIdByte & 0x7F;
  const hexByte = cleanId.toString(16).toUpperCase().padStart(2, '0');
  const rawHex = (rawIdByte & 0xFF).toString(16).toUpperCase().padStart(2, '0');

  // Try direct bank:hex format
  const key1 = `${continuationBank}:${rawHex}`;
  if (JEDEC_MANUFACTURERS[key1]) {
    return { name: JEDEC_MANUFACTURERS[key1], hexCode: `Bank ${continuationBank + 1} (0x${rawHex})` };
  }

  const key2 = `${continuationBank}:${hexByte}`;
  if (JEDEC_MANUFACTURERS[key2]) {
    return { name: JEDEC_MANUFACTURERS[key2], hexCode: `Bank ${continuationBank + 1} (0x${rawHex})` };
  }

  // Common fallbacks based on prominent ID bytes
  if (cleanId === 0x2C) return { name: 'Micron Technology', hexCode: `Bank ${continuationBank + 1} (0x${rawHex})` };
  if (cleanId === 0xCE || rawIdByte === 0xCE) return { name: 'Samsung Electronics', hexCode: `Bank 1 (0xCE)` };
  if (cleanId === 0xAD || rawIdByte === 0xAD) return { name: 'SK Hynix', hexCode: `Bank 1 (0xAD)` };
  if (cleanId === 0x98 && continuationBank === 1) return { name: 'Kingston Technology', hexCode: `Bank 2 (0x98)` };
  if (cleanId === 0x9E && continuationBank === 2) return { name: 'Corsair Memory', hexCode: `Bank 3 (0x9E)` };
  if (cleanId === 0xCD && continuationBank === 4) return { name: 'G.Skill International', hexCode: `Bank 5 (0xCD)` };
  if (cleanId === 0xCB && continuationBank === 4) return { name: 'ADATA Technology', hexCode: `Bank 5 (0xCB)` };
  if (cleanId === 0x0B) return { name: 'Nanya Technology', hexCode: `0x${rawHex}` };
  if (cleanId === 0xEF) return { name: 'Winbond', hexCode: `0x${rawHex}` };

  if (rawIdByte === 0x00 || rawIdByte === 0xFF) {
    return { name: 'Unknown / Not Programmed', hexCode: `0x${rawHex}` };
  }

  return { name: `JEDEC ID [Bank ${continuationBank + 1}, 0x${rawHex}]`, hexCode: `0x${rawHex}` };
}
