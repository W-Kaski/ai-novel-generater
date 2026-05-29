// frontend/src/components/CardSettings.tsx
import React, { useState, useEffect } from 'react';
import { getSettingCards, saveSettingCards } from '../api';
import { AppConfig, SettingCard } from '../types/novel';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Save, 
  Plus, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  GripVertical, 
  Edit2, 
  Check, 
  Layers 
} from 'lucide-react';

interface CardSettingsProps {
  filepath: string;
  config: AppConfig;
  onSaveConfig: (updated: AppConfig) => void;
}

export default function CardSettings({ filepath, config, onSaveConfig }: CardSettingsProps) {
  const [cards, setCards] = useState<SettingCard[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [editingCardIds, setEditingCardIds] = useState<Record<string, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load cards from API on mount/filepath change
  const loadCards = async () => {
    if (!filepath) return;
    setLoading(true);
    try {
      const data = await getSettingCards(filepath);
      setCards(data);
    } catch (e) {
      console.error('Failed to load setting cards from backend', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
  }, [filepath]);

  // Extract unique list of categories from active cards
  const categories = Array.from(new Set(cards.map(c => c.category || '其他设定')));

  // Filter visible cards based on the selected dropdown category
  const visibleCards = cards.filter(
    c => selectedCategory === '全部' || c.category === selectedCategory
  );

  // Toggle edit state of a single card
  const toggleEditMode = (cardId: string) => {
    setEditingCardIds(prev => ({
      ...prev,
      [cardId]: !prev[cardId]
    }));
  };

  // Update a single field inside a specific card
  const handleUpdateCardField = (id: string, field: keyof SettingCard, value: any) => {
    setCards(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, indexInVisible: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === indexInVisible) return;

    const dragTargetVisibleCard = visibleCards[draggedIndex];
    const dropTargetVisibleCard = visibleCards[indexInVisible];

    // Find their actual index in the master array
    const dragIdxInOriginal = cards.findIndex(c => c.id === dragTargetVisibleCard.id);
    const dropIdxInOriginal = cards.findIndex(c => c.id === dropTargetVisibleCard.id);

    if (dragIdxInOriginal === -1 || dropIdxInOriginal === -1) return;

    const updatedCards = [...cards];
    const [removed] = updatedCards.splice(dragIdxInOriginal, 1);
    updatedCards.splice(dropIdxInOriginal, 0, removed);

    setCards(updatedCards);
    setDraggedIndex(null);
  };

  // Reorder buttons logic
  const moveCard = (id: string, delta: number) => {
    const idx = cards.findIndex(c => c.id === id);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= cards.length) return;

    const updated = [...cards];
    const [removed] = updated.splice(idx, 1);
    updated.splice(newIdx, 0, removed);
    setCards(updated);
  };

  // Add custom card (defaults to '其他设定')
  const handleAddCard = () => {
    const cat = '其他设定';
    const newCard: SettingCard = {
      id: 'card-' + Date.now(),
      required: false,
      category: cat,
      title: '新设定项',
      content: '',
      heading_level: 3
    };
    setCards(prev => [...prev, newCard]);
    setSelectedCategory('全部'); // Jump to '全部' so the new card is visible
    // Set to edit mode automatically
    setEditingCardIds(prev => ({
      ...prev,
      [newCard.id]: true
    }));
  };

  // Add custom category with a placeholder card
  const handleAddCategory = () => {
    const cat = newCategoryName.trim();
    if (!cat) {
      alert('新分类名称不能为空！');
      return;
    }
    if (categories.includes(cat)) {
      alert('该分类已经存在！');
      return;
    }
    const newCard: SettingCard = {
      id: 'card-' + Date.now(),
      required: false,
      category: cat,
      title: `${cat}分类说明`,
      content: `在此输入【${cat}】分类的详细设定。`,
      heading_level: 3
    };
    setCards(prev => [...prev, newCard]);
    setSelectedCategory(cat); // Jump to new category immediately
    setEditingCardIds(prev => ({
      ...prev,
      [newCard.id]: true
    }));
    setNewCategoryName(''); // Clear input
  };

  // Delete custom category (only if empty)
  const handleDeleteCategory = () => {
    if (selectedCategory === '全部') return;
    
    // 用局部变量捕获当前分类名，避免 setState 异步更新后闭包读取到旧值
    const categoryToDelete = selectedCategory;
    const cardsInCat = cards.filter(c => c.category === categoryToDelete);
    if (cardsInCat.length > 0) {
      alert(`无法删除分类【${categoryToDelete}】：该分类下尚包含 ${cardsInCat.length} 个设定项，请先将它们移动到其他分类或将卡片删除！`);
      return;
    }

    if (!confirm(`确定要删除空分类【${categoryToDelete}】吗？`)) return;
    setSelectedCategory('全部');
    alert(`空分类【${categoryToDelete}】已删除成功！`);
  };

  // Delete custom card and immediately persist to backend
  const handleDeleteCard = async (id: string) => {
    if (!confirm('确定要删除这张设定卡片吗？')) return;
    const updated = cards.filter(c => c.id !== id);
    setCards(updated);
    if (filepath) {
      try {
        await saveSettingCards({ filepath, cards: updated });
      } catch (err) {
        console.error('Auto-save after card delete failed', err);
      }
    }
  };

  // Save cards to backend JSON and compile to novel_settings.md
  const handleSaveCards = async () => {
    if (!filepath) return;
    try {
      const res = await saveSettingCards({ filepath, cards });
      if (res.status === 'success') {
        alert('设定卡片保存成功，并同步编译至 novel_settings.md！');
        // Notify parent workspace to update config
        onSaveConfig({ ...config });
      } else {
        alert('保存卡片失败: ' + res.message);
      }
    } catch (err) {
      alert('保存失败，请检查网络！');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: '1rem' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>正在读取小说设定卡片...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'calc(100vh - 170px)' }}>
      {/* Top Header Filter & Add Toolbar */}
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', padding: '1rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Layers size={18} style={{ color: 'var(--accent-color)' }} />
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff' }}>过滤分类</span>
          <select 
            className="select-input" 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: '160px', padding: '0.45rem 0.75rem' }}
          >
            <option value="全部">全部设定</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {selectedCategory !== '全部' && (
            <button 
              className="btn-secondary" 
              onClick={handleDeleteCategory}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontSize: '0.75rem', color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.25)', borderRadius: '4px' }}
              title="删除当前选中的分类"
            >
              <Trash2 size={13} /> 删除分类
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input
            type="text"
            className="text-input"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="新分类名称"
            style={{ width: '150px', padding: '0.45rem 0.75rem' }}
          />
          <button className="btn-secondary" onClick={handleAddCategory} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
            <Plus size={14} /> 添加分类
          </button>
          <button className="btn-secondary" onClick={handleAddCard} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
            <Plus size={14} /> 添加卡片
          </button>
          <button className="btn-primary" onClick={handleSaveCards} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 1.25rem', fontSize: '0.8rem', backgroundColor: 'var(--color-success)' }}>
            <Save size={14} /> 保存设定卡片
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0 0.5rem' }}>
        提示：仅“小说名称”和“题材方向”为必填，用于约束大纲生成。其余卡片为自定义可选设定。拖拽卡片或点击排序键可调整其在 final markdown 中的编译顺序。
      </div>

      {/* Dynamic setting cards layout list */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', minWidth: 0 }}>
          {visibleCards.map((card, index) => {
            const isEditing = !!editingCardIds[card.id];
            
            return (
              <div
                key={card.id}
                className="glass-panel"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  padding: '1.25rem',
                  cursor: 'default',
                  position: 'relative',
                  border: isEditing ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  minWidth: 0
                }}
              >
                {/* Card Header metadata */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Drag Handle — only this element is draggable */}
                    {!isEditing && (
                      <div
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, index); }}
                        onDragEnd={(e) => { e.stopPropagation(); handleDragEnd(e); }}
                        style={{ color: 'var(--text-muted)', cursor: 'grab', display: 'flex', alignItems: 'center', userSelect: 'none' }}
                        title="按住拖拽排序"
                      >
                        <GripVertical size={14} />
                      </div>
                    )}
                    {/* Required / Custom Badge */}
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: card.required ? 'rgba(224, 108, 83, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                      color: card.required ? 'var(--accent-light)' : 'var(--text-secondary)',
                      border: card.required ? '1px solid rgba(224, 108, 83, 0.4)' : '1px solid rgba(107, 114, 128, 0.3)'
                    }}>
                      {card.required ? '必填' : '自定义'}
                    </span>
                  </div>

                  {/* Manual Arrow orders and Delete actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button 
                      className="btn-secondary" 
                      onClick={(e) => { e.stopPropagation(); moveCard(card.id, -1); }}
                      style={{ padding: '2px 4px', borderRadius: '4px', height: '24px' }}
                      title="上移"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button 
                      className="btn-secondary" 
                      onClick={(e) => { e.stopPropagation(); moveCard(card.id, 1); }}
                      style={{ padding: '2px 4px', borderRadius: '4px', height: '24px' }}
                      title="下移"
                    >
                      <ChevronDown size={12} />
                    </button>
                    {!card.required && (
                      <button 
                        className="btn-secondary" 
                        onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }}
                        style={{ padding: '2px 4px', borderRadius: '4px', height: '24px', color: 'var(--color-error)' }}
                        title="删除卡片"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit Form State */}
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">标题</label>
                        <input
                          type="text"
                          className="text-input"
                          value={card.title}
                          onChange={(e) => handleUpdateCardField(card.id, 'title', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">分类</label>
                        <select
                          className="select-input"
                          value={card.category || '其他设定'}
                          onChange={(e) => handleUpdateCardField(card.id, 'category', e.target.value)}
                          style={{ width: '100%' }}
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">设定详情 (支持 Markdown 语法)</label>
                      <textarea
                        className="textarea-input"
                        wrap="soft"
                        value={card.content}
                        onChange={(e) => handleUpdateCardField(card.id, 'content', e.target.value)}
                        style={{ minHeight: '130px', fontSize: '0.8rem', lineHeight: '1.5' }}
                      />
                    </div>
                  </div>
                ) : (
                  /* Read-Only Preview State */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%', flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{card.title || '未命名设定'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{card.category}</span>
                    </div>
                    {/* Markdown rendering inside a clean read-only block */}
                    <div 
                      onDoubleClick={() => toggleEditMode(card.id)}
                      className="preview-markdown"
                      style={{ 
                        padding: '0.5rem', 
                        minHeight: '80px', 
                        maxHeight: '300px',
                        overflowY: 'auto',
                        fontSize: '0.8rem',
                        lineHeight: '1.6',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px dashed rgba(255,255,255,0.05)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="双击进入编辑模式"
                    >
                      {card.content.trim() ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.content}</ReactMarkdown>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>无详细设定内容。请点击下方“编辑”添加内容。</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Edit/Preview Mode button */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={(e) => { e.stopPropagation(); toggleEditMode(card.id); }}
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
                      <>
                        <Check size={12} /> 预览并收起
                      </>
                    ) : (
                      <>
                        <Edit2 size={12} /> 编辑卡片
                      </>
                    )}
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {visibleCards.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            该分类下暂无设定卡片。您可以在上方输入分类名并点击“添加卡片”进行新增。
          </div>
        )}
      </div>
    </div>
  );
}
