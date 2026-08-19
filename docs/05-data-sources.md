# 数据源调研

> MVP 阶段使用模拟数据。本文档记录未来可接入的真实数据源。

---

## 概览

| 维度 | 数据源 | 覆盖范围 | 获取方式 |
|------|--------|----------|----------|
| BG 边界 | NHGIS / US Census TIGER | NYC + 全美 | GeoJSON API |
| 犯罪 | NYPD Complaint Data | NYC | SODA API (免费) |
| 犯罪 | JC IMPACT Crime Portal | Jersey City | Web Dashboard |
| 餐厅 | DOHMH Restaurant Inspection | NYC | SODA API (免费) |
| 酒吧 | NY SLA Liquor Licenses | NYC + NY State | SODA API (免费) |
| 超市 | NYC DCP Retail Food Stores DB | NYC | ArcGIS Feature Service |
| 施工 | DOB Permit Issuance + DOB NOW | NYC | SODA API (免费) |
| 交通 | MTA GTFS + Subway Stations | NYC | GTFS 静态数据 |
| 公园 | NYC Parks Recreation Dataset | NYC | GeoJSON |
| 人口 | US Census ACS 5-Year | NYC + 全美 | Census API (免费) |
| 租金 | ACS median rent / Zillow API | NYC + 全美 | Census API / 商业 API |

---

## 详细数据源

### 1. Census Block Group 边界

- **来源**: NHGIS / US Census Bureau TIGER/Line
- **API**: `https://services6.arcgis.com/IX0rbbPRMd0YfCJN/ArcGIS/rest/services/NYC_block_groups/FeatureServer/0`
- **格式**: GeoJSON
- **说明**: 免费、公开；包含 NYC 所有 Block Group 的精确多边形

### 2. 犯罪数据 (NYC)

- **来源**: NYPD Complaint Data (NYC Open Data)
- **数据集 ID**: `5uac-w243` (historical) / 实时端点
- **API**: Socrata SODA API (`data.cityofnewyork.us`)
- **字段**: 犯罪类型、发生时间、经纬度、辖区
- **频率**: 每日更新
- **认证**: 免费，无需注册（有 rate limit，注册 app token 提高限制）

### 3. 犯罪数据 (Jersey City)

- **来源**: JC IMPACT Crime Data Portal
- **URL**: `impact.jcnj.org`
- **说明**: 2026 年 6 月上线，提供实时犯罪数据地图
- **现状**: 需要进一步调研 API 接入方式

### 4. 餐厅数据

- **来源**: DOHMH NYC Restaurant Inspection Results
- **数据集 ID**: `43nn-pn8j`
- **API**: Socrata SODA API
- **关键字段**: 餐厅名、地址、经纬度、菜系、评分、检查日期
- **追踪新开**: 检查日期为 `1900-01-01` 的记录表示新申请但尚未检查的餐厅
- **追踪关闭**: 对比历史数据中消失的餐厅

### 5. 酒吧数据

- **来源**: NY State Liquor Authority Active Licenses
- **URL**: `data.ny.gov/d/9s3h-dpkz`
- **API**: Socrata SODA API
- **说明**: 包含所有活跃酒牌（酒吧、餐厅酒吧、俱乐部等），含经纬度
- **分类**: 可通过 License Type 筛选纯酒吧 vs 餐厅
- **追踪新开/关闭**: 对比不同时间点的活跃酒牌列表

### 6. 超市数据

- **来源**: NYC DCP Retail Food Stores Database
- **GitHub**: `NYCPlanning/db-retailfoodstores`
- **API**: ArcGIS Feature Service: `services.arcgis.com/uKN48PkxmWiqJM9q/ArcGIS/rest/services/NYC_GroceryStores/FeatureServer`
- **分类**: 超市(>5000sf)、杂货店(500-5000sf)、便利店(100-500sf)
- **说明**: NYC 城市规划局维护，用于 FRESH 项目

### 7. 施工数据

- **来源 1**: DOB Permit Issuance (BIS 旧系统)
  - 数据集 ID: `ipu4-2q9a`
  - 记录量: ~400 万条
- **来源 2**: DOB NOW: Build – Approved Permits (新系统)
  - 数据集 ID: `rbx6-tga4`
  - 当前活跃许可的主要来源
- **关键字段**: 许可类型、状态、签发日期、经纬度、施工类型
- **追踪活跃度**: 按月份统计新增许可数量

### 8. 交通数据

- **MTA GTFS 静态数据**: 地铁站位置、线路、时刻表
- **MTA Subway Stations**: 地铁站和站点群数据集（含经纬度）
- **MTA Subway Hourly Ridership**: 每小时各站客流量（2025年起）
- **通勤时间计算**: 需要结合 GTFS + 路由算法（如 OpenTripPlanner）

### 9. 公园数据

- **来源**: NYC Parks Active and Passive Recreation
- **数据集 ID**: `kcqe-vnci`
- **格式**: GeoJSON、CSV
- **Walk-to-a-Park Service Area**: 步行可达公园范围 shapefile

### 10. 人口数据

- **来源**: US Census American Community Survey (ACS) 5-Year Estimates
- **API**: `api.census.gov`
- **关键字段**: 人口密度、年龄中位数、收入中位数、家庭结构、教育水平
- **粒度**: Census Tract 级别（可聚合到 BG）

### 11. 租金数据

- **来源 1**: ACS median gross rent (免费，Census Tract 级别)
- **来源 2**: Zillow API (需注册，有使用限制，含 Zestimate rent)
- **来源 3**: StreetEasy (无公开 API，需要爬虫)
- **MVP 替代**: 使用 ACS 数据或模拟

---

## 数据处理流水线（未来）

```
原始数据源 (11个)
      ↓
数据获取层 (定期拉取 SODA/GTFS/Census API)
      ↓
ETL 处理 (清理、标准化、地理编码)
      ↓
BG 级别聚合 (所有指标聚合到 Block Group)
      ↓
Living Area 聚合 (2-6个相邻相似BG自动合并)
      ↓
趋势计算 (12个月月度对比)
      ↓
前端 API / 静态 JSON
```

---

## 数据更新频率建议

| 频率 | 数据 |
|------|------|
| 每日 | 餐厅检查、施工许可、311 投诉 |
| 每周 | 犯罪数据 |
| 每月 | 租金估算、趋势重算 |
| 每年 | 人口普查、BG 边界 |
| 按需 | 酒吧酒牌、超市、公园 |
