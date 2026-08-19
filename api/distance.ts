// ============================================================
// 服务端代理：Google Distance Matrix（真实通勤时间）
// API key 只存在 Vercel 环境变量 GOOGLE_GEOCODE_KEY 中。
// 只允许透传白名单参数，防止任意参数打到 Google。
// ============================================================

export default async function handler(req: any, res: any) {
  const allowed = ['origins', 'destinations', 'mode', 'transit_mode', 'departure_time']
  const q = new URLSearchParams()
  for (const k of allowed) {
    const v = req.query?.[k]
    if (v) q.set(k, String(v))
  }
  q.set('key', process.env.GOOGLE_GEOCODE_KEY || '')

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${q.toString()}`
    const resp = await fetch(url)
    const data = await resp.json()
    res.status(200).json(data)
  } catch {
    res.status(502).json({ status: 'UNKNOWN_ERROR' })
  }
}
