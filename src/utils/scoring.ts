import { livingAreas } from '../data/mock/livingAreas'

interface ScoreResult {
  name: string; id: string; scores: Record<string, number>
  weightedTotal: number; rank: number
}

// Tier lookup
const TIERS = [
  { max: 0.05, winner: 50, loser: 50 },
  { max: 0.15, winner: 60, loser: 40 },
  { max: 0.30, winner: 75, loser: 25 },
  { max: 0.50, winner: 90, loser: 10 },
  { max: Infinity, winner: 100, loser: 0 },
]

/**
 * Compute tiered score from a single diff value.
 * diff > 0 means A is better. We use |diff| to find tier.
 */
function tieredScore(diff: number): { a: number; b: number } {
  const abs = Math.abs(diff)
  for (const t of TIERS) {
    if (abs < t.max) {
      return diff >= 0 ? { a: t.winner, b: t.loser } : { a: t.loser, b: t.winner }
    }
  }
  return diff >= 0 ? { a: 100, b: 0 } : { a: 0, b: 100 }
}

/** Single metric diff: (A - B) / max(A, B), sign flips for lowerBetter */
function singleDiff(va: number, vb: number, lowerBetter: boolean): number {
  const denom = Math.max(va, vb, 1)
  if (lowerBetter) return (vb - va) / denom
  return (va - vb) / denom
}

// Sub-metric definition
interface SubDef { get: (x: any) => number; weight: number; lowerBetter?: boolean }
interface CharDef { subs: SubDef[]; label: string }

const CHARS: Record<string, CharDef> = {
  affordable: {
    label: 'Affordable Living',
    subs: [{ get: (x: any) => x.metrics.rentByBedroom.oneBr, weight: 100, lowerBetter: true }],
  },
  dining: {
    label: 'Dining & Entertainment',
    subs: [
      { get: (x: any) => x.metrics.restaurantCount || 0, weight: 25 },
      { get: (x: any) => (x.metrics as any).cafeCount || 0, weight: 25 },
      { get: (x: any) => x.metrics.barCount || 0, weight: 25 },
      { get: (x: any) => (x.metrics as any).mallCount || 0, weight: 25 },
    ],
  },
  convenience: {
    label: 'Daily Convenience',
    subs: [
      { get: (x: any) => x.metrics.supermarketCount || 0, weight: 50 },
      { get: (x: any) => (x.metrics as any).pharmacyCount || 0, weight: 30 },
      { get: (x: any) => (x.metrics as any).mallCount || 0, weight: 20 },
    ],
  },
  commute: {
    label: 'Easy Commute',
    subs: [
      { get: (x: any) => x.metrics.commuteTime || 30, weight: 100, lowerBetter: true },
    ],
  },
  safety: {
    label: 'Safety',
    subs: [{ get: (x: any) => x.metrics.crimeRate || 0, weight: 100, lowerBetter: true }],
  },
  fitness: {
    label: 'Fitness & Wellness',
    subs: [
      { get: (x: any) => (x.metrics as any).gymCount || 0, weight: 70 },
      { get: (x: any) => (x.metrics as any).pharmacyCount || 0, weight: 30 },
    ],
  },
  family: {
    label: 'Family Friendly',
    subs: [
      { get: (x: any) => x.metrics.crimeRate || 0, weight: 40, lowerBetter: true },
      { get: (x: any) => x.demographics?.under20 || 0, weight: 25 },
      { get: (x: any) => x.metrics.supermarketCount || 0, weight: 20 },
      { get: (x: any) => (x.metrics as any).pharmacyCount || 0, weight: 15 },
    ],
  },
  young: {
    label: 'Young & Social',
    subs: [
      { get: (x: any) => (x.demographics?.['20to29'] || 0) + (x.demographics?.['30to39'] || 0), weight: 70 },
      { get: (x: any) => x.metrics.barCount || 0, weight: 15 },
      { get: (x: any) => (x.metrics as any).cafeCount || 0, weight: 15 },
    ],
  },
  diverse: {
    label: 'Diverse Community',
    subs: [{
      get: (x: any) => {
        const d = x.demographics || {}
        const groups = [d.white || 0, d.black || 0, d.asian || 0, d.twoOrMore || 0, d.other || 0]
        const t = Math.max(groups.reduce((s: number, v: number) => s + v, 0), 1)
        return groups.reduce((s: number, v: number) => { const p = v / t; return s - (p > 0 ? p * Math.log(p) : 0) }, 0)
      },
      weight: 100,
    }],
  },
  quiet: {
    label: 'Quiet Living',
    subs: [
      { get: (x: any) => x.metrics.barCount || 0, weight: 40, lowerBetter: true },
      { get: (x: any) => x.metrics.crimeRate || 0, weight: 30, lowerBetter: true },
      { get: (x: any) => (x.metrics.restaurantCount || 0) + (x.metrics.barCount || 0), weight: 30, lowerBetter: true },
    ],
  },
}

/**
 * Easy Commute 专用 pairwise 得分（基于用户通勤时间上限 + 交通方式）
 */
