import React, { useState } from 'react';
import { X, HelpCircle, HardDrive, Cpu, Radio, Copy, Check, Terminal, ExternalLink } from 'lucide-react';

interface HardwareGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HardwareGuideModal: React.FC<HardwareGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'ch341a' | 'ddr_pinouts' | 'esp32' | 'drivers'>('ch341a');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const esp32Code = `// =========================================================================
// ESP32 / Arduino High-Speed I2C / SMBus SPD RAM Programmer Bridge
// Compatible with SPD Programmer Pro Web Interface via WebSerial (115200)
// =========================================================================
#include <Wire.h>

#define I2C_SDA_PIN 21   // Change for your board (e.g. GPIO21 for ESP32)
#define I2C_SCL_PIN 22   // Change for your board (e.g. GPIO22 for ESP32)
#define I2C_FREQ    400000 // 400kHz Fast Mode I2C

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, I2C_FREQ);
  while (!Serial) { delay(10); }
  Serial.println("SPD_PROGRAMMER_BRIDGE_READY:v1.2");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    
    if (cmd == "PING") {
      Serial.println("PONG:ESP32_SPD_OK");
    } else if (cmd == "SCAN") {
      // Scan I2C addresses 0x50 to 0x57
      for (uint8_t addr = 0x50; addr <= 0x57; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
          Serial.printf("SLOT_DETECTED:0x%02X\\n", addr);
        }
      }
      Serial.println("SCAN_DONE");
    } else if (cmd.startsWith("READ ")) {
      // Syntax: READ <i2c_addr> <offset> <length>
      int addr, offset, len;
      sscanf(cmd.c_str(), "READ %x %d %d", &addr, &offset, &len);
      
      Wire.beginTransmission((uint8_t)addr);
      Wire.write((uint8_t)offset);
      Wire.endTransmission(false);
      
      Wire.requestFrom((uint8_t)addr, (uint8_t)len);
      Serial.print("DATA:");
      while (Wire.available()) {
        uint8_t b = Wire.read();
        Serial.printf("%02X", b);
      }
      Serial.println();
    } else if (cmd.startsWith("WRITE ")) {
      // Syntax: WRITE <i2c_addr> <offset> <hex_byte>
      int addr, offset, val;
      sscanf(cmd.c_str(), "WRITE %x %d %x", &addr, &offset, &val);
      
      Wire.beginTransmission((uint8_t)addr);
      Wire.write((uint8_t)offset);
      Wire.write((uint8_t)val);
      uint8_t err = Wire.endTransmission();
      delay(5); // EEPROM tWR cycle
      Serial.println(err == 0 ? "WRITE_OK" : "WRITE_ERR");
    }
  }
}`;

  const copyCode = () => {
    navigator.clipboard.writeText(esp32Code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden text-neutral-200 font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-950 border-b border-neutral-800">
          <div className="flex items-center space-x-2 text-sky-400 font-bold">
            <HelpCircle className="w-4 h-4" />
            <span className="text-sm">Hardware Wiring, Pinout & Programmer Guide</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-1 px-4 py-2 bg-neutral-950 border-b border-neutral-800 text-xs">
          <button
            onClick={() => setActiveTab('ch341a')}
            className={`px-3 py-1 rounded transition-all ${
              activeTab === 'ch341a' ? 'bg-neutral-800 text-amber-300 font-bold border border-neutral-700' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            CH341A Wiring
          </button>
          <button
            onClick={() => setActiveTab('ddr_pinouts')}
            className={`px-3 py-1 rounded transition-all ${
              activeTab === 'ddr_pinouts' ? 'bg-neutral-800 text-amber-300 font-bold border border-neutral-700' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            DDR3 / DDR4 RAM Pinouts
          </button>
          <button
            onClick={() => setActiveTab('esp32')}
            className={`px-3 py-1 rounded transition-all ${
              activeTab === 'esp32' ? 'bg-neutral-800 text-amber-300 font-bold border border-neutral-700' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            ESP32 / Arduino Bridge (DIY)
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`px-3 py-1 rounded transition-all ${
              activeTab === 'drivers' ? 'bg-neutral-800 text-amber-300 font-bold border border-neutral-700' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Windows Driver Setup
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4 font-sans text-xs">
          {activeTab === 'ch341a' && (
            <div className="space-y-3 font-mono">
              <div className="text-sm font-bold text-amber-300">
                CH341A USB Programmer to RAM SPD EEPROM Connection (I2C / 24Cxx Mode)
              </div>
              <div className="text-neutral-300 leading-relaxed font-sans">
                The CH341A programmer (Black / Green PCB) supports 24Cxx I2C EEPROMs directly. Ensure the yellow jumper is set to <span className="font-bold text-amber-400">I2C / 24Cxx Mode</span> (Pins 1-2 shorted, NOT SPI mode).
              </div>

              <div className="p-3 bg-neutral-950 border border-neutral-800 rounded font-mono text-xs space-y-1">
                <div className="text-sky-400 font-bold">CH341A 24Cxx Socket Pinout:</div>
                <div>• Pin 8: <span className="text-emerald-400 font-bold">VCC (3.3V)</span> ─── connect to RAM VDDSPD (Pin 286 on DDR4 UDIMM)</div>
                <div>• Pin 7: <span className="text-amber-400 font-bold">WP (Write Protect)</span> ─── connect to GND to allow EEPROM write</div>
                <div>• Pin 6: <span className="text-sky-400 font-bold">SCL (Clock)</span> ───────── connect to RAM SCL (Pin 288 on DDR4 UDIMM)</div>
                <div>• Pin 5: <span className="text-sky-400 font-bold">SDA (Data)</span> ────────── connect to RAM SDA (Pin 287 on DDR4 UDIMM)</div>
                <div>• Pin 4: <span className="text-neutral-400 font-bold">GND</span> ──────────────── connect to RAM GND (Pin 283 on DDR4 UDIMM)</div>
                <div>• Pin 1, 2, 3: <span className="text-neutral-400">A0, A1, A2 (Address)</span> ─── connect to GND for I2C Address 0x50 (Slot 0)</div>
              </div>

              <div className="p-2.5 bg-neutral-950 rounded border border-neutral-800 text-[11px] text-neutral-400 font-sans">
                💡 <span className="font-bold text-neutral-200">Tip for Laptop SO-DIMM:</span> Use a dedicated DDR4/DDR3 SO-DIMM test socket or clip (e.g. SOIC-8 test clip on the onboard 34TS04 / AT24C02 chip).
              </div>
            </div>
          )}

          {activeTab === 'ddr_pinouts' && (
            <div className="space-y-3 font-mono">
              <div className="text-sm font-bold text-sky-300">
                JEDEC Standard DDR4 & DDR3 SPD Connector Pinouts
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* DDR4 288-pin UDIMM */}
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded space-y-1">
                  <div className="text-amber-300 font-bold border-b border-neutral-800 pb-1">
                    DDR4 288-Pin Desktop UDIMM
                  </div>
                  <div>• Pin 286: <span className="text-emerald-400 font-bold">VDDSPD (3.3V Power)</span></div>
                  <div>• Pin 287: <span className="text-sky-400 font-bold">SDA (SMBus I2C Data)</span></div>
                  <div>• Pin 288: <span className="text-sky-400 font-bold">SCL (SMBus I2C Clock)</span></div>
                  <div>• Pin 284: <span className="text-purple-300">SA0 (Address bit 0)</span></div>
                  <div>• Pin 285: <span className="text-purple-300">SA1 (Address bit 1)</span></div>
                  <div>• Pin 283: <span className="text-neutral-400 font-bold">VSS (GND)</span></div>
                </div>

                {/* DDR4 260-pin SO-DIMM */}
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded space-y-1">
                  <div className="text-amber-300 font-bold border-b border-neutral-800 pb-1">
                    DDR4 260-Pin Laptop SO-DIMM
                  </div>
                  <div>• Pin 255: <span className="text-emerald-400 font-bold">VDDSPD (3.3V Power)</span></div>
                  <div>• Pin 253: <span className="text-sky-400 font-bold">SDA (SMBus I2C Data)</span></div>
                  <div>• Pin 254: <span className="text-sky-400 font-bold">SCL (SMBus I2C Clock)</span></div>
                  <div>• Pin 256: <span className="text-purple-300">SA0 (Address bit 0)</span></div>
                  <div>• Pin 257: <span className="text-purple-300">SA1 (Address bit 1)</span></div>
                  <div>• Pin 259: <span className="text-neutral-400 font-bold">VSS (GND)</span></div>
                </div>

                {/* DDR3 240-pin UDIMM */}
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded space-y-1">
                  <div className="text-indigo-300 font-bold border-b border-neutral-800 pb-1">
                    DDR3 240-Pin Desktop UDIMM
                  </div>
                  <div>• Pin 236: <span className="text-emerald-400 font-bold">VDDSPD (3.3V Power)</span></div>
                  <div>• Pin 238: <span className="text-sky-400 font-bold">SDA (SMBus I2C Data)</span></div>
                  <div>• Pin 237: <span className="text-sky-400 font-bold">SCL (SMBus I2C Clock)</span></div>
                  <div>• Pin 118: <span className="text-purple-300">SA0</span> | Pin 119: <span className="text-purple-300">SA1</span></div>
                  <div>• Pin 239: <span className="text-neutral-400 font-bold">VSS (GND)</span></div>
                </div>

                {/* DDR3 204-pin SO-DIMM */}
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded space-y-1">
                  <div className="text-indigo-300 font-bold border-b border-neutral-800 pb-1">
                    DDR3 204-Pin Laptop SO-DIMM
                  </div>
                  <div>• Pin 199: <span className="text-emerald-400 font-bold">VDDSPD (3.3V Power)</span></div>
                  <div>• Pin 200: <span className="text-sky-400 font-bold">SDA (SMBus I2C Data)</span></div>
                  <div>• Pin 202: <span className="text-sky-400 font-bold">SCL (SMBus I2C Clock)</span></div>
                  <div>• Pin 201: <span className="text-neutral-400 font-bold">VSS (GND)</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'esp32' && (
            <div className="space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-300">
                  ESP32 / ESP32-S3 / Arduino Nano USB-to-SMBus Bridge Firmware
                </span>
                <button
                  onClick={copyCode}
                  className="flex items-center space-x-1 px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-semibold shadow"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied Arduino Code!' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="text-neutral-300 text-xs font-sans">
                Flash this firmware onto any ESP32, ESP32-S3, or Arduino board via Arduino IDE. Plug into your computer via USB and click <span className="font-bold text-amber-300">Connect</span> with <span className="font-bold text-sky-300">ESP32 Bridge</span> selected in this app.
              </div>

              <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded overflow-x-auto text-[11px] text-neutral-300 max-h-60">
                <code>{esp32Code}</code>
              </pre>
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="space-y-3 font-mono">
              <div className="text-sm font-bold text-purple-300">
                Windows Driver Setup for WebUSB & WebSerial
              </div>

              <div className="space-y-2 text-xs font-sans text-neutral-300">
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded space-y-1">
                  <div className="font-bold text-amber-300 font-mono">Option 1: WebSerial Mode (Recommended)</div>
                  <div>1. Install official <span className="font-mono text-sky-400">CH341SER.EXE</span> driver from WCH.</div>
                  <div>2. Plug CH341A into USB. It will appear as a COM Port (e.g. COM3).</div>
                  <div>3. In Chrome/Edge, click "Connect" and select your CH341 COM Port.</div>
                </div>

                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded space-y-1">
                  <div className="font-bold text-emerald-300 font-mono">Option 2: Direct WebUSB (WinUSB with Zadig)</div>
                  <div>1. Download <span className="font-mono text-sky-400">Zadig</span> (zadig.akeo.ie).</div>
                  <div>2. Select "CH341A" under Options -&gt; List All Devices.</div>
                  <div>3. Replace driver with <span className="font-mono text-emerald-400 font-bold">WinUSB (v6.1.7600.16385)</span>.</div>
                  <div>4. Chrome will be able to access the raw USB endpoints directly.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 text-right">
          <button onClick={onClose} className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium">
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
