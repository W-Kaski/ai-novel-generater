# 子技能：设定落盘路由

> 用于判断用户给出的设定、修改意见或新增资料应该写入哪个项目文件。

## 总原则

1. `00_settings/novel_settings.md` 是唯一设定总入口，承载作品级设定、世界规则、历史真相、制度细则和力量体系。
2. 可以在上层文件保留索引，但不要复制完整内容。
3. 改动一个文件后，检查是否需要同步引用文件。
4. 角色和阵营统一进入 `03_characters/`。

---

## 路由表

| 内容类型 | 写入位置 | 同步检查 |
| --- | --- | --- |
| 小说名称、题材、平台风格、受众、核心卖点 | `00_settings/novel_settings.md` | 无 |
| 主线冲突、三层故事、终局方向 | `00_settings/novel_settings.md` | 伏笔、章节蓝图 |
| 世界底层真相、历史、宗教、制度 | `00_settings/novel_settings.md` | 角色档案、正文一致性 |
| 力量来源、等级、功法、特性、代价、禁忌 | `00_settings/novel_settings.md` | 角色档案、正文一致性 |
| 主角/配角出身、欲望、恐惧、缺陷、长期弧光 | `03_characters/主要角色/*.md` 或 `03_characters/重要配角/*.md` | `character_state.md` |
| 角色当前状态、位置、伤势、情绪、当前目标、已知信息 | `00_settings/character_state.md` | `plot_arcs.json` |
| 势力、宗门、组织、阵营制度、内部矛盾 | `03_characters/阵营与规则/*.md` | `world_map.json`、`novel_settings.md` 索引 |
| 地点、区域、路线、坐标、阻隔、势力范围 | `00_settings/world_map.json` | `novel_settings.md` 地图索引、阵营档案 |
| 伏笔、误导、真实含义、回收章节 | `02_memory/foreshadowing_ledger.md` | `novel_directory.md` |
| 每章功能、冲突、节点、开头、结尾 | `02_memory/novel_directory.md` | 设定、角色、伏笔 |
| 人物每章出场轨迹、行动、关系变化 | `02_memory/plot_arcs.json` | `plot_arcs.md`、`character_state.md` |
| 正文 | `01_chapters/chapter_N.md` | 所有相关设定与记忆 |

---

## 判断步骤

1. 先问：这是“静态百科”还是“当前状态”？
   - 静态百科进入 `03_characters/` 或 `novel_settings.md`。
   - 当前状态进入 `character_state.md`。

2. 再问：这是“全书规则”还是“某个角色独有”？
   - 全书规则进入 `novel_settings.md`。
   - 角色独有能力进入角色档案。
   - 能力当章变化进入 `character_state.md`。

3. 再问：这是“空间信息”还是“势力制度”？
   - 空间信息进入 `world_map.json`。
   - 势力制度进入 `03_characters/阵营与规则/`。
   - `novel_settings.md` 只保留索引。

4. 最后问：是否会影响后续章节？
   - 会影响章节推进时，同步检查 `novel_directory.md`。
   - 会影响伏笔时，同步检查 `foreshadowing_ledger.md`。