function commutePairScore(
  aTime: number, bTime: number, commuteMax: number,
  aSupportsMode: boolean, bSupportsMode: boolean,
): { a: number; b: number } {
  const aIn = aTime <= commuteMax
  const bIn = bTime <= commuteMax
  const gap = Math.abs(aTime - bTime) / Math.max(aTime, bTime, 1)

  let base: { a: number; b: number }

  if (aIn && bIn) {
    // 两个都在通勤范围内 → 较快的略优，分差受限
    const faster = aTime <= bTime ? 'a' : 'b'
    let tier: [number, number]
    if (gap < 0.10) tier = [50, 50]
    else if (gap < 0.20) tier = [52, 48]
    else if (gap < 0.30) tier = [55, 45]
    else tier = [58, 42]
    base = faster === 'a' ? { a: tier[0], b: tier[1] } : { a: tier[1], b: tier[0] }

    // 交通方式加成（最多移动 3 分，且不超过 60/40）
    if (aSupportsMode && !bSupportsMode) {
      base = { a: Math.min(base.a + 3, 60), b: Math.max(base.b - 3, 40) }
    } else if (!aSupportsMode && bSupportsMode) {
      base = { a: Math.max(base.a - 3, 40), b: Math.min(base.b + 3, 60) }
    }
    return base
  }

  if (aIn && !bIn) {
    // A 在范围内，B 超出
    const exceed = (bTime - commuteMax) / commuteMax
    let tier: [number, number]
    if (exceed <= 0.10) tier = [60, 40]
    else if (exceed <= 0.20) tier = [70, 30]
    else if (exceed <= 0.40) tier = [80, 20]
    else tier = [90, 10]
    return { a: tier[0], b: tier[1] }
  }

  if (!aIn && bIn) {
    // B 在范围内，A 超出
    const exceed = (aTime - commuteMax) / commuteMax
    let tier: [number, number]
    if (exceed <= 0.10) tier = [40, 60]
    else if (exceed <= 0.20) tier = [30, 70]
    else if (exceed <= 0.40) tier = [20, 80]
    else tier = [10, 90]
    return { a: tier[0], b: tier[1] }
  }

  // 两个都超出 → 更短的获胜
  const faster = aTime <= bTime ? 'a' : 'b'
  let tier: [number, number]
  if (gap < 0.10) tier = [50, 50]
  else if (gap < 0.20) tier = [55, 45]
  else if (gap < 0.30) tier = [60, 40]
  else tier = [70, 30]
  return faster === 'a' ? { a: tier[0], b: tier[1] } : { a: tier[1], b: tier[0] }
}

const WEIGHTS = [40, 30, 20, 10]

/**
 * Affordable Living 专用 pairwise 得分（基于用户预算范围）
 */
function affordablePairScore(aRent: number, bRent: number, _rentMin: number, rentMax: number): { a: number; b: number } {
  const aIn = aRent <= rentMax        // 低于最低预算也算满足
  const bIn = bRent <= rentMax
  const gap = Math.abs(aRent - bRent) / Math.max(aRent, bRent, 1)

  if (aIn && bIn) {
    // 两个都在预算范围内 → 便宜的略优，分差受限
    const cheaper = aRent <= bRent ? 'a' : 'b'
    let tier: [number, number]
    if (gap < 0.10) tier = [50, 50]
    else if (gap < 0.20) tier = [52, 48]
    else if (gap < 0.30) tier = [55, 45]
    else tier = [58, 42]
    return cheaper === 'a' ? { a: tier[0], b: tier[1] } : { a: tier[1], b: tier[0] }
  }

  if (aIn && !bIn) {
    // A 在范围内，B 超出
    const exceed = (bRent - rentMax) / rentMax
    let tier: [number, number]
    if (exceed <= 0.05) tier = [60, 40]
    else if (exceed <= 0.10) tier = [70, 30]
    else if (exceed <= 0.20) tier = [80, 20]
    else tier = [90, 10]
    return { a: tier[0], b: tier[1] }
  }

  if (!aIn && bIn) {
    // B 在范围内，A 超出
    const exceed = (aRent - rentMax) / rentMax
    let tier: [number, number]
    if (exceed <= 0.05) tier = [40, 60]
    else if (exceed <= 0.10) tier = [30, 70]
    else if (exceed <= 0.20) tier = [20, 80]
    else tier = [10, 90]
    return { a: tier[0], b: tier[1] }
  }

  // 两个都超出 → 更便宜的（离预算上限更近的）获胜
  const cheaper = aRent <= bRent ? 'a' : 'b'
  let tier: [number, number]
  if (gap < 0.05) tier = [50, 50]
  else if (gap < 0.10) tier = [55, 45]
  else if (gap < 0.20) tier = [60, 40]
  else tier = [70, 30]
  return cheaper === 'a' ? { a: tier[0], b: tier[1] } : { a: tier[1], b: tier[0] }
}

