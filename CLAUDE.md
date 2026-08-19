# CLAUDE.md — NYC+Jersey City 智能租房决策平台

## 项目概述

面向 NYC 和 Jersey City 的智能租房决策 web app。不做公寓推荐、不做简单评分，通过可视化地图帮助用户了解居住片区的真实情况与近一年变化趋势。

**当前阶段**: MVP 第1阶段 — 偏好选择 + 筛选 + 地图标注 + 结果列表

---

## 技术栈

| 层面 | 选型 |
|------|------|
| 框架 | React 18 + TypeScript + Vite |
| 地图 | Mapbox GL JS |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand (persist 中间件) |
| 路由 | React Router v6 |
| 图标 | Lucide React |
| 部署 | GitHub Pages (gh-pages) |

---

## 重要文件路径

| 用途 | 路径 |
|------|------|
| 项目根目录 | `e:\1 vibe coding\二\test3\` |
| AI 助手指南 | `e:\1 vibe coding\二\test3\CLAUDE.md` |
| 开发日志 | `e:\1 vibe coding\二\test3\devlog\` |
| 每日记录 | `e:\1 vibe coding\二\test3\devlog\2026-07-30.md` |
| 待办清单 | `e:\1 vibe coding\二\test3\devlog\TODO.md` |
| 产品需求 | `e:\1 vibe coding\二\test3\docs\01-requirements.md` |
| 技术规范 | `e:\1 vibe coding\二\test3\docs\02-tech-specs.md` |
| 设计规范 | `e:\1 vibe coding\二\test3\docs\03-design-specs.md` |
| 执行计划 | `e:\1 vibe coding\二\test3\docs\04-execution-plan.md` |
| 数据源调研 | `e:\1 vibe coding\二\test3\docs\05-data-sources.md` |
| 实施计划(详细) | `C:\Users\王小雅\.claude\plans\web-app-jersey-city-graceful-flamingo.md` |
| 源代码 | `e:\1 vibe coding\二\test3\src\` (待创建) |

---

## AI 工作约定

### 代码风格
- 使用 TypeScript 严格模式，所有函数参数和返回值必须有类型
- React 组件使用函数式组件 + Hooks
- 文件命名：组件用 PascalCase (`PreferenceCard.tsx`)，工具函数用 camelCase (`matching.ts`)
- 每个组件文件只导出一个主组件

### 注释语言
- 代码注释使用中文
- 变量和函数名使用英文
- 面向代码小白的用户，复杂逻辑必须加注释解释

### 开发流程
1. 先在 `devlog/TODO.md` 更新任务状态
2. 按照 `docs/04-execution-plan.md` 的步骤顺序执行
3. 每完成一个 Step，在 `devlog/` 下记录进展
4. 每个 Step 完成后必须验证（`npm run dev` 确认可运行）

### 提交规范
- 每完成一个 Step 提交一次 git commit
- Commit message 格式: `[Step N] 简短描述`

### 沟通约定
- 用户是代码小白，解释技术决策时用通俗语言
- 涉及技术选型变更时先确认
- 优先展示视觉效果，再解释实现细节
