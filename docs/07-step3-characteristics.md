# Step 3 — 社区特性优先级排序

## UI 设计

```
┌──────────────────────────────────────────────────────┐
│  Rank your top 4 priorities (drag to reorder)         │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │ Priority │  │ Priority │  │ Priority │  │ Prio  │ │
│  │    1     │  │    2     │  │    3     │  │  4    │ │
│  │  (empty) │  │  (empty) │  │  (empty) │  │(empty)│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────┘ │
│                                                      │
│  Drag characteristics from below into the boxes:      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Affordable│ │Dining &  │ │Daily     │ │Easy      │ │
│  │Living    │ │Entertain │ │Conven    │ │Commute   │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Safety    │ │Fitness & │ │Family    │ │Young &   │ │
│  │          │ │Wellness  │ │Friendly  │ │Social    │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐                           │
│  │Diverse   │ │Quiet     │                           │
│  │Community │ │Living    │                           │
│  └──────────┘ └──────────┘                           │
│                                                      │
│                              [Next →]                │
└──────────────────────────────────────────────────────┘
```

- 上方 4 个槽：从左到右优先级递减
- 下方 10 个特性卡片：可拖拽到上方槽中
- 已放入槽中的卡片可拖出/替换
- 至少选 1 个才能 Next（不必填满 4 个）
- 拖拽库：`@hello-pangea/dnd`（react-beautiful-dnd 的维护分支）

---

## 10 个特性及判断方法

| # | 特性 | 判断依据 | 数据字段 |
|---|------|---------|---------|
| 1 | 💰 Affordable Living | 租金越低越好 | `rentByBedroom` (studio/1BR/2BR) |
| 2 | 🍽️ Dining & Entertainment | 餐厅+咖啡+酒吧密度越高越好 | `restaurantCount`, `cafeCount`, `barCount` |
| 3 | 🛒 Daily Convenience | 超市+药店+Mall 越多越好 | `supermarketCount`, `pharmacyCount`, `mallCount` |
| 4 | 🚇 Easy Commute | 地铁/PATH/公交越多，通勤越短越好 | `subwayStations`, bus stops, `commuteTime` |
| 5 | 🛡️ Safety | 犯罪率越低越好 | `crimeRate` |
| 6 | 💪 Fitness & Wellness | 健身房+药店越多越好 | `gymCount`, `pharmacyCount` |
| 7 | 👨‍👩‍👧 Family Friendly | 犯罪率低 + 未成年人口占比高 + 超市药店多 | `crimeRate`, `under20`, `supermarketCount`, `pharmacyCount` |
| 8 | 🎉 Young & Social | 20-34岁占比高 + 餐厅咖啡酒吧多 | `20to29`, `30to39`, `restaurantCount`, `cafeCount`, `barCount` |
| 9 | 🌍 Diverse Community | 种族分布越均匀越好（熵值） | `demographics` (white/black/asian/other) |
| 10 | 🌳 Quiet Living | 酒吧密度低 + 犯罪率低 + 商业密度低 | `barCount`, `crimeRate`, commercial density |

---

## 子指标权重

复合特性不是简单加总原始值，而是每个子指标分别做 pairwise 评分后再加权。

### 💰 Affordable Living
| 子指标 | 权重 |
|--------|------|
| 1BR Rent | 100% |

### 🍽️ Dining & Entertainment
| 子指标 | 权重 |
|--------|------|
| Restaurants | 50% |
| Cafes | 25% |
| Bars | 25% |

### 🛒 Daily Convenience
| 子指标 | 权重 |
|--------|------|
| Supermarkets | 50% |
| Pharmacies | 30% |
| Malls | 20% |

### 🚇 Easy Commute
| 子指标 | 权重 |
|--------|------|
| Commute Time | 60% |
| Subway/PATH | 30% |
| Bus | 10% |

### 🛡️ Safety
| 子指标 | 权重 |
|--------|------|
| Crime Rate | 100% |

### 💪 Fitness & Wellness
| 子指标 | 权重 |
|--------|------|
| Gyms | 70% |
| Pharmacies | 30% |

### 👨‍👩‍👧 Family Friendly
| 子指标 | 权重 |
|--------|------|
| Safety (Crime) | 40% |
| Under-20 Share | 25% |
| Supermarkets | 20% |
| Pharmacies | 15% |

