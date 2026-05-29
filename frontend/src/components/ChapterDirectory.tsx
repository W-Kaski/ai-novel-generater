// frontend/src/components/ChapterDirectory.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Save,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Edit2,
  Check,
  Layers
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChapterDirectoryProps {
  content: string;
  onChange: (val: string) => void;
  onSave: () => void;
}

interface ChapterItem {
  id: string;
  number: number;
  title: string;
  volume: string;
  outline: string;        // raw serialized form stored in file
  summary: string;        // 本章概括
  goal: string;           // 剧情目标
  opening: string;        // 开头设计
  conflict: string;       // 核心冲突
  beats: string;          // 关键情节节点
  ending: string;         // 结尾设计
}

const STRUCTURED_FIELDS: { key: keyof ChapterItem; label: string; rx: RegExp }[] = [
  { key: 'summary',  label: '本章概括',     rx: /^本章概括[：:]\s*/ },
  { key: 'goal',     label: '剧情目标',     rx: /^剧情目标[：:]\s*/ },
  { key: 'opening',  label: '开头设计',     rx: /^开头设计[：:]\s*/ },
  { key: 'conflict', label: '核心冲突',     rx: /^核心冲突[：:]\s*/ },
  { key: 'beats',    label: '关键情节节点', rx: /^关键情节节点[：:]\s*/ },
  { key: 'ending',   label: '结尾设计',     rx: /^结尾设计[：:]\s*/ },
];

const EMPTY_STRUCTURED: Pick<ChapterItem, 'summary'|'goal'|'opening'|'conflict'|'beats'|'ending'> = {
  summary: '', goal: '', opening: '', conflict: '', beats: '', ending: '',
};

function parseStructuredFields(outline: string): typeof EMPTY_STRUCTURED {
  const result = { ...EMPTY_STRUCTURED };
  for (const line of outline.split('\n')) {
    for (const f of STRUCTURED_FIELDS) {
      if (f.rx.test(line)) {
        (result as Record<string, string>)[f.key as string] = line.replace(f.rx, '').trim();
        break;
      }
    }
  }
  return result;
}

function serializeStructuredFields(ch: ChapterItem): string {
  return STRUCTURED_FIELDS
    .filter(f => (ch[f.key] as string).trim())
    .map(f => `${f.label}：${ch[f.key]}`)
    .join('\n');
}

function countFilledFields(ch: ChapterItem): number {
  return STRUCTURED_FIELDS.filter(f => (ch[f.key] as string).trim()).length;
}

