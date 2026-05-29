// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import { getChineseWordCount } from './utils/wordCount';
import { 
  getConfig, 
  saveAppConfig, 
  generateArchitecture, 
  generateBlueprint, 
  clearKnowledge, 
  importKnowledge, 
  watchFiles, 
  saveFile,
  listChapters,
  getChapterContent,
  buildPrompt,
  generateDraft,
  finalizeChapter,
  checkConsistency,
  listRoles,
  getWorldMap
} from './api';
import { AppConfig } from './types/novel';
import LogTerminal from './components/LogTerminal';
import MarkdownWorkspace from './components/MarkdownWorkspace';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ChaptersTab from './components/ChaptersTab';
import StoryTimeline from './components/StoryTimeline';
import ProjectPickerModal from './components/ProjectPickerModal';
import RoleManager from './components/RoleManager';
import SettingsTab from './components/SettingsTab';
import CardSettings from './components/CardSettings';
import ObsidianEditor from './components/ObsidianEditor';
import CharacterGraph from './components/CharacterGraph';
import ChapterDirectory from './components/ChapterDirectory';
import MapTab from './components/MapTab';
import { 
  Play, 
  Settings, 
  FileText, 
  Users, 
  Sparkles, 
  FolderOpen, 
  Database,
  Trash2,
  FileUp,
  BookOpen,
  Compass,
  FileSpreadsheet,
  Layers,
  ChevronLeft,
  ChevronRight,
  Save,
  PenTool,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

const tooltips: Record<string, string> = {
  "novel_name": "作品名称，会写入 novel_settings.md 的基础元数据。",
  "topic": "核心故事引擎：创意大梗、主线矛盾、主角欲望与失败代价。",
  "genre": "小说的类型题材，如诡异仙侠、玄幻修真、都市异能、科幻未来、架空历史等。",
  "target_audience": "目标读者与阅读期待，如男频剧情向、悬疑压迫感读者、轻小说读者等。",
  "platform_style": "平台和商业形态，如长篇网文、高概念连续追更、轻小说、影视剧本感等。",
  "writing_style": "全书文笔与语言风格，如短促阴冷、华丽史诗、冷峻克制、热血明快等。",
  "pacing_requirement": "全书节奏要求，如每章必须有冲突钩子、慢热群像、强悬念推进等。",
  "num_chapters": "计划生成小说总章节数量，会作为章节蓝图规划的依据。",
  "word_number": "期望单章大模型自动创作的字数字数。定稿时若草稿字数较少，可选择由 AI 自动润色并智能扩写。",
  "filepath": "本地保存小说项目文档和章节文件的绝对路径。",
  "chapter_num": "当前正在进行大纲细化、草稿创作与定稿优化工作的目标章节号。",
  "user_guidance": "为大模型下达的补充创作限制命令，如“多描写战斗招式细节，节奏明快，避免毒点”。",
  "characters_involved": "本章主要出场和参与情节的重要人物名称列表，以逗号分隔。",
  "key_items": "本章主线推进所关联或争夺的关键道具、机缘宝物、秘籍或线索名称。",
  "scene_location": "本章发生的主要空间地理坐标、势力驻地、战役地点名称。",
  "time_constraint": "本章剧情面临的紧急时间限制压力（例如：必须在黎明破晓前冲过峡谷哨防）。"
};

export interface ForeshadowingCard {
  id: string;
  name: string;
  content: string;
  setupChapter: string;
  misdirection: string;
  truth: string;
  recallChapter: string;
  recallMethod: string;
  status: string;
  extraFields?: Array<{ label: string; value: string }>;
}

export function parseForeshadowingLedger(markdown: string): ForeshadowingCard[] {
  if (!markdown) return [];
  const cards: ForeshadowingCard[] = [];
  const sections = markdown.split(/##\s+伏笔编号[：:]\s*/);
  
  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i];
    const lines = sec.split('\n');
    const id = lines[0].replace(/[\r\n\s]+/g, '').trim();
    const contentBody = lines.slice(1).join('\n');
    
    const extractSection = (num: number): string => {
      const startMarker = `### ${num}.`;
      const startIndex = contentBody.indexOf(startMarker);
      if (startIndex === -1) return '';
      
      const nextIndex = contentBody.indexOf('### ', startIndex + startMarker.length);
      let rawText = nextIndex === -1 
        ? contentBody.substring(startIndex + startMarker.length) 
        : contentBody.substring(startIndex + startMarker.length, nextIndex);
      
      rawText = rawText.replace(/^\s*【[^】]+】\s*\n/, '');
      rawText = rawText.replace(/^.*?\n/, '');
      rawText = rawText.split('\n').filter(line => !line.trim().startsWith('---')).join('\n').trim();
      return rawText;
    };

    // Extract extra fields (sections 9+)
    const extraFields: Array<{ label: string; value: string }> = [];
    let sNum = 9;
    while (true) {
      const marker = `### ${sNum}.`;
      const si = contentBody.indexOf(marker);
      if (si === -1) break;
      const labelLineEnd = contentBody.indexOf('\n', si + marker.length);
      const rawLabel = (labelLineEnd === -1 ? contentBody.substring(si + marker.length) : contentBody.substring(si + marker.length, labelLineEnd)).replace(/【[^】]+】/g, '').trim();
      const nextSec = contentBody.indexOf('### ', labelLineEnd + 1);
      let rawVal = nextSec === -1 ? contentBody.substring(labelLineEnd + 1) : contentBody.substring(labelLineEnd + 1, nextSec);
      rawVal = rawVal.split('\n').filter((l: string) => !l.trim().startsWith('---')).join('\n').trim();
      if (rawLabel) extraFields.push({ label: rawLabel, value: rawVal });
      sNum++;
    }

    cards.push({
      id,
      name: extractSection(1),
      content: extractSection(2),
      setupChapter: extractSection(3),
      misdirection: extractSection(4),
      truth: extractSection(5),
      recallChapter: extractSection(6),
      recallMethod: extractSection(7),
      status: extractSection(8) || '未埋设',
      extraFields,
    });
  }
  
  return cards;
}

