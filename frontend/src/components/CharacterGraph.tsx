// frontend/src/components/CharacterGraph.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { listRoles, saveRole } from '../api';
import { Category, Role } from '../types/novel';
import { Sparkles, Info, Users, GitFork, UserPlus, Plus } from 'lucide-react';

interface CharacterGraphProps {
  filepath: string;
}

export default function CharacterGraph({ filepath }: CharacterGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [categoriesData, setCategoriesData] = useState<Category[]>([]);
  const [totalRolesCount, setTotalRolesCount] = useState<number>(0);
  const [totalLinksCount, setTotalLinksCount] = useState<number>(0);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Add role node modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newRoleName, setNewRoleName] = useState<string>('');
  const [newRoleCategory, setNewRoleCategory] = useState<string>('主要角色');

  // Load roles data from backend
  const fetchRolesData = async () => {
    if (!filepath) return;
    setLoading(true);
    try {
      const data = await listRoles(filepath);
      setCategoriesData(data.categories || []);
      
      // Calculate count immediately
      let count = 0;
      (data.categories || []).forEach(cat => {
        count += (cat.roles || []).length;
      });
      setTotalRolesCount(count);
    } catch (e) {
      console.error("Failed to fetch roles for relationship graph", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesData();
  }, [filepath]);

  // Create or update ECharts options
  useEffect(() => {
    // If ref is null or categoriesData is not loaded yet, wait
    if (!chartRef.current || categoriesData.length === 0) return;

    // Collect all unique roles and map their names to category
    const allRoles: Role[] = [];
    const roleToCategoryMap = new Map<string, string>();
    let count = 0;

    categoriesData.forEach(cat => {
      (cat.roles || []).forEach(role => {
        allRoles.push(role);
        roleToCategoryMap.set(role.name, cat.name);
        count++;
      });
    });
    setTotalRolesCount(count);

    if (count === 0) {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
      return;
    }

    const roleNames = allRoles.map(r => r.name);

    // Nodes and links arrays
    const nodes: any[] = [];
    const links: any[] = [];
    const linkSet = new Set<string>(); // Prevent duplicate lines

    // 1. Build Nodes
    allRoles.forEach(role => {
      const contentLen = role.content?.length || 0;
      // Calculate responsive node size based on profile details length
      const size = Math.max(25, Math.min(65, 25 + contentLen / 60));
      const catName = roleToCategoryMap.get(role.name) || '未知';

      nodes.push({
        id: role.name,
        name: role.name,
        value: contentLen,
        category: catName,
        symbolSize: size,
        label: {
          show: true,
          position: 'right',
          fontSize: 11,
          fontWeight: 'bold',
        }
      });
    });

    // 2. Parse relationships (smart parser)
    allRoles.forEach(roleA => {
      const text = roleA.content || '';
      const lines = text.split('\n');

      roleNames.forEach(nameB => {
        // Avoid self-linking
        if (roleA.name === nameB) return;

        // Simple check if nameB is mentioned in A's profile
        if (text.includes(nameB)) {
          // Check for link uniqueness to avoid cluttered dual lines
          const linkKey = [roleA.name, nameB].sort().join('->');
          if (linkSet.has(linkKey)) return;
          linkSet.add(linkKey);

          // Find the exact line in A containing B's name to extract the relation details
          let relationLabel = '';
          for (const line of lines) {
            if (line.includes(nameB)) {
              // Pattern 1: B (relationship) or B（关系）
              const parenMatch = line.match(new RegExp(`${nameB}\\s*[（\\(]([^）\\)]+)[）\\)]`));
              if (parenMatch && parenMatch[1]) {
                relationLabel = parenMatch[1].trim();
                break;
              }
              // Pattern 2: B: relationship or B：关系
              const colonMatch = line.match(new RegExp(`${nameB}\\s*[:：]\\s*([^\\n。，*；]+)`));
              if (colonMatch && colonMatch[1]) {
                relationLabel = colonMatch[1].trim();
                break;
              }
              // Pattern 3: B - relationship
              const dashMatch = line.match(new RegExp(`${nameB}\\s*[-]\\s*([^\\n。，*；]+)`));
              if (dashMatch && dashMatch[1]) {
                relationLabel = dashMatch[1].trim();
                break;
              }
            }
          }

          links.push({
            source: roleA.name,
            target: nameB,
            value: relationLabel || '有关联',
            label: {
              show: !!relationLabel,
              // Use a function to prevent formatting template crashes in ECharts
              formatter: () => relationLabel,
              fontSize: 9,
              color: '#f3a492', // Warm copper accent
              backgroundColor: 'rgba(18, 18, 21, 0.95)',
              padding: [2, 4],
              borderRadius: 3,
              borderWidth: 1,
              borderColor: 'rgba(243, 164, 146, 0.2)'
            }
          });
        }
      });
    });
    setTotalLinksCount(links.length);

    try {
      // 3. Initialize ECharts Graph
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(chartRef.current, 'dark');
      }

      const categoriesList = categoriesData.map(c => ({ name: c.name }));

      // Soft Claude warm palette
      const colorPalette = [
        '#e06c53', // Amber Copper
        '#59a781', // Sage Green
        '#5b82c1', // Slate Blue
        '#d1a153', // Clay Gold
        '#a87ec9', // Dusty Amethyst
        '#559999', // Muted Teal
      ];

      const option: echarts.EChartsOption = {
        backgroundColor: 'transparent',
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            if (params.dataType === 'node') {
              return `<div style="font-family: inherit; font-size: 0.8rem; padding: 4px 8px; line-height: 1.5; color: #fff;">
                <strong style="color: var(--accent-color); font-size: 0.85rem;">👤 ${params.data.name}</strong><br/>
                <span style="color: #9ca3af;">阵营/分类:</span> ${params.data.category}<br/>
                <span style="color: #9ca3af;">人物设定长度:</span> ${params.data.value} 字
              </div>`;
            } else if (params.dataType === 'edge') {
              return `<div style="font-family: inherit; font-size: 0.8rem; padding: 4px 8px; line-height: 1.5; color: #fff;">
                <strong style="color: #f3a492;">🔗 关系联结</strong><br/>
                ${params.data.source} ➡️ ${params.data.target}<br/>
                <span style="color: #9ca3af;">设定纽带:</span> ${params.data.value}
              </div>`;
            }
            return '';
          },
          backgroundColor: '#121215',
          borderColor: '#24242b',
          borderWidth: 1,
          textStyle: {
            color: '#e5e7eb'
          }
        },
        legend: {
          data: categoriesList.map(c => c.name),
          textStyle: {
            color: '#9ca3af',
            fontSize: 11,
            fontFamily: 'inherit'
          },
          icon: 'circle',
          top: '2%',
          right: '4%'
        },
        color: colorPalette,
        series: [
          {
            type: 'graph',
            layout: 'force',
            data: nodes,
            links: links,
            categories: categoriesList,
            roam: true, // Allow zooming & panning
            draggable: true,
            label: {
              show: true,
              position: 'right',
              color: '#e5e7eb',
              fontSize: 11,
              fontFamily: 'inherit',
              formatter: '{b}'
            },
            lineStyle: {
              color: 'source', // Line inherits source node's color
              width: 1.8,
              curveness: 0.12, // Curve double links elegantly
              opacity: 0.75
            },
            force: {
              repulsion: 250, // Spread nodes apart
              gravity: 0.04,
              edgeLength: 140,
              layoutAnimation: true
            },
            emphasis: {
              focus: 'adjacency', // Highlight connection path on hover
              lineStyle: {
                width: 4.0,
                opacity: 1
              },
              label: {
                show: true,
                fontWeight: 'bold'
              }
            }
          }
        ]
      };

      chartInstance.current.setOption(option);
    } catch (err) {
      console.error("ECharts configuration or rendering failed", err);
    }

    // Resize handler
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [categoriesData]);

  // Clean up chart on unmount
  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  // Creator handler for new role node
  const handleAddRoleNode = async () => {
    if (!newRoleName.trim() || !filepath) return;
    const initialContent = `# ${newRoleName}\n\n## 基本信息\n- 姓名：${newRoleName}\n- 年龄：\n- 身份：\n\n## 功法修持 / 技能\n- \n\n## 角色性格与背景\n- \n`;
    try {
      await saveRole({
        filepath,
        category: newRoleCategory,
        role_name: newRoleName,
        content: initialContent,
      });
      setNewRoleName('');
      setShowAddModal(false);
      await fetchRolesData();
      alert(`角色节点 '${newRoleName}' 创建成功！后续可在“角色档案”中对其编辑润色。`);
    } catch (e) {
      alert('创建新角色节点失败，请确保本地后台正常运行！');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 180px)' }}>
      {/* Dynamic dashboard status bar */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem 1.25rem', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
          <Users size={14} style={{ color: 'var(--accent-color)' }} />
          <span>图谱节点(角色): <strong style={{ color: '#fff' }}>{totalRolesCount}</strong> 个</span>
        </div>
        <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
          <GitFork size={14} style={{ color: '#59a781' }} />
          <span>设定纽带(关系): <strong style={{ color: '#fff' }}>{totalLinksCount}</strong> 条</span>
        </div>
        <div style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-color)' }} />
        <button 
          onClick={fetchRolesData} 
          className="btn-secondary" 
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.25rem', borderRadius: '5px' }}
        >
          <Sparkles size={11} /> 重新分析扫描关系
        </button>
        <div style={{ flex: 1 }} />
        <button 
          onClick={() => setShowAddModal(true)} 
          className="btn-primary" 
          style={{ padding: '0.35rem 0.85rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'var(--accent-color)', borderRadius: '5px' }}
        >
          <UserPlus size={12} /> 新增角色节点
        </button>
      </div>

      <div className="glass-panel" style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: 'rgba(11,11,13,0.85)' }}>
            <div style={{ width: '24px', height: '24px', border: '3px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>正在扫描角色关系并绘制图谱中...</span>
          </div>
        )}

        {/* ECharts Canvas container - ALWAYS IN DOM to avoid ref initialization race conditions in React */}
        <div 
          style={{ 
            flex: 1, 
            display: totalRolesCount === 0 ? 'none' : 'flex', 
            position: 'relative', 
            height: '100%' 
          }}
        >
          <div ref={chartRef} style={{ width: '100%', height: '100%', minHeight: '400px' }} />

          {/* Smart mini tips guide */}
          <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', maxWidth: '380px', backgroundColor: 'rgba(18,18,21,0.85)', backdropFilter: 'blur(8px)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.65rem 0.85rem', display: 'flex', gap: '0.5rem' }}>
            <Info size={14} style={{ color: 'var(--accent-color)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              <strong style={{ color: '#fff', display: 'block', marginBottom: '0.15rem' }}>💡 关系绘制小贴士</strong>
              在任何角色的 Markdown 设定文本里提及另一个角色名字即可连线！
              通过写出类似 <code style={{ color: 'var(--accent-color)' }}>* 顾长生：同门师兄</code> 形式的列表行，图谱还能自动在连线上标示出专属纽带关系文本。支持鼠标拖动节点与滑轮缩放。
            </div>
          </div>
        </div>

        {/* Absolute overlay placeholder if no roles */}
        {totalRolesCount === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem', padding: '2rem' }}>
            <Info size={36} style={{ color: 'var(--accent-color)', opacity: 0.6 }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 'bold', marginBottom: '0.25rem' }}>暂无角色档案数据</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>请先在右上方点击“新增角色节点”创建角色，或者设置正确的小说项目保存目录！</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Role Modal inside Graph View */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                <Plus size={16} style={{ color: 'var(--accent-color)' }} /> 新增人物图谱节点
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
                <label className="form-label">角色名字 (节点名称)</label>
                <input
                  type="text"
                  className="text-input"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="例如: 顾长生"
                />
              </div>
              <div className="form-group">
                <label className="form-label">设定分类 (所属势力/阵营)</label>
                <input
                  type="text"
                  className="text-input"
                  value={newRoleCategory}
                  onChange={(e) => setNewRoleCategory(e.target.value)}
                  placeholder="例如: 主要角色、敌对势力、大荒神庙"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleAddRoleNode} style={{ backgroundColor: 'var(--accent-color)' }}>确定创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