export default function ChapterDirectory({ content, onChange, onSave }: ChapterDirectoryProps) {
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<string>('全部');
  const [editingCardIds, setEditingCardIds] = useState<Record<string, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggableIds, setDraggableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // ─── Parser ───
  const parseContent = useCallback((text: string): ChapterItem[] => {
    const result: ChapterItem[] = [];
    const seen = new Set<number>();
    const lines = text.split('\n');
    let currentVolume = '';
    let pendingChapter: ChapterItem | null = null;
    let pendingOutline: string[] = [];

    const flushPending = () => {
      if (pendingChapter) {
        const outlineText = pendingOutline.join('\n').trim();
        pendingChapter.outline = outlineText;
        Object.assign(pendingChapter, parseStructuredFields(outlineText));
        result.push(pendingChapter);
        seen.add(pendingChapter.number);
        pendingChapter = null;
        pendingOutline = [];
      }
    };

    for (const line of lines) {
      const volMatch = line.match(/^#{1,2}\s*(第[一二三四五六七八九十百千\d]+卷.*?)(?:\s*$)/);
      if (volMatch) {
        flushPending();
        currentVolume = volMatch[1].trim();
        continue;
      }

      const chapHeadingMatch = line.match(/^###\s*第\s*(\d+)\s*章(?:\s+(.+?))?(?:\s+#.*)?$/);
      if (chapHeadingMatch) {
        flushPending();
        const num = parseInt(chapHeadingMatch[1]);
        if (!seen.has(num)) {
          const titlePart = (chapHeadingMatch[2] || '').trim();
          pendingChapter = {
            id: `ch-${num}`,
            number: num,
            title: titlePart || `第 ${num} 章`,
            volume: currentVolume,
            outline: '',
            ...EMPTY_STRUCTURED,
          };
        }
        continue;
      }

      const tableMatch = line.match(/^\|\s*第\s*(\d+)\s*章\s*\|\s*(.+?)\s*\|/);
      if (tableMatch) {
        flushPending();
        const num = parseInt(tableMatch[1]);
        if (!seen.has(num)) {
          result.push({
            id: `ch-${num}`,
            number: num,
            title: tableMatch[2].trim(),
            volume: currentVolume,
            outline: '',
            ...EMPTY_STRUCTURED,
          });
          seen.add(num);
        }
        continue;
      }

      if (line.match(/^\|[\s:|-]+\|/)) continue;

      if (pendingChapter && line.trim()) {
        pendingOutline.push(line);
      }
    }

    flushPending();
    return result.sort((a, b) => a.number - b.number);
  }, []);

  // ─── Serializer ───
  const serializeChapters = useCallback((chs: ChapterItem[]): string => {
    const volumeOrder = Array.from(
      chs.reduce((acc, c) => { acc.add(c.volume); return acc; }, new Set<string>())
    );
    const lines: string[] = [];
    for (const vol of volumeOrder) {
      const volChapters = chs.filter(c => c.volume === vol);
      if (vol) lines.push(`# ${vol}`, '');
      for (const ch of volChapters) {
        lines.push(`### 第 ${ch.number} 章 ${ch.title}`, '');
        const serialized = serializeStructuredFields(ch) || ch.outline;
        if (serialized) lines.push(serialized, '');
      }
    }
    return lines.join('\n');
  }, []);

  useEffect(() => {
    if (!content) { setChapters([]); return; }
    setLoading(true);
    try { setChapters(parseContent(content)); }
    catch (e) { console.error('Failed to parse chapter directory', e); }
    finally { setLoading(false); }
  }, [content, parseContent]);

  const volumes = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const ch of chapters) {
      if (!seen.has(ch.volume)) { seen.add(ch.volume); result.push(ch.volume); }
    }
    return result;
  }, [chapters]);

  const visibleChapters = useMemo(() => {
    if (selectedVolume === '全部') return chapters;
    return chapters.filter(c => c.volume === selectedVolume);
  }, [chapters, selectedVolume]);

  const toggleEditMode = (id: string) => {
    setEditingCardIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleUpdateChapterField = (id: string, field: keyof ChapterItem, value: string) => {
    setChapters(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, [field]: value } : c);
      onChange(serializeChapters(updated));
      return updated;
    });
  };

  // ─── Drag and Drop (handle-only) ───
  const enableDrag = (id: string) => setDraggableIds(prev => new Set([...prev, id]));
  const disableDrag = (id: string) => setDraggableIds(prev => { const s = new Set(prev); s.delete(id); return s; });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e: React.DragEvent, id: string) => {
    setDraggedIndex(null);
    disableDrag(id);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = (e: React.DragEvent, indexInVisible: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === indexInVisible) return;
    const dragTarget = visibleChapters[draggedIndex];
    const dropTarget = visibleChapters[indexInVisible];
    const dragIdx = chapters.findIndex(c => c.id === dragTarget.id);
    const dropIdx = chapters.findIndex(c => c.id === dropTarget.id);
    if (dragIdx === -1 || dropIdx === -1) return;
    const updated = [...chapters];
    const [removed] = updated.splice(dragIdx, 1);
    updated.splice(dropIdx, 0, removed);
    setChapters(updated);
    onChange(serializeChapters(updated));
    setDraggedIndex(null);
  };

  const moveChapter = (id: string, delta: number) => {
    const idx = chapters.findIndex(c => c.id === id);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= chapters.length) return;
    const updated = [...chapters];
    const [removed] = updated.splice(idx, 1);
    updated.splice(newIdx, 0, removed);
    setChapters(updated);
    onChange(serializeChapters(updated));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '1rem' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>正在解析章节目录...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'calc(100vh - 170px)' }}>
      {/* Top Header Toolbar — same layout as CardSettings */}
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', padding: '1rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Layers size={18} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff' }}>过滤分卷</span>
          <select
            className="select-input"
            value={selectedVolume}
            onChange={e => setSelectedVolume(e.target.value)}
            style={{ width: '200px', padding: '0.45rem 0.75rem' }}
          >
            <option value="全部">全部章节</option>
            {volumes.map(v => (
              <option key={v} value={v}>{v || '（无分卷）'}</option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>共 {chapters.length} 章</span>
        </div>

        <button
          className="btn-primary"
          onClick={onSave}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 1.25rem', fontSize: '0.8rem', backgroundColor: 'var(--color-success)' }}
        >
          <Save size={14} /> 保存目录
        </button>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>
        提示：拖动左上角章节徽标可调整章节顺序；点击「编辑卡片」填写 6 个结构化字段写入 novel_directory.md。
      </div>

      {/* Dynamic chapter cards — same layout as CardSettings */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          {visibleChapters.map((chapter, index) => {
            const isEditing = !!editingCardIds[chapter.id];

            return (
              <div
                key={chapter.id}
                className="glass-panel"
                draggable={false}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, index)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  padding: '1.25rem',
                  cursor: 'default',
                  position: 'relative',
                  border: isEditing ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {/* Drag handle — only this area is draggable */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    draggable={!isEditing}
                    onDragStart={e => handleDragStart(e, index)}
                    onDragEnd={e => handleDragEnd(e, chapter.id)}
                  >
                    {!isEditing && (
                      <div style={{ color: 'var(--text-muted)', cursor: 'grab', display: 'flex', alignItems: 'center' }} title="按住拖拽排序">
                        <GripVertical size={14} />
                      </div>
                    )}
                    {/* Chapter number badge */}
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(224, 108, 83, 0.2)',
                      color: 'var(--accent-light)',
                      border: '1px solid rgba(224, 108, 83, 0.4)',
                      cursor: isEditing ? 'default' : 'grab',
                    }}>
                      第 {chapter.number} 章
                    </span>
                  </div>

                  {/* Arrow reorder buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      className="btn-secondary"
                      onClick={e => { e.stopPropagation(); moveChapter(chapter.id, -1); }}
                      style={{ padding: '2px 4px', borderRadius: '4px', height: '24px' }}
                      title="上移"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={e => { e.stopPropagation(); moveChapter(chapter.id, 1); }}
                      style={{ padding: '2px 4px', borderRadius: '4px', height: '24px' }}
                      title="下移"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                </div>

                {/* Edit Form State */}
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                    {/* Row 1: title + volume */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">章节标题</label>
                        <input
                          type="text"
                          className="text-input"
                          value={chapter.title}
                          onChange={e => handleUpdateChapterField(chapter.id, 'title', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">所属分卷</label>
                        <select
                          className="select-input"
                          value={chapter.volume}
                          onChange={e => handleUpdateChapterField(chapter.id, 'volume', e.target.value)}
                          style={{ width: '100%' }}
                        >
                          {volumes.map(v => (
                            <option key={v} value={v}>{v || '（无分卷）'}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Structured fields — 6 fields in 2-column grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {STRUCTURED_FIELDS.map(f => (
                        <div key={f.key as string} className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {f.label}
                            {!(chapter[f.key] as string).trim() && (
                              <span style={{ color: 'var(--color-warning, #e5c07b)', fontSize: '0.65rem' }}>必填</span>
                            )}
                          </label>
                          <textarea
                            className="textarea-input"
                            value={chapter[f.key] as string}
                            onChange={e => handleUpdateChapterField(chapter.id, f.key, e.target.value)}
                            style={{ minHeight: '52px', fontSize: '0.78rem', lineHeight: '1.5', resize: 'vertical' }}
                            placeholder={`填写${f.label}…`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Read-Only Preview State */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%', flex: 1 }}>
                    {/* Title row + completion badge */}
                    <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{chapter.title || '未命名章节'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{chapter.volume || '无分卷'}</span>
                        {(() => {
                          const filled = countFilledFields(chapter);
                          const color = filled === 6 ? 'var(--color-success, #98c379)' : filled >= 3 ? 'var(--color-warning, #e5c07b)' : 'var(--text-muted)';
                          return (
                            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', border: `1px solid ${color}`, color }}>
                              {filled}/6 字段
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    {/* Structured fields display */}
                    <div
                      onDoubleClick={() => toggleEditMode(chapter.id)}
                      style={{
                        padding: '0.5rem',
                        minHeight: '80px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        fontSize: '0.78rem',
                        lineHeight: '1.6',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px dashed rgba(255,255,255,0.05)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem',
                      }}
                      title="双击进入编辑模式"
                    >
                      {countFilledFields(chapter) > 0 ? (
                        STRUCTURED_FIELDS.filter(f => (chapter[f.key] as string).trim()).map(f => (
                          <div key={f.key as string} style={{ display: 'flex', gap: '0.4rem' }}>
                            <span style={{ color: 'var(--accent-light)', flexShrink: 0, fontSize: '0.72rem' }}>{f.label}：</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{chapter[f.key] as string}</span>
                          </div>
                        ))
                      ) : chapter.outline.trim() ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapter.outline}</ReactMarkdown>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>暂无大纲内容，请点击下方「编辑卡片」填写 6 个结构化字段</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit/Preview Mode button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={e => { e.stopPropagation(); toggleEditMode(chapter.id); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      borderColor: isEditing ? 'var(--color-success)' : 'var(--border-color)',
                      color: isEditing ? 'var(--color-success)' : '#fff'
                    }}
                  >
                    {isEditing ? (
                      <><Check size={12} /> 预览并收起</>
                    ) : (
                      <><Edit2 size={12} /> 编辑卡片</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {visibleChapters.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            该分卷下暂无章节大纲。
          </div>
        )}
      </div>
    </div>
  );
}


