// ============================================================
// 服务端代理：Google Geocoding（地址 → 坐标）
// API key 只存在 Vercel 环境变量 GOOGLE_GEOCODE_KEY 中，
// 不进入前端代码、不进入 git 仓库。
// ============================================================

export default async function handler(req: any, res: any) {
  const address = String(req.query?.address || '')
  if (!address) {
    res.status(400).json({ status: 'INVALID_REQUEST', error: 'address is required' })
    return
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', New York, NY')}&key=${process.env.GOOGLE_GEOCODE_KEY || ''}`
    const resp = await fetch(url)
    const data = await resp.json()
    res.status(200).json(data)
  } catch {
    res.status(502).json({ status: 'UNKNOWN_ERROR' })
  }
}
