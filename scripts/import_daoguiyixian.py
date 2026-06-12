# -*- coding: utf-8 -*-
"""Import 道诡异仙.txt into novels/道诡异仙 project structure."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path

SOURCE = Path(os.environ.get("IMPORT_SOURCE", r"e:\download\道诡异仙.txt"))
ROOT = Path(__file__).resolve().parents[1]
NOVEL = ROOT / "novels" / "道诡异仙"

CHAPTER_RE = re.compile(r"^第(\d+)章\s+(.+)$", re.MULTILINE)


def ensure_dirs():
    for rel in [
        "00_settings",
        "01_chapters",
        "02_memory",
        "03_characters/主要角色",
        "03_characters/重要配角",
        "03_characters/阵营与规则",
        "04_logs",
        "99_assets/imported_chapters",
        "99_assets/source",
    ]:
        (NOVEL / rel).mkdir(parents=True, exist_ok=True)


def split_chapters(text: str):
    matches = list(CHAPTER_RE.finditer(text))
    intro_end = matches[0].start() if matches else 0
    intro = text[:intro_end].strip()
    chapters = []
    for i, m in enumerate(matches):
        num = int(m.group(1))
        title = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        chapters.append((num, title, body))
    return intro, chapters


def write_settings(intro: str, chapter_count: int):
    novel_settings = f"""# 《道诡异仙》作品设定集

> 由本地 TXT 导入生成。作者：狐尾的笔。用于个人创作辅助与章节管理，请遵守版权规定。

## 基础元数据

### 小说名称

道诡异仙

### 主角姓名

李火旺

### 题材方向

东方玄幻 / 克系悬疑 / 精神病院现实线 ↔ 诡异道观幻境双线

### 作者与来源

- 原作者：狐尾的笔
- 本地导入：{SOURCE.name}
- 总章节数（正文卷）：{chapter_count}

## 简介（原文）

{intro.replace(chr(10), chr(10) + chr(10))}

## 核心命题

### 总述

「什么是真，什么是假？」——主角无法在诡异天道、异常仙佛与自身疾病之间分辨现实。

表层是精神病院里的少年与青梅杨娜的约定；里层是道观药引、炼丹、邪祟与游神的江湖。

## 叙事结构

- **现实线**：现代精神病院、主治医生、服药与复诊。
- **幻境/异世界线**：溶洞道观、丹阳子、药引、九流江湖、佛寺与心素等。
- **关键机制**：幻境物品偶发渗透现实（糖、玉佩等），推动主角探索「传送」规律。

## 创作辅助说明

- 全书章节原文存放于 `99_assets/imported_chapters/`（按章拆分，便于检索）。
- 可在 `01_chapters/` 中基于导入章节做改写、续写或拆书分析。
- 角色档案见 `03_characters/`，勿与本工具生成的同人设定混淆于原作者正典。
"""
    detailed_settings = """# 《道诡异仙》小说总架构

## 1. 双线世界

| 层面 | 场景 | 规则 |
|------|------|------|
| 现实 | 精神病院病房 | 医嘱、幻觉、复诊；杨娜为情感锚点 |
| 异世界 | 清风观/溶洞道观等 | 药引、炼丹、道童等级、师傅绝对权威 |

## 2. 力量与诡异体系（导入归纳）

- **道观侧**：炼丹、符箓、药引、成仙妄想、邪法献祭。
- **江湖侧**：九流、戏班、游神、地方邪祟、寺庙（正德寺等）。
- **心素/特殊体质**：后期展开，与「真假」主题深化相关。

## 3. 第一卷功能（约第1–50章）

1. 建立李火旺双重感知与物品渗透悬念。
2. 丹阳子与清风观恐怖基调。
3. 逃离道观进入人间江湖。
4. 建邺、佛寺线引入更大诡异。

## 4. 主题

- 认知不可靠：病、幻觉、还是异能？
- 生存伦理：药引命如草芥 vs 现代人性。
- 情感：杨娜代表「要回到的正常生活」。

## 5. 后续卷（导入标记）

全书共 1023 章，卷界需结合 `02_memory/novel_directory.md` 与阅读进度再细分。
"""
    (NOVEL / "00_settings/novel_settings.md").write_text(
        novel_settings.rstrip() + "\n\n## 详细世界规则与力量体系\n\n" + detailed_settings.lstrip(),
        encoding="utf-8"
    )

    char_state = """# 角色动态状态（导入初始化）

> 导入时仅记录开篇状态，推进章节后请在此更新。

## 李火旺

- **位置**：精神病院 / 清风观药引区（双线切换）
- **身心**：感知综合障碍；能短暂区分「幻觉」但证据动摇
- **关系**：杨娜（青梅竹马）；丹阳子（师傅/恐惧对象）；玄阳（道观师兄）
- **持有物**：幻境糖块已渗透现实；计划窃取玄阳玉佩试验
- **目标**：出院与杨娜同考大学；暗中验证两界物品传递

## 杨娜

- **位置**：校外，定期来探视
- **关系**：与李火旺约定同校

