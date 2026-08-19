import type { Polygon, MultiPolygon } from 'geojson'

// ============================================================
// 用户偏好
// ============================================================

/** 8种生活方式标签 */
export type LifestyleTag =
  | 'young_crowd'       // 年轻人聚集
  | 'quiet'             // 安静社区
  | 'nightlife'         // 夜生活丰富
  | 'family_friendly'   // 家庭友好
  | 'commute'           // 通勤便利
  | 'foodie'            // 餐饮丰富
  | 'green_space'       // 绿地较多
  | 'budget'            // 预算优先

/** 用户偏好设置（持久化到 localStorage） */
export interface UserPreferences {
  tags: LifestyleTag[]
  completedAt: string   // ISO 日期字符串
}

// ============================================================
// 筛选条件
// ============================================================

/** 户型 */
export type ApartmentType = 'studio' | '1br' | '2br'

/** 通勤方式 */
export type CommuteMode = 'subway' | 'bus' | 'driving' | 'walk'

/** 筛选状态 */
export interface FilterState {
  /** 月租金范围 [最小, 最大]，单位为美元 */
  budget: [number, number]
  /** 户型 */
  apartmentType: ApartmentType
  /** 最大通勤时间，单位为分钟 */
  commuteTime: number
  /** 通勤目的地文本 */
  commuteDestination: string
  /** 通勤目的地坐标 (geocoded) */
  workCoords: [number, number] | null
  /** Google Distance Matrix 结果缓存 {areaId: minutes} */
  commuteCache: Record<string, number>
  /** 通勤方式 */
  commuteMode: CommuteMode
}

// ============================================================
// 趋势数据
// ============================================================

/** 单月趋势数据点 */
export interface TrendPoint {
  month: string   // "2025-08" 格式
  value: number
}

/** 趋势方向 */
export type TrendDirection = 'up' | 'stable' | 'down'

/** Living Area 整体趋势判断 */
export type OverallTrend = 'developing' | 'stable' | 'declining'

/** 近一年关键变化（显示在片区卡片上） */
export interface MetricChange {
  label: string
  value: number | string  // 变化数值或格式化字符串
  direction: 'improving' | 'worsening' | 'neutral'
  icon: 'restaurant' | 'shopping' | 'bar' | 'crime' | 'construction' | 'rent'
  detail?: string
}

// ============================================================
// Living Area（展示单元：2-6个相似BG聚合）
// ============================================================

/** Living Area 的 9 维度指标 */
export interface LivingAreaMetrics {
  /** 租金中位数 (1BR) */
  rentMedian: number
  /** 分户型租金 */
  rentByBedroom: {
    studio: number
    oneBr: number
    twoBr: number
  }
  /** 租金范围 [最低, 最高] */
  rentRange: [number, number]
  /** 到曼哈顿中城的通勤时间（分钟） */
  commuteTime: number
  /** 地铁站数量 */
  subwayStations: number
  /** 公交线路数量 */
  busRoutes: number
  /** 每千人年犯罪率 */
  crimeRate: number
  /** 餐厅总数 */
  restaurantCount: number
  /** 超市总数 */
  supermarketCount: number
  /** 酒吧总数 */
  barCount: number
  /** 公园数量 */
  parkCount: number
  /** 绿化覆盖率 (0-100) */
  greenCoverage: number
  /** 活跃施工许可证数 */
  activePermits: number
  /** 人口密度（每平方英里） */
  populationDensity: number
  [key: string]: any
}

/** Living Area 趋势数据 */
export interface LivingAreaTrends {
  /** 整体趋势 */
  overall: OverallTrend
  /** 近一年关键变化列表（3-5条） */
  changes: MetricChange[]
  /** 迷你趋势图数据（3个关键指标各12个月，rent 按户型拆分） */
  sparklines: {
    rent: TrendPoint[]
    rentStudio?: TrendPoint[]
    rent1br?: TrendPoint[]
    rent2br?: TrendPoint[]
    crime: TrendPoint[]
    restaurantCount: TrendPoint[]
  }
  /** 额外数据 */
  [key: string]: any
}

