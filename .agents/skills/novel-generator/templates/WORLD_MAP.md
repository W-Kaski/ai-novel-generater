# 子技能：世界地图模板

> 用于创建、补全、审阅和更新 `00_settings/world_map.json`。

## 职责

`world_map.json` 负责可视化和结构化的空间信息：

- 区域层级
- 地点节点
- 坐标与视觉位置
- 路线、阻隔、通行条件
- 势力范围
- 地点规则与危险
- 剧情阶段解锁路线

不负责：

- 长篇地点散文
- 角色小传
- 全书主题阐释
- 章节正文

---

## 推荐 JSON 结构

```json
{
  "version": 1,
  "title": "世界地图",
  "regions": [
    {
      "id": "region_qingfeng",
      "name": "清风观区域",
      "type": "起始区域",
      "stage": "开局",
      "description": "主角开局被困的高压修行区域。",
      "danger_level": "高",
      "dominant_factions": ["清风观"],
      "unlock_condition": "开局可见，真实规则逐章揭示。"
    }
  ],
  "locations": [
    {
      "id": "loc_qingfeng_temple",
      "name": "清风观",
      "region_id": "region_qingfeng",
      "type": "宗门 / 道观 / 囚笼",
      "x": 0.5,
      "y": 0.45,
      "story_function": "开局牢笼、等级压迫、炼丹真相爆发地。",
      "rules": ["丹房不可擅入", "低阶弟子受师长绝对控制"],
      "risks": ["献祭", "监视", "精神污染"],
      "related_factions": ["清风观"],
      "related_characters": ["李火旺", "丹阳子"]
    }
  ],
  "routes": [
    {
      "id": "route_qingfeng_back_mountain",
      "from": "loc_qingfeng_temple",
      "to": "loc_back_mountain",
      "type": "山路",
      "status": "受限",
      "travel_cost": "半日",
      "barriers": ["巡逻弟子", "地形复杂"],
      "plot_use": "逃离、追捕、发现隐秘设施"
    }
  ],
  "faction_zones": [
    {
      "faction": "清风观",
      "region_ids": ["region_qingfeng"],
      "control_type": "直接控制",
      "public_order": "师徒等级压迫",
      "hidden_order": "筛选与献祭"
    }
  ]
}
```

---

## 填写规则

1. `id` 必须稳定，不要频繁改名。
2. `x`、`y` 使用 0 到 1 的相对坐标，便于前端渲染。
3. 地点必须绑定 `region_id`。
4. 势力范围写入 `faction_zones`，势力制度细节写入 `03_characters/阵营与规则/*.md`。
5. `novel_settings.md` 只保留地图升级路线和地点索引。
6. 每次新增地点后，检查章节大纲是否需要引用该地点。
7. 每次改变通行条件后，检查已写章节是否存在移动矛盾。

---

## 地图质量检查

更新地图后检查：

- 主角当前位置能否从上一章合理抵达。
- 新区域是否有明确剧情功能。
- 路线是否有代价或阻隔。
- 势力范围是否和阵营档案一致。
- 地点规则是否会制造冲突。
- 地图升级是否服务主线，而不是单纯扩大世界。
