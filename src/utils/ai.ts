// 注意：OpenAI key 不再出现在前端代码里。
// 生产环境走 Vercel 服务端函数 /api/chat（key 在 Vercel 环境变量），
// 开发环境走 vite 代理（key 从 .env.local 读取）。

interface AdvantageRow {
  metric: string     // 指标名，如 "Restaurants"
  winnerVal: string  // 优胜社区的值
  loserVal: string   // 另一个社区的值
  diff: string       // 优势描述，如 "+135 more" / "$350 cheaper"
}

interface PriorityDetail {
  key: string
  label: string
  highlight: string
  comparison: string
  explanation: string
  data: { name: string; value: string }[]
  advantageRows: AdvantageRow[]  // 仅包含优胜社区领先的指标行
}

interface AnalysisResult {
  winner: string
  matchScore: number
  priorities: PriorityDetail[]
  howToChoose: HowToChoose | null
}

interface HowToChoose {
  title: string
  paragraphs: string[]
  tables: HowToChooseTable[]
}

interface HowToChooseTable {
  title: string
  metrics: { name: string; recommended: string | number; other: string | number }[]
}

const LABELS: Record<string, string> = {
  affordable: 'Affordable Living', dining: 'Dining & Entertainment',
  convenience: 'Daily Convenience', commute: 'Easy Commute',
  safety: 'Safety', fitness: 'Fitness & Wellness',
  family: 'Family Friendly', young: 'Young & Social',
  diverse: 'Diverse Community', quiet: 'Quiet Living',
}