## 丹阳子（师傅）

- **位置**：丹炉大殿
- **威胁**：随意处死药引炼丹；权威不可挑战（开篇）

## 玄阳

- **位置**：道观道童
- **物品**：腰间玉佩（李火旺觊觎）
"""
    (NOVEL / "00_settings/character_state.md").write_text(char_state, encoding="utf-8")


def write_directory(chapters: list):
    lines = [
        "# 《道诡异仙》章节目录（导入）",
        "",
        f"> 共 {len(chapters)} 章，由 TXT 自动提取标题。",
        "",
        "| 章 | 标题 |",
        "| :--- | :--- |",
    ]
    for num, title, _ in chapters:
        t = title.replace("|", "\\|")
        lines.append(f"| 第 {num} 章 | {t} |")
    (NOVEL / "02_memory/novel_directory.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_chapters(chapters: list, copy_drafts: int = 5):
    imported = NOVEL / "99_assets/imported_chapters"
    drafts = NOVEL / "01_chapters"
    for num, title, body in chapters:
        fname = f"chapter_{num:04d}.md"
        content = f"# 第 {num} 章 {title}\n\n{body}\n"
        (imported / fname).write_text(content, encoding="utf-8")
        if num <= copy_drafts:
            (drafts / f"chapter_{num}.md").write_text(content, encoding="utf-8")

    # symlink-like readme
    (NOVEL / "99_assets/source/README.md").write_text(
        f"# 原文导入\n\n- 源文件：`{SOURCE}`\n- 拆分章节：`imported_chapters/chapter_XXXX.md`\n- 前 {copy_drafts} 章已复制到 `01_chapters/` 供编辑器打开。\n",
        encoding="utf-8",
    )


def write_roles():
    roles = {
        "主要角色/李火旺.md": """# 李火旺

## 身份

- 本作主角。
- 精神病院住院少年；幻境中为清风观药引。

## 性格与弧光

- 表面压抑，内心渴望正常人生与杨娜的未来。
- 在「幻觉」与「真实」之间挣扎，后期探索两界物品传递规律。

## 关键关系

- 杨娜：青梅竹马，情感锚点。
- 丹阳子：师傅，恐怖权威。
- 玄阳：道童师兄，玉佩线。

## 导入备注（第1–3章）

- 捣药、反抗师傅、病房回归。
- 幻境糖块出现在现实胸口。
""",
        "主要角色/杨娜.md": """# 杨娜

## 身份

- 李火旺青梅竹马，高三学生，成绩优异。

## 功能

- 代表现实世界「值得回去」的正常生活。
- 约定与李火旺考取同一所大学。

## 导入备注

- 常来医院探视，带作业与游戏机。
""",
        "主要角色/丹阳子.md": """# 丹阳子（癞子头师傅）

## 身份

- 幻境道观师傅；外貌邋遢、手段残忍。
- 追求「成仙」「炼丹」，视药引为耗材。

## 威胁

- 当众处死弟子献祭丹炉。
- 以绝对权威震慑药引。

## 别名

- 书中亦称丹阳子（后文展开）。
""",
        "重要配角/玄阳.md": """# 玄阳

## 身份

- 道观道童，穿旧青袍，持拂尘，对药引傲慢。

## 剧情功能

- 传话、嘲讽李火旺。
- 腰间古玉佩成为主角「跨界传送」试验目标。
""",
        "重要配角/白灵淼.md": """# 白灵淼（白化病少女）

## 身份

- 药引之一，白化病，受同门欺凌。

## 剧情功能

- 第1章被李火旺所救。
- 后期为重要同伴（全书后续章节展开）。
""",
        "重要配角/李医生.md": """# 李医生（主治医师）

## 身份

- 精神病院主治医生，记录幻觉并给药。

## 功能

- 强调「幻觉皆假」，要求李火旺按幻境逻辑配合治疗以图出院。
""",
        "阵营与规则/清风观.md": """# 清风观（溶洞道观）

## 概述

- 天然溶洞改造的道观群：灵宫殿、老律堂、庆祖殿、四御殿等。
- 巨大五层炼丹炉为核心场景。

## 规则

- **药引**：身体畸形或缺陷者干苦力，命如草芥。
- **道童**：穿道袍，地位高于药引（如玄阳）。
- **师傅**：丹阳子，可随意杀人炼丹。
""",
        "阵营与规则/幻觉与现实渗透.md": """# 幻觉 ↔ 现实渗透规则（导入归纳）

## 已出现现象

- 幻境中得到的「稀糖」出现在现实胸口。
- 李火旺开始假设：幻境物品可带到现实（价值、风险未知）。

## 叙事约束（辅助创作）

