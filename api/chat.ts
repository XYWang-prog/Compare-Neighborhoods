// ============================================================
// 服务端代理：OpenAI Chat Completions（How to Choose 文案生成）
// API key 只存在 Vercel 环境变量 OPENAI_KEY 中。
// 前端按 OpenAI 原生格式传 messages；服务端固定 model，
// 对 messages 数量/长度、temperature/max_tokens 做钳制，
// 防止公开接口被滥用烧钱。
// ============================================================

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }
  // 只取前 4 条消息，内容总长 ≤20000 字符（防公开接口被恶意塞超长提示词；
  // 三社区对比的真实数据量约 5-10K 字符，8000 上限会误伤正常请求）
  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(0, 4) : []
  if (messages.length === 0) {
    res.status(400).json({ error: 'messages is required' })
    return
  }
  if (JSON.stringify(messages).length > 20000) {
    res.status(400).json({ error: 'messages too long' })
    return
  }
  // 钳制参数：温度 ≤1，最大输出 ≤1000 token；model 由服务端固定，忽略前端传入值
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
        messages,
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
