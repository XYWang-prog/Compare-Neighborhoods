#!/usr/bin/env node
/**
 * build-apartments.mjs — 公寓推荐数据管线
 *
 * 数据来源：
 *   1. Google Places API Text Search (New) — 发现每社区的公寓楼（名字/评分/评论数/坐标）
 *   2. firstmovernyc.com/open-data 月度房源 CSV — 真实房源（租金/面积/免租月数等）
 *
 * 流程：解析 livingAreas.ts → 下载 CSV → 每区 3 个搜索词 → 去重/筛选
 *       → 全 CSV 建筑空间索引 + 街道名匹配 → 生成 src/data/mock/apartments.ts
 *
 * 用法：
 *   node scripts/build-apartments.mjs                    # 全量 170 区，取最新月份 CSV
 *   node scripts/build-apartments.mjs --areas=fm_newport,fm_beekman   # 只跑指定区
 *   node scripts/build-apartments.mjs --month=2026-04    # 指定 CSV 月份
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ============================================================
// 配置常量（可调）
// ============================================================

/**
 * Google API key — 不硬编码在代码里（仓库是公开的）。
 * 优先读系统环境变量，其次读项目根目录的 .env.local（不进 git）。
 */
function readKey(name: string): string {
  if (process.env[name]) return process.env[name]
  try {
    const txt = readFileSync(fileURLToPath(new URL('../.env.local', import.meta.url)), 'utf8')
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/)
      if (m && m[1] === name) return m[2].trim()
    }
  } catch {}
  return ''
}

const API_KEY = readKey('GOOGLE_GEOCODE_KEY') || readKey('GOOGLE_API_KEY')
if (!API_KEY) {
  console.error('✗ 缺少 Google API key：请在项目根目录 .env.local 中配置 GOOGLE_GEOCODE_KEY=你的key')
  process.exit(1)
}

/** 每社区搜索词模板（{name} = 社区名，{borough} = CSV 反查的行政区） */
const QUERY_TEMPLATES = [
  'apartments in {name} {borough}',
  'luxury apartments in {name} {borough}',
  'apartment buildings in {name} {borough}',
]

/** 公寓类型集合（primaryType / types 数组中出现即算） */
const TYPE_WHITELIST = new Set(['apartment_building', 'condominium_complex', 'apartment_complex'])
/** 始终拦截的类型（酒店等） */
const TYPE_ALWAYS_BLOCK = new Set(['lodging', 'hotel'])

/**
 * 中介名称识别：
 * 1. 商业后缀（LLC/Inc/Group/Realty...）→ 中介
 * 2. 人工黑名单（Rentopia 等知名中介品牌）
 * 3. 全通用词名称（如 "Luxury Apartments LIC"）→ SEO 中介名，真建筑名含专有名词
 *    （如 420 Kent / Sven / Avalon Cove 都含专有词，不会被误杀）
 */
const AGENCY_NAME_PATTERN = /\b(llc|inc|corp|group|team|brokerage|brokers|realty|realtors|management|company)\b/i
const AGENCY_NAME_BLOCKLIST = new Set(['rentopia', 'triplemint', 'compass real estate', 'brickunderground', 'jerry seinfeld & cosmo kramer apartment'])
const GENERIC_NAME_WORDS = new Set([
  'apartment', 'apartments', 'luxury', 'rental', 'rentals', 'leasing', 'residence', 'residences',
  'living', 'home', 'homes', 'property', 'properties', 'housing', 'nyc', 'new', 'york', 'city',
  'brooklyn', 'manhattan', 'queens', 'bronx', 'staten', 'island', 'jersey', 'hoboken',
  'lic', 'ny', 'co', 'usa', 'the', 'of', 'in', 'at',
])

function hasAgencyName(name) {
  const n = String(name || '').trim()
  if (!n) return false
  if (AGENCY_NAME_PATTERN.test(n)) return true
  if (AGENCY_NAME_BLOCKLIST.has(n.toLowerCase())) return true
  // 全通用词 = 没有专有名词的 SEO 名称
  const tokens = n.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(Boolean)
  if (tokens.length === 0) return false
  return tokens.every(t => GENERIC_NAME_WORDS.has(t))
}

