// frontend/src/components/MarkdownWorkspace.tsx
import React from 'react';
import { Save } from 'lucide-react';
import ObsidianEditor from './ObsidianEditor';
import { getChineseWordCount } from '../utils/wordCount';

interface MarkdownWorkspaceProps {
  title: string;
  content: string;
  onChange: (val: string) => void;
  onSave: () => void;
  wordCount: number;
  loading?: boolean;
  actions?: React.ReactNode;
}

export default function MarkdownWorkspace({ title, content, onChange, onSave, wordCount, loading = false, actions }: MarkdownWorkspaceProps) {
  // Chinese character word count — shared utility from utils/wordCount.ts
  const localWordCount = wordCount || getChineseWordCount(content);

  return (
    <div className="full-editor-workspace">
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', marginBottom: '0.5rem', flexShrink: 0 }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>{title}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            当前字数: <strong style={{ color: '#fff' }}>{localWordCount}</strong> 字
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {actions}
          <button
            className="btn-primary"
            onClick={onSave}
            disabled={loading}
            style={{ padding: '0.45rem 1rem', fontSize: '0.8rem' }}
          >
            <Save size={14} /> 保存当前修改
          </button>
        </div>
      </div>

      {/* Editor — ObsidianEditor has built-in edit/preview toggle */}
      <ObsidianEditor
        value={content}
        onChange={onChange}
        disabled={loading}
      />
    </div>
  );
}