/** Living Area —— 推荐居住片区 */
export interface LivingArea {
  /** 唯一标识 */
  id: string
  /** 用户友好名称，如 "Williamsburg North" */
  name: string
  /** 所属社区/行政区，如 "Brooklyn" */
  neighborhood: string
  /** 包含的 Block Group 数量 (2-6) */
  bgCount: number
  /** GeoJSON 多边形或多多边形（用于地图渲染） */
  geometry: Polygon | MultiPolygon
  /** 中心点 [经度, 纬度] */
  centroid: [number, number]
  /** 9维度指标 */
  metrics: LivingAreaMetrics
  /** 趋势数据 */
  trends: LivingAreaTrends
  /** 该片区匹配的偏好标签 */
  dimensionTags: LifestyleTag[]
  /** 匹配度评分 (0-100)，由匹配算法计算 */
  matchScore: number
  /** 包含的 BG GEOID 列表（用于追溯原始数据） */
  bgGeoIds: string[]
  /** 额外数据（sparkline 值、人口统计等） */
  [key: string]: any
}

// ============================================================
// 公寓推荐（Explore Your Match）
// 数据来源：Google Places API（建筑信息）+ firstmovernyc 月度 CSV（真实房源）
// 由 scripts/build-apartments.mjs 生成，不要手写编造数字
// ============================================================

/** 单条真实房源（来自 firstmover 月度 CSV） */
export interface ApartmentListing {
  /** 卧室数：0 = studio，1 = 1BR，2 = 2BR */
  bedrooms: number
  /** 展示价：净有效租金 > 0 时取净价，否则取挂牌价 */
  price: number
  /** 净有效租金原值（CSV 为 0 → null，绝不编造） */
  netEffectivePrice: number | null
  /** 面积平方英尺（CSV 为 0 → null） */
  sqft: number | null
  /** 免租月数（0 = 无） */
  monthsFree: number
  /** 是否免中介费 */
  noFee: boolean
  /** 是否带家具 */
  furnished: boolean
  /** 可入住日期 'YYYY-MM-DD' */
  availableDate: string | null
  /** StreetEasy 真实房源链接 */
  url: string
}

/** 一栋公寓楼（Places 建筑信息 + 匹配到的 CSV 房源） */
export interface ApartmentBuilding {
  /** Google Places place_id */
  placeId: string
  /** 建筑名（Places displayName） */
  name: string
  /** Google 评分（无评分为 null） */
  rating: number | null
  /** 评论数量（0 = 无数据） */
  reviewCount: number
  /** 地址（Places formattedAddress） */
  address: string
  /** 坐标 [经度, 纬度] */
  location: [number, number]
  /** Places 编辑摘要（住宅建筑大多为空） */
  editorialSummary: string | null
  /** Google Maps 链接 */
  googleMapsUrl: string
  /** 匹配到的真实房源（≤6 条，价格升序） */
  listings: ApartmentListing[]
  /** 该建筑本月 CSV 中全部房源数（含被裁剪的） */
  listingCount: number
}

/** src/data/mock/apartments.ts 导出结构（脚本生成） */
export interface ApartmentDataFile {
  /** 生成时间 ISO 字符串 */
  generatedAt: string
  /** 数据来源 CSV 月份 'YYYY-MM' */
  csvMonth: string
  /** 原始 CSV 下载地址 */
  sourceCsvUrl: string
  /** key = LivingArea.id */
  buildings: Record<string, ApartmentBuilding[]>
}

// ============================================================
// 偏好卡片定义
// ============================================================

/** 单张偏好卡片的展示信息 */
export interface PreferenceCardData {
  tag: LifestyleTag
  icon: string        // Lucide 图标名称，如 "Users"
  title: string       // 中文标题
  description: string // 简短描述
}