- 未弄清规律前，不宜向医生坦白（担心实验切片）。
- 物品传递是全书核心悬念之一。
""",
    }
    for rel, body in roles.items():
        (NOVEL / "03_characters" / rel).write_text(body.strip() + "\n", encoding="utf-8")


def write_setting_cards():
    """Keep existing non-empty setting_cards.json; do not wipe user data."""
    path = NOVEL / "00_settings" / "setting_cards.json"
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, list) and len(data) > 0:
                return
        except Exception:
            pass
    path.write_text("[]", encoding="utf-8")


def write_memory_and_state(chapter_count: int):
    plot = {
        "schema_version": 2,
        "chapters": [
            {
                "chapter_num": 1,
                "beats": [
                    {"character": "李火旺", "event": "料房捣药，砸伤同门，被唤去见师傅", "scene_id": "s0"},
                    {"character": "丹阳子", "event": "处死歪嘴师姐献祭丹炉，质问李火旺", "scene_id": "s1"},
                ],
            },
            {
                "chapter_num": 2,
                "beats": [
                    {"character": "李火旺", "event": "幻觉中断，回到病房见医生与杨娜", "scene_id": "merged"},
                    {"character": "杨娜", "event": "探视、约定同考大学", "scene_id": "merged"},
                    {"character": "李医生", "event": "强调幻觉为假，要求配合治疗", "scene_id": "s2"},
                ],
            },
            {
                "chapter_num": 3,
                "beats": [
                    {"character": "李火旺", "event": "发现幻境糖块出现在现实，决定保密并探索规律", "scene_id": "s0"},
                    {"character": "李火旺", "event": "盯上玄阳玉佩", "scene_id": "s1"},
                    {"character": "玄阳", "event": "嘲讽药引，玉佩被惦记", "scene_id": "s1"},
                ],
            },
            {
                "chapter_num": 4,
                "beats": [
                    {"character": "李火旺", "event": "偷走玄阳玉佩", "scene_id": "s0"},
                    {"character": "丹阳子", "event": "当众处刑叛逃者", "scene_id": "merged"},
                    {"character": "玄阳", "event": "叛逃失败", "scene_id": "merged"},
                ],
            },
            {
                "chapter_num": 5,
                "beats": [
                    {"character": "丹阳子", "event": "训诫弟子立威", "scene_id": "s0"},
                    {"character": "李火旺", "event": "升为记名弟子，赐道号玄阳", "scene_id": "merged"},
                    {"character": "丹阳子", "event": "赐五颗黝黑丹药", "scene_id": "merged"},
                ],
            },
        ],
    }
    for ch in range(6, 11):
        plot["chapters"].append({"chapter_num": ch, "beats": []})

    mem = NOVEL / "02_memory"
    (mem / "plot_arcs.json").write_text(json.dumps(plot, ensure_ascii=False, indent=2), encoding="utf-8")

    (NOVEL / "04_logs/.novel_state.json").write_text(
        json.dumps(
            {
                "stage": "imported",
                "current_chapter": 1,
                "confirmed_settings": True,
                "confirmed_directory": True,
                "last_finalized_chapter": 0,
                "source_file": str(SOURCE),
                "total_chapters": chapter_count,
                "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def update_config():
    cfg_path = ROOT / "config.json"
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    fp = str(NOVEL).replace("/", "\\")
    cfg["other_params"]["filepath"] = fp
    cfg["other_params"]["novel_name"] = "道诡异仙"
    cfg["other_params"]["topic"] = (
        "精神病少年李火旺在诡异道观与精神病院之间往返，"
        "幻境物品渗透现实，他在真假难辨中求生并守护与杨娜的约定。"
    )
    cfg["other_params"]["genre"] = "玄幻悬疑"
    cfg["other_params"]["target_audience"] = "男频 / 剧情向 / 悬疑压迫感读者"
    cfg["other_params"]["platform_style"] = "长篇网文 / 高概念连续追更"
    cfg["other_params"]["writing_style"] = "短促、阴冷、带有民俗邪气和感官压迫感，偶尔以荒诞感缓冲高压氛围。"
    cfg["other_params"]["pacing_requirement"] = "每章都要保持信息不足但危险逼近，以持续钩子驱动阅读。"
    cfg["other_params"]["num_chapters"] = 1023
    cfg["other_params"]["chapter_num"] = "1"
    cfg["other_params"]["characters_involved"] = "李火旺, 杨娜, 丹阳子"
    cfg["deep_settings"]["novel_name"] = "道诡异仙"
    cfg["deep_settings"]["protagonist_name"] = "李火旺"
    cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=4), encoding="utf-8")
    return fp


def main():
    if not SOURCE.exists():
        raise SystemExit(f"源文件不存在: {SOURCE}")
    text = SOURCE.read_text(encoding="utf-8", errors="ignore")
    intro, chapters = split_chapters(text)
    print(f"Intro OK, chapters: {len(chapters)}")
    ensure_dirs()
    write_settings(intro, len(chapters))
    write_directory(chapters)
    write_chapters(chapters, copy_drafts=5)
    write_roles()
    write_setting_cards()
    write_memory_and_state(len(chapters))
    fp = update_config()
    print(f"Done. Novel at: {NOVEL}")
    print(f"config.json filepath -> {fp}")


if __name__ == "__main__":
    main()

