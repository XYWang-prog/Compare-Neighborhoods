# Compare Neighborhoods — 执行步骤

> 从现有代码基础上重构，保留数据层，替换交互层。

---

## Step 1: 新首页 — 社区选择器

### 改动
- 删除 OnboardingPage 中的偏好卡片、预算滑块、通勤选择
- 替换为两个搜索下拉框（autocomplete）
- 下拉列表显示所有 170 个社区：`"FirstMove名 · NTA名"`
- 选择两个社区后 → 按钮 "Compare" 激活

### 文件
- `src/pages/OnboardingPage.tsx` — 重写
- `src/components/NeighborhoodPicker.tsx` — 新建

### 验证
- 两个下拉框可搜索、可选择
- 选不同社区后按钮可点击
- 跳转到 `/compare?areaA=xxx&areaB=xxx`

---

## Step 2: 对比页 — 并排布局

### 改动
- 新建 `ComparePage.tsx`
- 上半部分：地图（两个社区着色，不同颜色：🔵A vs 🟠B）
- 下半部分：并排数据表

### 布局
```
┌──────────────────────────────────────┐
│  Header                              │
├──────────────────┬───────────────────┤
│     🗺️ 地图      │     🗺️ 地图       │
│   社区 A (蓝)     │   社区 B (橙)      │
├──────────────────┴───────────────────┤
│   社区 A 数据     │   社区 B 数据      │
│   💰 $3,200/mo   │   💰 $4,500/mo    │
│   👥 41,969      │   👥 28,000       │
│   ...            │   ...             │
├──────────────────────────────────────┤
│         AI 摘要 (OpenAI)              │
│   "Chelsea offers better commute..."  │
└──────────────────────────────────────┘
```

### 文件
- `src/pages/ComparePage.tsx` — 新建
- `src/components/compare/DataTable.tsx` — 新建
- `src/components/compare/AISummary.tsx` — 新建
- `src/App.tsx` — 添加路由 `/compare`

### 验证
- 两个社区数据正确显示
- 地图显示两个多边形（蓝/橙）

---

## Step 3: 地图双社区渲染

### 改动
- 修改 `ResultMap` 或新建双社区地图组件
- 社区 A 填充蓝色，社区 B 填充橙色
- 支持 venue 点切换

### 文件
- `src/components/map/CompareMap.tsx` — 新建
- 或修改 `ResultMap.tsx` 支持双数据源

---

## Step 4: OpenAI API 集成

### 改动
- 安装 `openai` npm 包
- 创建 API 调用函数
- 构建 prompt（注入两个社区的 JSON 数据）
- 流式或一次性获取对比摘要

### Prompt 示例
```
You are an NYC neighborhood analyst. Compare these two neighborhoods using the data provided. Write 3-5 sentences highlighting key differences in rent, demographics, transit, and lifestyle. Then suggest who each neighborhood is best for. Keep it concise and data-driven.

Neighborhood A: {name: "Chelsea", rent: {studio: 4495, oneBr: 6051, twoBr: 6995}, population: 52364, demographics: {white: 65, black: 8, asian: 14, hispanic: 11}, transit: {subway: 8, bus: 45}, restaurants: 320, bars: 85, cafes: 42}

Neighborhood B: {name: "Astoria", rent: {studio: 2725, oneBr: 3000, twoBr: 3500}, population: 78125, demographics: {white: 49, black: 5, asian: 16, hispanic: 26}, transit: {subway: 4, bus: 32}, restaurants: 185, bars: 38, cafes: 25}
```

### 文件
- `src/utils/openai.ts` — 新建
- `src/components/compare/AISummary.tsx` — 新建
- `.env` — 添加 `VITE_OPENAI_API_KEY`

### 验证
- AI 返回英文对比摘要
- 内容基于实际数据

---

## Step 5: 清理旧代码

### 删除
- `src/components/filter/` — 整个文件夹
- `src/components/preference/` — 整个文件夹
- `src/utils/matching.ts`
- `src/data/preferences.ts`
- `src/components/results/` — AreaCard, AreaList
- `FilterState`, `UserPreferences` 相关类型

### 保留
- 所有 `src/data/mock/` 数据文件
- `src/data/constants.ts`（清理不需要的部分）
- 地图组件（修改复用）
- venue 相关逻辑

---

## Step 6: 部署

- 更新 `index.html` title
- 确保 `.env` 配置正确
- `npm run deploy` 到 GitHub Pages
