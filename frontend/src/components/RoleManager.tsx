// frontend/src/components/RoleManager.tsx
import React, { useState, useEffect } from 'react';
import { listRoles, saveRole, deleteRole } from '../api';
import { Category, Role } from '../types/novel';
import { Users, UserPlus, Save, CheckSquare, Square, Trash2, FolderPlus } from 'lucide-react';
import ObsidianEditor from './ObsidianEditor';

interface RoleManagerProps {
  filepath: string;
  selectedRoleNames: string[];
  onSelectRoles: (roleNames: string[]) => void;
}

export default function RoleManager({ filepath, selectedRoleNames, onSelectRoles }: RoleManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [roleText, setRoleText] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Modals and New Role Inputs
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCategory, setNewRoleCategory] = useState('主角');
  
  // Custom Category Creation States
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');

  // Sidebar category creation modal
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');

  const fetchRoles = async () => {
    if (!filepath) return;
    setLoading(true);
    try {
      const data = await listRoles(filepath);
      setCategories(data.categories || []);
      
      // Keep active role loaded and refreshed
      if (activeRole) {
        let found = false;
        for (const cat of (data.categories || [])) {
          const matched = cat.roles.find(r => r.name === activeRole.name);
          if (matched) {
            setActiveRole(matched);
            setActiveCategory(cat.name);
            found = true;
            break;
          }
        }
        if (!found) {
          setActiveRole(null);
          setActiveCategory('');
          setRoleText('');
        }
      } else if (data.categories && data.categories.length > 0 && !activeCategory) {
        setActiveCategory(data.categories[0].name);
      }
    } catch (e) {
      console.error("Failed to load character library", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [filepath]);

  const selectRole = (role: Role, catName: string) => {
    setActiveRole(role);
    setActiveCategory(catName);
    setRoleText(role.content || '');
  };

  const handleSaveRole = async () => {
    if (!activeRole || !filepath || !activeCategory) return;
    try {
      await saveRole({
        filepath,
        category: activeCategory,
        role_name: activeRole.name,
        content: roleText,
      });
      
      // Update local state cache
      setCategories((prev) => 
        prev.map(cat => {
          if (cat.name === activeCategory) {
            return {
              ...cat,
              roles: cat.roles.map(r => r.name === activeRole.name ? { ...r, content: roleText } : r)
            };
          }
          return cat;
        })
      );
      alert(`角色 '${activeRole.name}' 资料保存成功！`);
    } catch (e) {
      alert('保存失败，请检查网络和后台！');
    }
  };

  // Delete handler with server removal and directory cleanup
  const handleDeleteRole = async () => {
    if (!activeRole || !filepath || !activeCategory) return;
    if (!window.confirm(`确认要从角色档案中永久删除角色 '${activeRole.name}' 吗？此操作不可逆！`)) return;

    try {
      await deleteRole(filepath, activeCategory, activeRole.name);
      // Deselect if active
      onSelectRoles(selectedRoleNames.filter(name => name !== activeRole.name));
      setActiveRole(null);
      setRoleText('');
      await fetchRoles();
      alert('角色资料已成功删除！');
    } catch (e) {
      alert('删除角色失败，请确保后台正常运行！');
    }
  };

  const handleOpenAddModal = () => {
    setNewRoleName('');
    setIsCustomCategory(false);
    setCustomCategoryName('');
    
    if (categories.length > 0) {
      setNewRoleCategory(categories[0].name);
    } else {
      setNewRoleCategory('主角');
    }
    setShowAddModal(true);
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim() || !filepath) return;
    
    // Resolve final category: either dropdown selection or new typed custom input
    const finalCategory = isCustomCategory ? customCategoryName.trim() : newRoleCategory;
    if (!finalCategory) {
      alert('分类/势力名称不能为空！');
      return;
    }
    
    const initialContent = `# ${newRoleName}\n\n## 基本信息\n- 姓名：${newRoleName}\n- 年龄：\n- 身份：\n\n## 功法修持 / 技能\n- \n\n## 角色性格与背景\n- \n`;
    try {
      await saveRole({
        filepath,
        category: finalCategory,
        role_name: newRoleName,
        content: initialContent,
      });
      setNewRoleName('');
      setCustomCategoryName('');
      setIsCustomCategory(false);
      setShowAddModal(false);
      await fetchRoles();
    } catch (e) {
      alert('创建失败，请确保连接状态正常！');
    }
  };

  const handleCreateCategory = async () => {
    const categoryName = newCategoryNameInput.trim();
    if (!categoryName || !filepath) {
      alert('分类名称不能为空！');
      return;
    }
    
    if (categories.some(cat => cat.name === categoryName)) {
      alert('该分类已经存在！');
      return;
    }

    try {
      await saveRole({
        filepath,
        category: categoryName,
        role_name: '说明',
        content: `# ${categoryName} 分类介绍\n\n在此编写该分类或势力的背景介绍。`,
      });
      setShowAddCategoryModal(false);
      setNewCategoryNameInput('');
      await fetchRoles();
      alert('分类新建成功！');
    } catch (e) {
      alert('创建分类失败，请确保连接状态正常！');
    }
  };

  const toggleSelectRole = (roleName: string) => {
    if (selectedRoleNames.includes(roleName)) {
      onSelectRoles(selectedRoleNames.filter(name => name !== roleName));
    } else {
      onSelectRoles([...selectedRoleNames, roleName]);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', height: 'calc(100vh - 180px)' }}>
      {/* Sidebar List */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="panel-title" style={{ border: 'none', marginBottom: 0, paddingBottom: 0 }}>
            <Users size={18} style={{ color: 'var(--accent-color)' }} /> 角色列表
          </h3>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button 
              className="btn-secondary" 
              onClick={() => {
                setNewCategoryNameInput('');
                setShowAddCategoryModal(true);
              }}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: '6px', borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
            >
              <FolderPlus size={14} /> 新建分类
            </button>
            <button 
              className="btn-secondary" 
              onClick={handleOpenAddModal}
              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', borderRadius: '6px', borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
            >
              <UserPlus size={14} /> 新增角色
            </button>
          </div>
        </div>

        {loading && <div style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem' }}>正在加载角色档案...</div>}

        {!loading && categories.length === 0 && (
          <div style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem', lineHeight: '1.4' }}>
            尚未创建角色档案文件夹。<br/>请选择小说保存路径并在上方点击“新增角色”初始化分类目录。
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflowY: 'auto', marginTop: '0.5rem' }}>
          {categories.map((cat) => (
            <div key={cat.name}>
              <h4 style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.5rem', borderLeft: '2.5px solid var(--accent-color)', paddingLeft: '0.5rem' }}>
                {cat.name}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {(cat.roles || []).map((role) => {
                  const isChecked = selectedRoleNames.includes(role.name);
                  const isCurrentActive = activeRole?.name === role.name;
                  return (
                    <div 
                      key={role.name}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}
                    >
                      <button
                        onClick={() => toggleSelectRole(role.name)}
                        style={{ background: 'transparent', border: 'none', color: isChecked ? '#10b981' : '#5e6573', cursor: 'pointer', display: 'flex', padding: '0.5rem 0' }}
                        title={isChecked ? '取消勾选' : '勾选出场'}
                      >
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                      <div
                        onClick={() => selectRole(role, cat.name)}
                        className={`tree-item ${isCurrentActive ? 'active' : ''}`}
                        style={{ flex: 1, padding: '0.4rem 0.5rem', marginBottom: 0 }}
                      >
                        <span>{role.name}</span>
                        {isChecked && (
                          <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>
                            已导入
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor Main Section */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: 0, overflow: 'hidden' }}>
        {activeRole ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '1rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>{activeRole.name}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>设定分组: {activeCategory}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn-secondary" 
                  onClick={handleDeleteRole} 
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem', color: 'var(--color-error)', borderColor: 'rgba(239,68,68,0.25)', borderRadius: '4px' }}
                >
                  <Trash2 size={13} /> 删除人物卡
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleSaveRole} 
                  style={{ padding: '0.45rem 1.1rem', fontSize: '0.75rem', backgroundColor: 'var(--accent-color)', borderRadius: '4px' }}
                >
                  <Save size={14} /> 保存资料
                </button>
              </div>
            </div>
            
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ObsidianEditor
                value={roleText}
                onChange={(val) => setRoleText(val)}
              />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '0.5rem' }}>
            <Users size={32} style={{ opacity: 0.5, color: 'var(--accent-color)' }} />
            <span style={{ fontSize: '0.8rem' }}>在左侧列表中点击具体角色以编辑详细属性与生平。</span>
          </div>
        )}
      </div>

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                <FolderPlus size={16} style={{ color: 'var(--accent-color)' }} /> 新建自定义分类
              </h3>
              <button 
                onClick={() => setShowAddCategoryModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">分类名称 (例如：敌对势力)</label>
                <input
                  type="text"
                  className="text-input"
                  value={newCategoryNameInput}
                  onChange={(e) => setNewCategoryNameInput(e.target.value)}
                  placeholder="例如: 敌对势力"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddCategoryModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleCreateCategory} style={{ backgroundColor: 'var(--accent-color)' }}>确定创建</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Role Modal with custom categories creation */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                <UserPlus size={16} style={{ color: 'var(--accent-color)' }} /> 新增人物档案卡
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">角色姓名 (人物卡名称)</label>
                <input
                  type="text"
                  className="text-input"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="例如: 沈青灯"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">分类/势力范围</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <select
                    className="select-input"
                    value={isCustomCategory ? '__new__' : newRoleCategory}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setIsCustomCategory(true);
                      } else {
                        setIsCustomCategory(false);
                        setNewRoleCategory(e.target.value);
                      }
                    }}
                    style={{ flex: 1 }}
                  >
                    {categories.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                    {/* Default fallback options if categories list is completely empty */}
                    {categories.length === 0 && (
                      <>
                        <option value="主角">主角</option>
                        <option value="配角">配角</option>
                        <option value="反派">反派</option>
                        <option value="势力人物">势力人物</option>
                      </>
                    )}
                    <option value="__new__">➕ 【新建自定义分类】</option>
                  </select>
                </div>
                
                {isCustomCategory && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                    <FolderPlus size={14} style={{ color: 'var(--accent-color)', flexShrink: 0 }} />
                    <input
                      type="text"
                      className="text-input"
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      placeholder="输入新分类, 如: 临渊城世家"
                      style={{ flex: 1 }}
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleAddRole} style={{ backgroundColor: 'var(--accent-color)' }}>确定创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
