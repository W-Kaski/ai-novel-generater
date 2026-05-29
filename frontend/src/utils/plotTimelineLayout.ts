// 人物轨时间线布局：每章独立 Y 排位（方案 A），同框合并为单节点
// 注意：PlotBeat / PlotChapter / PlotArcsData 类型定义在 types/novel.ts，这里统一从那里导入

import type { PlotBeat, PlotChapter } from '../types/novel';

// LayoutNode 是本文件特有的布局产物，不在 types/novel.ts 中
export interface LayoutNode {
  chapter_num: number;
  row: number;
  scene_id: string;
  beats: PlotBeat[];
  merged: boolean;
}

const PALETTE = [
  '#e06c53', '#818cf8', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#a78bfa', '#fb923c', '#2dd4bf', '#e879f9',
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf',
  '#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185',
];

// 角色到颜色的映射表，确保每个角色有唯一颜色
let characterColorMap = new Map<string, string>();
let colorIndex = 0;

export function colorForCharacter(name: string): string {
  // 如果角色已有分配的颜色，直接返回
  if (characterColorMap.has(name)) {
    return characterColorMap.get(name)!;
  }

  // 为新角色分配颜色
  let color: string;
  if (colorIndex < PALETTE.length) {
    // 使用调色板中的颜色
    color = PALETTE[colorIndex];
    colorIndex++;
  } else {
    // 调色板用完，使用 HSL 生成新颜色
    const hue = (colorIndex * 137.5) % 360; // 黄金角度分布
    const saturation = 65 + (colorIndex % 3) * 10; // 65-85%
    const lightness = 55 + (colorIndex % 2) * 10; // 55-65%
    color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    colorIndex++;
  }

  characterColorMap.set(name, color);
  return color;
}

// 重置颜色映射（用于测试或重新加载）
export function resetColorMap(): void {
  characterColorMap = new Map<string, string>();
  colorIndex = 0;
}

function ensureSceneIds(beats: PlotBeat[]): PlotBeat[] {
  return beats.map((b, i) => ({
    ...b,
    scene_id: (b.scene_id || '').trim() || `solo-${i}`,
  }));
}

/** 每章独立分组排位；同 scene_id 合并为一行 */
export function layoutChapter(chapter: PlotChapter): LayoutNode[] {
  const beats = ensureSceneIds(chapter.beats.filter(b => b.character.trim()));
  const order: string[] = [];
  const map = new Map<string, PlotBeat[]>();

  for (const b of beats) {
    const sid = b.scene_id!;
    if (!map.has(sid)) {
      order.push(sid);
      map.set(sid, []);
    }
    map.get(sid)!.push(b);
  }

  return order.map((scene_id, row) => {
    const group = map.get(scene_id)!;
    return {
      chapter_num: chapter.chapter_num,
      row: row + 1,
      scene_id,
      beats: group,
      merged: group.length > 1,
    };
  });
}

export function layoutAllChapters(chapters: PlotChapter[]): LayoutNode[] {
  return chapters.flatMap(layoutChapter);
}

/** 角色 → 每章坐标（同框共享同一 row）；未出场为 null */
export function buildCharacterPaths(
  chapters: PlotChapter[]
): Map<string, Array<number | null>> {
  const sorted = [...chapters].sort((a, b) => a.chapter_num - b.chapter_num);
  const chNums = sorted.map(c => c.chapter_num);
  const allChars = new Set<string>();
  for (const ch of sorted) {
    for (const b of ch.beats) {
      if (b.character.trim()) allChars.add(b.character.trim());
    }
  }

  const paths = new Map<string, Array<number | null>>();

  for (const char of allChars) {
    const rowByChapter = new Map<number, number>();
    for (const ch of sorted) {
      for (const node of layoutChapter(ch)) {
        if (node.beats.some(b => b.character.trim() === char)) {
          rowByChapter.set(ch.chapter_num, node.row);
        }
      }
    }
    paths.set(
      char,
      chNums.map(n => rowByChapter.get(n) ?? null)
    );
  }

  return paths;
}

export function maxRowInTimeline(chapters: PlotChapter[]): number {
  let max = 1;
  for (const ch of chapters) {
    const n = layoutChapter(ch).length;
    if (n > max) max = n;
  }
  return max;
}

export function newSceneId(): string {
  return `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
