# AI Community Tags — 生成流程说明

## 概述

为每个社区预计算 lifestyle tags。使用 OpenAI GPT-4o-mini，基于社区真实数据生成 4-8 个标签。

---

## 数据输入（每个社区）

发送以下 JSON 给 AI：

```json
{
  "neighborhood": "Chelsea",
  "nta": "Chelsea-Hudson Yards",
  "metrics": {
    "rent": { "studio": 4495, "oneBr": 6051, "twoBr": 6995 },
    "restaurants": 320, "cafes": 42, "bars": 85,
    "supermarkets": 18, "gyms": 12, "pharmacies": 7,
    "subwayStations": 8, "busStops": 45,
    "medianAge": 41.1, "population": 52364,
    "crimeRate": 27.5
  },
  "demographics": {
    "white": 65, "black": 7, "asian": 12, "other": 16
  }
}
```

---

## 生成规则

### 核心原则
1. 只基于提供的数据生成，不编造
2. 每个 tag 必须引用具体数据
3. 4–8 个 tag
4. 偏正向，但数据支持时可以负向
5. 不用 "amazing"、"best"、"perfect" 等主观词
6. 重叠时只保留数据支撑最强的那个

### Prompt
```
Generate community tags based ONLY on the provided metrics.
Rules:
1. Each tag must be supported by quantitative metrics.
2. Return 4-8 tags only.
3. Prefer positive tags, but include negative tags when clearly supported.
4. Do not use subjective words.
5. If multiple tags overlap, choose the strongest one only.
6. Every tag must include a short explanation referencing the supporting metrics.

Output format: JSON array of { "tag": "emoji name", "reason": "explanation with data" }
```

---

## Tag 候选池

| Tag | 条件 | 对照数据 |
|-----|------|---------|
| 🍴 Food Paradise | 餐厅密度前 20% | restaurantCount |
| ☕ Cafe Culture | 咖啡馆密度前 20% | cafeCount |
| 🍺 Nightlife | 酒吧密度前 15% | barCount |
| 🛒 Grocery Hub | 超市数前 20% | supermarketCount |
| 🚇 Excellent Transit | ≥1 地铁站 | subwayStations |
| 🌳 Green Space | 公园数前 20% | parkCount |
| 🚶 Walkable | 餐厅+超市+咖啡馆+公交高 | 复合指标 |
| 🏗 Rapid Development | 施工活跃度前 15% | activePermits |
| 💰 Premium Rent | 租金前 20% | rent.oneBr |
| 💵 Budget Friendly | 租金后 20% | rent.oneBr |
| 🌿 Quiet Living | 低酒吧+低犯罪 | barCount, crimeRate |
| 👨‍👩‍👧 Family Friendly | 公园+低犯罪+超市 | parkCount, crimeRate, supermarketCount |
| 👔 Professional Hub | 高租金+强公交+近就业 | rent+transit |
| 🎓 Student Friendly | 相对低价+近大学 | rent, medianAge |
| 🌊 Waterfront | 临水社区 | 地理判断 |

---

## 预计算流程

1. 加载 170 个社区的完整数据
2. 为每个社区构建 JSON context
3. 调用 OpenAI API（GPT-4o-mini）批量生成 tags
4. 每 10 个社区加 1s 延迟（rate limit）
5. 结果存入 `src/data/mock/communityTags.ts`
6. 前端从该文件读取展示

### 预计 API 调用
- 170 个社区 × ~500 tokens/次 ≈ 85K 总 tokens
- GPT-4o-mini 价格：~$0.15/1M input + $0.60/1M output
- 总费用：约 **$0.05-0.10**

---

## 前端展示

ComparePage 增加两个 Tab：

```
[🏷 Tags] [📊 Data]
```

Tags tab 内容：

```
┌──────────────────┬──────────────────┐
│   Chelsea         │   East Village    │
│                   │                   │
│ 🍴 Food Paradise  │ 🍺 Nightlife      │
│ 320 restaurants   │ 85 bars           │
│                   │                   │
│ 💰 Premium Rent   │ 🚶 Walkable       │
│ 1BR $6,051/mo     │ High density      │
│                   │                   │
│ ...               │ ...               │
└──────────────────┴──────────────────┘
```

---

## 所需依赖
- OpenAI API key（环境变量 `VITE_OPENAI_API_KEY` 或脚本用 key）
- Python：`openai` 包
- Node：预计算脚本使用 Python（与现有脚本一致）