/** 评分下限（低于此值丢弃） */
const MIN_RATING = 3.0
/** 评论数分层阈值：从高到低找第一层能凑够 ≥2 栋的档位 */
const REVIEW_TIERS = [20, 10, 5, 1]
/** 每区最多保留的建筑数 */
const MAX_BUILDINGS_PER_AREA = 4
/** Places 结果距社区中心的距离上限（米） */
const MAX_DISTANCE_M = 1800
/** 地理+街道名同时成立的距离上限（米） */
const GEO_STREET_MATCH_M = 150
/** 极近距离直接信任坐标（米，同楼群不同门牌号的塔楼） */
const GEO_ONLY_MATCH_M = 60
/** 街道名兜底匹配的距离上限（米） */
const STREET_FALLBACK_M = 300
/** 每建筑最多保留的房源条数（价格升序） */
const MAX_LISTINGS_PER_BUILDING = 6
/**
 * 排除的房源建筑类型
 * 注意不排除 UNKNOWN：Places 已确认该建筑是公寓楼（如 Avalon Cove 在 CSV 中被标 UNKNOWN，
 * 但其房源是真实公寓房源），UNKNOWN 只说明 StreetEasy 未分类，不代表不是公寓
 */
const BUILDING_TYPE_EXCLUDE = new Set(['HOUSE', 'TOWNHOUSE', 'COMMERCIAL'])
/** 并发查询数 */
const CONCURRENCY = 4
/** 每次请求间隔（毫秒，限速用） */
const REQUEST_DELAY_MS = 250

/** CSV 数据仓库（GitHub raw） */
const CSV_BASE_URL = 'https://raw.githubusercontent.com/benfwalla/firstmover-open-data-project/main/public/data'
const CSV_LIST_URL = 'https://api.github.com/repos/benfwalla/firstmover-open-data-project/contents/public/data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(__dirname, '..')
const CACHE_DIR = join(__dirname, '.cache')
const AREAS_FILE = join(PROJECT_ROOT, 'src', 'data', 'mock', 'livingAreas.ts')
const OUTPUT_FILE = join(PROJECT_ROOT, 'src', 'data', 'mock', 'apartments.ts')
const EXPECTED_AREA_COUNT = 170

// ============================================================
// 命令行参数
// ============================================================

const args = process.argv.slice(2)
const argMap = {}
for (const a of args) {
  const m = a.match(/^--([^=]+)=(.*)$/)
  if (m) argMap[m[1]] = m[2]
}
const onlyAreas = argMap.areas ? new Set(argMap.areas.split(',').map(s => s.trim()).filter(Boolean)) : null
const monthOverride = argMap.month || null

// ============================================================
// 工具函数
// ============================================================

/** haversine 距离（米） */
function haversineM(aLat, aLng, bLat, bLng) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** 街道缩写展开表（Places 用 "Dr S" 这类写法，CSV 用全称） */
const ABBREVIATIONS = {
  st: 'street', ave: 'avenue', blvd: 'boulevard', ln: 'lane', dr: 'drive',
  pkwy: 'parkway', pl: 'place', rd: 'road', hwy: 'highway', sq: 'square',
  ter: 'terrace', ct: 'court', plz: 'plaza',
}

/** 街道名规范化：小写、剥逗号后内容、展开缩写、去方向后缀 → 返回 {number, name} */
function normalizeStreet(raw) {
  let s = String(raw || '').toLowerCase().trim()
  s = s.replace(/,.*$/, '').trim()          // 去掉城市/州部分
  const numMatch = s.match(/^\d+[-\d]*\s*/) // 门牌号（可带连字符如 110-120）
  const number = numMatch ? numMatch[0].trim() : ''
  let rest = s.slice(numMatch ? numMatch[0].length : 0).trim()
  // 展开缩写
  rest = rest
    .split(/\s+/)
    .map(w => ABBREVIATIONS[w] || w)
    .join(' ')
  // 去方向后缀（n/s/e/w/north/south/east/west，出现在结尾时）
  rest = rest.replace(/\s+(n|s|e|w|north|south|east|west)$/, '')
  // 去掉所有空格便于比较
  return { number, name: rest.replace(/\s+/g, '') }
}

