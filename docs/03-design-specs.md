# 设计规范

## 1. 配色方案

### 1.1 主色调

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 (Primary) | `#2563EB` (Blue-600) | 按钮、链接、选中态 |
| 主色深 | `#1D4ED8` (Blue-700) | Hover 态 |
| 主色浅 | `#DBEAFE` (Blue-100) | 背景高亮 |

### 1.2 趋势颜色（核心）

| 趋势 | 色值 | Tailwind | 用途 |
|------|------|----------|------|
| 发展中 | `#22C55E` | `green-500` | 地图多边形、趋势标签 |
| 稳定 | `#3B82F6` | `blue-500` | 地图多边形、趋势标签 |
| 衰退 | `#EF4444` | `red-500` | 地图多边形、趋势标签 |

### 1.3 功能色

| 用途 | 色值 | Tailwind |
|------|------|----------|
| 改善/正面 | `#16A34A` | `green-600` |
| 恶化/负面 | `#DC2626` | `red-600` |
| 中性 | `#6B7280` | `gray-500` |
| 警告 | `#F59E0B` | `amber-500` |

### 1.4 中性色

| 用途 | 色值 | Tailwind |
|------|------|----------|
| 背景 | `#F9FAFB` | `gray-50` |
| 卡片背景 | `#FFFFFF` | `white` |
| 边框 | `#E5E7EB` | `gray-200` |
| 文字主色 | `#111827` | `gray-900` |
| 文字辅色 | `#6B7280` | `gray-500` |

---

## 2. 排版

### 2.1 字体
- 系统默认字体栈（无需加载 Web Font）
- `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

### 2.2 字号层级

| 层级 | Tailwind Class | 大小 | 用途 |
|------|---------------|------|------|
| H1 | `text-3xl font-bold` | 30px | 页面标题 |
| H2 | `text-2xl font-semibold` | 24px | 区块标题 |
| H3 | `text-lg font-semibold` | 18px | 卡片标题 |
| Body | `text-base` | 16px | 正文 |
| Small | `text-sm` | 14px | 辅助信息、标签 |
| XS | `text-xs` | 12px | 指标徽章 |

---

## 3. 组件样式规范

### 3.1 偏好卡片
```
尺寸: 160px × 120px
圆角: rounded-xl (12px)
边框: border-2
默认态: border-gray-200 bg-white
选中态: border-blue-500 bg-blue-50 shadow-md
悬停态: shadow-lg scale-[1.02] transition
图标: 32px, 居中, text-blue-500
```

### 3.2 筛选面板
```
宽度: 260px (固定)
背景: bg-white border-r border-gray-200
内边距: p-4
滑块颜色: accent-blue-500
按钮组: 圆角按钮, 选中态 bg-blue-500 text-white
```

### 3.3 地图片区多边形
```
填充透明度: 0.4 (匹配度100%) ~ 0.15 (匹配度60%)
边框宽度: 1px (默认) / 3px (hover/选中)
边框颜色: 白色 (默认) / 黑色 (hover/选中)
```

### 3.4 片区卡片 (AreaCard)
```
宽度: 100% (填充列表区域)
圆角: rounded-lg (8px)
边框: border border-gray-200
内边距: p-4
悬停态: shadow-md border-blue-300
选中态: border-blue-500 bg-blue-50 ring-2 ring-blue-200
匹配度条: h-2 rounded-full, bg-blue-500 (填充), bg-gray-200 (底色)
```

### 3.5 趋势标签 (TrendIndicator)
```
发展中: bg-green-100 text-green-700 border-green-300
稳定:   bg-blue-100 text-blue-700 border-blue-300
衰退:   bg-red-100 text-red-700 border-red-300
尺寸: text-xs px-2 py-0.5 rounded-full
```

### 3.6 按钮
```
主按钮: bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700
次按钮: border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50
禁用态: opacity-50 cursor-not-allowed
```

---

## 4. 布局规范

### 4.1 OnboardingPage
```
┌─────────────────────────────┐
│         Header               │
│                               │
│     标题 + 副标题 (居中)       │
│                               │
│   ┌───┐ ┌───┐ ┌───┐ ┌───┐  │
│   │卡1│ │卡2│ │卡3│ │卡4│  │
│   └───┘ └───┘ └───┘ └───┘  │
│   ┌───┐ ┌───┐ ┌───┐ ┌───┐  │
│   │卡5│ │卡6│ │卡7│ │卡8│  │
│   └───┘ └───┘ └───┘ └───┘  │
│                               │
│     [开始匹配] 按钮 (居中)     │
│     已选 X/8 张               │
└─────────────────────────────┘
```

### 4.2 ResultsPage
```
┌──────────────────────────────────────────┐
│  Header (h-16)                            │
├─────────┬──────────────────┬──────────────┤
│ 筛选面板 │      地图         │  结果列表     │
│ w-64    │    flex-1        │  w-96        │
│         │                  │  可滚动       │
│ 预算    │                  │              │
│ [滑块]  │  🟢 🔵 🔴       │ 卡片1        │
│         │  (多边形图层)     │ 卡片2        │
│ 通勤    │                  │ 卡片3        │
│ [滑块]  │                  │ 卡片4        │
│         │                  │  ...         │
│ 方式    │                  │              │
│ [按钮组]│                  │              │
│         │                  │              │
│ 大小    │                  │              │
│ [按钮组]│                  │              │
├─────────┴──────────────────┴──────────────┤
│  图例 (h-10)                               │
└──────────────────────────────────────────┘
```

---

## 5. 交互动效

| 交互 | 动效 |
|------|------|
| 卡片选中 | `scale-[1.02]` + 边框颜色过渡 `transition-all duration-200` |
| 地图多边形 hover | 边框变粗 + 微亮 `transition duration-150` |
| 列表 ↔ 地图联动 | 滚动到视野 `scrollIntoView({ behavior: 'smooth' })` |
| 筛选滑块变化 | 地图多边形 + 列表实时更新（debounce 150ms） |
| 页面切换 | React Router 默认过渡（后续可加 fade） |

---

## 6. 响应式策略

MVP 阶段聚焦桌面端（>=1280px 宽度）。后续阶段适配：
- **平板 (768-1279px)**: 筛选面板可折叠，地图 + 列表上下排列
- **手机 (<768px)**: 单列布局，地图缩小，列表全宽
