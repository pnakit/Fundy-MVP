import { useEffect, useRef, useState } from 'react';

const LABEL_COLORS = {
  ERROR: '#ef4444',
  SAVE: '#6366f1',
  'INVEST✓': '#10b981',
  'INVEST↑': '#10b981',
  MATURE: '#10b981',
  DONE: '#10b981',
};

function labelColor(label) {
  return LABEL_COLORS[label] || '#9ca3af';
}

export default function DebugPanel({ logs, onClear }) {
  const [collapsed, setCollapsed] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!collapsed && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [logs, collapsed]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: 480,
        zIndex: 9999,
        background: 'rgba(10, 10, 20, 0.95)',
        border: '1px solid rgba(99,102,241,0.4)',
        borderRadius: 8,
        fontFamily: 'monospace',
        fontSize: 11,
        boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          background: 'rgba(99,102,241,0.15)',
          borderBottom: collapsed ? 'none' : '1px solid rgba(99,102,241,0.2)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ color: '#a5b4fc', fontWeight: 600, letterSpacing: '0.05em' }}>
          ◉ DEBUG LOG {logs.length > 0 ? `(${logs.length})` : ''}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span
            style={{ color: '#6b7280', fontSize: 10, padding: '1px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: 4 }}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            clear
          </span>
          <span style={{ color: '#6b7280' }}>{collapsed ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Log body */}
      {!collapsed && (
        <div
          ref={bodyRef}
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            padding: '6px 0',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: '#4b5563', padding: '4px 10px' }}>Waiting for events…</div>
          ) : (
            logs.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: '2px 10px',
                  lineHeight: 1.5,
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
              >
                <span style={{ color: '#4b5563', flexShrink: 0 }}>{entry.ts}</span>
                <span style={{ color: labelColor(entry.label), flexShrink: 0, minWidth: 64 }}>[{entry.label}]</span>
                <span style={{ color: '#d1d5db', wordBreak: 'break-all' }}>{entry.detail ?? ''}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