/**
 * 街道名匹配：门牌号一致（或一方无门牌号）+ 街道名互相包含
 * 例："110 River Drive" ↔ "110 River Dr S" → ✓
 */
function streetNamesMatch(aRaw, bRaw) {
  const a = normalizeStreet(aRaw)
  const b = normalizeStreet(bRaw)
  if (!a.name || !b.name) return false
  if (a.number && b.number && a.number !== b.number) return false
  return a.name.includes(b.name) || b.name.includes(a.name)
}

/** 仅街道名匹配（忽略门牌号，用于极近的同楼群塔楼） */
function streetNamesMatchIgnoreNumber(aRaw, bRaw) {
  const a = normalizeStreet(aRaw)
  const b = normalizeStreet(bRaw)
  if (!a.name || !b.name) return false
  return a.name.includes(b.name) || b.name.includes(a.name)
}

/**
 * 轻量引号感知 CSV 解析器
 * photo_ids 列含带引号的逗号，不能直接 split(',')
 */
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length < 2) throw new Error('CSV 内容为空或只有表头')
  const header = parseCsvLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const row = {}
    header.forEach((h, idx) => { row[h] = cols[idx] ?? '' })
    rows.push(row)
  }
  return { header, rows }
}

/** 解析布尔字段（CSV 里可能是 true/false/TRUE/FALSE/t/f） */
function parseBool(v) {
  return String(v).toLowerCase() === 'true' || v === 't' || v === '1'
}

/** 解析数字，非法值返回 0 */
function parseNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** 带重试与 429 指数退避的 fetch */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, options)
    if (resp.status === 429 || resp.status >= 500) {
      const wait = 1000 * 2 ** attempt
      console.warn(`  ⚠ ${resp.status}，${wait}ms 后重试 (${attempt + 1}/${retries})`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    return resp
  }
  throw new Error(`请求失败: ${url}`)
}

/** 简单并发池：控制同时进行的任务数 */
async function runPool(items, worker, concurrency = CONCURRENCY) {
  const results = new Array(items.length)
  let next = 0
  async function runner() {
    while (next < items.length) {
      const i = next++
      try { results[i] = await worker(items[i], i) }
      catch (e) { results[i] = { error: String(e && e.message || e) } }
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner))
  return results
}

// ============================================================
// 1. 解析 livingAreas.ts（截取 JSON 数组部分）
// ============================================================

function parseLivingAreas() {
  const text = readFileSync(AREAS_FILE, 'utf-8')
  const start = text.indexOf('= [')
  if (start === -1) throw new Error('livingAreas.ts 中找不到数组起始位置')
  const jsonStart = start + 2 // 跳过 "= "
  const end = text.indexOf('export const LIVING_AREA_COUNT', jsonStart)
  if (end === -1) throw new Error('livingAreas.ts 中找不到 LIVING_AREA_COUNT 标记')
  let jsonText = text.slice(jsonStart, end).trim()
  jsonText = jsonText.replace(/;\s*$/, '').replace(/,\s*$/, '')
  const areas = JSON.parse(jsonText)
  if (!Array.isArray(areas) || areas.length !== EXPECTED_AREA_COUNT) {
    throw new Error(`解析出的社区数量为 ${areas.length}，预期 ${EXPECTED_AREA_COUNT}，中止`)
  }
  return areas
}

// ============================================================
// 2. CSV 下载与解析
// ============================================================

