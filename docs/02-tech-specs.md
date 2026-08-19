# 技术规范

## 1. 技术栈选型

| 层面 | 选型 | 版本 | 选型理由 |
|------|------|------|----------|
| 语言 | TypeScript | 5.5+ | 类型安全，减少运行时错误 |
| 框架 | React | 18.3 | 生态成熟、社区活跃 |
| 构建 | Vite | 5.4 | 极快 HMR，CRA 已停止维护 |
| 地图 | Mapbox GL JS | 3.5 | 自定义多边形图层、强大的颜色编码和交互 |
| 样式 | Tailwind CSS | 3.4 | Utility-first，快速开发 |
| 状态管理 | Zustand | 4.5 | 零样板代码，persist 中间件，selector 避免不必要渲染 |
| 路由 | React Router | 6.26 | 标准 SPA 路由方案 |
| 图标 | Lucide React | 0.400 | 轻量、Tree-shaking、图标丰富 |

### 为什么 Zustand 而不是 Context？

| Context + useReducer | Zustand |
|----------------------|---------|
| 需要 Provider 包裹 | 直接 `useStore()` 调用 |
| 状态变化时所有消费者重渲染 | selector 精确订阅，不相关状态不触发渲染 |
| localStorage 需要手写 | `persist` 中间件一行代码 |
| 需要多个 Context | 一个 store 文件搞定 |

### 为什么原生 Mapbox GL JS？

- 需要精细控制多边形 fill layer 的颜色和透明度
- click/hover 事件需要直接操作 feature state
- `fitBounds` 等相机操作更灵活
- react-map-gl 在 Mapbox GL JS v3 上有版本滞后问题

---

## 2. 项目结构

```
nyc-rental-finder/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── CLAUDE.md
├── devlog/                    # 开发日志
├── docs/                      # 项目文档
└── src/
    ├── main.tsx               # 入口文件
    ├── App.tsx                # 路由配置
    ├── pages/
    │   ├── OnboardingPage.tsx # 偏好选择页
    │   └── ResultsPage.tsx    # 结果页（筛选 + 地图 + 列表）
    ├── components/
    │   ├── preference/        # 偏好卡片相关
    │   ├── filter/            # 筛选面板相关
    │   ├── map/               # 地图相关
    │   ├── results/           # 结果列表相关
    │   └── common/            # 通用组件
    ├── store/
    │   └── useAppStore.ts     # Zustand 全局 store
    ├── data/
    │   ├── types.ts           # TypeScript 类型
    │   ├── constants.ts       # 常量
    │   ├── preferences.ts     # 偏好卡片定义
    │   └── mock/              # 模拟数据
    ├── utils/
    │   ├── matching.ts        # 匹配算法
    │   └── format.ts          # 格式化工具
    └── styles/
        └── index.css          # Tailwind 入口
```

---

## 3. 路由设计

| 路径 | 页面组件 | 说明 |
|------|----------|------|
| `/` | `OnboardingPage` | 偏好卡片选择（首次必选） |
| `/results` | `ResultsPage` | 主功能页（筛选 + 地图 + 列表） |

路由守卫逻辑：
- 访问 `/` 时检查 localStorage 是否有偏好数据
- 有 → 自动跳转到 `/results`
- 无 → 显示偏好选择页面

---

## 4. 状态管理 (Zustand Store)

```typescript
interface AppState {
  // === 状态 ===
  preferences: UserPreferences | null;     // 用户偏好（persist 到 localStorage）
  filters: FilterState;                    // 筛选条件
  selectedAreaId: string | null;           // 当前选中的片区 ID
  hoveredAreaId: string | null;            // 当前悬停的片区 ID
  livingAreas: LivingArea[];              // 所有 Living Area 数据
  isOnboarded: boolean;                    // 是否完成偏好选择

  // === 操作 ===
  setPreferences: (p: UserPreferences) => void;
  updateFilter: (partial: Partial<FilterState>) => void;
  selectArea: (id: string | null) => void;
  hoverArea: (id: string | null) => void;
  resetAll: () => void;
}
```

persist 配置：仅持久化 `preferences` 和 `isOnboarded`。

---

## 5. 数据流

```
用户选择偏好 → Store.setPreferences()
     ↓
用户调整筛选 → Store.updateFilter()
     ↓
useMemo 计算匹配结果 ← Store.preferences + Store.filters + Store.livingAreas
     ↓
匹配结果分别流入 → ResultMap（地图图层） + AreaList（卡片列表）
     ↓
用户交互（click/hover）→ Store.selectArea() / hoverArea()
     ↓
地图和列表同步响应（通过订阅 selectedAreaId / hoveredAreaId）
```

---

## 6. 模拟数据要求

- **20-30 个 Living Area**，覆盖 Manhattan、Brooklyn、Queens、Jersey City
- 每个 LA 有真实的 GeoJSON Polygon（基于 NYC 实际地理坐标）
- 每个 LA 有 1-5 个维度标签（用于偏好匹配）
- 每个 LA 有完整的 9 维度 metrics
- 每个 LA 有 12 个月趋势数据（3 个关键指标）
- 每个 LA 有 3-5 个 MetricChange（近一年关键变化）
- 趋势 overall 分布：~30% developing, ~40% stable, ~30% declining

---

## 7. 性能考虑

- 地图 GeoJSON 数据在组件外定义（避免重复解析）
- 匹配结果用 `useMemo` 缓存（依赖 preferences + filters + livingAreas）
- Zustand selector 精确到需要的字段（避免地图因筛选变化重渲染）
- 列表虚拟化（如果超过 50 个结果，但 MVP 只有 20-30 个不需要）
