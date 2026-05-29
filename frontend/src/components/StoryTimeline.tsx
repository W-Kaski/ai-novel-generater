import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { getPlotArcs, savePlotArcs, listRoles } from '../api';
import type { PlotArcsData, PlotChapter, PlotBeat } from '../types/novel';

import {
  layoutAllChapters,
  layoutChapter,
  buildCharacterPaths,
  maxRowInTimeline,
  colorForCharacter,
  newSceneId,
  resetColorMap,
  type LayoutNode,
} from '../utils/plotTimelineLayout';
import { Sparkles, Save, Plus, Trash2, UserPlus, Users, BookMarked } from 'lucide-react';

interface StoryTimelineProps {
  filepath: string;
  characterStateContent?: string;
  onCharacterStateChange?: (val: string) => void;
  onCharacterStateSave?: () => void;
}

function nodeTooltipHtml(node: LayoutNode): string {
  const title = node.merged
    ? `第 ${node.chapter_num} 章 · ${node.beats.map(b => b.character).join('、')}`
    : `第 ${node.chapter_num} 章 · ${node.beats[0]?.character || ''}`;
  let html = `<div style="padding:0.5rem;line-height:1.55;font-size:0.75rem;width:280px;white-space:normal;">`;
  html += `<div style="font-weight:bold;color:#fff;border-bottom:1px solid #374151;padding-bottom:4px;margin-bottom:6px;">${title}</div>`;
  for (const b of node.beats) {
    const c = colorForCharacter(b.character);
    html += `<div style="margin-bottom:4px;"><span style="color:${c};font-weight:bold;">${b.character}：</span>`;
    html += `<span style="color:#d1d5db;">${(b.event || '').trim() || '（未填写）'}</span></div>`;
  }
  html += `</div>`;
  return html;
}