/** 从 GitHub API 列目录拿最新月份文件名 */
async function getLatestMonth() {
  const resp = await fetchWithRetry(CSV_LIST_URL, {
    headers: { 'User-Agent': 'build-apartments-script' },
  })
  const files = await resp.json()
  if (!Array.isArray(files)) throw new Error('GitHub API 返回异常: ' + JSON.stringify(files).slice(0, 200))
  const months = files
    .map(f => f.name)
    .filter(n => /^\d{4}-\d{2}\.csv$/.test(n))
    .sort()
  if (months.length === 0) throw new Error('GitHub 目录中没有月度 CSV 文件')
  return months[months.length - 1].replace('.csv', '')
}

async function downloadCsv(month) {
  const cachePath = join(CACHE_DIR, `listings-${month}.csv`)
  if (existsSync(cachePath)) {
    console.log(`使用缓存的 CSV: ${cachePath}`)
    return readFileSync(cachePath, 'utf-8')
  }
  const url = `${CSV_BASE_URL}/${month}.csv`
  console.log(`下载 CSV: ${url}`)
  const resp = await fetchWithRetry(url)
  if (!resp.ok) throw new Error(`CSV 下载失败 (${resp.status}): ${url} — 保留旧 apartments.ts，中止`)
  const text = await resp.text()
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(cachePath, text)
  return text
}

// ============================================================
// 3. Places Text Search (New)
// ============================================================

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
  'places.rating', 'places.userRatingCount', 'places.types', 'places.primaryType',
  'places.editorialSummary',
].join(',')

/** 对单个社区发 3 个搜索词，合并去重，返回原始 places 数组 */
async function searchArea(area, borough, month) {
  // 部分社区 id 含 "/"（如 fm_fulton/seaport），替换避免被当成目录分隔符
  const safeId = area.id.replace(/[/\\]/g, '_')
  const cachePath = join(CACHE_DIR, `places-${safeId}-${month}.json`)
  if (existsSync(cachePath)) {
    console.log(`  使用缓存的 Places 结果: ${area.id}`)
    return JSON.parse(readFileSync(cachePath, 'utf-8'))
  }

  const merged = new Map() // placeId -> place
  for (const template of QUERY_TEMPLATES) {
    const textQuery = template
      .replace('{name}', area.name)
      .replace('{borough}', borough || area.neighborhood)
    const body = {
      textQuery,
      languageCode: 'en',
      pageSize: 20,
      locationBias: {
        circle: {
          center: { latitude: area.centroid[1], longitude: area.centroid[0] },
          radius: 1500,
        },
      },
    }
    const resp = await fetchWithRetry(SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const errText = await resp.text()
      throw new Error(`Places API ${resp.status}: ${errText.slice(0, 300)}`)
    }
    const data = await resp.json()
    for (const p of data.places || []) {
      if (!merged.has(p.id)) merged.set(p.id, p)
    }
  }

  const places = [...merged.values()]
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(cachePath, JSON.stringify(places))
  return places
}

// ============================================================
// 4. CSV 建筑空间索引（全 CSV，跨社区匹配）
// ============================================================

/**
 * 把全部 CSV 房源行按坐标分组为"建筑"，建立经纬度网格索引。
 * 跨社区匹配：Places 建筑的实际房源可能落在相邻 CSV 社区名下
 * （如 BLVD Collection 在 Paulus Hook，不在 Newport），所以按坐标全局匹配。
 */
