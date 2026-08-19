// ============================================================
// 服务端代理：OpenAI Chat Completions（How to Choose 文案生成）
// API key 只存在 Vercel 环境变量 OPENAI_KEY 中。
// 前端只传 system/user 提示词；temperature/max_tokens 做上限钳制，
// 防止公开接口被滥用烧钱。
// ============================================================

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  const { system, user } = req.body || {}
  if (!user) {
    res.status(400).json({ error: 'user prompt is required' })
    return
  }
  // 钳制参数：温度 ≤1，最大输出 ≤1000 token
  const temperature = Math.min(Number(req.body?.temperature) || 0.4, 1)
  const maxTokens = Math.min(Number(req.body?.max_tokens) || 800, 1000)
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_KEY || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system || '' },
          { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    })
    const data = await resp.json()
    res.status(resp.status).json(data)
  } catch {
    res.status(502).json({ error: 'upstream error' })
  }
}
