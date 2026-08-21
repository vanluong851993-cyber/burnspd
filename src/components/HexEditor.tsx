import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  ArrowRight,
  Copy,
  ClipboardPaste,
  RotateCcw,
  Check,
  Hash,
  Binary,
  Type,
  FileCode,
  Sparkles
} from 'lucide-react';
import { SPDParsedInfo } from '../types';

interface HexEditorProps {
  data: Uint8Array;
  originalData: Uint8Array;
  spdInfo: SPDParsedInfo | null;
  onByteChange: (offset: number, newValue: number) => void;
  onBytesChange: (changes: { offset: number; value: number }[]) => void;
  selectedOffset: number;
  onSelectOffset: (offset: number) => void;
}

export const HexEditor: React.FC<HexEditorProps> = ({
  data,
  originalData,
  spdInfo,
  onByteChange,
  onBytesChange,
  selectedOffset,
  onSelectOffset
}) => {
  // Editing state
  const [editingOffset, setEditingOffset] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchType, setSearchType] = useState<'hex' | 'ascii' | 'offset'>('hex');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState<number>(-1);

  // Converter tool
  const [converterValue, setConverterValue] = useState<string>('0');

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const bytesPerRow = 16;
  const totalRows = Math.ceil(data.length / bytesPerRow);

  // Focus input when editing starts
  useEffect(() => {
    if (editingOffset !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingOffset]);

  // Handle Search Execution
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      return;
    }

    const matches: number[] = [];

    if (searchType === 'offset') {
      let offset = 0;
      if (searchQuery.toLowerCase().startsWith('0x')) {
        offset = parseInt(searchQuery, 16);
      } else {
        offset = parseInt(searchQuery, 10);
      }
      if (!isNaN(offset) && offset >= 0 && offset < data.length) {
        matches.push(offset);
      }
    } else if (searchType === 'hex') {
      const cleanQuery = searchQuery.replace(/[^0-9A-Fa-f]/g, '');
      if (cleanQuery.length >= 2) {
        const queryBytes: number[] = [];
        for (let i = 0; i < cleanQuery.length; i += 2) {
          queryBytes.push(parseInt(cleanQuery.substr(i, 2), 16));
        }

        for (let i = 0; i <= data.length - queryBytes.length; i++) {
          let match = true;
          for (let j = 0; j < queryBytes.length; j++) {
            if (data[i + j] !== queryBytes[j]) {
              match = false;
              break;
            }
          }
          if (match) matches.push(i);
        }
      }
    } else if (searchType === 'ascii') {
      const queryStr = searchQuery.toLowerCase();
      for (let i = 0; i <= data.length - queryStr.length; i++) {
        let match = true;
        for (let j = 0; j < queryStr.length; j++) {
          if (String.fromCharCode(data[i + j]).toLowerCase() !== queryStr[j]) {
            match = false;
            break;
          }
        }
        if (match) matches.push(i);
      }
    }

    setSearchResults(matches);
    if (matches.length > 0) {
      setCurrentSearchIndex(0);
      onSelectOffset(matches[0]);
      scrollToOffset(matches[0]);
    } else {
      setCurrentSearchIndex(-1);
    }
  }, [searchQuery, searchType, data, onSelectOffset]);

  const handleNextSearch = () => {
    if (searchResults.length === 0) return;
    const nextIdx = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIdx);
    onSelectOffset(searchResults[nextIdx]);
    scrollToOffset(searchResults[nextIdx]);
  };

  const scrollToOffset = (offset: number) => {
    const row = Math.floor(offset / bytesPerRow);
    const rowElem = document.getElementById(`hex-row-${row}`);
    if (rowElem) {
      rowElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Keyboard navigation & Shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingOffset !== null) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        if (editingOffset < data.length - 1) {
          startEdit(editingOffset + 1);
        }
      } else if (e.key === 'Escape') {
        cancelEdit();
      }
      return;
    }

    // Ctrl+C Copy
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      copySelection('hex');
      return;
    }

    // Navigation Keys
    let nextOffset = selectedOffset;
    if (e.key === 'ArrowRight') {
      nextOffset = Math.min(data.length - 1, selectedOffset + 1);
    } else if (e.key === 'ArrowLeft') {
      nextOffset = Math.max(0, selectedOffset - 1);
    } else if (e.key === 'ArrowDown') {
      nextOffset = Math.min(data.length - 1, selectedOffset + bytesPerRow);
    } else if (e.key === 'ArrowUp') {
      nextOffset = Math.max(0, selectedOffset - 16);
    } else if (e.key === 'Home') {
      nextOffset = 0;
    } else if (e.key === 'End') {
      nextOffset = data.length - 1;
    } else if (e.key === 'Enter') {
      startEdit(selectedOffset);
      return;
    } else if (/^[0-9a-fA-F]$/.test(e.key)) {
      startEdit(selectedOffset, e.key.toUpperCase());
      return;
    }

    if (nextOffset !== selectedOffset) {
      e.preventDefault();
      onSelectOffset(nextOffset);
      scrollToOffset(nextOffset);
    }
  };

  const startEdit = (offset: number, initialChar?: string) => {
    setEditingOffset(offset);
    setEditBuffer(initialChar || data[offset].toString(16).toUpperCase().padStart(2, '0'));
    onSelectOffset(offset);
  };

  const commitEdit = () => {
    if (editingOffset === null) return;
    const parsed = parseInt(editBuffer, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFF) {
      if (data[editingOffset] !== parsed) {
        onByteChange(editingOffset, parsed);
      }
    }
    setEditingOffset(null);
    setEditBuffer('');
  };

  const cancelEdit = () => {
    setEditingOffset(null);
    setEditBuffer('');
  };

  // Copy helpers
  const copySelection = (format: 'hex' | 'c_array' | 'ascii' | 'dec') => {
    const start = selectionRange ? Math.min(selectionRange.start, selectionRange.end) : selectedOffset;
    const end = selectionRange ? Math.max(selectionRange.start, selectionRange.end) : selectedOffset;
    const slice = data.slice(start, end + 1);

    let text = '';
    const bytes = Array.from(slice) as number[];
    if (format === 'hex') {
      text = bytes.map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    } else if (format === 'c_array') {
      text = bytes.map((b: number) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(', ');
    } else if (format === 'ascii') {
      text = bytes.map((b: number) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
    } else if (format === 'dec') {
      text = bytes.join(' ');
    }

    navigator.clipboard.writeText(text);
    setCopiedNotification(`Copied ${slice.length} byte(s) as ${format.toUpperCase()}`);
    setTimeout(() => setCopiedNotification(null), 2000);
  };

  // Selected byte details
  const currentByteVal = data[selectedOffset] !== undefined ? data[selectedOffset] : 0;
  const originalByteVal = originalData[selectedOffset] !== undefined ? originalData[selectedOffset] : currentByteVal;
  const isByteModified = currentByteVal !== originalByteVal;

  const jedecFieldInfo = spdInfo?.byteMap?.[selectedOffset] || null;

  return (
    <div
      className="flex flex-col h-full bg-neutral-950 text-neutral-200 select-none font-mono focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={editorContainerRef}
    >
      {/* Top Search, Inspector & Converter Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 gap-2 text-xs">
        {/* Search Controls */}
        <div className="flex items-center space-x-1.5">
          <div className="flex items-center space-x-1 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-700">
            <Search className="w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder={searchType === 'hex' ? 'Search HEX (e.g. 0C 4A)...' : (searchType === 'ascii' ? 'Search ASCII...' : 'Go to Offset (0x100)...')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              className="bg-transparent text-xs text-neutral-200 focus:outline-none w-44 font-mono placeholder:text-neutral-600"
            />
          </div>

          <select
            value={searchType}
            onChange={e => setSearchType(e.target.value as any)}
            className="bg-neutral-950 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-neutral-300 focus:outline-none"
          >
            <option value="hex">HEX</option>
            <option value="ascii">ASCII</option>
            <option value="offset">Offset</option>
          </select>

          <button
            onClick={handleSearch}
            className="px-2 py-0.5 rounded bg-sky-700 hover:bg-sky-600 text-white text-xs font-semibold"
          >
            Find
          </button>

          {searchResults.length > 0 && (
            <div className="flex items-center space-x-1 text-[11px] text-neutral-400">
              <span>{currentSearchIndex + 1}/{searchResults.length}</span>
              <button
                onClick={handleNextSearch}
                className="p-0.5 hover:text-white"
                title="Next match"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Copy Tools & Quick Format Actions */}
        <div className="flex items-center space-x-2">
          {copiedNotification && (
            <span className="text-[11px] text-emerald-400 font-semibold animate-pulse">
              ✓ {copiedNotification}
            </span>
          )}

          <div className="flex items-center space-x-1 bg-neutral-950 p-0.5 rounded border border-neutral-800 text-[11px]">
            <span className="text-neutral-500 px-1">Copy:</span>
            <button
              onClick={() => copySelection('hex')}
              className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="Copy as Space-Separated HEX"
            >
              HEX
            </button>
            <button
              onClick={() => copySelection('c_array')}
              className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="Copy as C / C++ Array Format (0x00, 0x01, ...)"
            >
              C-Array
            </button>
            <button
              onClick={() => copySelection('ascii')}
              className="px-1.5 py-0.5 rounded hover:bg-neutral-800 text-neutral-300"
              title="Copy ASCII String"
            >
              ASCII
            </button>
          </div>
        </div>
      </div>

      {/* Selected Byte Technical Inspector Banner */}
      <div className="px-3 py-1.5 bg-neutral-900/60 border-b border-neutral-800/80 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="text-neutral-400">Offset:</span>
            <span className="text-amber-400 font-bold">
              0x{selectedOffset.toString(16).toUpperCase().padStart(4, '0')}
            </span>
            <span className="text-neutral-500 text-[11px]">
              (Dec: {selectedOffset})
            </span>
          </div>

          <div className="h-3 w-px bg-neutral-700" />

          <div className="flex items-center space-x-3">
            <div>
              <span className="text-neutral-400">HEX: </span>
              <span className="text-sky-300 font-bold">
                0x{currentByteVal.toString(16).toUpperCase().padStart(2, '0')}
              </span>
            </div>

            <div>
              <span className="text-neutral-400">DEC: </span>
              <span className="text-emerald-300">
                {currentByteVal}
              </span>
            </div>

            <div>
              <span className="text-neutral-400">BIN: </span>
              <span className="text-purple-300">
                {currentByteVal.toString(2).padStart(8, '0')}
              </span>
            </div>

            <div>
              <span className="text-neutral-400">ASCII: </span>
              <span className="text-amber-300">
                {currentByteVal >= 32 && currentByteVal <= 126 ? `'${String.fromCharCode(currentByteVal)}'` : '•'}
              </span>
            </div>

            {isByteModified && (
              <span className="px-1.5 py-0.2 bg-amber-950 border border-amber-700 text-amber-300 text-[10px] rounded font-bold">
                MODIFIED (Orig: 0x{originalByteVal.toString(16).toUpperCase().padStart(2, '0')})
              </span>
            )}
          </div>
        </div>

        {/* JEDEC Field Name Indicator */}
        <div className="flex items-center space-x-1 text-neutral-300 text-[11px] truncate max-w-md">
          {jedecFieldInfo ? (
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-sky-300 font-sans">
              <span className="font-bold text-neutral-400 font-mono">[{jedecFieldInfo.section}] </span>
              {jedecFieldInfo.name}
            </span>
          ) : (
            <span className="text-neutral-500 italic text-[10px]">
              Offset 0x{selectedOffset.toString(16).toUpperCase().padStart(3, '0')} (Vendor / Extension Field)
            </span>
          )}
        </div>
      </div>

      {/* Main HEX & ASCII Data Grid */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs select-text">
        <div className="inline-block min-w-full">
          {/* Header Row: Offset + 00..0F + ASCII Header */}
          <div className="flex items-center text-neutral-400 font-bold border-b border-neutral-800 pb-1 mb-1 select-none">
            <div className="w-24 text-neutral-400 pr-2 text-right">Offset (h)</div>
            <div className="w-2 text-neutral-400 text-center">|</div>
            <div className="grid grid-cols-16 gap-1 px-2 text-center w-[460px]">
              {Array.from({ length: 16 }).map((_, i) => (
                <span
                  key={i}
                  className={`w-6 text-center ${selectedOffset % 16 === i ? 'text-amber-400 font-bold' : ''}`}
                >
                  {i.toString(16).toUpperCase().padStart(2, '0')}
                </span>
              ))}
            </div>
            <div className="w-2 text-neutral-400 text-center">|</div>
            <div className="w-48 pl-2 text-left">Decoded ASCII</div>
          </div>

          {/* Hex Lines */}
          {Array.from({ length: totalRows }).map((_, rowIdx) => {
            const rowStart = rowIdx * bytesPerRow;
            const isSelectedRow = Math.floor(selectedOffset / bytesPerRow) === rowIdx;

            return (
              <div
                key={rowIdx}
                id={`hex-row-${rowIdx}`}
                className={`flex items-center hover:bg-neutral-900/60 py-0.5 transition-colors ${
                  isSelectedRow ? 'bg-neutral-900/40' : ''
                }`}
              >
                {/* Address Offset */}
                <div className={`w-24 text-right pr-2 select-none ${isSelectedRow ? 'text-amber-400 font-bold' : 'text-neutral-400'}`}>
                  0x{rowStart.toString(16).toUpperCase().padStart(6, '0')}
                </div>

                <div className="w-2 text-neutral-400 text-center select-none">|</div>

                {/* 16 Hex Bytes */}
                <div className="grid grid-cols-16 gap-1 px-2 text-center w-[460px]">
                  {Array.from({ length: 16 }).map((_, colIdx) => {
                    const offset = rowStart + colIdx;
                    if (offset >= data.length) {
                      return <span key={colIdx} className="w-6 text-neutral-700">--</span>;
                    }

                    const val = data[offset];
                    const origVal = originalData[offset];
                    const isSelected = selectedOffset === offset;
                    const isModified = origVal !== undefined && val !== origVal;
                    const isSearchResult = searchResults.includes(offset);
                    const isCurrentSearch = searchResults[currentSearchIndex] === offset;
                    const isEditing = editingOffset === offset;

                    // Section color coding
                    let sectionStyle = 'text-neutral-300';
                    if (offset >= 0 && offset <= 3) sectionStyle = 'text-indigo-300'; // Header
                    else if (offset >= 4 && offset <= 17) sectionStyle = 'text-sky-300'; // Config
                    else if (offset >= 18 && offset <= 37) sectionStyle = 'text-emerald-300'; // Timings
                    else if ((offset >= 126 && offset <= 127) || (offset >= 254 && offset <= 255)) sectionStyle = 'text-rose-400 font-bold'; // CRC
                    else if (offset >= 320 && offset <= 324) sectionStyle = 'text-amber-300'; // Mfg
                    else if (offset >= 325 && offset <= 348) sectionStyle = 'text-purple-300'; // Serial & Part#

                    return (
                      <div
                        key={colIdx}
                        onClick={() => onSelectOffset(offset)}
                        onDoubleClick={() => startEdit(offset)}
                        className={`w-6 h-5 flex items-center justify-center rounded cursor-pointer transition-all ${
                          isEditing
                            ? 'bg-amber-500 text-black font-bold ring-2 ring-amber-300'
                            : isSelected
                            ? 'bg-sky-600 text-white font-bold shadow ring-1 ring-sky-300'
                            : isCurrentSearch
                            ? 'bg-purple-600 text-white font-bold ring-1 ring-purple-300'
                            : isSearchResult
                            ? 'bg-purple-950 text-purple-300'
                            : isModified
                            ? 'bg-amber-950/80 text-amber-300 font-bold border border-amber-600'
                            : `hover:bg-neutral-800 ${sectionStyle}`
                        }`}
                      >
                        {isEditing ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            maxLength={2}
                            value={editBuffer}
                            onChange={e => setEditBuffer(e.target.value.toUpperCase())}
                            onBlur={commitEdit}
                            className="w-full text-center bg-transparent text-black font-bold outline-none uppercase"
                          />
                        ) : (
                          val.toString(16).toUpperCase().padStart(2, '0')
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="w-2 text-neutral-400 text-center select-none">|</div>

                {/* 16 ASCII Characters */}
                <div className="w-48 pl-2 tracking-widest text-neutral-400 select-text flex items-center">
                  {Array.from({ length: 16 }).map((_, colIdx) => {
                    const offset = rowStart + colIdx;
                    if (offset >= data.length) return null;

                    const val = data[offset];
                    const isSelected = selectedOffset === offset;
                    const char = val >= 32 && val <= 126 ? String.fromCharCode(val) : '.';

                    return (
                      <span
                        key={colIdx}
                        onClick={() => onSelectOffset(offset)}
                        className={`cursor-pointer inline-block w-2.5 text-center ${
                          isSelected ? 'bg-sky-600 text-white font-bold' : (char !== '.' ? 'text-neutral-200' : 'text-neutral-600')
                        }`}
                      >
                        {char}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
