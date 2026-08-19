# TODO — 待办清单

> 状态标记: ⬜ 待开始 | 🔲 进行中 | ✅ 已完成 | ❌ 已取消

---

## 阶段零：项目文档搭建

| 状态 | 任务 | 关联文档 |
|------|------|----------|
| ✅ | 创建 devlog 文件夹和 README | devlog/README.md |
| ✅ | 创建 docs 文件夹 | docs/ |
| ✅ | 编写 CLAUDE.md | CLAUDE.md |
| ✅ | 编写产品需求文档 | docs/01-requirements.md |
| ✅ | 编写技术规范文档 | docs/02-tech-specs.md |
| ✅ | 编写设计规范文档 | docs/03-design-specs.md |
| ✅ | 编写执行步骤文档 | docs/04-execution-plan.md |
| ✅ | 编写数据源调研文档 | docs/05-data-sources.md |

---

## 阶段一：项目初始化

| 状态 | 任务 | 关联 |
|------|------|------|
| ✅ | Step 1: Vite + React + TypeScript 脚手架 | docs/04-execution-plan.md#step-1 |
| ✅ | 安装所有依赖 | docs/02-tech-specs.md |
| ✅ | 配置 Tailwind CSS | docs/03-design-specs.md |
| ✅ | 配置路由 (`/` 和 `/results`) | docs/04-execution-plan.md#step-1 |
| ✅ | 配置 GitHub Pages base path | docs/04-execution-plan.md#step-1 |

---

## 阶段二：基础搭建

| 状态 | 任务 | 关联 |
|------|------|------|
| ✅ | Step 2: 类型定义 (types.ts) | docs/04-execution-plan.md#step-2 |
| ✅ | Step 2: 常量定义 (constants.ts) | docs/04-execution-plan.md#step-2 |
| ✅ | Step 2: 偏好卡片数据 (preferences.ts) | docs/04-execution-plan.md#step-2 |
| ✅ | Step 2: Zustand Store (useAppStore.ts) | docs/04-execution-plan.md#step-2 |

---

## 阶段三：数据层

| 状态 | 任务 | 关联 |
|------|------|------|
| ✅ | Step 3: 下载 7178 个真实 BG 边界（TIGERweb） | docs/04-execution-plan.md#step-3 |
| ✅ | Step 3: k-means 聚类 → 25 Living Area | docs/04-execution-plan.md#step-3 |
| ✅ | Step 3: 模拟指标 + 趋势 + sparklines | docs/04-execution-plan.md#step-3 |

---

## 阶段四：偏好卡片页面

| 状态 | 任务 | 关联 |
|------|------|------|
| ✅ | Step 4: PreferenceCard 组件 | docs/04-execution-plan.md#step-4 |
| ✅ | Step 4: PreferenceCardGrid 布局 | docs/04-execution-plan.md#step-4 |
| ✅ | Step 4: OnboardingPage 页面（Zustand + 路由） | docs/04-execution-plan.md#step-4 |

---

## 阶段五：筛选面板

| 状态 | 任务 | 关联 |
|------|------|------|
| ✅ | Step 5: FilterPanel 容器 | docs/04-execution-plan.md#step-5 |
| ✅ | Step 5: BudgetSlider 双端滑块 | docs/04-execution-plan.md#step-5 |
| ✅ | Step 5: CommuteSelector 通勤+方式 | docs/04-execution-plan.md#step-5 |
| ✅ | Step 5: AreaSizeSelector 大小选择 | docs/04-execution-plan.md#step-5 |
| ✅ | Step 5: ResultsPage 接入 FilterPanel | docs/04-execution-plan.md#step-5 |

---

## 阶段六：匹配算法

| 状态 | 任务 | 关联 |
|------|------|------|
| ⬜ | Step 6: 偏好匹配 + 筛选匹配算法 | docs/04-execution-plan.md#step-6 |
| ⬜ | Step 6: 格式化工具函数 | docs/04-execution-plan.md#step-6 |

---

## 阶段七：结果地图

| 状态 | 任务 | 关联 |
|------|------|------|
| ⬜ | Step 7: ResultMap 地图组件 | docs/04-execution-plan.md#step-7 |
| ⬜ | Step 7: MapLegend 图例组件 | docs/04-execution-plan.md#step-7 |
| ⬜ | Step 7: GeoJSON 图层 + 颜色编码 | docs/04-execution-plan.md#step-7 |

---

## 阶段八：结果列表 + 联动

| 状态 | 任务 | 关联 |
|------|------|------|
| ⬜ | Step 8: AreaCard 片区卡片 | docs/04-execution-plan.md#step-8 |
| ⬜ | Step 8: TrendIndicator 趋势标签 | docs/04-execution-plan.md#step-8 |
| ⬜ | Step 8: AreaList 列表组件 | docs/04-execution-plan.md#step-8 |
| ⬜ | Step 8: ResultsPage 三栏布局 | docs/04-execution-plan.md#step-8 |
| ⬜ | Step 8: 地图 ↔ 列表双向联动 | docs/04-execution-plan.md#step-8 |

---

## 阶段九：部署（Vercel，替代原 GitHub Pages 方案）

| 状态 | 任务 | 关联 |
|------|------|------|
| 🔲 | Step 9: 创建 GitHub 公开仓库并推送（等待用户建仓库） | docs/04-execution-plan.md#step-9 |
| ✅ | Step 9: Vercel 配置（base '/'、vercel.json、api/ 服务端代理） | docs/04-execution-plan.md#step-9 |
| ⬜ | Step 9: Vercel 导入仓库 + 配置环境变量（GOOGLE_GEOCODE_KEY、OPENAI_KEY） | docs/04-execution-plan.md#step-9 |
| ⬜ | Step 9: 验证公网可访问 | docs/04-execution-plan.md#step-9 |

---

## 阶段十：公寓推荐（Explore Your Match）

| 状态 | 任务 | 备注 |
|------|------|------|
| ✅ | 公寓推荐类型定义 | src/data/types.ts 追加 ApartmentListing/Building/DataFile |
| ✅ | 数据管线脚本 | scripts/build-apartments.mjs（Places 搜索 + CSV 匹配） |
| ✅ | 生成 apartments.ts 数据 | 全量 170 区，$0 免费额度内 |
| ✅ | ComparePage 集成公寓推荐卡片 | 'selling' 标签，aptType 软过滤 |
| ⬜ | 部署验证 | GitHub Pages 公网验证 |

---

## 待定 / 未来

| 状态 | 任务 | 备注 |
|------|------|------|
| ⬜ | 接入真实数据源 | 见 docs/05-data-sources.md |
| ⬜ | Living Area 详情页 (`/area/:id`) | 趋势折线图 |
| ⬜ | BG 聚合算法实现 | 2-6个相邻相似BG自动聚合 |
| ⬜ | 响应式移动端适配 | 手机屏幕布局调整 |
| ⬜ | Mapbox token 安全处理 | 生产环境用环境变量 |