export function computeCharacteristicScores(
  areaIds: string[],
  priorities: string[],
  rentMin = 2000,
  rentMax = 5000,
  commuteMax = 30,
  commuteMode = 'subway',
  commuteCache: Record<string, number> = {},
): ScoreResult[] {
  const areas = areaIds.map(id => livingAreas.find(a => a.id === id)).filter(Boolean) as any[]
  if (areas.length < 2) return []

  // 判断某区域是否支持指定通勤方式
  const supportsMode = (area: any) => {
    if (commuteMode === 'subway') return (area.metrics.subwayStations || 0) > 0
    if (commuteMode === 'bus') return (area.metrics.busRoutes || 0) > 0
    return true  // driving / walk always supported
  }

  // 获取通勤时间（优先用 Google API 真实数据）
  const getCommute = (area: any) => commuteCache[area.id] || area.metrics.commuteTime || 30

  const n = areas.length
  const validP = priorities.filter(p => CHARS[p])
  const totalW = validP.reduce((s, _, i) => s + (WEIGHTS[i] || 10), 0)

  // 初始化每个区域的得分表
  const scores: Record<string, Record<string, number[]>> = {}
  for (const area of areas) { scores[area.id] = {} }

  // 对每一对区域做 pairwise 对比
  for (const key of validP) {
    // Affordable Living 使用自定义预算匹配逻辑
    if (key === 'affordable') {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = areas[i]; const b = areas[j]
          const aRent = a.metrics.rentByBedroom.oneBr
          const bRent = b.metrics.rentByBedroom.oneBr
          const { a: sa, b: sb } = affordablePairScore(aRent, bRent, rentMin, rentMax)
          if (!scores[a.id][key]) scores[a.id][key] = []
          if (!scores[b.id][key]) scores[b.id][key] = []
          scores[a.id][key].push(sa)
          scores[b.id][key].push(sb)
        }
      }
      continue
    }

    // Easy Commute 使用自定义通勤匹配逻辑
    if (key === 'commute') {
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = areas[i]; const b = areas[j]
          const aTime = getCommute(a)
          const bTime = getCommute(b)
          const aSupports = supportsMode(a)
          const bSupports = supportsMode(b)
          const { a: sa, b: sb } = commutePairScore(aTime, bTime, commuteMax, aSupports, bSupports)
          if (!scores[a.id][key]) scores[a.id][key] = []
          if (!scores[b.id][key]) scores[b.id][key] = []
          scores[a.id][key].push(sa)
          scores[b.id][key].push(sb)
        }
      }
      continue
    }

    const cfg = CHARS[key]

    // 对每对 (i, j) 计算 diff
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = areas[i]; const b = areas[j]
        let totalDiff = 0; let totalWeight = 0
        for (const sub of cfg.subs) {
          const va = sub.get(a); const vb = sub.get(b)
          totalDiff += singleDiff(va, vb, sub.lowerBetter || false) * sub.weight
          totalWeight += sub.weight
        }
        const avgDiff = totalDiff / totalWeight
        const { a: sa, b: sb } = tieredScore(avgDiff)
        if (!scores[a.id][key]) scores[a.id][key] = []
        if (!scores[b.id][key]) scores[b.id][key] = []
        scores[a.id][key].push(sa)
        scores[b.id][key].push(sb)
      }
    }
  }

  // 每个区域在每个优先级上取 pairwise 平均
  const finalScores: Record<string, Record<string, number>> = {}
  for (const area of areas) {
    finalScores[area.id] = {}
    for (const key of validP) {
      const vals = scores[area.id][key] || []
      finalScores[area.id][key] = vals.length > 0
        ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
        : 50
    }
  }

  // Weighted total
  for (const area of areas) {
    let wt = 0
    validP.forEach((key, i) => {
      wt += (finalScores[area.id][key] || 50) * (WEIGHTS[i] || 10)
    })
    area._weighted = Math.round(wt / totalW)
  }

  const mkRaw = (area: any) => ({
    _rent: area.metrics.rentByBedroom.oneBr,
    _restaurants: area.metrics.restaurantCount || 0,
    _cafes: (area.metrics as any).cafeCount || 0,
    _bars: area.metrics.barCount || 0,
    _supermarkets: area.metrics.supermarketCount || 0,
    _pharmacies: (area.metrics as any).pharmacyCount || 0,
    _malls: (area.metrics as any).mallCount || 0,
    _gyms: (area.metrics as any).gymCount || 0,
    _subway: area.metrics.subwayStations || 0,
    _bus: area.metrics.busRoutes || 0,
    _commuteTime: area.metrics.commuteTime || 30,
    _crime: area.metrics.crimeRate || 0,
    _under20: area.demographics?.under20 || 0,
    _young: (area.demographics?.['20to29'] || 0) + (area.demographics?.['30to39'] || 0),
    _white: area.demographics?.white || 0,
    _black: area.demographics?.black || 0,
    _asian: area.demographics?.asian || 0,
  })

  return areas
    .map((area, i) => ({
      name: area.name, id: area.id, scores: finalScores[area.id],
      weightedTotal: area._weighted, rank: i + 1, ...mkRaw(area),
    }))
    .sort((x, y) => y.weightedTotal - x.weightedTotal)
}

export function getCharacteristicLabel(key: string): string {
  return CHARS[key]?.label || key
}