export async function analyzeCharacteristics(
  results: any[],
  priorities: string[],
  aptType = '1br',
  commuteCache: Record<string, number> = {},
  commuteDest = '',
): Promise<AnalysisResult | null> {
  // 用 Google API 真实通勤时间覆盖 mock 数据
  console.log('analyzeCharacteristics: commuteCache =', JSON.stringify(commuteCache))
  for (const r of results) {
    console.log(`  area ${r.id} (${r.name}): mock=${r._commuteTime}min, google=${commuteCache[r.id] || 'N/A'}`)
    if (commuteCache[r.id]) {
      r._commuteTime = commuteCache[r.id]
    }
  }
  const winner = results[0]
  if (!winner) return null

  // Build data + highlights per priority
  const details: PriorityDetail[] = priorities.map(key => {
    const label = LABELS[key] || key
    let data: { name: string; value: string }[] = []
    let highlight = ''
    let comparison = ''

    // Build comparison data — winner vs other
    const other = results[1]
    const advantageRows: AdvantageRow[] = []
    if (key === 'affordable') {
      // Priority: show user's selected apartment type first
      const aptMultipliers: Record<string, number> = { studio: 0.72, '1br': 1.0, '2br': 1.38 }
      const selectedRent = winner._rent * (aptMultipliers[aptType] || 1)
      const otherSelectedRent = (other?._rent || 0) * (aptMultipliers[aptType] || 1)
      const diff = otherSelectedRent - selectedRent
      const aptLabel = aptType === 'studio' ? 'Studio' : aptType === '2br' ? '2BR' : '1BR'
      data = [
        { name: `${aptLabel} Rent (selected)`, value: diff > 0 ? `$${Math.round(selectedRent).toLocaleString()}/mo ($${Math.round(diff).toLocaleString()} cheaper)` : `$${Math.round(selectedRent).toLocaleString()}/mo ($${Math.round(Math.abs(diff)).toLocaleString()} more)` },
      ]
      if (aptType !== 'studio') data.push({ name: 'Studio', value: `$${Math.round(winner._rent * 0.72).toLocaleString()}/mo` })
      if (aptType !== '1br') data.push({ name: '1BR', value: `$${Math.round(winner._rent).toLocaleString()}/mo` })
      if (aptType !== '2br') data.push({ name: '2BR', value: `$${Math.round(winner._rent * 1.38).toLocaleString()}/mo` })
      highlight = diff > 0 ? `$${Math.round(diff).toLocaleString()}/month cheaper` : `$${Math.round(Math.abs(diff)).toLocaleString()}/month more`
      // 优势对比行（只放优胜者的优势数据）
      if (diff > 0) {
        advantageRows.push({ metric: `${aptLabel} Rent`, winnerVal: `$${Math.round(selectedRent).toLocaleString()}/mo`, loserVal: `$${Math.round(otherSelectedRent).toLocaleString()}/mo`, diff: `$${Math.round(diff).toLocaleString()}/mo cheaper` })
      }
      comparison = ''
    } else if (key === 'dining') {
      const diffR = (winner._restaurants || 0) - (other?._restaurants || 0)
      const diffC = (winner._cafes || 0) - (other?._cafes || 0)
      const diffB = (winner._bars || 0) - (other?._bars || 0)
      data = [
        { name: 'Restaurants', value: `${winner._restaurants || 0} (${diffR >= 0 ? '+' : ''}${diffR} vs ${other?.name})` },
        { name: 'Cafes', value: `${winner._cafes || 0} (${diffC >= 0 ? '+' : ''}${diffC})` },
        { name: 'Bars', value: `${winner._bars || 0} (${diffB >= 0 ? '+' : ''}${diffB})` },
      ]
      highlight = diffR + diffC + diffB > 0 ? `+${diffR + diffC + diffB} more venues` : ''
      // 优势对比行
      if (diffR > 0) advantageRows.push({ metric: 'Restaurants', winnerVal: `${winner._restaurants || 0}`, loserVal: `${other?._restaurants || 0}`, diff: `+${diffR} more` })
      if (diffC > 0) advantageRows.push({ metric: 'Cafes', winnerVal: `${winner._cafes || 0}`, loserVal: `${other?._cafes || 0}`, diff: `+${diffC} more` })
      if (diffB > 0) advantageRows.push({ metric: 'Bars', winnerVal: `${winner._bars || 0}`, loserVal: `${other?._bars || 0}`, diff: `+${diffB} more` })
      comparison = ''
    } else if (key === 'convenience') {
      const diffS = (winner._supermarkets || 0) - (other?._supermarkets || 0)
      const diffP = (winner._pharmacies || 0) - (other?._pharmacies || 0)
      const diffM = (winner._malls || 0) - (other?._malls || 0)
      data = [
        { name: 'Supermarkets', value: `${winner._supermarkets || 0} (${diffS >= 0 ? '+' : ''}${diffS})` },
        { name: 'Pharmacies', value: `${winner._pharmacies || 0} (${diffP >= 0 ? '+' : ''}${diffP})` },
        { name: 'Malls', value: `${winner._malls || 0} (${diffM >= 0 ? '+' : ''}${diffM})` },
      ]
      highlight = diffS + diffP + diffM > 0 ? `+${diffS + diffP + diffM} more` : ''
      if (diffS > 0) advantageRows.push({ metric: 'Supermarkets', winnerVal: `${winner._supermarkets || 0}`, loserVal: `${other?._supermarkets || 0}`, diff: `+${diffS} more` })
      if (diffP > 0) advantageRows.push({ metric: 'Pharmacies', winnerVal: `${winner._pharmacies || 0}`, loserVal: `${other?._pharmacies || 0}`, diff: `+${diffP} more` })
      if (diffM > 0) advantageRows.push({ metric: 'Malls', winnerVal: `${winner._malls || 0}`, loserVal: `${other?._malls || 0}`, diff: `+${diffM} more` })
      comparison = ''
    } else if (key === 'commute') {
      const diffT = (other?._commuteTime || 30) - (winner._commuteTime || 30)
      const destLabel = commuteDest ? `Commute to ${commuteDest.length > 20 ? commuteDest.slice(0,20)+'...' : commuteDest}` : 'Commute Time'
      data = [
        { name: destLabel, value: `${winner._commuteTime || 30}min (${diffT > 0 ? diffT + 'min faster' : ''})` },
      ]
      highlight = diffT > 0 ? `${diffT}min faster` : ''
      if (diffT > 0) advantageRows.push({ metric: destLabel, winnerVal: `${winner._commuteTime || 30}min`, loserVal: `${other?._commuteTime || 30}min`, diff: `${diffT}min faster` })
      comparison = ''
    } else if (key === 'safety') {
      const diff = (other?._crime || 0) - (winner._crime || 0)
      data = [
        { name: 'Crime Rate', value: `${winner._crime || '—'}/1K (${diff >= 0 ? diff.toFixed(1) + '/1K lower' : Math.abs(diff).toFixed(1) + '/1K higher'})` },
      ]
      highlight = diff > 0 ? `${diff.toFixed(1)}/1K lower crime rate` : ''
      if (diff > 0) advantageRows.push({ metric: 'Crime Rate', winnerVal: `${winner._crime || '—'}/1K`, loserVal: `${other?._crime || '—'}/1K`, diff: `${diff.toFixed(1)}/1K lower` })
      comparison = ''
    } else if (key === 'fitness') {
      const diffG = (winner._gyms || 0) - (other?._gyms || 0)
      const diffP = (winner._pharmacies || 0) - (other?._pharmacies || 0)
      data = [
        { name: 'Gyms', value: `${winner._gyms || 0} (${diffG >= 0 ? '+' : ''}${diffG})` },
        { name: 'Pharmacies', value: `${winner._pharmacies || 0} (${diffP >= 0 ? '+' : ''}${diffP})` },
      ]
      highlight = `${winner.name} has ${winner._gyms || 0} gyms, ${winner._pharmacies || 0} pharmacies`
      if (diffG > 0) advantageRows.push({ metric: 'Gyms', winnerVal: `${winner._gyms || 0}`, loserVal: `${other?._gyms || 0}`, diff: `+${diffG} more` })
      if (diffP > 0) advantageRows.push({ metric: 'Pharmacies', winnerVal: `${winner._pharmacies || 0}`, loserVal: `${other?._pharmacies || 0}`, diff: `+${diffP} more` })
      comparison = ''
    } else if (key === 'family') {
      const dU = (winner._under20 || 0) - (other?._under20 || 0)
      const dC = (other?._crime || 0) - (winner._crime || 0)
      const dS = (winner._supermarkets || 0) - (other?._supermarkets || 0)
      data = [
        { name: 'Under-20 Population', value: `${winner._under20 || 0}% (${dU >= 0 ? '+' : ''}${dU}% vs ${other?.name})` },
        { name: 'Crime Rate', value: `${winner._crime || 0}/1K (${dC >= 0 ? dC.toFixed(1) + '/1K lower' : Math.abs(dC).toFixed(1) + '/1K higher'})` },
        { name: 'Supermarkets', value: `${winner._supermarkets || 0} (${dS >= 0 ? '+' : ''}${dS})` },
      ]
      highlight = `${winner._under20 || 0}% under-20 population`
      if (dU > 0) advantageRows.push({ metric: 'Under-20 Pop.', winnerVal: `${winner._under20 || 0}%`, loserVal: `${other?._under20 || 0}%`, diff: `+${dU}% more` })
      if (dC > 0) advantageRows.push({ metric: 'Crime Rate', winnerVal: `${winner._crime || 0}/1K`, loserVal: `${other?._crime || 0}/1K`, diff: `${dC.toFixed(1)}/1K lower` })
      if (dS > 0) advantageRows.push({ metric: 'Supermarkets', winnerVal: `${winner._supermarkets || 0}`, loserVal: `${other?._supermarkets || 0}`, diff: `+${dS} more` })
      comparison = ''
    } else if (key === 'young') {
      const dY = (winner._young || 0) - (other?._young || 0)
      const dR = (winner._restaurants || 0) - (other?._restaurants || 0)
      const dC = (winner._cafes || 0) - (other?._cafes || 0)
      const dB = (winner._bars || 0) - (other?._bars || 0)
      data = [
        { name: 'Age 20-39', value: `${winner._young || 0}% (${dY >= 0 ? '+' : ''}${dY}% vs ${other?.name})` },
        { name: 'Restaurants', value: `${winner._restaurants || 0} (${dR >= 0 ? '+' : ''}${dR})` },
        { name: 'Cafes', value: `${winner._cafes || 0} (${dC >= 0 ? '+' : ''}${dC})` },
        { name: 'Bars', value: `${winner._bars || 0} (${dB >= 0 ? '+' : ''}${dB})` },
      ]
      highlight = `${winner._young || 0}% of residents are 20-39`
      if (dY > 0) advantageRows.push({ metric: 'Age 20-39', winnerVal: `${winner._young || 0}%`, loserVal: `${other?._young || 0}%`, diff: `+${dY}% more` })
      if (dR > 0) advantageRows.push({ metric: 'Restaurants', winnerVal: `${winner._restaurants || 0}`, loserVal: `${other?._restaurants || 0}`, diff: `+${dR} more` })
      if (dC > 0) advantageRows.push({ metric: 'Cafes', winnerVal: `${winner._cafes || 0}`, loserVal: `${other?._cafes || 0}`, diff: `+${dC} more` })
      if (dB > 0) advantageRows.push({ metric: 'Bars', winnerVal: `${winner._bars || 0}`, loserVal: `${other?._bars || 0}`, diff: `+${dB} more` })
      comparison = ''
    } else if (key === 'diverse') {
      const dW = (winner._white || 0) - (other?._white || 0)
      const dBk = (winner._black || 0) - (other?._black || 0)
      const dA = (winner._asian || 0) - (other?._asian || 0)
      data = [
        { name: 'White', value: `${winner._white || 0}% (${dW >= 0 ? '+' : ''}${dW}% vs ${other?.name})` },
        { name: 'Black', value: `${winner._black || 0}% (${dBk >= 0 ? '+' : ''}${dBk}%)` },
        { name: 'Asian', value: `${winner._asian || 0}% (${dA >= 0 ? '+' : ''}${dA}%)` },
      ]
      highlight = `Diverse community`
      if (dW > 0) advantageRows.push({ metric: 'White', winnerVal: `${winner._white || 0}%`, loserVal: `${other?._white || 0}%`, diff: `More balanced` })
      if (dBk > 0) advantageRows.push({ metric: 'Black', winnerVal: `${winner._black || 0}%`, loserVal: `${other?._black || 0}%`, diff: `More balanced` })
      if (dA > 0) advantageRows.push({ metric: 'Asian', winnerVal: `${winner._asian || 0}%`, loserVal: `${other?._asian || 0}%`, diff: `More balanced` })
      comparison = ''
    } else if (key === 'quiet') {
      const diffB = (winner._bars || 0) - (other?._bars || 0)
      data = [
        { name: 'Bars', value: `${winner._bars || 0} (${diffB <= 0 ? '' : '+'}${Math.abs(diffB)} fewer)` },
        { name: 'Crime Rate', value: `${winner._crime || 0}/1K` },
      ]
      highlight = (winner._bars || 0) < (other?._bars || 0) ? `${Math.abs(diffB)} fewer bars` : ''
      if (diffB < 0) advantageRows.push({ metric: 'Bars', winnerVal: `${winner._bars || 0}`, loserVal: `${other?._bars || 0}`, diff: `${Math.abs(diffB)} fewer (quieter)` })
      comparison = ''
    } else {
      data = results.map((r: any) => ({ name: r.name, value: `${r.scores?.[key] || 0}` }))
    }

    return { key, label, highlight, comparison, explanation: '', data, advantageRows }
  })

  // AI generates explanations
  const context = JSON.stringify({
    winner: winner.name,
    loser: results[1]?.name,
    priorities: details.map(p => ({
      key: p.key, label: p.label,
      advantage: p.advantageRows.length > 0
        ? p.advantageRows.map(r => `${r.metric}: ${r.winnerVal} vs ${r.loserVal} (${r.diff})`).join('; ')
        : 'no significant advantage',
    })),
  })

  const prompt = `For each priority, write 2-3 sentences in a natural, conversational tone. Don't sound formulaic — write like a friend giving advice. Use the data naturally in sentences. Output JSON array: [{"key":"...","explanation":"..."}]

Criteria reference:
- Affordable Living: lower rent wins
- Dining & Entertainment: restaurants + cafes + bars density
- Daily Convenience: supermarkets + pharmacies + malls count
- Easy Commute: subway/PATH + bus + commute time
- Safety: crime rate per 1K residents
- Fitness & Wellness: gyms + pharmacies
- Family Friendly: under-20 pop + low crime + supermarket access
- Young & Social: 20-39 age group + restaurants + cafes + bars
- Diverse Community: race/ethnicity balance
- Quiet Living: low bar density + low crime

Data: ${context}`

  try {
    // 经服务端代理调用 OpenAI（key 不暴露在前端）
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: 'You output only valid JSON arrays. No markdown.',
        user: prompt,
        temperature: 0.3,
        max_tokens: 500,
      }),
    })
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content || '[]'
    const s = content.indexOf('['), e = content.lastIndexOf(']') + 1
    const explanations = JSON.parse(content.slice(s, e))
    for (const exp of explanations) {
      const pd = details.find(p => p.key === exp.key)
      if (pd) pd.explanation = exp.explanation
    }
  } catch {}

  // ================================================================
  // Generate "How to Choose" — structured recommendation text + tables
  // ================================================================
  let howToChoose: HowToChoose | null = null
  try {
    const competitors = results.slice(1)  // 第2名、第3名
    if (competitors.length === 0) { return { winner: winner.name, matchScore: winner.weightedTotal, priorities: details, howToChoose: null } }

    const primaryCompetitor = competitors[0]
    const winnerScores = winner.scores || {}
    const primaryScores = primaryCompetitor.scores || {}
    const matchDifference = winner.weightedTotal - (primaryCompetitor.weightedTotal || 0)
    const isThreeWay = competitors.length >= 2

    // Weight labels
    const priorityWeights = ['40%', '30%', '20%', '10%']

    // Build userPriorities: ranked list
    const userPriorities = priorities.map((p, i) => ({
      rank: i + 1,
      name: LABELS[p] || p,
      weight: priorityWeights[i] || `${(priorities.length - i) * 10}%`,
    }))

    // Build characteristicScores: winner vs primary competitor (with real-world context)
    const characteristicScores = priorities.map(p => {
      const w = winnerScores[p] || 50
      const l = primaryScores[p] || 50
      let result = 'tied'
      if (w > l) result = 'won'
      else if (w < l) result = 'lost'
      // 附上真实数据含义
      let context = ''
      if (p === 'affordable') {
        context = `${winner.name}: $${winner._rent}/mo, ${primaryCompetitor.name}: $${primaryCompetitor._rent}/mo`
      } else if (p === 'commute') {
        const dest = commuteDest ? ` to ${commuteDest}` : ''
        context = `${winner.name}: ${winner._commuteTime}min${dest}, ${primaryCompetitor.name}: ${primaryCompetitor._commuteTime}min${dest}`
      } else if (p === 'safety') {
        context = `${winner.name}: ${winner._crime}/1K, ${primaryCompetitor.name}: ${primaryCompetitor._crime}/1K`
      }
      return { name: LABELS[p] || p, recommended: w, competing: l, result, context }
    })

    // Winning priorities (only those the winner actually won vs primary)
    const winningPriorities = characteristicScores.filter(c => c.result === 'won')

    // Supporting metrics: only where recommended > primary competitor
    const supportingMetrics = details
      .filter(p => p.advantageRows.length > 0)
      .flatMap(p => p.advantageRows.map(r => ({
        priority: p.label,
        metric: r.metric,
        recommended: isNaN(Number(r.winnerVal)) ? r.winnerVal : Number(r.winnerVal.replace(/[^0-9.]/g, '')),
        competing: isNaN(Number(r.loserVal)) ? r.loserVal : Number(r.loserVal.replace(/[^0-9.]/g, '')),
      })))

    // Build ranked summary
    const rankedSummary = results.map((r, i) => `${i + 1}. ${r.name} (score: ${r.weightedTotal})`).join(', ')

    // Build structured input for the AI
    const input = JSON.stringify({
      recommended: winner.name,
      competingNeighborhoods: competitors.map(c => c.name),
      isThreeWay,
      matchScore: winner.weightedTotal,
      matchDifference,
      rankedSummary,
      userPriorities,
      characteristicScores,
      winningPriorities,
      supportingMetrics,
    })

    const systemPrompt = `You are writing the "How to Choose" section for an AI neighborhood comparison product.

Your goal is NOT to summarize both neighborhoods.

Your goal is to clearly explain WHY the recommended neighborhood should be chosen based on the user's priorities.

The recommendation has already been determined by the scoring algorithm.

You will receive:

• Recommended neighborhood
• Competing neighborhood
• Match Score
• Match Difference
• Winning Priorities
• User Priority Ranking
• Characteristic Scores
• Supporting Metrics

${isThreeWay ? `Note: There are 3 neighborhoods. The recommended neighborhood ranked #1. Explain why it beat BOTH competitors.` : ''}

==================================================
RULE 1 - Focus on the recommendation

Always write from the perspective of the recommended neighborhood.

Do NOT introduce both neighborhoods equally.

The competing neighborhood should only appear when comparing a metric that supports the recommendation.

The purpose is to reinforce the recommendation, not compare every metric.

==================================================
RULE 2 - Decide the writing strategy

Use Match Difference to determine the overall tone.

Case A
Match Difference ≥ 15

The recommendation is clear.

Strongly emphasize the recommended neighborhood's advantages.

Focus on the characteristics that contributed most to the recommendation.

Little attention should be given to trade-offs.

------------------------------------------

Case B
Match Difference < 15

The comparison is relatively close.

The writing should explain WHAT made the difference instead of exaggerating the recommendation.

Focus on the deciding factors.

Do NOT describe the recommendation as uncertain.

==================================================
RULE 3 - Winning Priorities

The scoring algorithm will provide which priorities are won.

Example

Winning Priorities

✓ Priority #1

✓ Priority #2

✕ Priority #3

≈ Priority #4

Use these results to determine the storyline.

--------------------------------------------------

Case 1

The recommended neighborhood wins Priority #1.

This MUST become the core message.

Explain that because the user's most important priority is better satisfied, this neighborhood becomes the better overall choice.

Then use the remaining strengths as supporting evidence.

--------------------------------------------------

Case 2

The recommended neighborhood does NOT win Priority #1,
but wins Priority #2 and Priority #3.

Do NOT describe this as a weakness.

Instead explain naturally:

Although the recommended neighborhood is slightly behind in the highest priority, its significantly stronger performance across the second and third priorities creates a better overall match.

Emphasize the combined strengths.

--------------------------------------------------

Case 3

The recommended neighborhood wins ALL priorities.

Describe it as a comprehensive recommendation.

Explain that it consistently outperforms the competing neighborhood across every factor the user values.

--------------------------------------------------

Case 4

The recommendation wins ONLY Priority #1.

Explain that the highest priority carries the greatest decision weight.

Although the competing neighborhood performs better in several secondary priorities, the user's most important requirement makes this recommendation the stronger overall choice.

--------------------------------------------------

Case 5

The recommendation wins three or more priorities.

Do NOT list every priority individually.

Instead explain that multiple strengths together create a stronger overall recommendation.

==================================================
RULE 4 - Storytelling

Never explain every priority one by one.

Identify the one or two priorities that contributed the most.

These become the main storyline.

The remaining winning priorities should only be used as supporting evidence.

The explanation should feel like a recommendation from an experienced advisor instead of a checklist.

==================================================
RULE 5 - Data Comparison

Between paragraphs, insert ONE comparison table.

The table should ONLY contain metrics where the recommended neighborhood performs better.

Never display metrics where the competing neighborhood wins.

Never display neutral metrics.

Only include metrics that directly support the recommendation.

Each table should contain 2–4 metrics.

Example

| Metric | Recommended | Other |
|--------|------------:|------:|
| Monthly Rent | $3,150 | $3,450 |
| Restaurants | 182 | 134 |
| Grocery Stores | 12 | 8 |

==================================================
RULE 6 - Structure

Generate exactly 3 paragraphs. No more, no less.

Each paragraph MUST be no more than 3 lines. Be concise.

Paragraph 1

State the recommendation. Explain WHY this neighborhood wins. Mention the most important deciding factor.

↓

Comparison Table

↓

Paragraph 2

Explain how the remaining strengths reinforce the recommendation.

↓

Comparison Table (optional)

↓

Paragraph 3

Summarize why this neighborhood is the better overall fit. End decisively.

==================================================
RULE 7 - Tone

Be confident.

Be concise.

Avoid generic phrases such as

• Both neighborhoods are great.

• It depends on your preference.

• Both have their own advantages.

Instead, confidently explain why the recommended neighborhood better aligns with the user's priorities.

==================================================
RULE 8 - Writing Style

Always explain decisions instead of describing data.

Every paragraph should connect back to the user's priorities.

Avoid simply listing metrics.

Convert numbers into decision-making insights.

Example

❌

"The neighborhood has 269 restaurants."

✅

"Because Dining & Entertainment is one of your highest priorities, the significantly larger restaurant scene becomes one of the biggest reasons this neighborhood stands out."

==================================================
RULE 9 - The Recommendation Must Feel Decisive

The purpose of this section is to help the user make a decision.

Do not write balanced comparisons.

Do not leave the user undecided.

Even if the Match Difference is small, confidently recommend the selected neighborhood.

When the comparison is close, explain WHY the winning priorities make the recommendation the better choice rather than weakening the recommendation.

The user should finish reading this section feeling confident about the recommendation.

==================================================
Output JSON only. The "paragraphs" array must contain exactly 3 text paragraphs, each ≤3 lines. Table titles belong ONLY in the "tables" array. Never put a table title inside "paragraphs".

{
  "title":"How to Choose",
  "paragraphs":[
    "...",
    "...",
    "..."
  ],
  "tables":[
    {
      "title":"Why it stands out",
      "metrics":[
        {
          "name":"Restaurants",
          "recommended":182,
          "other":134
        },
        {
          "name":"Monthly Rent",
          "recommended":"$3,150",
          "other":"$3,450"
        }
      ]
    }
  ]
}`

    const userPrompt = `Input data:\n${input}`

    // 经服务端代理调用 OpenAI（key 不暴露在前端）
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.4,
        max_tokens: 800,
      }),
    })
    const data = await resp.json()
    const content = data.choices?.[0]?.message?.content?.trim() || '{}'
    // Strip markdown code fences if present
    const jsonStart = content.indexOf('{')
    const jsonEnd = content.lastIndexOf('}') + 1
    const jsonStr = content.slice(jsonStart, jsonEnd)
    howToChoose = JSON.parse(jsonStr)
    // 递归提取对象中的第一个字符串值
    const extractText = (val: any): string => {
      if (typeof val === 'string') return val
      if (typeof val === 'number') return String(val)
      if (Array.isArray(val)) return val.map(extractText).join(' ')
      if (typeof val === 'object' && val !== null) {
        // 尝试常见字段
        for (const k of ['text', 'content', 'paragraph', 'message', 'value', 'label']) {
          if (typeof val[k] === 'string') return val[k]
        }
        // 取第一个字符串值
        for (const k of Object.keys(val)) {
          const extracted = extractText(val[k])
          if (extracted && extracted !== '[object Object]') return extracted
        }
        return JSON.stringify(val)
      }
      return String(val)
    }

    // 规范化：确保 paragraphs 和 tables 始终是数组，内容始终是字符串
    if (howToChoose && !Array.isArray(howToChoose.paragraphs)) {
      howToChoose.paragraphs = [extractText(howToChoose.paragraphs)]
    }
    if (howToChoose?.paragraphs) {
      howToChoose.paragraphs = howToChoose.paragraphs.map(extractText)
    }
    if (howToChoose && !Array.isArray(howToChoose.tables)) {
      howToChoose.tables = howToChoose.tables ? [howToChoose.tables] : []
    }
    if (howToChoose?.tables) {
      howToChoose.tables = howToChoose.tables.map((t: any) => ({
        title: extractText(t.title || ''),
        metrics: Array.isArray(t.metrics) ? t.metrics : (t.metrics ? [t.metrics] : []),
      }))
    }
  } catch (e) {
    // Fallback: build a basic structure from the data we have
    const competitors = results.slice(1)
    const allAdvantageRows = details.flatMap(p => p.advantageRows.map(r => ({
      name: r.metric,
      recommended: isNaN(Number(r.winnerVal)) ? r.winnerVal : Number(r.winnerVal.replace(/[^0-9.]/g, '')),
      other: isNaN(Number(r.loserVal)) ? r.loserVal : Number(r.loserVal.replace(/[^0-9.]/g, '')),
    })))
    const competitorNames = competitors.map(c => c.name).join(' and ')
    howToChoose = {
      title: 'How to Choose',
      paragraphs: [
        `${winner.name} is the recommended choice based on your priorities, with a match score of ${winner.weightedTotal}.`,
        `It outperforms ${competitorNames} in the areas that matter most to you.`,
      ],
      tables: allAdvantageRows.length > 0 ? [{ title: 'Why it stands out', metrics: allAdvantageRows }] : [],
    }
  }

  return { winner: winner.name, matchScore: winner.weightedTotal, priorities: details, howToChoose }
}