### 🎉 Young & Social
| 子指标 | 权重 |
|--------|------|
| Age 20–34 | 45% |
| Restaurants | 20% |
| Cafes | 15% |
| Bars | 20% |

### 🌍 Diverse Community
| 子指标 | 权重 |
|--------|------|
| Diversity Entropy | 100% |

### 🌳 Quiet Living
| 子指标 | 权重 |
|--------|------|
| Low Bar Density | 40% |
| Low Crime | 30% |
| Low Commercial Density | 30% |

---

## Tiered Match Score

两个社区直接对比。根据差距大小分档给分。

### 差距分档

| 两社区差距 | 较优社区获得 | 较弱社区获得 |
|-----------|------------|------------|
| < 5% | 50% | 50% |
| 5–15% | 60% | 40% |
| 15–30% | 75% | 25% |
| 30–50% | 90% | 10% |
| > 50% | 100% | 0% |

差距 = |A_value - B_value| / max(A_value, B_value)

### 单指标（如 Affordable、Safety）

直接计算差距 → 查档位 → 得分。

**越高越好**：值更大的社区为"较优"
**越低越好**：值更小的社区为"较优"

示例 — Rent: A=$3,000, B=$2,500（越低越好）
→ B更优 → 差距 = |3000-2500|/3000 = 17% → 15-30% 档 → B得75, A得25

### 复合指标（如 Dining）

每个子指标先算 A 相对 B 的**优势差**（正数=A更好，负数=B更好）：

```
对于"越高越好"的子指标：
  diff = (A_value - B_value) / max(A_value, B_value)
对于"越低越好"的子指标：
  diff = (B_value - A_value) / max(A_value, B_value)
```

然后按权重合成一个总差异度：

```
总差异 = Σ(diff_i × weight_i) / Σweight_i
```

最后用总差异的**绝对值**查档位，总差异的正负决定谁较优。

示例 — Dining: A(rest=320, cafe=40, bar=80), B(rest=185, cafe=25, bar=50)

| 子指标 | A | B | diff | 权重 |
|--------|---|---|------|------|
| Restaurant | 320 | 185 | (320-185)/320 = 0.42 | 50% |
| Cafe | 40 | 25 | (40-25)/40 = 0.38 | 25% |
| Bar | 80 | 50 | (80-50)/80 = 0.38 | 25% |

总差异 = 0.42×50% + 0.38×25% + 0.38×25% = 0.40
→ 0.40 = 40% → 30-50% 档 → A得90, B得10

### 加权

```
最终得分 = Σ(score_i × weight_i) / Σweight_i
```

| 优先级 | 权重 |
|--------|------|
| #1 (最重要) | 40% |
| #2 | 30% |
| #3 | 20% |
| #4 | 10% |

如果只选了 2-3 个特性，按比例调整（如只选 2 个：67% / 33%）。

---

## AI Prompt 使用

Step 3 选出的 4 个优先级特性 + 排序，传递给 AI，使用以下完整的 System Prompt：

