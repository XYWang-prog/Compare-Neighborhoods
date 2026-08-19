import type { LifestyleTag, FilterState, CommuteMode, ApartmentType } from './types'

// ============================================================
// 偏好标签中文映射
// ============================================================

export const LIFESTYLE_LABELS: Record<LifestyleTag, string> = {
  young_crowd: 'Young Crowd',
  quiet: 'Quiet',
  nightlife: 'Nightlife',
  family_friendly: 'Family Friendly',
  commute: 'Commute',
  foodie: 'Food Scene',
  green_space: 'Green Space',
  budget: 'Budget-Friendly',
}

// ============================================================
// 趋势颜色映射（Tailwind class + Hex）
// ============================================================

export const TREND_COLORS = {
  developing: {
    hex: '#22C55E',       // green-500
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-300',
    label: 'Growing',
  },
  stable: {
    hex: '#3B82F6',       // blue-500
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-300',
    label: 'Stable',
  },
  declining: {
    hex: '#EF4444',       // red-500
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-300',
    label: 'Declining',
  },
} as const

// ============================================================
// 筛选默认值
// ============================================================

export const DEFAULT_FILTERS: FilterState = {
  budget: [2000, 8000],
  apartmentType: '1br',
  commuteTime: 30,
  commuteDestination: '',
  workCoords: null,
  commuteCache: {},
  commuteMode: 'subway',
}

// ============================================================
// 户型选项
// ============================================================

export const APARTMENT_TYPE_OPTIONS: { value: ApartmentType; label: string; desc: string }[] = [
  { value: 'studio', label: 'Studio', desc: '开间/单间' },
  { value: '1br', label: '1BR', desc: '一室一厅' },
  { value: '2br', label: '2BR', desc: '两室一厅' },
]

/** 户型租金系数（相对于 1BR 中位数） */
export const APARTMENT_RENT_MULTIPLIER: Record<ApartmentType, number> = {
  studio: 0.72,
  '1br': 1.0,
  '2br': 1.38,
}

// ============================================================
// 工作地点选项
// ============================================================

export const WORK_LOCATIONS: { label: string; coords: [number, number] }[] = [
  { label: 'Midtown Manhattan', coords: [-73.980, 40.755] },
  { label: 'Downtown / Wall Street', coords: [-74.009, 40.707] },
  { label: 'Hudson Yards', coords: [-74.002, 40.755] },
  { label: 'Chelsea', coords: [-74.001, 40.746] },
  { label: 'Union Square', coords: [-73.990, 40.736] },
  { label: 'Flatiron', coords: [-73.989, 40.740] },
  { label: 'SoHo', coords: [-74.000, 40.723] },
  { label: 'Tribeca', coords: [-74.009, 40.718] },
  { label: 'Upper East Side', coords: [-73.956, 40.774] },
  { label: 'Upper West Side', coords: [-73.975, 40.787] },
  { label: 'Harlem', coords: [-73.946, 40.811] },
  { label: 'Columbia University', coords: [-73.962, 40.808] },
  { label: 'Downtown Brooklyn', coords: [-73.990, 40.693] },
  { label: 'Williamsburg', coords: [-73.956, 40.713] },
  { label: 'DUMBO', coords: [-73.989, 40.703] },
  { label: 'Long Island City', coords: [-73.946, 40.748] },
  { label: 'Astoria', coords: [-73.922, 40.778] },
  { label: 'Jersey City / Exchange Place', coords: [-74.033, 40.717] },
  { label: 'Hoboken', coords: [-74.032, 40.744] },
  { label: 'Newark Penn Station', coords: [-74.164, 40.735] },
]

// ============================================================
// 通勤目的地解析
// ============================================================

// 注意：Google API key 不再出现在前端代码里。
// 开发环境走 vite 代理（key 从 .env.local 读取），
// 生产环境走 Vercel 服务端函数 api/geocode.ts 和 api/distance.ts
// （key 存在 Vercel 环境变量中）。

/**
 * Google Geocoding — 地址 → 坐标（经服务端代理，key 不暴露）
 */
