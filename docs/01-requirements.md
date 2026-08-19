# Compare Neighborhoods — 产品需求文档

## 1. 产品定位

**Compare Neighborhoods**: 选择 NYC 两个社区，并排对比所有关键维度，由 AI（OpenAI）基于真实数据生成对比摘要。

❌ **不再做**：偏好卡片选择、匹配算法、Top N 推荐
✅ **改做**：双社区对比 + AI 生成洞察

---

## 2. 用户流程

```
进入产品 → 选择社区 A → 选择社区 B → 查看对比结果 + AI 摘要
```

1. 用户在首页看到两个搜索框
2. 输入/选择两个社区名称（FirstMove 名 + NTA 名，如 "Chelsea · Chelsea-Hudson Yards"）
3. 确认后跳转到对比页
4. 对比页展示：地图（两个社区着色）+ 并排数据表 + AI 摘要

---

## 3. 社区命名规则

每个社区显示为：**FirstMove 名 · NTA 名**

示例：
- `Chelsea · Chelsea-Hudson Yards`
- `East Village · East Village`
- `Williamsburg · Williamsburg`
- `Downtown Brooklyn · Downtown Brooklyn-DUMBO-Boerum Hill`

170 个可选社区。

---

## 4. 对比维度

### 4.1 核心指标（并排展示）

| 维度 | 社区 A | 社区 B |
|------|--------|--------|
| 💰 租金 (Studio/1BR/2BR) | $X,XXX | $X,XXX |
| 👥 人口 | XX,XXX | XX,XXX |
| 🚇 通勤 (选择工作地点) | XX min | XX min |
| 🍽️ 餐厅 | XXX | XXX |
| 🍸 酒吧 | XX | XX |
| ☕ 咖啡馆 | XX | XX |
| 🛒 超市 | XX | XX |
| 🏋️ 健身房 | XX | XX |
| 💊 药店 | XX | XX |
| 🌳 公园/绿化 | X% | X% |

### 4.2 人口与趋势

| 维度 | 社区 A | 社区 B |
|------|--------|--------|
| 族裔构成 | W%/B%/A%/H% | W%/B%/A%/H% |
| 年龄分布 | 20-29: X%, ... | 20-29: X%, ... |
| 人口变化 (YoY) | ±X% | ±X% |

### 4.3 Transit

| 维度 | 社区 A | 社区 B |
|------|--------|--------|
| 🚇 地铁站 | XX | XX |
| 🚌 公交站 | XX | XX |

### 4.4 地图

- 两个社区同时显示在地图上（不同颜色）
- 可切换显示 venue 点

---

## 5. AI 摘要

### 调用方式
- 将两个社区的**所有数据（JSON）**作为 prompt context 发送给 OpenAI
- 请求生成：
  1. 一段自然语言对比摘要（3-5 句）
  2. 社区 A 适合什么样的人
  3. 社区 B 适合什么样的人
  4. 一句话推荐

### Prompt 结构
```
你是一个 NYC 社区分析助手。
以下是两个社区的真实数据。请生成简洁的英文对比摘要。

社区 A: [JSON data]
社区 B: [JSON data]

请输出:
1. 对比摘要 (3-5句)
2. 社区 A 适合人群
3. 社区 B 适合人群
4. 推荐
```

---

## 6. 技术要点

- OpenAI API: GPT-4o-mini（便宜、够用）
- API key 需用户提供或项目配置
- 数据 context ~2KB per neighborhood × 2 = ~4KB tokens
- 需要 `.env` 文件或前端 key 输入

---

## 7. 数据保留

所有现有数据层保持不变：
- 170 个社区（FirstMove 租金 + NTA 边界）
- ACS 人口/种族/年龄
- OSM venue 坐标
- Google Distance Matrix 通勤数据
- Mapbox 地图