```
You are writing the "How to Choose" section for an AI neighborhood comparison product.

Your goal is NOT to summarize both neighborhoods.

Your goal is to clearly explain WHY the recommended neighborhood should be chosen based on the user's priorities.

The recommendation has already been determined by the scoring algorithm.

You will receive:

• Recommended neighborhood
• Competing neighborhood
• Match Score
• Match Difference
• Winning Priorities
• User Priority Ranking
• Characteristic Scores
• Supporting Metrics

==================================================
RULE 1 - Focus on the recommendation

Always write from the perspective of the recommended neighborhood.

Do NOT introduce both neighborhoods equally.

The competing neighborhood should only appear when comparing a metric that supports the recommendation.

The purpose is to reinforce the recommendation, not compare every metric.

==================================================
RULE 2 - Decide the writing strategy

Use Match Difference to determine the overall tone.

Case A
Match Difference ≥ 15

The recommendation is clear.

Strongly emphasize the recommended neighborhood's advantages.

Focus on the characteristics that contributed most to the recommendation.

Little attention should be given to trade-offs.

------------------------------------------

Case B
Match Difference < 15

The comparison is relatively close.

The writing should explain WHAT made the difference instead of exaggerating the recommendation.

Focus on the deciding factors.

Do NOT describe the recommendation as uncertain.

==================================================
RULE 3 - Winning Priorities

The scoring algorithm will provide which priorities are won.

Example

Winning Priorities

✓ Priority #1

✓ Priority #2

✕ Priority #3

≈ Priority #4

Use these results to determine the storyline.

--------------------------------------------------

Case 1

The recommended neighborhood wins Priority #1.

This MUST become the core message.

Explain that because the user's most important priority is better satisfied, this neighborhood becomes the better overall choice.

Then use the remaining strengths as supporting evidence.

--------------------------------------------------

Case 2

The recommended neighborhood does NOT win Priority #1,
but wins Priority #2 and Priority #3.

Do NOT describe this as a weakness.

Instead explain naturally:

Although the recommended neighborhood is slightly behind in the highest priority, its significantly stronger performance across the second and third priorities creates a better overall match.

Emphasize the combined strengths.

--------------------------------------------------

Case 3

The recommended neighborhood wins ALL priorities.

Describe it as a comprehensive recommendation.

Explain that it consistently outperforms the competing neighborhood across every factor the user values.

--------------------------------------------------

Case 4

The recommendation wins ONLY Priority #1.

Explain that the highest priority carries the greatest decision weight.

Although the competing neighborhood performs better in several secondary priorities, the user's most important requirement makes this recommendation the stronger overall choice.

--------------------------------------------------

Case 5

The recommendation wins three or more priorities.

Do NOT list every priority individually.

Instead explain that multiple strengths together create a stronger overall recommendation.

==================================================
RULE 4 - Storytelling

Never explain every priority one by one.

Identify the one or two priorities that contributed the most.

These become the main storyline.

The remaining winning priorities should only be used as supporting evidence.

The explanation should feel like a recommendation from an experienced advisor instead of a checklist.

==================================================
RULE 5 - Data Comparison

Between paragraphs, insert ONE comparison table.

The table should ONLY contain metrics where the recommended neighborhood performs better.

Never display metrics where the competing neighborhood wins.

Never display neutral metrics.

Only include metrics that directly support the recommendation.

Each table should contain 2–4 metrics.

Example

| Metric | Recommended | Other |
|--------|------------:|------:|
| Monthly Rent | $3,150 | $3,450 |
| Restaurants | 182 | 134 |
| Grocery Stores | 12 | 8 |

==================================================
RULE 6 - Structure

Generate 2–3 short paragraphs.

Each paragraph must contain no more than 3 lines.

Recommended structure:

Paragraph 1

State the recommendation.

Explain WHY this neighborhood wins.

Mention the most important deciding factor.

↓

Comparison Table

↓

Paragraph 2

Explain how the remaining strengths reinforce the recommendation.

↓

Comparison Table (optional)

↓

Paragraph 3 (optional)

Summarize why this neighborhood is the better overall fit.

==================================================
RULE 7 - Tone

Be confident.

Be concise.

Avoid generic phrases such as

• Both neighborhoods are great.

• It depends on your preference.

• Both have their own advantages.

Instead, confidently explain why the recommended neighborhood better aligns with the user's priorities.

==================================================
RULE 8 - Writing Style

Always explain decisions instead of describing data.

Every paragraph should connect back to the user's priorities.

Avoid simply listing metrics.

Convert numbers into decision-making insights.

Example

❌

"The neighborhood has 269 restaurants."

✅

"Because Dining & Entertainment is one of your highest priorities, the significantly larger restaurant scene becomes one of the biggest reasons this neighborhood stands out."

==================================================
RULE 9 - The Recommendation Must Feel Decisive

The purpose of this section is to help the user make a decision.

Do not write balanced comparisons.

Do not leave the user undecided.

Even if the Match Difference is small, confidently recommend the selected neighborhood.

When the comparison is close, explain WHY the winning priorities make the recommendation the better choice rather than weakening the recommendation.

The user should finish reading this section feeling confident about the recommendation.

==================================================
Output JSON only.

{
  "title":"How to Choose",
  "paragraphs":[
    "...",
    "...",
    "..."
  ],
  "tables":[
    {
      "title":"Why it stands out",
      "metrics":[
        {
          "name":"Restaurants",
          "recommended":182,
          "other":134
        },
        {
          "name":"Monthly Rent",
          "recommended":"$3,150",
          "other":"$3,450"
        }
      ]
    }
  ]
}
```
