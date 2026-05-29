// frontend/src/components/LogTerminal.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE } from '../api';

interface LogLine {
  text: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'meta';
  timestamp: string;
}

export default function LogTerminal() {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Open Server-Sent Events stream from FastAPI
    const sse = new EventSource(`${API_BASE}/api/logs`);

    sse.onopen = () => {
      setIsConnected(true);
    };

    sse.onerror = () => {
      setIsConnected(false);
    };

    sse.onmessage = (event) => {
      const data = event.data;
      if (data === 'ping') return; // Skip heartbeat

      // Determine log category/type
      let type: 'info' | 'success' | 'warning' | 'error' | 'meta' = 'info';
      let cleanText = data;

      if (data.includes('✅') || data.includes('成功') || data.includes('done')) {
        type = 'success';
      } else if (data.includes('❌') || data.includes('Error') || data.includes('failed') || data.includes('出错') || data.includes('🛑')) {
        type = 'error';
      } else if (data.includes('⚠️') || data.includes('warning') || data.includes('警告')) {
        type = 'warning';
      } else if (data.startsWith('---') || data.includes('🚀') || data.includes('开始')) {
        type = 'meta';
      }

      const timestamp = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev, { text: cleanText, type, timestamp }]);
    };

    return () => {
      sse.close();
    };
  }, []);

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs]);

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="terminal-container" style={collapsed ? { height: 'auto' } : {}}>
      <div className="terminal-header">
        <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="terminal-dots">
            <span className="dot dot-red"></span>
            <span className="dot dot-yellow"></span>
            <span className="dot dot-green"></span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#94a3b8' }}>
            <Terminal size={14} /> AI 创作轨迹终端
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.75rem', color: isConnected ? '#10b981' : '#ef4444' }}>
            ● {isConnected ? '已连接' : '未连接'}
          </span>
          <button 
            onClick={clearLogs}
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="清空终端"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title={collapsed ? '展开终端' : '收起终端'}
          >
            {collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="terminal-body" ref={bodyRef}>
          {logs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', gap: '0.5rem' }}>
              <ShieldAlert size={28} style={{ opacity: 0.5 }} />
              <span>暂无生成轨迹，开启下方大纲或章节创作吧...</span>
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={`log-line log-${log.type}`}>
                <span className="log-meta">[{log.timestamp}] </span>
                {log.text}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