function buildCsvIndex(csvRows) {
  const buildingMap = new Map() // key = 四舍五入坐标（~11m 精度）
  for (const row of csvRows) {
    const lat = parseNum(row.latitude)
    const lng = parseNum(row.longitude)
    if (!lat || !lng) continue
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`
    if (!buildingMap.has(key)) {
      buildingMap.set(key, { lat, lng, streets: new Set(), rows: [] })
    }
    const b = buildingMap.get(key)
    b.rows.push(row)
    if (row.street) b.streets.add(row.street)
  }
  const buildings = [...buildingMap.values()]

  // 网格索引：0.01° ≈ 1.1km，查询时检查 3×3 相邻格
  const buckets = new Map()
  const cellKey = (lat, lng) => `${Math.floor(lat * 100)},${Math.floor(lng * 100)}`
  buildings.forEach((b, i) => {
    const k = cellKey(b.lat, b.lng)
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k).push(i)
  })

  return {
    buildings,
    /** 查询某坐标附近 ≤maxDistM 内的建筑 */
    query(lat, lng, maxDistM) {
      const out = []
      const cl = Math.floor(lat * 100)
      const cg = Math.floor(lng * 100)
      for (let dl = -1; dl <= 1; dl++) {
        for (let dg = -1; dg <= 1; dg++) {
          const idxs = buckets.get(`${cl + dl},${cg + dg}`)
          if (!idxs) continue
          for (const i of idxs) {
            const b = buildings[i]
            if (haversineM(lat, lng, b.lat, b.lng) <= maxDistM) out.push(b)
          }
        }
      }
      return out
    },
  }
}

/** 房源行 → ApartmentListing（过滤非法值，绝不编造） */
function rowToListing(row) {
  const net = parseNum(row.net_effective_price)
  const price = parseNum(row.price)
  if (price <= 0 && net <= 0) return null
  const sqft = parseNum(row.sqft)
  return {
    bedrooms: parseNum(row.bedrooms),
    price: net > 0 ? net : price,          // 有净价用净价，否则用挂牌价
    netEffectivePrice: net > 0 ? net : null,
    sqft: sqft > 0 ? sqft : null,
    monthsFree: parseNum(row.months_free),
    noFee: parseBool(row.no_fee),
    furnished: parseBool(row.furnished),
    availableDate: row.available_date && row.available_date.trim() ? row.available_date : null,
    url: row.url || '',
  }
}

/**
 * 为单个 Places 建筑找匹配的 CSV 建筑（跨社区，全局索引）：
 * 规则 1：距离 ≤150m 且街道名匹配（门牌号一致或一方无）—— 最可靠
 * 规则 2：距离 ≤60m 且街道名匹配（忽略门牌号）—— 同楼群相邻塔楼（如 20/31 River Ct）
 * 规则 3：距离 ≤60m —— 极近直接信任坐标
 * 规则 4：距离 ≤300m 且街道名匹配 —— 坐标略偏的兜底
 */
function matchCsvBuilding(place, csvIndex) {
  if (!place.location) return null
  const pLat = place.location.latitude
  const pLng = place.location.longitude
  const cands = csvIndex
    .query(pLat, pLng, STREET_FALLBACK_M)
    .map(b => ({ b, d: haversineM(pLat, pLng, b.lat, b.lng) }))
    .sort((x, y) => x.d - y.d)

  const addr = place.formattedAddress || ''
  // 规则 1
  for (const { b, d } of cands) {
    if (d > GEO_STREET_MATCH_M) break
    if ([...b.streets].some(s => streetNamesMatch(addr, s))) return b
  }
  // 规则 2 + 3
  for (const { b, d } of cands) {
    if (d > GEO_ONLY_MATCH_M) break
    if ([...b.streets].some(s => streetNamesMatchIgnoreNumber(addr, s))) return b
  }
  for (const { b, d } of cands) {
    if (d > GEO_ONLY_MATCH_M) break
    return b
  }
  // 规则 4
  for (const { b, d } of cands) {
    if (d > STREET_FALLBACK_M) break
    if ([...b.streets].some(s => streetNamesMatch(addr, s))) return b
  }
  return null
}

// ============================================================
// 5. 筛选与选择
// ============================================================

/**
 * 是否"像公寓楼"：
 * - lodging/hotel 一律拦截
 * - 中介名字（LLC/Rentopia/全通用词）→ 拦截
 * - 有公寓类型 → 放行
 * - 无公寓类型但匹配到真实房源建筑（如 Avalon Cove 被 Google 误标 agency）→ 放行
 * - 纯服务类（primaryType = service，如物业管理办公室）→ 拦截
 */
function isAptLike(place, hasMatch) {
  const all = [place.primaryType, ...(place.types || [])].filter(Boolean)
  if (all.some(t => TYPE_ALWAYS_BLOCK.has(t))) return false
  if (place.primaryType === 'service') return false
  if (hasAgencyName(place.displayName?.text)) return false
  if (all.some(t => TYPE_WHITELIST.has(t))) return true
  return hasMatch
}

/**
 * 对单个社区的候选 places 应用筛选并选出最终 3-4 栋：
 * 优先"匹配到真实房源"的建筑；不足 2 栋时才混入无房源的建筑。
 */
function selectBuildings(enriched) {
  // 类型 + 评分过滤
  const ok = enriched.filter(
    ({ p, match }) => isAptLike(p, !!match) && (p.rating ?? 0) >= MIN_RATING
  )
  const matched = ok.filter(e => e.match)
  const unmatched = ok.filter(e => !e.match)

  // 评论数分层：优先在"有房源"池内选档；有房源 <2 栋时用全池
  const tierPool = matched.length >= 2 ? matched : ok
  let chosen = []
  for (const tier of REVIEW_TIERS) {
    chosen = tierPool.filter(e => (e.p.userRatingCount || 0) >= tier)
    if (chosen.length >= 2) break
  }
  if (chosen.length === 0) chosen = tierPool

  // 排序：评论数降序 → 评分降序
  chosen.sort(
    (a, b) => (b.p.userRatingCount || 0) - (a.p.userRatingCount || 0) || (b.p.rating || 0) - (a.p.rating || 0)
  )
  return chosen.slice(0, MAX_BUILDINGS_PER_AREA)
}

// ============================================================
// 6. 单区处理
// ============================================================

async function processArea(area, csvByNeighborhood, csvIndex, month) {
  const lowerName = area.name.toLowerCase()
  const rows = csvByNeighborhood.get(lowerName) || []
  // 从 CSV 反查 borough 用于搜索词消歧
  const borough = rows.length > 0 ? rows[0].borough : ''
  const places = await searchArea(area, borough, month)

  // 距离过滤（locationBias 是偏置不是硬限制）
  const near = places.filter(p => {
    if (!p.location) return false
    return (
      haversineM(area.centroid[1], area.centroid[0], p.location.latitude, p.location.longitude) <=
      MAX_DISTANCE_M
    )
  })

  // 每栋先匹配 CSV 建筑，再筛选
  const enriched = near.map(p => ({ p, match: matchCsvBuilding(p, csvIndex) }))
  const chosen = selectBuildings(enriched)

  const buildings = []
  for (const { p: place, match } of chosen) {
    let listings = []
    let listingCount = 0
    if (match) {
      // 过滤建筑类型 → 转 Listing → 价格升序 → 裁剪
      const usable = match.rows
        .filter(r => !BUILDING_TYPE_EXCLUDE.has(String(r.building_type || '').toUpperCase()))
        .map(rowToListing)
        .filter(Boolean)
        .sort((a, b) => a.price - b.price)
      listingCount = usable.length
      listings = usable.slice(0, MAX_LISTINGS_PER_BUILDING)
    }
    buildings.push({
      placeId: place.id,
      name: place.displayName?.text || place.id,
      rating: typeof place.rating === 'number' ? place.rating : null,
      reviewCount: place.userRatingCount || 0,
      address: place.formattedAddress || '',
      location: place.location
        ? [place.location.longitude, place.location.latitude]
        : [area.centroid[0], area.centroid[1]],
      editorialSummary: place.editorialSummary?.text || null,
      googleMapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.id}`,
      listings,
      listingCount,
    })
  }
  return { areaId: area.id, buildings }
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  console.log('========== build-apartments ==========')
  mkdirSync(CACHE_DIR, { recursive: true })

  // 1. 解析 livingAreas.ts
  const areas = parseLivingAreas()
  console.log(`✓ 解析出 ${areas.length} 个社区`)
  const targetAreas = onlyAreas ? areas.filter(a => onlyAreas.has(a.id)) : areas
  if (onlyAreas) console.log(`  仅处理指定社区: ${[...onlyAreas].join(', ')} (${targetAreas.length} 个)`)

  // 2. 下载并解析 CSV
  const month = monthOverride || await getLatestMonth()
  console.log(`使用月份: ${month}`)
  const csvText = await downloadCsv(month)
  const { rows: csvRows } = parseCsv(csvText)
  console.log(`✓ CSV 共 ${csvRows.length} 行房源`)

  // 按 neighborhood 建索引（大小写不敏感；只用于 borough 反查）
  const csvByNeighborhood = new Map()
  for (const row of csvRows) {
    const key = String(row.neighborhood || '').toLowerCase().trim()
    if (!key) continue
    if (!csvByNeighborhood.has(key)) csvByNeighborhood.set(key, [])
    csvByNeighborhood.get(key).push(row)
  }

  // 全 CSV 建筑空间索引（跨社区匹配用）
  const csvIndex = buildCsvIndex(csvRows)
  console.log(`✓ 全 CSV 共 ${csvIndex.buildings.length} 栋建筑（坐标分组）`)

  // 3. 并发处理各区
  const totalQueries = targetAreas.length * QUERY_TEMPLATES.length
  console.log(`开始查询 ${targetAreas.length} 个社区 × ${QUERY_TEMPLATES.length} 词 = ${totalQueries} 次 Text Search`)
  console.log(`（费用：免费额度 1000 次/月内，本次预计 $0）\n`)

  const results = await runPool(targetAreas, async (area) => {
    try {
      return await processArea(area, csvByNeighborhood, csvIndex, month)
    } catch (e) {
      console.error(`✗ ${area.id} (${area.name}) 失败: ${e.message || e}`)
      return { areaId: area.id, buildings: [], error: String(e.message || e) }
    }
  })

  // 4. 汇总
  const buildingsMap = {}
  let totalBuildings = 0
  let withListings = 0
  const failedAreas = []
  for (const r of results) {
    buildingsMap[r.areaId] = r.buildings || []
    totalBuildings += (r.buildings || []).length
    withListings += (r.buildings || []).filter(b => b.listings.length > 0).length
    if (r.error) failedAreas.push(r.areaId)
  }

  // 5. 写输出文件
  const dataFile = {
    generatedAt: new Date().toISOString(),
    csvMonth: month,
    sourceCsvUrl: `${CSV_BASE_URL}/${month}.csv`,
    buildings: buildingsMap,
  }
  const tsContent = `// 本文件由 scripts/build-apartments.mjs 自动生成 — 请勿手动修改
// 数据来源：Google Places API（建筑信息） + firstmovernyc.com/open-data（真实房源，${month}）
// 重新生成：npm run build:apartments
import type { ApartmentDataFile } from '../types'

export const apartmentData: ApartmentDataFile = ${JSON.stringify(dataFile, null, 2)}
`
  writeFileSync(OUTPUT_FILE, tsContent)
  const sizeKb = Math.round(tsContent.length / 1024)
  console.log(`\n✓ 已生成 ${OUTPUT_FILE} (${sizeKb} KB)`)

  // 6. 报告
  console.log('\n========== 报告 ==========')
  console.log(`覆盖社区数: ${targetAreas.length}`)
  console.log(`公寓建筑总数: ${totalBuildings}`)
  console.log(`匹配到真实房源的建筑数: ${withListings}`)
  const emptyAreas = Object.entries(buildingsMap).filter(([, bs]) => bs.length === 0).map(([id]) => id)
  if (emptyAreas.length > 0) console.log(`无结果的社区 (${emptyAreas.length}): ${emptyAreas.join(', ')}`)
  if (failedAreas.length > 0) {
    console.error(`失败社区 (${failedAreas.length}): ${failedAreas.join(', ')}`)
    process.exitCode = 1
  } else {
    console.log('无失败社区 ✓')
  }
  console.log('==========================')
}

main().catch(e => {
  console.error('脚本中止:', e)
  process.exitCode = 1
})
