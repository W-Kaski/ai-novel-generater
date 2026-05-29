// frontend/src/components/ObsidianEditor.tsx
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Eye, Edit3 } from 'lucide-react';

interface ObsidianEditorProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}

// Strip leading Chinese full-width spaces (　) from each paragraph line
// so CSS text-indent handles indentation instead of double-indenting
function processNovelText(text: string): string {
  return text
    .split('\n')
    .map(line => line.replace(/^[　\u3000]+/, ''))
    .join('\n');
}

export default function ObsidianEditor({ value, onChange, disabled = false }: ObsidianEditorProps) {
  const [isPreview, setIsPreview] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-input)' }}>
      {/* Toggle bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.35rem 0.75rem',
        backgroundColor: '#0f0f12',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => setIsPreview(false)}
          style={{
            background: !isPreview ? 'rgba(224,108,83,0.15)' : 'transparent',
            border: !isPreview ? '1px solid rgba(224,108,83,0.4)' : '1px solid transparent',
            color: !isPreview ? 'var(--accent-light)' : 'var(--text-muted)',
            borderRadius: '3px',
            padding: '2px 10px',
            fontSize: '0.72rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <Edit3 size={11} /> 编辑
        </button>
        <button
          type="button"
          onClick={() => setIsPreview(true)}
          style={{
            background: isPreview ? 'rgba(224,108,83,0.15)' : 'transparent',
            border: isPreview ? '1px solid rgba(224,108,83,0.4)' : '1px solid transparent',
            color: isPreview ? 'var(--accent-light)' : 'var(--text-muted)',
            borderRadius: '3px',
            padding: '2px 10px',
            fontSize: '0.72rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <Eye size={11} /> 预览
        </button>
      </div>

      {/* Content area */}
      {isPreview ? (
        <div
          className="preview-markdown chapter-preview"
          style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', border: 'none', borderRadius: 0 }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{processNovelText(value)}</ReactMarkdown>
        </div>
      ) : (
        <textarea
          className="editor-textarea"
          style={{
            flex: 1,
            borderRadius: 0,
            border: 'none',
            padding: '1.25rem',
            fontSize: '0.92rem',
            lineHeight: '1.75',
            fontFamily: 'inherit',
            resize: 'none',
            overflowY: 'auto',
          }}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder="章节内容将在此显示，生成或加载后可直接编辑..."
          spellCheck={false}
        />
      )}
    </div>
  );
}
