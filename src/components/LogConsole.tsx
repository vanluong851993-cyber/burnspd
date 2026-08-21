import React, { useState, useRef, useEffect } from 'react';
import { LogEntry, LogLevel } from '../types';
import { Terminal, Trash2, Copy, Download, ChevronUp, ChevronDown, Check } from 'lucide-react';

interface LogConsoleProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const LogConsole: React.FC<LogConsoleProps> = ({ logs, onClearLogs }) => {
  const [filter, setFilter] = useState<'ALL' | LogLevel>('ALL');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filter === 'ALL' ? logs : logs.filter(l => l.level === filter);

  useEffect(() => {
    if (!isCollapsed) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isCollapsed]);

  const copyAllLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportLogFile = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPD_Programmer_Log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-neutral-950 border-t border-neutral-800 text-neutral-200 font-mono text-xs select-none flex flex-col">
      {/* Console Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900 border-b border-neutral-800 text-[11px]">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-bold uppercase tracking-wider text-neutral-300">
            System & Hardware Telemetry Log
          </span>
          <span className="text-neutral-500">({logs.length} entries)</span>

          <div className="h-3 w-px bg-neutral-800 mx-1" />

          {/* Filters */}
          <div className="flex items-center space-x-1">
            {(['ALL', LogLevel.INFO, LogLevel.SUCCESS, LogLevel.WARNING, LogLevel.ERROR] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-1.5 py-0.2 rounded text-[10px] font-semibold transition-colors ${
                  filter === f
                    ? 'bg-neutral-800 text-amber-300 border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1">
          <button
            onClick={copyAllLogs}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            title="Copy all logs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={exportLogFile}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            title="Export log as .txt"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClearLogs}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
            title={isCollapsed ? 'Expand console' : 'Collapse console'}
          >
            {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Log Entries Container */}
      {!isCollapsed && (
        <div className="h-28 overflow-y-auto p-2 space-y-1 font-mono text-[11px] select-text bg-neutral-950">
          {filteredLogs.length === 0 ? (
            <div className="text-neutral-600 italic">No log entries.</div>
          ) : (
            filteredLogs.map(l => {
              let levelColor = 'text-sky-300';
              let badgeBg = 'bg-sky-950/60 border-sky-800 text-sky-400';

              if (l.level === LogLevel.SUCCESS) {
                levelColor = 'text-emerald-300';
                badgeBg = 'bg-emerald-950/60 border-emerald-800 text-emerald-400';
              } else if (l.level === LogLevel.WARNING) {
                levelColor = 'text-amber-300';
                badgeBg = 'bg-amber-950/60 border-amber-800 text-amber-400';
              } else if (l.level === LogLevel.ERROR) {
                levelColor = 'text-rose-300 font-bold';
                badgeBg = 'bg-rose-950/80 border-rose-700 text-rose-300';
              } else if (l.level === LogLevel.PROTOCOL) {
                levelColor = 'text-purple-300';
                badgeBg = 'bg-purple-950/60 border-purple-800 text-purple-400';
              }

              return (
                <div key={l.id} className="flex items-start space-x-2 leading-tight">
                  <span className="text-neutral-500 shrink-0">[{l.timestamp}]</span>
                  <span className={`px-1 py-0.2 rounded border text-[9px] font-bold shrink-0 ${badgeBg}`}>
                    {l.level}
                  </span>
                  <span className={`flex-1 break-all ${levelColor}`}>{l.message}</span>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
};