export default function StoryTimeline({ filepath, characterStateContent = '', onCharacterStateChange, onCharacterStateSave }: StoryTimelineProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [plotData, setPlotData] = useState<PlotArcsData | null>(null);
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [focusedChapter, setFocusedChapter] = useState(1);
  const [rightPanel, setRightPanel] = useState<'beats' | 'state'>('beats');
  const isInitialLoad = useRef(true);

  const chapters = plotData?.chapters ?? [];
  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.chapter_num - b.chapter_num),
    [chapters]
  );
  const chapterNums = sortedChapters.map(c => c.chapter_num);
  const maxChapter = chapterNums.length ? Math.max(...chapterNums) : 1;
  const yMax = maxRowInTimeline(sortedChapters);

  const loadAll = async () => {
    if (!filepath) return;
    setLoading(true);
    try {
      // 重置颜色映射，确保每次加载时颜色分配一致
      resetColorMap();

      const [data, roles] = await Promise.all([
        getPlotArcs(filepath),
        listRoles(filepath),
      ]);
      setPlotData(data);
      const names: string[] = [];
      for (const cat of roles.categories || []) {
        for (const r of cat.roles || []) {
          if (r.name) names.push(r.name);
        }
      }
      setRoleNames([...new Set(names)]);
      if (data.chapters?.length) {
        setFocusedChapter(data.chapters[0].chapter_num);
      }
    } catch (e) {
      console.error('Failed to load plot timeline', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [filepath]);

  // Track unsaved changes (no auto-save; user must click save to sync)
  useEffect(() => {
    if (isInitialLoad.current) { isInitialLoad.current = false; return; }
    if (!plotData || loading) return;
    setUnsaved(true);
  }, [plotData]);

  const updateChapters = (updater: (prev: PlotChapter[]) => PlotChapter[]) => {
    setPlotData(prev => {
      if (!prev) return prev;
      return { ...prev, chapters: updater(prev.chapters) };
    });
  };

  const getChapter = (num: number) => sortedChapters.find(c => c.chapter_num === num);

  const handleSave = async () => {
    if (!filepath || !plotData) return;
    setSaving(true);
    try {
      const res = await savePlotArcs({ filepath, data: plotData });
      if (res.status === 'success') {
        setUnsaved(false);
      } else {
        alert('保存失败: ' + res.message);
      }
    } catch {
      alert('保存失败，请检查网络');
    } finally {
      setSaving(false);
    }
  };

  const handleAddChapter = () => {
    const next = sortedChapters.length ? Math.max(...chapterNums) + 1 : 1;
    updateChapters(prev => [...prev, { chapter_num: next, beats: [] }]);
    setFocusedChapter(next);
  };

  const handleDeleteLastChapter = () => {
    if (sortedChapters.length <= 1) return;
    if (!confirm('确定删除最后一章？')) return;
    const last = Math.max(...chapterNums);
    updateChapters(prev => prev.filter(c => c.chapter_num !== last));
    setFocusedChapter(Math.min(focusedChapter, last - 1));
  };

  const handleAddBeat = (chapterNum: number) => {
    updateChapters(prev =>
      prev.map(ch =>
        ch.chapter_num === chapterNum
          ? {
              ...ch,
              beats: [
                ...ch.beats,
                { character: '', event: '', scene_id: newSceneId() },
              ],
            }
          : ch
      )
    );
  };

  const handleShareFrame = (chapterNum: number, beatIdx: number, targetCharacter: string) => {
    updateChapters(prev =>
      prev.map(ch => {
        if (ch.chapter_num !== chapterNum) return ch;
        const beats = [...ch.beats];
        if (!targetCharacter) {
          beats[beatIdx] = { ...beats[beatIdx], scene_id: newSceneId() };
        } else {
          const targetIdx = beats.findIndex((b, i) => i !== beatIdx && b.character === targetCharacter);
          if (targetIdx >= 0) {
            const sid = beats[targetIdx].scene_id || newSceneId();
            beats[targetIdx] = { ...beats[targetIdx], scene_id: sid };
            beats[beatIdx] = { ...beats[beatIdx], scene_id: sid };
          }
        }
        return { ...ch, beats };
      })
    );
  };

  const handleRemoveBeat = (chapterNum: number, index: number) => {
    updateChapters(prev =>
      prev.map(ch =>
        ch.chapter_num === chapterNum
          ? { ...ch, beats: ch.beats.filter((_, i) => i !== index) }
          : ch
      )
    );
  };

  const handleBeatChange = (
    chapterNum: number,
    index: number,
    field: keyof PlotBeat,
    value: string
  ) => {
    updateChapters(prev =>
      prev.map(ch => {
        if (ch.chapter_num !== chapterNum) return ch;
        const beats = [...ch.beats];
        beats[index] = { ...beats[index], [field]: value };
        return { ...ch, beats };
      })
    );
  };

  const handleMergeWithPrev = (chapterNum: number, index: number) => {
    if (index <= 0) return;
    updateChapters(prev =>
      prev.map(ch => {
        if (ch.chapter_num !== chapterNum) return ch;
        const beats = [...ch.beats];
        const prevSid = beats[index - 1].scene_id || newSceneId();
        beats[index] = { ...beats[index], scene_id: prevSid };
        if (!beats[index - 1].scene_id) {
          beats[index - 1] = { ...beats[index - 1], scene_id: prevSid };
        }
        return { ...ch, beats };
      })
    );
  };

  // ECharts: straight lines per character + single scatter for merged nodes
  useEffect(() => {
    if (!chartRef.current || !plotData || sortedChapters.length === 0) return;

    // 复用已有实例，避免每次更新都触发销毁重建（防止图表闪烁、丢失缩放状态）
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    const chart = chartInstance.current;

    const nodes = layoutAllChapters(sortedChapters);
    const paths = buildCharacterPaths(sortedChapters);
    const nodeSeriesData = nodes.map(node => ({
      value: [node.chapter_num, node.row],
      symbolSize: node.merged ? 14 : 10,
      itemStyle: {
        color: node.merged ? '#e06c53' : colorForCharacter(node.beats[0]?.character || ''),
        borderColor: '#111827',
        borderWidth: 2,
      },
      _node: node,
    }));

    const lineSeries: echarts.SeriesOption[] = [];
    paths.forEach((rows, character) => {
      const data = chapterNums.map((chNum, i) => {
        const y = rows[i];
        return y === null ? null : [chNum, y];
      });
      lineSeries.push({
        name: character,
        type: 'line',
        data,
        smooth: false,
        connectNulls: false,
        showSymbol: false,
        symbol: 'circle',
        lineStyle: {
          color: colorForCharacter(character),
          width: 2,
        },
        emphasis: { focus: 'series' },
      });
    });

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      legend: {
        type: 'scroll',
        bottom: 0,
        textStyle: { color: '#9ca3af', fontSize: 10 },
      },
      grid: {
        top: '12%',
        left: '8%',
        right: '4%',
        bottom: '22%',
        containLabel: true,
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'none' },
        {
          type: 'slider',
          xAxisIndex: 0,
          height: 16,
          bottom: 28,
          borderColor: '#374151',
          fillerColor: 'rgba(224,108,83,0.12)',
        },
      ],
      tooltip: {
        trigger: 'item',
        backgroundColor: '#111827',
        borderColor: '#374151',
        textStyle: { color: '#f3f4f6' },
        formatter: (params: unknown) => {
          const p = params as { seriesType?: string; data?: { _node?: LayoutNode } };
          if (p.seriesType === 'scatter' && p.data?._node) {
            return nodeTooltipHtml(p.data._node);
          }
          const name = (params as { seriesName?: string }).seriesName;
          if (name) {
            return `<div style="padding:0.4rem;font-size:0.75rem;"><b style="color:${colorForCharacter(name)}">${name}</b></div>`;
          }
          return '';
        },
      },
      xAxis: {
        type: 'value',
        min: 1,
        max: maxChapter,
        minInterval: 1,
        splitLine: {
          show: true,
          lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' },
        },
        axisLabel: {
          formatter: (v: number) => {
            const n = Math.round(v);
            if (n < 1 || n > maxChapter || Math.abs(v - n) > 0.01) return '';
            return `第 ${n} 章`;
          },
          color: '#9ca3af',
          fontSize: 10,
        },
        axisLine: { lineStyle: { color: '#374151' } },
      },
      yAxis: {
        type: 'value',
        min: 1,
        max: Math.max(yMax, 1),
        minInterval: 1,
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          formatter: (v: number) => {
            const n = Math.round(v);
            if (n < 1 || n > yMax || Math.abs(v - n) > 0.01) return '';
            return `轨 ${n}`;
          },
          color: '#6b7280',
          fontSize: 10,
        },
      },
      series: [
        ...lineSeries,
        {
          name: '剧情节点',
          type: 'scatter',
          data: nodeSeriesData,
          z: 10,
          symbol: 'circle',
        },
      ],
    };

    chart.setOption(option);

    chart.on('click', (params: unknown) => {
      const p = params as { value?: number[]; data?: { _node?: LayoutNode } };
      const ch = p.value?.[0] ?? p.data?._node?.chapter_num;
      if (ch) {
        setFocusedChapter(ch);
        document.getElementById(`timeline-card-${ch}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      // 注意：chart 实例销毁由卸载 useEffect 统一处理，此处只清除监听器
    };
  }, [plotData, sortedChapters, chapterNums, maxChapter, yMax]);

  if (!filepath) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        请先设置小说项目路径，再编辑人物轨时间线。
      </div>
    );
  }

  if (loading || !plotData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '1rem' }}>
        <div style={{ width: 24, height: 24, border: '2px solid var(--accent-color)', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>正在装载人物轨时间线…</span>
      </div>
    );
  }

  const focused = getChapter(focusedChapter);
  const focusedNodes = focused ? layoutChapter(focused) : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', height: 'calc(100vh - 180px)' }}>
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div>
            <h3 className="panel-title" style={{ margin: 0, border: 'none', padding: 0 }}>
              <Users size={18} style={{ color: 'var(--accent-color)', marginRight: '0.3rem' }} />
              剧情时间线
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button type="button" className="btn-secondary" onClick={loadAll} disabled={loading} title="从 JSON 文件重新加载，放弃未保存的修改" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', color: 'var(--text-secondary)' }}>
              ↺ 从文件重载
            </button>
            <button type="button" className="btn-secondary" onClick={handleDeleteLastChapter} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', color: 'var(--color-error)' }}>
              <Trash2 size={13} /> 删减章节
            </button>
            <button type="button" className="btn-secondary" onClick={handleAddChapter} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
              <Plus size={13} /> 递增章节
            </button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: '0.75rem', padding: '0.4rem 1rem', backgroundColor: unsaved ? 'var(--color-success)' : 'rgba(107,114,128,0.3)', borderColor: unsaved ? 'var(--color-success)' : 'var(--border-color)', transition: 'all 0.2s' }}>
              <Save size={13} /> {saving ? '同步中…' : unsaved ? '● 同步保存' : '已同步'}
            </button>
          </div>
        </div>

        <div
          ref={chartRef}
          style={{
            flex: 1,
            minHeight: 280,
            border: '1px dashed rgba(255,255,255,0.05)',
            borderRadius: 6,
          }}
        />

        {focused && (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '0.85rem', fontSize: '0.75rem' }}>
            <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              第 {focused.chapter_num} 章 · 本章节点 ({focusedNodes.length})
            </div>
            {focusedNodes.length === 0 ? (
              <span style={{ color: 'var(--text-secondary)' }}>暂无出场角色，请在右侧添加。</span>
            ) : (
              focusedNodes.map(node => (
                <div key={node.scene_id} style={{ marginBottom: '0.4rem', paddingLeft: '0.5rem', borderLeft: `2px solid ${node.merged ? '#e06c53' : colorForCharacter(node.beats[0]?.character || '')}` }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {node.merged ? `[会师] ` : ''}
                    {node.beats.map(b => b.character).join('、')}
                  </span>
                  {node.beats.map(b => (
                    <div key={b.character} style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                      {b.event.trim() || '（未填写事件）'}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0', padding: '0', overflowY: 'hidden' }}>
        {/* Right panel tab toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setRightPanel('beats')}
            style={{
              flex: 1,
              background: rightPanel === 'beats' ? 'rgba(224,108,83,0.1)' : 'transparent',
              border: 'none',
              borderBottom: rightPanel === 'beats' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: rightPanel === 'beats' ? 'var(--accent-light)' : 'var(--text-secondary)',
              padding: '0.65rem 0',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              fontWeight: rightPanel === 'beats' ? 'bold' : 'normal',
              transition: 'all 0.15s',
            }}
          >
            <Sparkles size={13} /> 按章编辑出场角色
          </button>
          <button
            type="button"
            onClick={() => setRightPanel('state')}
            style={{
              flex: 1,
              background: rightPanel === 'state' ? 'rgba(224,108,83,0.1)' : 'transparent',
              border: 'none',
              borderBottom: rightPanel === 'state' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: rightPanel === 'state' ? 'var(--accent-light)' : 'var(--text-secondary)',
              padding: '0.65rem 0',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              fontWeight: rightPanel === 'state' ? 'bold' : 'normal',
              transition: 'all 0.15s',
            }}
          >
            <BookMarked size={13} /> 角色当前状态
          </button>
        </div>

        {rightPanel === 'beats' ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sortedChapters.map(ch => {
              const isFocused = ch.chapter_num === focusedChapter;
              const groups = layoutChapter(ch);
              return (
            <div
              key={ch.chapter_num}
              id={`timeline-card-${ch.chapter_num}`}
              onClick={() => setFocusedChapter(ch.chapter_num)}
              style={{
                border: isFocused ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                backgroundColor: isFocused ? 'rgba(224,108,83,0.04)' : 'var(--bg-card)',
                padding: '1rem',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: isFocused ? 'var(--accent-color)' : '#fff' }}>
                  第 {ch.chapter_num} 章
                  {groups.some(g => g.merged) && (
                    <span style={{ marginLeft: 8, fontSize: '0.65rem', color: '#e06c53' }}>含会师节点</span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={e => {
                    e.stopPropagation();
                    handleAddBeat(ch.chapter_num);
                  }}
                  style={{ fontSize: '0.7rem', padding: '0.25rem 0.5rem' }}
                >
                  <UserPlus size={12} /> 添加角色
                </button>
              </div>

              {ch.beats.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>点击「添加角色」开始编排本章人物轨。</p>
              ) : (
                ch.beats.map((beat, idx) => {
                  // 获取当前章节已添加的有角色名的beat（排除当前）
                  const otherNamedBeats = ch.beats.filter((b, i) => i !== idx && b.character);
                  // 过滤掉已被其他beat使用的角色（允许重复用在不同章节，但同章节内不重复）
                  const existingCharacters = ch.beats
                    .map((b, i) => i !== idx ? b.character : null)
                    .filter(c => c !== null && c !== '');
                  const availableRoles = roleNames.filter(n => !existingCharacters.includes(n));
                  // 当前beat与哪个角色同框
                  const sharedWith = otherNamedBeats.find(
                    b => b.scene_id && b.scene_id === beat.scene_id
                  )?.character || '';
                  return (
                    <div
                      key={`${ch.chapter_num}-${idx}`}
                      onClick={e => e.stopPropagation()}
                      style={{
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 4,
                        padding: '0.65rem',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                          className="text-input"
                          value={beat.character}
                          onChange={e => handleBeatChange(ch.chapter_num, idx, 'character', e.target.value)}
                          style={{ flex: 1, fontSize: '0.75rem', padding: '0.35rem' }}
                        >
                          <option value="">-- 选择角色 --</option>
                          {beat.character && !roleNames.includes(beat.character) && (
                            <option value={beat.character}>{beat.character}</option>
                          )}
                          {availableRoles.map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleRemoveBeat(ch.chapter_num, idx)}
                          style={{ padding: '0.25rem 0.4rem', color: 'var(--color-error)' }}
                          title="移除"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <input
                        type="text"
                        className="text-input"
                        value={beat.event}
                        onChange={e => handleBeatChange(ch.chapter_num, idx, 'event', e.target.value)}
                        placeholder="本章该角色的事件梗概"
                        style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                      />
                      {otherNamedBeats.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>与角色同框：</span>
                          <select
                            className="text-input"
                            value={sharedWith}
                            onChange={e => handleShareFrame(ch.chapter_num, idx, e.target.value)}
                            style={{ flex: 1, fontSize: '0.68rem', padding: '0.2rem 0.35rem' }}
                          >
                            <option value="">不同框（独立轨道）</option>
                            {otherNamedBeats.map((b, i) => (
                              <option key={i} value={b.character}>{b.character}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
          </div>
        ) : (
          /* 角色当前状态面板 */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.25rem', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              记录角色在当前进度的最新状态、处境与情绪变化，可供生成章节时参考。
            </div>
            <textarea
              className="editor-textarea"
              style={{ flex: 1, resize: 'none', fontSize: '0.82rem', lineHeight: '1.65' }}
              value={characterStateContent}
              onChange={e => onCharacterStateChange?.(e.target.value)}
              placeholder="在此记录各角色的当前状态、处境、情绪...&#10;&#10;例如：&#10;李火旺：正处于精神病院治疗中，内心对修仙世界的真实性产生动摇...&#10;白灵淼：在清风观修炼，暗中寻找师傅藏匿玉佩的线索..."
              spellCheck={false}
            />
            {onCharacterStateSave && (
              <button
                className="btn-primary"
                onClick={onCharacterStateSave}
                style={{ alignSelf: 'flex-end', padding: '0.4rem 1.2rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'var(--color-success)' }}
              >
                <Save size={13} /> 保存角色状态
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