export async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (!address.trim()) return null
  try {
    const resp = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`)
    const data = await resp.json()
    if (data.status === 'OK' && data.results[0]) {
      const loc = data.results[0].geometry.location
      return [loc.lng, loc.lat]
    }
  } catch {}
  return null
}

/**
 * Google Distance Matrix — 批量获取通勤时间
 */
export async function fetchCommuteTimes(
  workCoords: [number, number],
  centroids: { id: string; lng: number; lat: number }[],
  mode: string,
): Promise<Record<string, number>> {
  const modeMap: Record<string, string> = {
    'subway': 'transit',
    'bus': 'transit',
    'driving': 'driving',
    'walk': 'walking',
    'bike': 'bicycling',
  }
  const googleMode = modeMap[mode] || 'transit'
  // 不限制 transit_mode，让 Google 返回最快路线（PATH/subway/bus 都会考虑）
  const transitMode = mode === 'bus' ? 'bus' : undefined
  const results: Record<string, number> = {}

  // 逐个查询避免批量失败
  for (const c of centroids) {
    const dest = `${c.lat},${c.lng}`
    const origin = `${workCoords[1]},${workCoords[0]}`

    try {
      const now = Math.floor(Date.now() / 1000)
      let url = `/api/distance?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}&mode=${googleMode}`
      if (googleMode === 'transit') url += `&departure_time=${now}`
      if (transitMode) url += `&transit_mode=${transitMode}`

      const resp = await fetch(url)
      const data = await resp.json()

      if (data.status === 'OK' && data.rows?.[0]?.elements?.[0]?.status === 'OK') {
        results[c.id] = Math.round(data.rows[0].elements[0].duration.value / 60)
        console.log(`Commute: ${c.id} = ${results[c.id]}min (${googleMode}${transitMode ? '/'+transitMode : ''})`)
      } else {
        console.warn(`Commute failed for ${c.id}: status=${data.status}, el=${data.rows?.[0]?.elements?.[0]?.status}`)
        // 回退：transit 失败时尝试 driving
        if (googleMode === 'transit') {
          const fallbackUrl = `/api/distance?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(dest)}&mode=driving`
          const fbResp = await fetch(fallbackUrl)
          const fbData = await fbResp.json()
          if (fbData.status === 'OK' && fbData.rows?.[0]?.elements?.[0]?.status === 'OK') {
            results[c.id] = Math.round(fbData.rows[0].elements[0].duration.value / 60)
          }
        }
      }
    } catch (_) { /* skip */ }
  }

  console.log('Commute cache result:', JSON.stringify(results))
  return results
}

/** 根据 Google Distance Matrix 结果计算通勤时间（无缓存返回 999 即不匹配） */
export function estimateCommute(
  areaId: string,
  workCoords: [number, number] | null,
  googleTimes?: Record<string, number>,
): number {
  if (!workCoords) return 30  // 未输入工作地点时不筛选通勤
  if (googleTimes && areaId in googleTimes) {
    return googleTimes[areaId]
  }
  return 999  // 无 Google 数据 → 不匹配
}

/** 地址显示标签 */
export function resolveDestination(input: string): string {
  if (!input.trim()) return ''
  return input.length > 25 ? input.slice(0, 25) + '...' : input
}

// ============================================================
// 通勤方式选项
// ============================================================

export const COMMUTE_MODE_OPTIONS: { value: CommuteMode; label: string }[] = [
  { value: 'subway', label: 'Subway' },
  { value: 'bus', label: 'Bus' },
  { value: 'driving', label: 'Drive' },
  { value: 'walk', label: 'Walk' },
]

// ============================================================
// 地图初始配置
// ============================================================

/**
 * Mapbox 访问令牌（pk. 开头的公开 token，用于地图加载）
 * 从环境变量 VITE_MAPBOX_TOKEN 读取，不写死在代码里：
 * - 本地开发：.env.local 里配置（vite 会自动注入）
 * - 生产部署：Vercel 项目环境变量里配置
 * 这样公开仓库里不包含任何 token，也不会被 GitHub 密钥扫描拦截
 */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''

/** NYC + Jersey City 中心点 */
export const MAP_CENTER: [number, number] = [-73.985, 40.730]

/** 默认缩放级别 */
export const MAP_DEFAULT_ZOOM = 11

/** Mapbox 样式 URL（需要 token） */
export const MAP_STYLE = 'mapbox://styles/mapbox/light-v11'

// ============================================================
// 匹配度阈值
// ============================================================

/** 匹配度低于此值不展示 */
export const MIN_MATCH_SCORE = 50

// ============================================================
// 预算和通勤的滑块范围
// ============================================================

export const BUDGET_MIN = 2000
export const BUDGET_MAX = 8000
export const BUDGET_STEP = 100

export const COMMUTE_MIN = 10
export const COMMUTE_MAX = 60
export const COMMUTE_STEP = 5