export function compileForeshadowingLedger(cards: ForeshadowingCard[]): string {
  return cards.map(c => {
    return `## 伏笔编号：${c.id}

### 1. 伏笔名称【必填】
${c.name || '未命名'}

---

### 2. 伏笔内容【必填】
${c.content || '暂无内容'}

---

### 3. 埋设章节【必填】
${c.setupChapter || '第 1 章'}

---

### 4. 表层解释 / 误导方向【必填】
${c.misdirection || '暂无误导'}

---

### 5. 真实含义【必填】
${c.truth || '暂无真实含义'}

---

### 6. 计划回收章节【推荐】
${c.recallChapter || '暂无回收计划'}

---

### 7. 回收方式【推荐】
${c.recallMethod || '暂无回收方式'}

---

### 8. 当前状态【必填】
${c.status || '未埋设'}${
  (c.extraFields || []).length > 0
    ? '\n\n' + (c.extraFields || []).map((ef, idx) => `### ${9 + idx}. ${ef.label}\n${ef.value || ''}\n\n---`).join('\n\n')
    : ''
}
`;
  }).join('\n\n');
}

export function ForeshadowingLedger({ content, onSave }: { content: string; onSave: (newContent: string) => void }) {
  const [cards, setCards] = useState<ForeshadowingCard[]>([]);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<ForeshadowingCard | null>(null);

  useEffect(() => {
    // Only update main cards list from props if not actively editing
    if (!editingCardId) {
      setCards(parseForeshadowingLedger(content));
    }
  }, [content, editingCardId]);

  const handleSave = (updatedCards: ForeshadowingCard[]) => {
    setCards(updatedCards);
    const newMarkdown = compileForeshadowingLedger(updatedCards);
    onSave(newMarkdown);
  };

  const handleStartEdit = (card: ForeshadowingCard) => {
    setEditingCardId(card.id);
    setEditingCard({ ...card });
  };

  const handleCancelEdit = () => {
    setEditingCardId(null);
    setEditingCard(null);
  };

  const handleCommitSave = () => {
    if (!editingCard) return;
    const updated = cards.map(c => c.id === editingCard.id ? editingCard : c);
    handleSave(updated);
    setEditingCardId(null);
    setEditingCard(null);
  };

  const handleUpdateEditingField = (field: keyof ForeshadowingCard, value: string) => {
    if (editingCard) {
      setEditingCard(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleUpdateExtraField = (index: number, field: 'label' | 'value', val: string) => {
    if (!editingCard) return;
    const updated = [...(editingCard.extraFields || [])];
    updated[index] = { ...updated[index], [field]: val };
    setEditingCard(prev => prev ? { ...prev, extraFields: updated } : null);
  };

  const handleAddExtraField = () => {
    if (!editingCard) return;
    setEditingCard(prev => prev ? { ...prev, extraFields: [...(prev.extraFields || []), { label: '自定义字段', value: '' }] } : null);
  };

  const handleRemoveExtraField = (index: number) => {
    if (!editingCard) return;
    const updated = (editingCard.extraFields || []).filter((_, i) => i !== index);
    setEditingCard(prev => prev ? { ...prev, extraFields: updated } : null);
  };

  const handleAddCard = () => {
    const maxNum = cards.reduce((max, c) => {
      const num = parseInt(c.id.replace(/\D/g, '')) || 0;
      return num > max ? num : max;
    }, 0);
    const nextId = `F${String(maxNum + 1).padStart(3, '0')}`;
    
    const newCard: ForeshadowingCard = {
      id: nextId,
      name: '新伏笔名称',
      content: '读者在正文中看到的表层信息。',
      setupChapter: '第 1 章',
      misdirection: '表层解释 / 误导方向。',
      truth: '真实含义。',
      recallChapter: '第 2 章',
      recallMethod: '真相如何被揭开。',
      status: '未埋设',
      extraFields: [],
    };
    const updated = [...cards, newCard];
    handleSave(updated);
    setEditingCardId(nextId);
    setEditingCard(newCard);
  };

  const handleDeleteCard = (id: string) => {
    if (!window.confirm(`确定要删除伏笔 ${id} 吗？`)) return;
    const updated = cards.filter(c => c.id !== id);
    handleSave(updated);
    if (editingCardId === id) {
      setEditingCardId(null);
      setEditingCard(null);
    }
  };

  const getStatusStyle = (status: string) => {
    const st = (status || '').trim();
    switch (st) {
      case '已埋设':
        return { background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)' };
      case '持续发酵':
        return { background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.2)' };
      case '部分揭示':
        return { background: 'rgba(249, 115, 22, 0.1)', color: '#fb923c', border: '1px solid rgba(249, 115, 22, 0.2)' };
      case '已回收':
        return { background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)' };
      case '废弃':
        return { background: 'rgba(239, 68, 68, 0.05)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.1)' };
      case '需要修改':
        return { background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' };
      default:
        return { background: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.2)' };
    }
  };

  return (
    <div className="full-editor-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', flexShrink: 0 }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>伏笔台账 (foreshadowing_ledger.md)</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>精细化管理主线与支线埋线，杜绝故事线逻辑漏洞</span>
        </div>
        <button className="btn-primary" onClick={handleAddCard} style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', backgroundColor: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          + 新增伏笔
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.25rem' }}>
        {cards.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', border: '1px dashed var(--border-color)', borderRadius: '8px', gap: '0.5rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>当前台账无任何伏笔，点击右上角按钮开始埋线吧</span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
            {cards.map(c => {
              const isEditing = editingCardId === c.id;
              const statusStyle = getStatusStyle(isEditing && editingCard ? editingCard.status : c.status);
              return (
                <div 
                  key={c.id} 
                  className="glass-panel" 
                  style={{ 
                    padding: '1rem', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '0.75rem', 
                    border: isEditing ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid var(--border-color)', 
                    position: 'relative',
                    transition: 'all 0.25s ease',
                    boxShadow: isEditing ? '0 0 15px rgba(59, 130, 246, 0.15)' : 'none',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.015)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#60a5fa', padding: '0.1rem 0.35rem', backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: '4px' }}>
                        {c.id}
                      </span>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                        {isEditing && editingCard ? (
                          <input 
                            type="text" 
                            value={editingCard.name}
                            onChange={(e) => handleUpdateEditingField('name', e.target.value)}
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.8rem', width: '160px' }}
                          />
                        ) : (
                          c.name || '未命名伏笔'
                        )}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {isEditing && editingCard ? (
                        <select
                          value={editingCard.status}
                          onChange={(e) => handleUpdateEditingField('status', e.target.value)}
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', padding: '0.2rem', fontSize: '0.75rem' }}
                        >
                          <option value="未埋设">未埋设</option>
                          <option value="已埋设">已埋设</option>
                          <option value="持续发酵">持续发酵</option>
                          <option value="部分揭示">部分揭示</option>
                          <option value="已回收">已回收</option>
                          <option value="废弃">废弃</option>
                          <option value="需要修改">需要修改</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '0.65rem', fontWeight: 'bold', padding: '0.15rem 0.4rem', borderRadius: '12px', ...statusStyle }}>
                          {c.status}
                        </span>
                      )}
                      
                      {isEditing ? (
                        <>
                          <button 
                            onClick={handleCommitSave}
                            className="btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', backgroundColor: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            保存
                          </button>
                          <button 
                            onClick={handleCancelEdit}
                            className="btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: '#9ca3af', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleStartEdit(c)}
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: '#9ca3af', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          编辑
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteCard(c.id)}
                        className="btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', backgroundColor: 'transparent', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <div>
                      <span style={{ color: '#60a5fa', fontWeight: 'bold', display: 'block', marginBottom: '0.15rem', fontSize: '0.75rem' }}>伏笔内容：</span>
                      {isEditing && editingCard ? (
                        <textarea
                          value={editingCard.content}
                          onChange={(e) => handleUpdateEditingField('content', e.target.value)}
                          style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', padding: '0.3rem', fontSize: '0.75rem', minHeight: '50px', marginTop: '0.2rem' }}
                        />
                      ) : (
                        <span style={{ display: 'block', lineHeight: '1.4', backgroundColor: 'rgba(255,255,255,0.01)', padding: '0.4rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>{c.content || '暂无内容'}</span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', margin: '0.25rem 0' }}>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '4px' }}>
                        <span style={{ color: '#60a5fa', fontWeight: 'bold', display: 'block', fontSize: '0.7rem', marginBottom: '0.25rem' }}>埋设章节</span>
                        {isEditing && editingCard ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>第</span>
                            <input
                              type="number"
                              min="1"
                              value={(editingCard.setupChapter.match(/\d+/) || ['1'])[0]}
                              onChange={(e) => handleUpdateEditingField('setupChapter', `第 ${e.target.value} 章`)}
                              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.7rem', width: '60px' }}
                            />
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>章</span>
                          </div>
                        ) : (
                          <span style={{ color: '#e5e7eb', fontSize: '0.8rem', fontWeight: 'bold' }}>{c.setupChapter || '第 1 章'}</span>
                        )}
                      </div>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', padding: '0.4rem', borderRadius: '4px' }}>
                        <span style={{ color: '#60a5fa', fontWeight: 'bold', display: 'block', fontSize: '0.7rem', marginBottom: '0.25rem' }}>计划回收章节</span>
                        {isEditing && editingCard ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>第</span>
                            <input
                              type="number"
                              min="1"
                              value={(editingCard.recallChapter.match(/\d+/) || ['1'])[0]}
                              onChange={(e) => handleUpdateEditingField('recallChapter', `第 ${e.target.value} 章`)}
                              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', padding: '0.1rem 0.3rem', fontSize: '0.7rem', width: '60px' }}
                            />
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>章</span>
                          </div>
                        ) : (
                          <span style={{ color: '#e5e7eb', fontSize: '0.8rem', fontWeight: 'bold' }}>{c.recallChapter || '暂无'}</span>
                        )}
                      </div>
                    </div>

                    {(isEditing || c.misdirection || c.truth || c.recallMethod) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#60a5fa', fontWeight: 'bold', display: 'block', marginBottom: '0.15rem', fontSize: '0.75rem' }}>表层解释 / 误导方向：</span>
                          {isEditing && editingCard ? (
                            <textarea
                              value={editingCard.misdirection}
                              onChange={(e) => handleUpdateEditingField('misdirection', e.target.value)}
                              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', padding: '0.3rem', fontSize: '0.75rem', minHeight: '40px', marginTop: '0.1rem', boxSizing: 'border-box' }}
                            />
                          ) : (
                            <span style={{ display: 'block', paddingLeft: '0.2rem', color: '#d1d5db', lineHeight: '1.5' }}>{c.misdirection}</span>
                          )}
                        </div>
                        <div>
                          <span style={{ color: '#34d399', fontWeight: 'bold', display: 'block', marginBottom: '0.15rem', fontSize: '0.75rem' }}>真实含义：</span>
                          {isEditing && editingCard ? (
                            <textarea
                              value={editingCard.truth}
                              onChange={(e) => handleUpdateEditingField('truth', e.target.value)}
                              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', padding: '0.3rem', fontSize: '0.75rem', minHeight: '40px', marginTop: '0.1rem', boxSizing: 'border-box' }}
                            />
                          ) : (
                            <span style={{ display: 'block', paddingLeft: '0.2rem', color: '#a7f3d0', lineHeight: '1.5' }}>{c.truth}</span>
                          )}
                        </div>
                        <div>
                          <span style={{ color: '#60a5fa', fontWeight: 'bold', display: 'block', marginBottom: '0.15rem', fontSize: '0.75rem' }}>回收方式：</span>
                          {isEditing && editingCard ? (
                            <textarea
                              value={editingCard.recallMethod}
                              onChange={(e) => handleUpdateEditingField('recallMethod', e.target.value)}
                              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', padding: '0.3rem', fontSize: '0.75rem', minHeight: '40px', marginTop: '0.1rem', boxSizing: 'border-box' }}
                            />
                          ) : (
                            <span style={{ display: 'block', paddingLeft: '0.2rem', color: '#d1d5db', lineHeight: '1.5' }}>{c.recallMethod}</span>
                          )}
                        </div>

                        {/* Extra custom fields */}
                        {isEditing && editingCard ? (
                          <>
                            {(editingCard.extraFields || []).map((ef, i) => (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', borderTop: '1px dashed rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <input
                                    type="text"
                                    value={ef.label}
                                    onChange={(e) => handleUpdateExtraField(i, 'label', e.target.value)}
                                    placeholder="字段名"
                                    style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fbbf24', borderRadius: '4px', padding: '0.15rem 0.35rem', fontSize: '0.72rem', fontWeight: 'bold' }}
                                  />
                                  <button
                                    onClick={() => handleRemoveExtraField(i)}
                                    style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem', color: '#f87171', background: 'transparent', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', cursor: 'pointer' }}
                                  >×</button>
                                </div>
                                <textarea
                                  value={ef.value}
                                  onChange={(e) => handleUpdateExtraField(i, 'value', e.target.value)}
                                  placeholder={`填写${ef.label}内容…`}
                                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: '#fff', borderRadius: '4px', padding: '0.3rem', fontSize: '0.75rem', minHeight: '40px', boxSizing: 'border-box' }}
                                />
                              </div>
                            ))}
                            <button
                              onClick={handleAddExtraField}
                              style={{ alignSelf: 'flex-start', marginTop: '0.25rem', padding: '0.2rem 0.65rem', fontSize: '0.72rem', color: '#fbbf24', background: 'rgba(251,191,36,0.06)', border: '1px dashed rgba(251,191,36,0.35)', borderRadius: '4px', cursor: 'pointer' }}
                            >＋ 添加字段</button>
                          </>
                        ) : (
                          (c.extraFields || []).filter(ef => ef.value.trim()).map((ef, i) => (
                            <div key={i}>
                              <span style={{ color: '#fbbf24', fontWeight: 'bold', display: 'block', marginBottom: '0.1rem', fontSize: '0.75rem' }}>{ef.label}：</span>
                              <span style={{ display: 'block', paddingLeft: '0.2rem', color: '#d1d5db', lineHeight: '1.5' }}>{ef.value}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'main' | 'setting' | 'directory' | 'character' | 'chapters' | 'roles' | 'config'>(
    () => (localStorage.getItem('ng_activeTab') as any) || 'main'
  );
  const [novelSettingsMode, setNovelSettingsMode] = useState<'markdown' | 'cards' | 'map'>(
    () => (localStorage.getItem('ng_novelSettingsMode') as any) || 'cards'
  );
  const [rolesSubTab, setRolesSubTab] = useState<'library' | 'graph' | 'state'>(
    () => (localStorage.getItem('ng_rolesSubTab') as any) || 'library'
  );
  const [chaptersSubTab, setChaptersSubTab] = useState<'manage' | 'timeline' | 'directory' | 'foreshadowing'>(
    () => (localStorage.getItem('ng_chaptersSubTab') as any) || 'manage'
  );
  const [config, setConfig] = useState<AppConfig | null>(null);
  
  // Shared state values
  const [filepath, setFilepath] = useState('');
  const [selectedLLM, setSelectedLLM] = useState('DeepSeek V3');
  const [selectedEmbedding, setSelectedEmbedding] = useState('OpenAI');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [allRoleNames, setAllRoleNames] = useState<string[]>([]);
  const [allCityNames, setAllCityNames] = useState<string[]>([]);
  const [wordCountTarget, setWordCountTarget] = useState(3000);
  
  // Configured parameters
  const [novelName, setNovelName] = useState('');
  const [topic, setTopic] = useState('');
  const [genre, setGenre] = useState('玄幻');
  const [targetAudience, setTargetAudience] = useState('');
  const [platformStyle, setPlatformStyle] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [pacingRequirement, setPacingRequirement] = useState('');
  const [numChapters, setNumChapters] = useState(10);
  const [userGuidance, setUserGuidance] = useState('');

  // 10 core settings inputs alignment with Eralnea parameters
  const [activeChapterNum, setActiveChapterNum] = useState<number>(1);
  const [charactersInvolved, setCharactersInvolved] = useState<string>('');
  const [keyItems, setKeyItems] = useState<string>('');
  const [sceneLocation, setSceneLocation] = useState<string>('');
  const [timeConstraint, setTimeConstraint] = useState<string>('');

  // Chapter Draft writing workspace states
  const [chapterContent, setChapterContent] = useState<string>('');
  const [chapterWordCount, setChapterWordCount] = useState<number>(0);
  const [chapterLoading, setChapterLoading] = useState<boolean>(false);
  const [draftsList, setDraftsList] = useState<string[]>([]);
  const [finalizedList, setFinalizedList] = useState<string[]>([]);
  
  // Modal dialog states for prompt building & consistency review
  const [draftPrompt, setDraftPrompt] = useState<string>('');
  const [showPromptModal, setShowPromptModal] = useState<boolean>(false);
  const [consistencyResult, setConsistencyResult] = useState<string>('');
  const [showConsistencyModal, setShowConsistencyModal] = useState<boolean>(false);
  const [showProjectPicker, setShowProjectPicker] = useState<boolean>(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const [novelSettingsContent, setNovelSettingsContent] = useState('');
  const [novelDirContent, setNovelDirContent] = useState('');
  const [characterStateContent, setCharacterStateContent] = useState('');
  const [foreshadowingLedgerContent, setForeshadowingLedgerContent] = useState('');
  const [settingsFileTitle, setSettingsFileTitle] = useState('小说大纲设定 (novel_settings.md)');

  // Operations state
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isGeneratingArch, setIsGeneratingArch] = useState(false);
  const [isGeneratingBlue, setIsGeneratingBlue] = useState(false);

  // Chinese character word count — shared utility from utils/wordCount.ts

  // Initialize and retrieve backend configurations
  const fetchConfig = async () => {
    setLoading(true);
    setConfigError(null);
    try {
      const data = await getConfig();
      setConfig(data);
      if (data.other_params) {
        setFilepath(data.other_params.filepath || '');
        setNovelName(data.other_params.novel_name || '');
        setTopic(data.other_params.topic || '');
        setGenre(data.other_params.genre || '玄幻');
        setTargetAudience(data.other_params.target_audience || '');
        setPlatformStyle(data.other_params.platform_style || '');
        setWritingStyle(data.other_params.writing_style || '');
        setPacingRequirement(data.other_params.pacing_requirement || '');
        setNumChapters(data.other_params.num_chapters || 10);
        setWordCountTarget(data.other_params.word_number || 3000);
        setUserGuidance(data.other_params.user_guidance || '');
        
        // Match 10 core settings inputs from other_params
        setActiveChapterNum(parseInt(data.other_params.chapter_num) || 1);
        setCharactersInvolved(data.other_params.characters_involved || '');
        setKeyItems(data.other_params.key_items || '');
        setSceneLocation(data.other_params.scene_location || '');
        setTimeConstraint(data.other_params.time_constraint || '');
      }
      if (data.choose_configs) {
        setSelectedLLM(data.choose_configs.prompt_draft_llm || 'DeepSeek V3');
      }
    } catch (e) {
      console.error("Failed to load config from server", e);
      setConfig(null);
      setConfigError('未能连接到 AI 创作后端 `http://127.0.0.1:8000`。请确认后端服务已经启动。');
    } finally {
      setLoading(false);
    }
  };

  // Sync core file updates on load
  const syncWorkspaceFiles = async () => {
    if (!filepath) return;
    try {
      const data = await watchFiles(filepath);
      if (data.files.novel_settings?.exists) {
        setNovelSettingsContent(data.files.novel_settings.content);
        setSettingsFileTitle('小说大纲设定 (novel_settings.md)');
      }
      if (data.files.novel_directory?.exists) {
        setNovelDirContent(data.files.novel_directory.content);
      }
      if (data.files.character_state?.exists) {
        setCharacterStateContent(data.files.character_state.content);
      }
      if (data.files.foreshadowing_ledger?.exists) {
        setForeshadowingLedgerContent(data.files.foreshadowing_ledger.content);
      }
    } catch (e) {
      console.error("Failed to sync project files", e);
    }
  };

  const fetchChaptersList = async () => {
    if (!filepath) return;
    try {
      const data = await listChapters(filepath);
      setDraftsList(data.drafts || []);
      setFinalizedList(data.finalized || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchActiveChapter = async () => {
    if (!filepath) return;
    setChapterLoading(true);
    try {
      const fileName = `chapter_${activeChapterNum}.md`;
      const draftExists = draftsList.includes(fileName);
      const finalExists = finalizedList.includes(fileName);
      
      let content = '';
      if (draftExists) {
        const data = await getChapterContent(filepath, fileName, true);
        content = data.content;
      } else if (finalExists) {
        const data = await getChapterContent(filepath, fileName, false);
        content = data.content;
      } else {
        content = `# 第 ${activeChapterNum} 章\n\n在此输入本章大纲，或点击下方 Step 流程启动自动创作...`;
      }
      setChapterContent(content);
      setChapterWordCount(getChineseWordCount(content));
    } catch (e) {
      console.error(e);
    } finally {
      setChapterLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Persist tab state across page refreshes
  useEffect(() => { localStorage.setItem('ng_activeTab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('ng_novelSettingsMode', novelSettingsMode); }, [novelSettingsMode]);
  useEffect(() => { localStorage.setItem('ng_rolesSubTab', rolesSubTab); }, [rolesSubTab]);
  useEffect(() => { localStorage.setItem('ng_chaptersSubTab', chaptersSubTab); }, [chaptersSubTab]);

  useEffect(() => {
    syncWorkspaceFiles();
    fetchChaptersList();
  }, [filepath, activeTab]);

  // Load role names and city names for main panel linkage
  useEffect(() => {
    if (!filepath) return;
    listRoles(filepath)
      .then(data => setAllRoleNames((data.categories || []).flatMap(c => c.roles.map(r => r.name))))
      .catch(() => {});
    getWorldMap(filepath)
      .then(data => setAllCityNames((data.cities || []).map((city: { name: string }) => city.name)))
      .catch(() => {});
  }, [filepath]);

  useEffect(() => {
    fetchActiveChapter();
  }, [activeChapterNum, draftsList, finalizedList, filepath]);

  const handleUpdateConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      const updated = {
        ...config,
        other_params: {
          ...config.other_params,
          filepath,
          novel_name: novelName,
          topic,
          genre,
          target_audience: targetAudience,
          platform_style: platformStyle,
          writing_style: writingStyle,
          pacing_requirement: pacingRequirement,
          num_chapters: numChapters,
          word_number: wordCountTarget,
          user_guidance: userGuidance,
          // Save Eralnea parameters!
          chapter_num: activeChapterNum.toString(),
          characters_involved: charactersInvolved,
          key_items: keyItems,
          scene_location: sceneLocation,
          time_constraint: timeConstraint
        },
        choose_configs: {
          ...config.choose_configs,
          prompt_draft_llm: selectedLLM,
          architecture_llm: selectedLLM,
          chapter_outline_llm: selectedLLM,
          final_chapter_llm: selectedLLM,
          consistency_review_llm: selectedLLM
        }
      };
      await saveAppConfig(updated);
      setConfig(updated);
      alert('所有配置已保存并同步至 config.json！');
    } catch (e) {
      alert('保存配置失败，请检查网络和 API 服务！');
    }
  };

  const applyProjectPath = async (selected: string) => {
    setFilepath(selected);
    if (!config) return;
    try {
      const updated = {
        ...config,
        other_params: { ...config.other_params, filepath: selected },
      };
      await saveAppConfig(updated);
      setConfig(updated);
    } catch (e) {
      console.error('Failed to persist filepath to config', e);
    }
  };

  // Tauri: native folder dialog; Browser: project picker modal
  const handleBrowseFolder = async () => {
    const isTauri = (window as any).__TAURI_INTERNALS__ !== undefined;
    if (!isTauri) {
      setShowProjectPicker(true);
      return;
    }

    let selected: string | null = null;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const res = await open({
        directory: true,
        multiple: false,
        defaultPath: filepath || undefined,
      });
      if (res && typeof res === 'string') {
        selected = res;
      }
    } catch (e) {
      console.error('Tauri dialog error, falling back to project picker:', e);
      setShowProjectPicker(true);
      return;
    }

    if (selected) {
      await applyProjectPath(selected);
    }
  };

  // Save current active chapter edits back to drafts folder
  const handleSaveChapter = async () => {
    if (!filepath) return;
    try {
      const fileName = `01_chapters/chapter_${activeChapterNum}.md`;
      await saveFile({
        filepath,
        file_name: fileName,
        content: chapterContent,
      });
      alert(`第 ${activeChapterNum} 章内容已成功保存！`);
      fetchChaptersList();
    } catch (e) {
      alert('保存失败，请检查连接状态！');
    }
  };

  // Standard core file saving handlers
  const handleSaveCoreFile = async (fileName: string, content: string) => {
    if (!filepath) return;
    try {
      await saveFile({
        filepath,
        file_name: fileName,
        content,
      });
      alert(`文件 ${fileName} 保存成功！`);
      syncWorkspaceFiles();
    } catch (e) {
      alert('保存失败，请检查网络！');
    }
  };

  // Step 1: Generate settings workshop artifacts
  const handleGenerateArch = async () => {
    if (!filepath.trim()) {
      alert('请先设定小说项目文件夹路径！');
      return;
    }
    if (!confirm('确定要生成设定工坊内容吗？这可能会更新作品设定、世界观架构，以及 03_characters 下的人物与阵营档案。')) return;

    setIsGeneratingArch(true);
    try {
      await generateArchitecture({
        model_key: selectedLLM,
        novel_name: novelName,
        topic,
        genre,
        target_audience: targetAudience,
        platform_style: platformStyle,
        writing_style: writingStyle,
        pacing_requirement: pacingRequirement,
        num_chapters: numChapters,
        word_number: wordCountTarget,
        user_guidance: userGuidance,
        filepath,
      });
      alert('设定工坊任务已启动，请在下方日志终端查看实时进度！');
    } catch (e) {
      alert('发起设定工坊任务失败！');
    } finally {
      setIsGeneratingArch(false);
    }
  };

  // Step 2: Generate Chapter Blueprint
  const handleGenerateBlueprint = async () => {
    if (!filepath.trim()) {
      alert('请先设定小说项目文件夹路径！');
      return;
    }
    if (!confirm('确定要生成章节蓝图吗？这会基于已有设定、人物和世界观生成 novel_directory.md。')) return;

    setIsGeneratingBlue(true);
    try {
      await generateBlueprint({
        model_key: selectedLLM,
        num_chapters: numChapters,
        filepath,
      });
      alert('生成章节目录任务已启动，请在下方日志终端查看实时进度！');
    } catch (e) {
      alert('发起生成章节大纲任务失败！');
    } finally {
      setIsGeneratingBlue(false);
    }
  };

  // Step 3: Compile prompt draft details and open prompt editor
  const handleLoadDraftPrompt = async () => {
    if (!filepath.trim()) {
      alert('请先设定小说项目文件夹路径！');
      return;
    }
    try {
      const data = await buildPrompt({
        model_key: selectedLLM,
        chapter_num: activeChapterNum,
        word_number: wordCountTarget,
        user_guidance: userGuidance,
        characters_involved: charactersInvolved,
        key_items: keyItems,
        scene_location: sceneLocation,
        time_constraint: timeConstraint,
        embedding_key: selectedEmbedding,
        filepath,
      });
      setDraftPrompt(data.prompt);
      setShowPromptModal(true);
    } catch (e) {
      alert('编译提示词失败，请检查模型、结构化记忆与知识库配置！');
    }
  };

  const handleStartGenerateDraft = async () => {
    if (!filepath) return;
    try {
      await generateDraft({
        model_key: selectedLLM,
        chapter_num: activeChapterNum,
        word_number: wordCountTarget,
        user_guidance: userGuidance,
        characters_involved: charactersInvolved,
        key_items: keyItems,
        scene_location: sceneLocation,
        time_constraint: timeConstraint,
        embedding_key: selectedEmbedding,
        filepath,
        custom_prompt_text: draftPrompt,
      });
      setShowPromptModal(false);
      alert(`第 ${activeChapterNum} 章大模型自动写作任务已开启！请在下方控制台日志查看状态。`);
      fetchChaptersList();
    } catch (e) {
      alert('指派草稿生成任务失败！');
    }
  };

  // Step 4: Execute chapter finalization & vector base syncing
  const handleFinalizeChapter = async () => {
    if (!filepath.trim()) {
      alert('请先设定小说项目文件夹路径！');
      return;
    }
    const lowCount = chapterWordCount < 0.7 * wordCountTarget;
    const enrich = lowCount ? window.confirm(`当前章节字数 (${chapterWordCount}字) 低于期望字数 (${wordCountTarget}字) 的70%，定稿时是否让 AI 自动进行扩写扩充？`) : false;
    
    try {
      await finalizeChapter({
        model_key: selectedLLM,
        embedding_key: selectedEmbedding,
        chapter_num: activeChapterNum,
        word_number: wordCountTarget,
        filepath,
        chapter_text: chapterContent,
        should_enrich: enrich,
      });
      alert('已在后台开启本章审校定稿、角色状态更新与知识库写入任务！详情在控制台日志查看。');
    } catch (e) {
      alert('定稿任务发起失败！');
    }
  };

  // Run Consistency Checker on selected chapter
  const handleCheckConsistency = async () => {
    if (!filepath.trim()) {
      alert('请先设定小说项目文件夹路径！');
      return;
    }
    try {
      const data = await checkConsistency({
        model_key: selectedLLM,
        chapter_num: activeChapterNum,
        filepath,
      });
      setConsistencyResult(data.result);
      setShowConsistencyModal(true);
    } catch (e) {
      alert('一致性校验接口异常，请确认大模型配置！');
    }
  };

  const handleClearVectorDb = async () => {
    if (!filepath.trim()) return;
    if (!confirm('警告: 确认要彻底清空本项目的本地知识特征向量库吗？此操作不可恢复！')) return;
    if (!confirm('二次确认: 真的删除所有向量数据吗？')) return;

    try {
      await clearKnowledge(filepath);
      alert('本地向量数据库清理完毕。');
    } catch (e) {
      alert('清空向量库失败！');
    }
  };

  const handleImportKnowledgeFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.txt';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const text = evt.target?.result as string;
        try {
          await importKnowledge({
            embedding_key: selectedEmbedding,
            filepath,
            file_content: text,
            file_name: file.name,
          });
          alert(`设定文档 ${file.name} 切片向量化任务已下发！可在终端查看状态。`);
        } catch (err) {
          alert('知识库注入任务失败，请检查模型配置与网络！');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handlePrevChapter = () => {
    if (activeChapterNum > 1) {
      setActiveChapterNum(prev => prev - 1);
    }
  };

  const handleNextChapter = () => {
    setActiveChapterNum(prev => prev + 1);
  };

  // Tooltip Helper Component
  const renderTooltipIcon = (key: string) => {
    const text = tooltips[key] || "暂无说明";
    const isActive = activeTooltip === key;
    return (
      <div style={{ display: 'inline-block', position: 'relative', marginLeft: '4px' }}>
        <HelpCircle 
          size={12} 
          style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            setActiveTooltip(isActive ? null : key);
          }}
          onMouseEnter={() => setActiveTooltip(key)}
          onMouseLeave={() => setActiveTooltip(null)}
        />
        {isActive && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#1f2937',
            border: '1px solid var(--border-color)',
            color: '#f3f4f6',
            fontSize: '0.7rem',
            padding: '0.4rem 0.6rem',
            borderRadius: '4px',
            width: '200px',
            zIndex: 100,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)',
            lineHeight: '1.4',
            pointerEvents: 'none',
            marginBottom: '4px'
          }}>
            {text}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0b0f17', gap: '1rem' }}>
        <div style={{ width: '32px', height: '32px', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>正在连接 AI 创作后端，同步项目配置中...</span>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#0b0f17', gap: '0.85rem', padding: '1.5rem', textAlign: 'center' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontWeight: 700 }}>!</div>
        <div style={{ color: '#f3f4f6', fontSize: '0.95rem', fontWeight: 600 }}>AI 创作后端连接失败</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6, maxWidth: '540px' }}>
          {configError || '项目配置尚未加载成功。'}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.6, maxWidth: '620px' }}>
          常见原因：后端 `server.py` 没有启动，或浏览器页在后端可用前就先发起了首次配置请求。
        </div>
        <button
          className="btn-secondary"
          onClick={() => void fetchConfig()}
          style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', border: '1px solid var(--border-color)' }}
        >
          重新连接后端
        </button>
      </div>
    );
  }

  return (
    <div className="app-container" onClick={() => setActiveTooltip(null)}>
      {/* Premium Minimalist Header */}
      <header>
        <div className="logo-container">
          <div className="logo-box" style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center' }}>
            <BookOpen size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff' }}>Novel Generator Studio</h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
              简约大气双模极客工坊 • 基于 FastAPI + React TypeScript
            </span>
          </div>
        </div>

        {/* Emojis completely eliminated from tabs */}
        <div className="tabs-nav">
          <button className={`tab-btn ${activeTab === 'main' ? 'active' : ''}`} onClick={() => setActiveTab('main')}>
            <Compass size={14} /> 主控制面板
          </button>
          <button className={`tab-btn ${activeTab === 'setting' ? 'active' : ''}`} onClick={() => setActiveTab('setting')}>
            <BookOpen size={14} /> 大纲设定
          </button>
          <button className={`tab-btn ${activeTab === 'chapters' ? 'active' : ''}`} onClick={() => setActiveTab('chapters')}>
            <FileText size={14} /> 章节
          </button>
          <button className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`} onClick={() => setActiveTab('roles')}>
            <Users size={14} /> 角色
          </button>
          <button className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
            <Settings size={14} /> 高级配置
          </button>
        </div>

        {/* Directory browser field */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--bg-input)', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>小说目录:</span>
            <span style={{ color: '#fff', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={filepath}>
              {filepath || '未设置保存路径'}
            </span>
            <button
              type="button"
              onClick={handleBrowseFolder}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem' }}
              title="切换小说项目"
            >
              浏览
            </button>
          </div>
        </div>
      </header>

      {/* Renders Tab Panels strictly keeping original structures */}
      <div style={{ flex: 1, padding: '0px 1.5rem 1.5rem 1.5rem', maxWidth: '1600px', width: '100%', margin: '0 auto', overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        
        {/* Tab 1: 主控制面板 (经典 4-Step 升级重构版本) */}
        {activeTab === 'main' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', height: 'calc(100vh - 120px)', paddingTop: '0.75rem' }}>
            
            {/* Left Side: Chapter Editor Area, 4-Step buttons, and Log Terminal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden' }}>
              
              {/* Chapter result edit textbox container */}
              <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16} style={{ color: 'var(--accent-color)' }} />
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff' }}>
                      本章内容 (可编辑) • 字数: {chapterWordCount}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Compact Chapter selectors */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '1px 4px' }}>
                      <button 
                        onClick={handlePrevChapter} 
                        disabled={activeChapterNum <= 1}
                        style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', padding: '2px' }}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fff', width: '50px', textAlign: 'center' }}>
                        第 {activeChapterNum} 章
                      </span>
                      <button 
                        onClick={handleNextChapter} 
                        style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', padding: '2px' }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <button 
                      className="btn-secondary" 
                      onClick={handleSaveChapter} 
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Save size={12} /> 保存本章
                    </button>
                  </div>
                </div>

                {/* Chapter result textarea */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {chapterLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.05)' }}>
                      <div style={{ width: '16px', height: '16px', border: '2px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>正在装载章节文本...</span>
                    </div>
                  ) : (
                    <ObsidianEditor
                      value={chapterContent}
                      onChange={(val) => {
                        setChapterContent(val);
                        setChapterWordCount(getChineseWordCount(val));
                      }}
                    />
                  )}
                </div>

                {/* Classical Step Buttons Wizard console */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={handleGenerateArch} 
                    disabled={isGeneratingArch}
                    style={{ fontSize: '0.75rem', padding: '0.5rem 0', fontWeight: 'bold' }}
                    title="生成作品设定、世界观架构，以及人物与阵营档案"
                  >
                    Step1. 设定工坊
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={handleGenerateBlueprint} 
                    disabled={isGeneratingBlue}
                    style={{ fontSize: '0.75rem', padding: '0.5rem 0', fontWeight: 'bold' }}
                    title="根据设定工坊结果，自动分解并细化生成章节蓝图 (novel_directory.md)"
                  >
                    Step2. 章节蓝图
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={handleLoadDraftPrompt}
                    style={{ fontSize: '0.75rem', padding: '0.5rem 0', fontWeight: 'bold', backgroundColor: 'var(--accent-color)' }}
                    title="编译本章蓝图、人物档案、角色状态、伏笔和人物轨，组装生成提示词并指派草稿生成"
                  >
                    Step3. 生成草稿
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={handleFinalizeChapter}
                    style={{ fontSize: '0.75rem', padding: '0.5rem 0', fontWeight: 'bold', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                    title="审校本章一致性，更新角色状态，并尝试录入知识库供后文引用"
                  >
                    Step4. 审校定稿
                  </button>
                </div>
              </div>

              {/* Log Terminal below */}
              <div style={{ flexShrink: 0 }}>
                <LogTerminal />
              </div>
            </div>

            {/* Right Side: Scrollable parameters frame & optional buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden' }}>
              
              {/* Scrollable params panel */}
              <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem', overflowY: 'auto' }}>
                <h3 className="panel-title" style={{ marginBottom: '0.5rem' }}>
                  <Settings size={16} style={{ color: 'var(--accent-color)' }} /> 设定工坊参数
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {/* 保存路径 */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      保存路径 {renderTooltipIcon('filepath')}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        className="text-input" 
                        value={filepath} 
                        onChange={(e) => setFilepath(e.target.value)} 
                        placeholder="请输入或浏览项目路径"
                        style={{ flex: 1, padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                      />
                      <button className="btn-secondary" onClick={handleBrowseFolder} style={{ padding: '0.45rem 0.75rem', fontSize: '0.75rem' }}>
                        浏览
                      </button>
                    </div>
                  </div>

                  {/* 章节号 */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      当前写作章节号 {renderTooltipIcon('chapter_num')}
                    </label>
                    <input 
                      type="number" 
                      className="text-input" 
                      value={activeChapterNum} 
                      onChange={(e) => setActiveChapterNum(Math.max(1, parseInt(e.target.value) || 1))}
                      style={{ width: '120px', padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                    />
                  </div>

                  {/* 小说名称 */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      小说名称 {renderTooltipIcon('novel_name')}
                    </label>
                    <input
                      type="text"
                      className="text-input"
                      value={novelName}
                      onChange={(e) => setNovelName(e.target.value)}
                      placeholder="例如：道诡异仙"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                    />
                  </div>

                  {/* 故事创意大梗 (Topic) */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      核心故事引擎 {renderTooltipIcon('topic')}
                    </label>
                    <textarea
                      className="textarea-input"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="主角处境、核心欲望、主线冲突、失败代价"
                      style={{ minHeight: '60px', padding: '0.45rem 0.65rem', fontSize: '0.8rem', lineHeight: '1.4' }}
                    />
                  </div>

                  {/* 题材类型 (Genre) */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      题材类型 {renderTooltipIcon('genre')}
                    </label>
                    <input 
                      type="text" 
                      className="text-input" 
                      value={genre} 
                      onChange={(e) => setGenre(e.target.value)} 
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        目标读者 {renderTooltipIcon('target_audience')}
                      </label>
                      <input
                        type="text"
                        className="text-input"
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        placeholder="男频 / 悬疑压迫感读者"
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        平台风格 {renderTooltipIcon('platform_style')}
                      </label>
                      <input
                        type="text"
                        className="text-input"
                        value={platformStyle}
                        onChange={(e) => setPlatformStyle(e.target.value)}
                        placeholder="长篇网文 / 高概念连续追更"
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      文笔与语言风格 {renderTooltipIcon('writing_style')}
                    </label>
                    <textarea
                      className="textarea-input"
                      value={writingStyle}
                      onChange={(e) => setWritingStyle(e.target.value)}
                      placeholder="例如：短促、阴冷、带民俗邪气和感官压迫感"
                      style={{ minHeight: '50px', padding: '0.45rem 0.65rem', fontSize: '0.8rem', lineHeight: '1.4' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      节奏要求 {renderTooltipIcon('pacing_requirement')}
                    </label>
                    <textarea
                      className="textarea-input"
                      value={pacingRequirement}
                      onChange={(e) => setPacingRequirement(e.target.value)}
                      placeholder="例如：每章都要有危险逼近、信息不足、章尾钩子"
                      style={{ minHeight: '50px', padding: '0.45rem 0.65rem', fontSize: '0.8rem', lineHeight: '1.4' }}
                    />
                  </div>

                  {/* 章节字数设定 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        总章节数 {renderTooltipIcon('num_chapters')}
                      </label>
                      <input 
                        type="number" 
                        className="text-input" 
                        value={numChapters} 
                        onChange={(e) => setNumChapters(parseInt(e.target.value) || 10)}
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        期望单章字数 {renderTooltipIcon('word_number')}
                      </label>
                      <input 
                        type="number" 
                        className="text-input" 
                        value={wordCountTarget} 
                        onChange={(e) => setWordCountTarget(parseInt(e.target.value) || 3000)}
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  {/* 内容指导 */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      内容指导 {renderTooltipIcon('user_guidance')}
                    </label>
                    <textarea
                      className="textarea-input"
                      value={userGuidance}
                      onChange={(e) => setUserGuidance(e.target.value)}
                      placeholder="内容指导与限制要求"
                      style={{ minHeight: '50px', padding: '0.45rem 0.65rem', fontSize: '0.8rem', lineHeight: '1.4' }}
                    />
                  </div>

                  {/* 核心人物 */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      核心人物 {renderTooltipIcon('characters_involved')}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <textarea
                        className="textarea-input"
                        value={charactersInvolved}
                        onChange={(e) => setCharactersInvolved(e.target.value)}
                        placeholder="多个人物以逗号隔开"
                        style={{ flex: 1, minHeight: '46px', padding: '0.35rem 0.55rem', fontSize: '0.8rem', lineHeight: '1.4', resize: 'none' }}
                      />
                    </div>
                    {allRoleNames.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.35rem' }}>
                        {allRoleNames.map(name => {
                          const active = charactersInvolved.split(',').map(s => s.trim()).filter(Boolean).includes(name);
                          return (
                            <button
                              key={name}
                              onClick={() => {
                                const current = charactersInvolved.split(',').map(s => s.trim()).filter(Boolean);
                                if (active) {
                                  setCharactersInvolved(current.filter(s => s !== name).join(', '));
                                } else {
                                  setCharactersInvolved([...current, name].join(', '));
                                }
                              }}
                              style={{
                                fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', cursor: 'pointer',
                                border: `1px solid ${active ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                backgroundColor: active ? 'rgba(224,108,83,0.18)' : 'transparent',
                                color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                              }}
                            >
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 其它可选设定 (道具/空间/时间) */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">
                      关键道具 {renderTooltipIcon('key_items')}
                    </label>
                    <input 
                      type="text" 
                      className="text-input" 
                      value={keyItems} 
                      onChange={(e) => setKeyItems(e.target.value)} 
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        空间坐标 {renderTooltipIcon('scene_location')}
                      </label>
                      <input 
                        type="text" 
                        list="city-names-list"
                        className="text-input" 
                        value={sceneLocation} 
                        onChange={(e) => setSceneLocation(e.target.value)} 
                        placeholder={allCityNames.length > 0 ? '输入或从地图城市中选择...' : '场景位置'}
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                      />
                      {allCityNames.length > 0 && (
                        <datalist id="city-names-list">
                          {allCityNames.map(name => <option key={name} value={name} />)}
                        </datalist>
                      )}
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        时间压力 {renderTooltipIcon('time_constraint')}
                      </label>
                      <input 
                        type="text" 
                        className="text-input" 
                        value={timeConstraint} 
                        onChange={(e) => setTimeConstraint(e.target.value)} 
                        style={{ padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Optional Action buttons panel */}
              <div className="glass-panel" style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={handleCheckConsistency}
                    style={{ fontSize: '0.75rem', padding: '0.45rem 0', fontWeight: 'bold' }}
                  >
                    <CheckCircle size={12} style={{ color: 'var(--color-warning)' }} /> 一致性审校
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={handleImportKnowledgeFile}
                    style={{ fontSize: '0.75rem', padding: '0.45rem 0', fontWeight: 'bold' }}
                  >
                    <FileUp size={12} style={{ color: 'var(--accent-light)' }} /> 导入知识库
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={handleClearVectorDb}
                    style={{ fontSize: '0.75rem', padding: '0.45rem 0', fontWeight: 'bold', color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.2)' }}
                  >
                    <Trash2 size={12} /> 清空向量库
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={handleSaveConfig}
                    style={{ fontSize: '0.75rem', padding: '0.45rem 0', fontWeight: 'bold', backgroundColor: 'var(--accent-color)' }}
                  >
                    <Save size={12} /> 保存主配置
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: 大纲设定 */}
        {activeTab === 'setting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            {/* Toggle bar between Markdown, Card Settings, and WorldMapViewer */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', position: 'sticky', top: '0px', zIndex: 90, backgroundColor: 'var(--bg-main)', paddingTop: '0.5rem' }}>
              <button
                className={`btn-secondary`}
                onClick={() => setNovelSettingsMode('cards')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: novelSettingsMode === 'cards' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                可视化卡片引导设定
              </button>
              <button
                className={`btn-secondary`}
                onClick={() => setNovelSettingsMode('markdown')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: novelSettingsMode === 'markdown' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                Markdown 大纲编辑器
              </button>
              <button
                className={`btn-secondary`}
                onClick={() => setNovelSettingsMode('map')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: novelSettingsMode === 'map' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                生成整个世界的地图
              </button>
            </div>

            {novelSettingsMode === 'markdown' ? (
              <div className="full-editor-workspace">
                <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>大纲设定预览</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>只读预览 — 如需修改，请切换至「可视化卡片引导设定」</span>
                </div>
                <div className="preview-markdown" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                  {novelSettingsContent.trim()
                    ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{novelSettingsContent}</ReactMarkdown>
                    : <span style={{ color: 'var(--text-secondary)' }}>暂无内容，请先在卡片模式中填写并保存设定</span>
                  }
                </div>
              </div>
            ) : novelSettingsMode === 'cards' ? (
              <CardSettings
                filepath={filepath}
                config={config}
                onSaveConfig={handleUpdateConfig}
              />
            ) : (
              <MapTab filepath={filepath} />
            )}
          </div>
        )}

        {/* Tab 6: 章节 */}
        {activeTab === 'chapters' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            {/* Toggle bar between ChaptersTab (manage), timeline, directory, and ForeshadowingLedger */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', position: 'sticky', top: '0px', zIndex: 90, backgroundColor: 'var(--bg-main)', paddingTop: '0.5rem' }}>
              <button
                className={`btn-secondary`}
                onClick={() => setChaptersSubTab('manage')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: chaptersSubTab === 'manage' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                章节管理
              </button>
              <button
                className={`btn-secondary`}
                onClick={() => setChaptersSubTab('timeline')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: chaptersSubTab === 'timeline' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                剧情时间线
              </button>
              <button
                className={`btn-secondary`}
                onClick={() => setChaptersSubTab('directory')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: chaptersSubTab === 'directory' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                章节大纲目录
              </button>
              <button
                className={`btn-secondary`}
                onClick={() => setChaptersSubTab('foreshadowing')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: chaptersSubTab === 'foreshadowing' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                伏笔台账
              </button>
            </div>

            {chaptersSubTab === 'manage' && (
              <ChaptersTab
                filepath={filepath}
                selectedLLM={selectedLLM}
                selectedEmbedding={selectedEmbedding}
                selectedRoles={selectedRoles}
                wordCountTarget={wordCountTarget}
                userGuidance={userGuidance}
                charactersInvolved={charactersInvolved}
                keyItems={keyItems}
                sceneLocation={sceneLocation}
                timeConstraint={timeConstraint}
              />
            )}
            {/* StoryTimeline is always mounted to preserve state; hidden via CSS when inactive */}
            <div style={{ display: chaptersSubTab === 'timeline' ? 'contents' : 'none' }}>
              <StoryTimeline
                filepath={filepath}
                characterStateContent={characterStateContent}
                onCharacterStateChange={setCharacterStateContent}
                onCharacterStateSave={() => handleSaveCoreFile('character_state.md', characterStateContent)}
              />
            </div>
            {chaptersSubTab === 'directory' && (
              <ChapterDirectory
                content={novelDirContent}
                onChange={(val) => setNovelDirContent(val)}
                onSave={() => handleSaveCoreFile('novel_directory.md', novelDirContent)}
              />
            )}
            {chaptersSubTab === 'foreshadowing' && (
              <ForeshadowingLedger
                content={foreshadowingLedgerContent}
                onSave={(val) => {
                  setForeshadowingLedgerContent(val);
                  handleSaveCoreFile('foreshadowing_ledger.md', val);
                }}
              />
            )}
          </div>
        )}

        {/* Tab 7: 角色 */}
        {activeTab === 'roles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
            {/* Toggle bar between Role Manager (Library), Graph, and Character State */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', position: 'sticky', top: '0px', zIndex: 90, backgroundColor: 'var(--bg-main)', paddingTop: '0.5rem' }}>
              <button
                className={`btn-secondary`}
                onClick={() => setRolesSubTab('library')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: rolesSubTab === 'library' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                角色档案
              </button>
              <button
                className={`btn-secondary`}
                onClick={() => setRolesSubTab('graph')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: rolesSubTab === 'graph' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                角色图谱
              </button>
              <button
                className={`btn-secondary`}
                onClick={() => setRolesSubTab('state')}
                style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', backgroundColor: rolesSubTab === 'state' ? 'var(--accent-color)' : 'transparent', color: '#fff', border: '1px solid var(--border-color)' }}
              >
                角色当前状态
              </button>
            </div>

            {rolesSubTab === 'library' ? (
              <RoleManager 
                filepath={filepath}
                selectedRoleNames={selectedRoles}
                onSelectRoles={(names) => setSelectedRoles(names)}
              />
            ) : rolesSubTab === 'graph' ? (
              <CharacterGraph filepath={filepath} />
            ) : (
              <MarkdownWorkspace
                title="角色状态记录 (character_state.md)"
                content={characterStateContent}
                onChange={(val) => setCharacterStateContent(val)}
                onSave={() => handleSaveCoreFile('character_state.md', characterStateContent)}
                wordCount={0}
              />
            )}
          </div>
        )}

        {/* Tab 8: 高级配置 */}
        {activeTab === 'config' && (
          <div style={{ paddingTop: '0.75rem' }}>
            <SettingsTab 
              config={config}
              onUpdateConfig={handleUpdateConfig}
              onSave={handleSaveConfig}
            />
          </div>
        )}

      </div>

      <ProjectPickerModal
        open={showProjectPicker}
        currentPath={filepath}
        onClose={() => setShowProjectPicker(false)}
        onSelect={applyProjectPath}
      />

      {/* Compile Prompt Modal Dialog */}
      {showPromptModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', height: '80vh' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                <Sparkles size={16} style={{ color: 'var(--accent-color)' }} /> 第 {activeChapterNum} 章 AI 生成请求提示词 (可编辑)
              </h3>
              <button 
                onClick={() => setShowPromptModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <textarea
                className="editor-textarea"
                style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.5' }}
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
              />
              <div className="status-bar" style={{ marginTop: '0.5rem' }}>
                <span>提示词估算字数: {getChineseWordCount(draftPrompt)} 字</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPromptModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleStartGenerateDraft}>确认发送大模型生成草稿</button>
            </div>
          </div>
        </div>
      )}

      {/* Consistency review feedback Modal */}
      {showConsistencyModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', height: '80vh' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                <CheckCircle size={16} style={{ color: 'var(--color-warning)' }} /> 第 {activeChapterNum} 章 一致性校验审校报告
              </h3>
              <button 
                onClick={() => setShowConsistencyModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', backgroundColor: '#05070c', padding: '1.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem', lineHeight: '1.7', color: '#d1d5db' }}>
                {consistencyResult}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowConsistencyModal(false)}>关闭报告</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
