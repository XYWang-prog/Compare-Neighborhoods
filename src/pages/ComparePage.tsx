import { useMemo, useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { livingAreas } from '../data/mock/livingAreas'
import { apartmentData } from '../data/mock/apartments'

import { analyzeCharacteristics } from '../utils/ai'
import { computeCharacteristicScores } from '../utils/scoring'
import { fetchCommuteTimes } from '../data/constants'
import CompareMapView from '../components/map/CompareMapView'

/** SVG 租金曲线图 */
function RentLineChart({ data, minVal, range, monthLabel }: {
  data: { month: string; value: number }[]
  minVal: number
  range: number
  monthLabel: (m: string) => string
}) {
  const W = 720; const H = 160; const PAD = { top: 20, right: 16, bottom: 20, left: 40 }
  const iw = W - PAD.left - PAD.right; const ih = H - PAD.top - PAD.bottom
  const n = data.length

  // 坐标映射
  const x = (i: number) => PAD.left + (i / (n - 1)) * iw
  const y = (v: number) => PAD.top + ih - ((v - minVal) / (range || 1)) * ih

  // 折线路径
  const lineD = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  // 面积填充路径
  const areaD = lineD + ` L ${x(n - 1).toFixed(1)} ${H - PAD.bottom} L ${x(0).toFixed(1)} ${H - PAD.bottom} Z`

  // Y轴刻度
  const yTicks = [minVal, minVal + range / 2, minVal + range]
  // X轴标签（隔一个显示避免拥挤）
  const showLabel = (i: number) => n <= 12 ? i % 2 === 0 : true

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  return (
    <div className="mb-4 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 400 }}>
        {/* 网格线 */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="text-[9px] fill-gray-400">${Math.round(v).toLocaleString()}</text>
          </g>
        ))}

        {/* 面积填充 */}
        <path d={areaD} fill="url(#rentGradient)" />

        {/* 折线 */}
        <path d={lineD} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* 数据点 */}
        {data.map((p, i) => {
          const isCurrent = i === n - 1
          return (
            <g key={i} onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}>
              <circle
                cx={x(i)} cy={y(p.value)} r={isCurrent ? 4 : hoverIdx === i ? 3.5 : 2.5}
                fill={isCurrent ? '#2563eb' : '#fff'}
                stroke={isCurrent ? '#fff' : '#2563eb'}
                strokeWidth={isCurrent ? 2 : 1.5}
                className="transition-all cursor-pointer"
              />
              {/* 悬停提示 — 智能避让边界 */}
              {hoverIdx === i && (
                <g>
                  <rect
                    x={Math.max(2, Math.min(x(i) - 36, W - 74))}
                    y={y(p.value) < 36 ? y(p.value) + 8 : y(p.value) - 28}
                    width={72} height={18} rx={4} fill="#1e293b"
                  />
                  <text
                    x={Math.max(38, Math.min(x(i), W - 38))}
                    y={y(p.value) < 36 ? y(p.value) + 21 : y(p.value) - 15}
                    textAnchor="middle" className="text-[10px] fill-white font-medium"
                  >
                    ${p.value.toLocaleString()}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* X轴标签 */}
        {data.map((p, i) => (
          showLabel(i) ? (
            <text key={i} x={x(i)} y={H - 4} textAnchor="middle" className="text-[9px] fill-gray-400">
              {monthLabel(p.month)}
            </text>
          ) : null
        ))}

        {/* 渐变定义 */}
        <defs>
          <linearGradient id="rentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

/** 优势对比小表格 — 只展示优胜社区领先的指标 */
function ComparisonTable({ title, rows }: { title: string; rows: { metric: string; winnerVal: string; loserVal: string; diff: string }[] }) {
  if (!rows || rows.length === 0) return null
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs">
      <div className="text-gray-500 font-medium mb-2">{title}</div>
      <table className="w-full">
        <thead>
          <tr className="text-gray-400 border-b border-gray-200">
            <th className="text-left py-1 font-normal">Metric</th>
            <th className="text-right py-1 font-normal">Winner</th>
            <th className="text-right py-1 font-normal">vs Other</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, j) => (
            <tr key={j} className="border-b border-gray-100 last:border-0">
              <td className="py-1.5 text-gray-600">{r.metric}</td>
              <td className="py-1.5 text-right text-gray-800 font-medium">{r.winnerVal} ✓</td>
              <td className="py-1.5 text-right text-gray-500">{r.loserVal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-gray-600 text-[11px] mt-1.5 font-medium">
        {rows.map(r => r.diff).join(' · ')}
      </div>
    </div>
  )
}

/**
 * 根据指标名解析出「每个社区取什么真实数据 + 怎么格式化」。
 * 指标名来自 AI 表格 / 优势行（如 "1BR Rent"、"Restaurants"、"Crime Rate"），
 * 解析失败返回 null，调用方跳过该行（不编造数据）。
 */
function resolveMetric(name: string): {
  get: (a: any, commuteCache: Record<string, number>) => number
  fmt: (v: number) => string
  higherBetter: boolean
} | null {
  const n = name.toLowerCase()
  const m = (a: any) => a.metrics || {}
  if (n.includes('rent')) {
    if (n.includes('studio')) {
      return { get: a => m(a).rentByBedroom?.studio || 0, fmt: v => `$${Math.round(v).toLocaleString()}/mo`, higherBetter: false }
    }
    if (n.includes('2br') || n.includes('two')) {
      return { get: a => m(a).rentByBedroom?.twoBr || 0, fmt: v => `$${Math.round(v).toLocaleString()}/mo`, higherBetter: false }
    }
    return { get: a => m(a).rentByBedroom?.oneBr || 0, fmt: v => `$${Math.round(v).toLocaleString()}/mo`, higherBetter: false }
  }
  if (n.includes('commute')) {
    return { get: (a, cc) => cc[a.id] || m(a).commuteTime || 30, fmt: v => `${v}min`, higherBetter: false }
  }
  if (n.includes('crime')) {
    return { get: a => m(a).crimeRate || 0, fmt: v => `${v}/1K`, higherBetter: false }
  }
  if (n.includes('restaurant')) return { get: a => m(a).restaurantCount || 0, fmt: v => `${v}`, higherBetter: true }
  if (n.includes('cafe')) return { get: a => m(a).cafeCount || 0, fmt: v => `${v}`, higherBetter: true }
  if (n.includes('bar')) return { get: a => m(a).barCount || 0, fmt: v => `${v}`, higherBetter: true }
  if (n.includes('supermarket')) return { get: a => m(a).supermarketCount || 0, fmt: v => `${v}`, higherBetter: true }
  if (n.includes('pharmac')) return { get: a => m(a).pharmacyCount || 0, fmt: v => `${v}`, higherBetter: true }
  if (n.includes('mall')) return { get: a => m(a).mallCount || 0, fmt: v => `${v}`, higherBetter: true }
  if (n.includes('gym')) return { get: a => m(a).gymCount || 0, fmt: v => `${v}`, higherBetter: true }
  if (n.includes('under')) return { get: a => a.demographics?.under20 || 0, fmt: v => `${v}%`, higherBetter: true }
  return null
}

/**
 * 三向对比表 — 用真实数据展示三个社区在每个指标上的值。
 * 被推荐社区严格最优时标绿（并列不算优势）。
 * 所有行都无法解析出真实数据时返回 null。
 */
function ThreeWayTable({ title, rows, areas, winnerName, commuteCache }: {
  title: string
  rows: { metric: string }[]
  areas: any[]
  winnerName: string
  commuteCache: Record<string, number>
}) {
  // 解析出能取到真实数据的行（解析失败的行跳过，不编造）
  const resolved = rows
    .map(r => ({ metric: r.metric, res: resolveMetric(r.metric) }))
    .filter((x): x is { metric: string; res: NonNullable<ReturnType<typeof resolveMetric>> } => x.res !== null)
  if (resolved.length === 0) return null

  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs mb-4">
      <div className="text-gray-500 font-medium mb-2">{title}</div>
      <table className="w-full">
        <thead>
          <tr className="text-gray-400 border-b border-gray-200">
            <th className="text-left py-1 font-normal">Metric</th>
            {areas.map((a: any) => (
              <th key={a.name} className="text-right py-1 font-normal">
                {a.name}{a.name === winnerName ? ' ✓' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resolved.map(({ metric, res }, j) => (
            <tr key={j} className="border-b border-gray-100 last:border-0">
              <td className="py-1.5 text-gray-600">{metric}</td>
              {areas.map((a: any) => (
                <td key={a.name} className="py-1.5 text-right text-gray-500">
                  {res.fmt(res.get(a, commuteCache))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ComparePage() {
  const [params] = useSearchParams()
  const areaA = useMemo(() => livingAreas.find(a => a.id === params.get('areaA')), [params])
  const areaB = useMemo(() => livingAreas.find(a => a.id === params.get('areaB')), [params])
  const areaC = useMemo(() => params.get('areaC') ? livingAreas.find(a => a.id === params.get('areaC')) : undefined, [params])
  const [venueType, setVenueType] = useState<string | null>(null)
  const [viewTab, setViewTab] = useState<'howto' | 'data' | 'selling'>('howto')
  const priorities = params.get('priorities')?.split(',').filter(Boolean) || []
  const aptType = params.get('aptType') || '1br'
  const rentMin = parseInt(params.get('rentMin') || '') || 2000
  const rentMax = parseInt(params.get('rentMax') || '') || 5000
  const commuteDest = params.get('commuteDest') || ''
  const workLat = parseFloat(params.get('workLat') || '')
  const workLng = parseFloat(params.get('workLng') || '')
  const commuteMode = params.get('commuteMode') || 'subway'
  const commuteTime = parseInt(params.get('commuteTime') || '') || 30
  const workCoords: [number, number] | null = (!isNaN(workLat) && !isNaN(workLng)) ? [workLng, workLat] : null

  // 返回偏好页的链接 — 把已选的区域和偏好参数原样带回，避免重新填写
  const backUrl = useMemo(() => {
    let url = `/preferences?areaA=${areaA?.id || ''}&areaB=${areaB?.id || ''}`
    if (areaC) url += `&areaC=${areaC.id}`
    url += `&rentMin=${rentMin}&rentMax=${rentMax}&aptType=${aptType}&commuteTime=${commuteTime}&commuteMode=${commuteMode}`
    if (commuteDest) url += `&commuteDest=${encodeURIComponent(commuteDest)}`
    if (workCoords) url += `&workLat=${workCoords[1]}&workLng=${workCoords[0]}`
    if (priorities.length > 0) url += `&priorities=${priorities.join(',')}`
    return url
  }, [areaA?.id, areaB?.id, areaC?.id, rentMin, rentMax, aptType, commuteTime, commuteMode, commuteDest, workCoords?.join(','), priorities.join(',')])

  const [charAnalysis, setCharAnalysis] = useState<{ winner: string; matchScore: number; howToChoose: { title: string; paragraphs: string[]; tables: { title: string; metrics: { name: string; recommended: string | number; other: string | number }[] }[] } | null; priorities: { key: string; label: string; highlight: string; comparison: string; explanation: string; data: { name: string; value: string }[]; advantageRows: { metric: string; winnerVal: string; loserVal: string; diff: string }[] }[] } | null>(null)
  const [charLoading, setCharLoading] = useState(false)

  // 真实通勤时间缓存
  const [commuteCache, setCommuteCache] = useState<Record<string, number>>({})

  // Compute scores + AI analysis for Characteristics tab
  useEffect(() => {
    if (!areaA || !areaB || priorities.length === 0) return
    setCharLoading(true)
    const ids = [areaA.id, areaB.id, ...(areaC ? [areaC.id] : [])]
    const results = computeCharacteristicScores(ids, priorities, rentMin, rentMax, commuteTime, commuteMode, commuteCache)
    analyzeCharacteristics(results, priorities, aptType, commuteCache, commuteDest).then(t => { setCharAnalysis(t); setCharLoading(false) })
  }, [areaA?.id, areaB?.id, areaC?.id, priorities.join(','), JSON.stringify(commuteCache)])

  // 真实通勤时间获取
  useEffect(() => {
    if (!workCoords) return
    const raw = areaC ? [areaA, areaB, areaC] : [areaA, areaB]
    const centroids = raw.map((a: any) => ({
      id: a.id,
      lng: a.centroid[0],
      lat: a.centroid[1],
    }))
    fetchCommuteTimes(workCoords, centroids, commuteMode).then(setCommuteCache)
  }, [workCoords?.join(','), areaA?.id, areaB?.id, areaC?.id, commuteMode])

  if (!areaA || !areaB) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
        <p className="text-gray-500">Invalid neighborhoods selected.</p>
        <Link to="/" className="text-blue-600 hover:underline">← Go back</Link>
      </div>
    )
  }

  const areas = areaC ? [areaA, areaB, areaC] : [areaA, areaB]
  const isThreeWay = !!areaC
  // 被推荐社区对象（AI 分析完成后才存在，Data 标签与三向对比表共用）
  const winnerAreaObj = (charAnalysis ? areas.find(a => a.name === charAnalysis.winner) : undefined) as any

  const venueTypes = [
    { type: 'restaurant' as const, label: 'Restaurants' },
    { type: 'cafe' as const, label: 'Cafes' },
    { type: 'bar' as const, label: 'Bars' },
    { type: 'supermarket' as const, label: 'Supermarkets' },
    { type: 'gym' as const, label: 'Gyms' },
    { type: 'pharmacy' as const, label: 'Pharmacies' },
    { type: 'subway' as const, label: 'Subway' },
    { type: 'mall' as const, label: 'Malls' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-6">
        <Link to={backUrl} className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>
        <h1 className="text-lg font-bold text-gray-900">
          {areas.map((a: any, i: number) => (
            <span key={i}>{i > 0 && <span className="text-gray-400 mx-2">vs</span>}{a.name}</span>
          ))}
        </h1>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        <div className="h-[55vh] bg-gray-100 rounded-xl overflow-hidden mb-6">
          <CompareMapView areaA={areaA} areaB={areaB} areaC={areaC} venueType={venueType} />
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {venueTypes.map(v => (
            <button key={v.type} onClick={() => setVenueType(venueType === v.type ? null : v.type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${venueType === v.type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          {(['howto', 'data', 'selling'] as const).map(tab => (
            <button key={tab} onClick={() => setViewTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {tab === 'howto' ? '💡 How to Choose' : tab === 'data' ? '📊 Data' : '🔍 Explore Your Match'}
            </button>
          ))}
        </div>

        {/* HOW TO CHOOSE */}
        {viewTab === 'howto' && (
          <>
            {/* 用户偏好摘要 — 户型 + 预算 + 通勤 + 社区特征优先级 */}
            {priorities.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2 text-center">Your Preferences</p>
                {/* 第一行：户型 + 预算 + 通勤 */}
                <div className="flex justify-center gap-2 flex-wrap mb-2">
                  {/* 户型 */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs text-gray-500 border border-gray-300">
                    🛏️ {aptType === 'studio' ? 'Studio' : aptType === '2br' ? '2BR' : '1BR'}
                  </span>
                  {/* 租金范围 */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs text-gray-500 border border-gray-300">
                    💰 ${rentMin.toLocaleString()}–${rentMax.toLocaleString()}/mo
                  </span>
                  {/* 通勤上限 + 方式 + 目的地 */}
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs text-gray-500 border border-gray-300">
                    ⏱ ≤{commuteTime} min by {({ subway: 'Subway', bus: 'Bus', driving: 'Drive', walk: 'Walk' } as Record<string, string>)[commuteMode] || 'Subway'}
                    {commuteDest ? ` to ${commuteDest.length > 25 ? commuteDest.slice(0, 25) + '...' : commuteDest}` : ''}
                  </span>
                </div>
                {/* 第二行：社区特征优先级（AI 分析完成后显示标签） */}
                {charAnalysis && charAnalysis.priorities.length > 0 && (
                  <div className="flex justify-center gap-2 flex-wrap">
                    {charAnalysis.priorities.map((p, i) => (
                      <span key={p.key} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs text-gray-500 border border-gray-300">
                        <span className="text-gray-400 text-[10px]">P{i + 1}</span>
                        {p.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {priorities.length > 0 && charLoading && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center mb-6">
                <p className="text-sm text-gray-400">Analyzing your priorities...</p>
              </div>
            )}
            {priorities.length > 0 && !charLoading && charAnalysis && charAnalysis.priorities && (
              <>

                {/* Recommendation header */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 text-center">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Recommendation</p>
                  <p className="text-2xl font-bold text-gray-900">Choose {charAnalysis.winner}</p>
                </div>

                {/* How to Choose — AI-generated paragraphs + tables interleaved */}
                {charAnalysis.howToChoose && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                    {charAnalysis.howToChoose.paragraphs.map((para: any, i: number) => (
                      <div key={i}>
                        <p className="text-sm text-gray-800 leading-relaxed mb-4">{typeof para === 'string' ? para : (para?.text || para?.content || para?.paragraph || JSON.stringify(para))}</p>
                        {/* Insert table after paragraph i if one exists at that position */}
                        {/* 三向对比：用真实数据渲染三列（三个社区都显示）；两向保持 AI 原表 */}
                        {charAnalysis.howToChoose!.tables[i] && (
                          isThreeWay ? (
                            ThreeWayTable({
                              title: charAnalysis.howToChoose!.tables[i].title,
                              rows: charAnalysis.howToChoose!.tables[i].metrics.map((m: any) => ({ metric: String(m.name) })),
                              areas, winnerName: charAnalysis.winner, commuteCache,
                            }) || (
                              /* 指标名无法解析出真实数据时，退回原来的两列 AI 表格 */
                              <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs mb-4">
                                <div className="text-gray-500 font-medium mb-2">{charAnalysis.howToChoose!.tables[i].title}</div>
                                <table className="w-full">
                                  <thead>
                                    <tr className="text-gray-400 border-b border-gray-200">
                                      <th className="text-left py-1 font-normal">Metric</th>
                                      <th className="text-right py-1 font-normal">{charAnalysis.winner}</th>
                                      <th className="text-right py-1 font-normal">vs Others</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {charAnalysis.howToChoose!.tables[i].metrics.map((m, j) => (
                                      <tr key={j} className="border-b border-gray-100 last:border-0">
                                        <td className="py-1.5 text-gray-600">{m.name}</td>
                                        <td className="py-1.5 text-right text-gray-800 font-medium">{typeof m.recommended === 'number' ? m.recommended.toLocaleString() : m.recommended} ✓</td>
                                        <td className="py-1.5 text-right text-gray-500">{typeof m.other === 'number' ? m.other.toLocaleString() : m.other}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )
                          ) : (
                            <div className="bg-gray-50 rounded-lg px-4 py-3 text-xs mb-4">
                              <div className="text-gray-500 font-medium mb-2">{charAnalysis.howToChoose!.tables[i].title}</div>
                              <table className="w-full">
                                <thead>
                                  <tr className="text-gray-400 border-b border-gray-200">
                                    <th className="text-left py-1 font-normal">Metric</th>
                                    <th className="text-right py-1 font-normal">{charAnalysis.winner}</th>
                                    <th className="text-right py-1 font-normal">{areaA?.name === charAnalysis.winner ? areaB?.name : areaA?.name}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {charAnalysis.howToChoose!.tables[i].metrics.map((m, j) => (
                                    <tr key={j} className="border-b border-gray-100 last:border-0">
                                      <td className="py-1.5 text-gray-600">{m.name}</td>
                                      <td className="py-1.5 text-right text-gray-800 font-medium">{typeof m.recommended === 'number' ? m.recommended.toLocaleString() : m.recommended} ✓</td>
                                      <td className="py-1.5 text-right text-gray-500">{typeof m.other === 'number' ? m.other.toLocaleString() : m.other}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Fallback: when no AI output, show all advantage tables */}
                {!charAnalysis.howToChoose && charAnalysis.priorities.some(p => p.advantageRows.length > 0) && (
                  <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                    <h3 className="text-sm font-semibold text-gray-800 mb-4">🏆 Why {charAnalysis.winner} Wins — Data at a Glance</h3>
                    <div className="space-y-3">
                      {charAnalysis.priorities.filter(p => p.advantageRows.length > 0).map(p => (
                        /* 三向对比：显示三个社区的真实数据；两向保持原两列表 */
                        isThreeWay ? (
                          ThreeWayTable({
                            title: p.label,
                            rows: p.advantageRows.map(r => ({ metric: r.metric })),
                            areas, winnerName: charAnalysis.winner, commuteCache,
                          }) || <ComparisonTable key={p.key} title={p.label} rows={p.advantageRows} />
                        ) : (
                          <ComparisonTable key={p.key} title={p.label} rows={p.advantageRows} />
                        )
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* DATA TAB */}
        {viewTab === 'data' && charAnalysis && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Metric</th>
                  {areas.map((a: any) => (
                    <th key={a.name} className={`text-right px-5 py-3 text-xs font-semibold uppercase ${a.name === charAnalysis.winner ? 'text-green-700' : 'text-gray-500'}`}>{a.name}{a.name === charAnalysis.winner ? ' ✓' : ''}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Rent — lower is better */}
                <tr className="border-b border-gray-100">
                  <td className="px-5 py-3 text-sm text-gray-700 font-medium" colSpan={areas.length + 1}>💰 Rent</td>
                </tr>
                {['Studio','1BR','2BR'].map((label, i) => {
                  const key = ['studio','oneBr','twoBr'][i]
                  // 被推荐社区租金严格最低才标绿（两向、三向对比都生效）
                  const wVal = (winnerAreaObj.metrics.rentByBedroom as any)[key] || 0
                  const winnerHasAdvantage = areas.filter(a => a.name !== charAnalysis.winner)
                    .every(a => wVal < ((a.metrics.rentByBedroom as any)[key] || 0))
                  return (
                  <tr key={key} className="border-b border-gray-50">
                    <td className="px-5 py-2.5 text-sm text-gray-500">{label}</td>
                    {areas.map((a: any) => {
                      const v = (a.metrics.rentByBedroom as any)[key] || 0
                      const isWinner = a.name === charAnalysis.winner && winnerHasAdvantage
                      return (
                        <td key={a.name} className={`px-5 py-2.5 text-sm text-right ${isWinner ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-800'}`}>
                          ${v.toLocaleString()}/mo
                        </td>
                      )
                    })}
                  </tr>
                )})}

                {/* Venues — higher is better */}
                <tr className="border-b border-gray-100">
                  <td className="px-5 py-3 text-sm text-gray-700 font-medium" colSpan={areas.length + 1}>🍽️ Dining & Shopping</td>
                </tr>
                {[
                  { label: 'Restaurants', get: (a: any) => a.metrics.restaurantCount },
                  { label: 'Cafes', get: (a: any) => (a.metrics as any).cafeCount || 0 },
                  { label: 'Bars', get: (a: any) => a.metrics.barCount },
                  { label: 'Supermarkets', get: (a: any) => a.metrics.supermarketCount },
                  { label: 'Gyms', get: (a: any) => (a.metrics as any).gymCount || 0 },
                  { label: 'Pharmacies', get: (a: any) => (a.metrics as any).pharmacyCount || 0 },
                  { label: 'Malls', get: (a: any) => (a.metrics as any).mallCount || 0 },
                ].map(r => {
                  // 被推荐社区数值严格最高才标绿（两向、三向对比都生效）
                  const wVal = r.get(winnerAreaObj)
                  const winnerHasAdvantage = areas.filter(a => a.name !== charAnalysis.winner).every(a => wVal > r.get(a))
                  return (
                  <tr key={r.label} className="border-b border-gray-50">
                    <td className="px-5 py-2.5 text-sm text-gray-500">{r.label}</td>
                    {areas.map((a: any) => {
                      const v = r.get(a)
                      const isWinner = a.name === charAnalysis.winner && winnerHasAdvantage
                      return (
                        <td key={a.name} className={`px-5 py-2.5 text-sm text-right ${isWinner ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-800'}`}>
                          {v.toLocaleString()}
                        </td>
                      )
                    })}
                  </tr>
                )})}

                {/* Transit */}
                <tr className="border-b border-gray-100">
                  <td className="px-5 py-3 text-sm text-gray-700 font-medium" colSpan={areas.length + 1}>🚇 Transit</td>
                </tr>
                {[
                  { label: 'Subway/PATH', get: (a: any) => a.metrics.subwayStations || 0, higherBetter: true },
                  { label: 'Bus Routes', get: (a: any) => a.metrics.busRoutes || 0, higherBetter: true },
                  { label: commuteDest ? `Commute to ${commuteDest.length > 20 ? commuteDest.slice(0,20)+'...' : commuteDest}` : 'Commute to Midtown',
                    get: (a: any) => commuteCache[a.id] || a.metrics.commuteTime || 30, higherBetter: false, fmt: (v: any) => `${v}min` },
                ].map(r => {
                  // 按指标方向判断被推荐社区是否严格最优（两向、三向对比都生效）
                  const wVal = Number(r.get(winnerAreaObj)) || 0
                  const winnerHasAdvantage = areas.filter(a => a.name !== charAnalysis.winner)
                    .every(a => r.higherBetter ? wVal > (Number(r.get(a)) || 0) : wVal < (Number(r.get(a)) || 0))
                  return (
                  <tr key={r.label} className="border-b border-gray-50">
                    <td className="px-5 py-2.5 text-sm text-gray-500">{r.label}</td>
                    {areas.map((a: any) => {
                      const v = r.get(a)
                      const isWinner = a.name === charAnalysis.winner && winnerHasAdvantage
                      return (
                        <td key={a.name} className={`px-5 py-2.5 text-sm text-right ${isWinner ? 'text-green-700 font-semibold bg-green-50' : 'text-gray-800'}`}>
                          {r.fmt ? r.fmt(v) : v}
                        </td>
                      )
                    })}
                  </tr>
                )})}

                {/* Demographics — 横向柱状对比 */}
                <tr className="border-b border-gray-100">
                  <td className="px-5 py-3 text-sm text-gray-700 font-medium" colSpan={areas.length + 1}>👥 People</td>
                </tr>
              </tbody>
            </table>

            {/* 年龄分布 */}
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Age Distribution</p>
              {[
                { label: 'Under 20', key: 'under20' },
                { label: '20 – 29', key: '20to29' },
                { label: '30 – 39', key: '30to39' },
                { label: '40 – 49', key: '40to49' },
                { label: '50 – 64', key: '50to64' },
                { label: '65+', key: '65plus' },
              ].map(row => {
                const vals = areas.map(a => (a as any).demographics?.[row.key] || 0)
                const maxV = Math.max(...vals, 30)
                return (
                  <div key={row.key} className="flex items-center gap-3 mb-2 last:mb-0">
                    <span className="text-xs text-gray-500 w-16 shrink-0 text-right">{row.label}</span>
                    {areas.map((a, ai) => {
                      const v = (a as any).demographics?.[row.key] || 0
                      const pct = Math.max(2, (v / maxV) * 100)
                      return (
                        <div key={ai} className="flex items-center gap-2 flex-1">
                          <div className="h-5 bg-gray-200 rounded-sm flex-1 relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 bg-blue-400 rounded-sm transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-10 shrink-0">{v}%</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* 种族分布 */}
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Race & Ethnicity</p>
              {[
                { label: 'White', key: 'white' },
                { label: 'Black', key: 'black' },
                { label: 'Asian', key: 'asian' },
                { label: 'Hispanic / Other', key: 'other' },
              ].map(row => {
                const vals = areas.map(a => (a as any).demographics?.[row.key] || 0)
                const maxV = Math.max(...vals, 50)
                return (
                  <div key={row.key} className="flex items-center gap-3 mb-2 last:mb-0">
                    <span className="text-xs text-gray-500 w-24 shrink-0 text-right">{row.label}</span>
                    {areas.map((a, ai) => {
                      const v = (a as any).demographics?.[row.key] || 0
                      const pct = Math.max(2, (v / maxV) * 100)
                      return (
                        <div key={ai} className="flex items-center gap-2 flex-1">
                          <div className="h-5 bg-gray-200 rounded-sm flex-1 relative overflow-hidden">
                            <div className="absolute inset-y-0 left-0 bg-emerald-400 rounded-sm transition-all" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-10 shrink-0">{v}%</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* 关键指标 */}
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Key Indicators</p>
              {[
                { label: 'Crime Rate', get: (a: any) => `${a.metrics.crimeRate || 0}/1K` },
                { label: 'Median Age', get: (a: any) => `${(a as any).demographics?.medianAge || '—'}` },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3 mb-2 last:mb-0">
                  <span className="text-xs text-gray-500 w-24 shrink-0 text-right">{row.label}</span>
                  {areas.map((a, ai) => (
                    <span key={ai} className="text-xs text-gray-600 flex-1">{row.get(a)}</span>
                  ))}
                </div>
              ))}
            </div>

          </div>
        )}

        {/* EXPLORE YOUR MATCH — 推荐社区的深度数据展示 */}
        {viewTab === 'selling' && (() => {
          // 找到被推荐的社区
          const winnerName = charAnalysis?.winner || areaA.name
          const recommendedArea = [areaA, areaB, areaC].filter(Boolean).find(a => a!.name === winnerName) || areaA

          // 根据用户选择的户型读取对应的趋势数据
          const sparkKey = aptType === 'studio' ? 'rentStudio' : aptType === '2br' ? 'rent2br' : 'rent1br'
          const aptLabel = aptType === 'studio' ? 'Studio' : aptType === '2br' ? '2BR' : '1BR'
          const rentTrend: { month: string; value: number }[] = (recommendedArea as any)?.trends?.sparklines?.[sparkKey]
            || (recommendedArea as any)?.trends?.sparklines?.rent || []

          // 公寓推荐数据（scripts/build-apartments.mjs 生成的真实房源）
          const recs = apartmentData.buildings[recommendedArea.id] || []

          // 完全无数据时显示降级文案
          if (rentTrend.length === 0 && recs.length === 0) {
            return <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">No detailed data available for {recommendedArea.name} yet.</div>
          }

          // 户型映射：用户选的 aptType → CSV bedrooms 编号（0=studio）
          const aptBedrooms = aptType === 'studio' ? 0 : aptType === '2br' ? 2 : 1
          const bedroomLabel = (n: number) => (n === 0 ? 'Studio' : `${n}BR`)
          // 'YYYY-MM' → 'May 2026'
          const monthName = (m: string) => {
            const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            const [y, mo] = m.split('-')
            return `${names[(Number(mo) || 1) - 1]} ${y}`
          }
          // 'YYYY-MM-DD' → 'MM/DD'
          const shortDate = (d: string) => (d.length >= 10 ? `${d.slice(5, 7)}/${d.slice(8, 10)}` : d)

          // 计算关键统计（趋势卡用）
          const values = rentTrend.map(p => p.value)
          const current = values[values.length - 1]
          const first = values[0]
          const yoyChange = first > 0 ? ((current - first) / first * 100) : 0
          const maxVal = Math.max(...values)
          const minVal = Math.min(...values)
          const range = maxVal - minVal || 1

          // 格式化月份标签
          const monthLabel = (m: string) => { const d = m.split('-'); return `${d[1]}` }

          return (
            <div className="space-y-4 mb-6">
              {/* 公寓推荐卡片区 — 真实建筑 + 真实房源 */}
              {recs.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Recommended Apartments
                    </h3>
                    <span className="text-[10px] text-gray-400">{aptLabel} listings first</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {recs.map(b => {
                      // 软过滤：用户所选户型优先，同户型价格升序，最多展示 2 条
                      const displayListings = [...b.listings]
                        .sort((x, y) => {
                          const xPref = x.bedrooms === aptBedrooms ? 0 : 1
                          const yPref = y.bedrooms === aptBedrooms ? 0 : 1
                          return xPref - yPref || x.price - y.price
                        })
                        .slice(0, 2)
                      // 简介：Places 编辑摘要优先，缺失时用真实数据合成句
                      const intro = b.editorialSummary
                        || (b.listingCount > 0
                          ? `${b.listingCount} units listed in ${monthName(apartmentData.csvMonth)} · ${bedroomLabel(displayListings[0]?.bedrooms ?? 0)} from $${displayListings[0]?.price.toLocaleString()}/mo`
                          : `Apartment building in ${recommendedArea.name}`)
                      return (
                        <div key={b.placeId} className="bg-gray-50 rounded-lg p-4">
                          {/* 头部：名字 + 评分 */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-gray-900 leading-snug">{b.name}</h4>
                            {b.rating !== null && (
                              <span className="shrink-0 text-xs text-amber-600 font-medium">★{b.rating} · {b.reviewCount}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{intro}</p>

                          {/* 房源行 — 徽章全部条件渲染，无数据的字段不显示 */}
                          {displayListings.length > 0 ? (
                            <div className="space-y-1.5">
                              {displayListings.map((l, li) => (
                                <div key={li} className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-gray-900">{bedroomLabel(l.bedrooms)} · ${l.price.toLocaleString()}/mo</span>
                                    {l.netEffectivePrice !== null && (
                                      <span className="text-gray-400">net ${l.netEffectivePrice.toLocaleString()}</span>
                                    )}
                                    {l.sqft !== null && <span className="text-gray-500">{l.sqft.toLocaleString()} sqft</span>}
                                    {l.monthsFree > 0 && <span className="text-gray-500">{l.monthsFree} mo free</span>}
                                    {l.furnished && <span className="text-gray-500">Furnished</span>}
                                    {l.noFee && <span className="text-gray-500">No fee</span>}
                                    {l.availableDate && <span className="text-gray-500">Avail {shortDate(l.availableDate)}</span>}
                                  </div>
                                  {l.url && (
                                    <a href={l.url} target="_blank" rel="noreferrer" className="shrink-0 text-blue-600 underline hover:text-blue-700">
                                      StreetEasy ↗
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">No current listings in firstmover data</p>
                          )}

                          {/* 底部：地址 + Google Maps 链接 */}
                          <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-gray-400 truncate">{b.address}</span>
                            <a href={b.googleMapsUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] text-blue-600 underline hover:text-blue-700">
                              Google Maps ↗
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                  No apartment data available for {recommendedArea.name} yet
                </div>
              )}

              {/* 租金趋势卡片 */}
              {rentTrend.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {recommendedArea.name} — 12-Month Rent Trend
                    </h3>
                    <span className="text-[10px] text-gray-400">{aptLabel} Median Rent</span>
                  </div>

                  {/* SVG 曲线图 */}
                  <RentLineChart data={rentTrend} minVal={minVal} range={range} monthLabel={monthLabel} />

                  {/* 统计卡片 */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] text-gray-400 mb-0.5">Current</p>
                      <p className="text-sm font-bold text-gray-900">${current.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] text-gray-400 mb-0.5">YoY Change</p>
                      <p className={`text-sm font-bold ${yoyChange <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {yoyChange > 0 ? '+' : ''}{yoyChange.toFixed(1)}%
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] text-gray-400 mb-0.5">12M High</p>
                      <p className="text-sm font-bold text-gray-900">${maxVal.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] text-gray-400 mb-0.5">12M Low</p>
                      <p className="text-sm font-bold text-gray-900">${minVal.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 数据来源 */}
              <p className="text-[10px] text-gray-400 text-center">
                Rent trends & listings based on{' '}
                <a href="https://www.firstmovernyc.com/open-data" target="_blank" className="underline hover:text-gray-500">
                  firstmovernyc.com/open-data
                </a>
                {' '}({monthName(apartmentData.csvMonth)}) · Building info from Google Places · Updated {apartmentData.generatedAt.slice(0, 10)}
              </p>
            </div>
          )
        })()}

      </div>
    </div>
  )
}

export default ComparePage
