import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'

const CHARACTERISTICS = [
  { key: 'affordable', label: '💰 Affordable Living', icon: '💰' },
  { key: 'dining', label: '🍽️ Dining & Entertainment', icon: '🍽️' },
  { key: 'convenience', label: '🛒 Daily Convenience', icon: '🛒' },
  { key: 'commute', label: '🚇 Easy Commute', icon: '🚇' },
  { key: 'safety', label: '🛡️ Safety', icon: '🛡️' },
  { key: 'fitness', label: '💪 Fitness & Wellness', icon: '💪' },
  { key: 'family', label: '👨‍👩‍👧 Family Friendly', icon: '👨‍👩‍👧' },
  { key: 'young', label: '🎉 Young & Social', icon: '🎉' },
  { key: 'diverse', label: '🌍 Diverse Community', icon: '🌍' },
  { key: 'quiet', label: '🌳 Quiet Living', icon: '🌳' },
]

function PriorityPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // 从 URL 恢复之前的选择（从对比页 Back 回来时保留），只接受合法特征键且最多 4 个
  const validKeys = new Set(CHARACTERISTICS.map(c => c.key))
  const [selected, setSelected] = useState<string[]>(() => {
    // 取 URL 里最后一次出现的 priorities 值（历史上可能有重复参数，get() 只取第一个旧值）
    const raw = params.getAll('priorities').pop() || ''
    return [...new Set(raw.split(','))].filter(k => validKeys.has(k)).slice(0, 4)
  })

  const toggle = (key: string) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleNext = () => {
    // 先移除 URL 里已有的 priorities 再写入本次选择：
    // 否则会出现两个同名参数，而 get() 只读第一个旧值，新选择会被忽略
    const next = new URLSearchParams(params)
    next.delete('priorities')
    const prio = selected.join(',')
    if (prio) next.set('priorities', prio)
    navigate(`/compare?${next.toString()}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-10 w-full max-w-2xl">
        <div className="text-xs text-gray-400 mb-1">Step 3 of 3</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">What Matters Most?</h1>
        <p className="text-sm text-gray-500 mb-8">Select up to 4 characteristics and rank them by priority</p>

        {/* Priority slots */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[0, 1, 2, 3].map(i => {
            const key = selected[i]
            const char = CHARACTERISTICS.find(c => c.key === key)
            return (
              <div key={i}
                className={`h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-xs transition ${
                  char ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'
                }`}>
                <span className="text-[10px] text-gray-400 mb-1">Priority {i + 1}</span>
                {char ? (
                  <>
                    <span className="text-lg">{char.icon}</span>
                    <span className="font-medium text-gray-700 text-[10px] text-center leading-tight">{char.label.replace(/^[^\s]+\s/, '')}</span>
                  </>
                ) : (
                  <span className="text-gray-300 text-lg">+</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Characteristic pool */}
        <div className="grid grid-cols-5 gap-2 mb-8">
          {CHARACTERISTICS.map(c => {
            const idx = selected.indexOf(c.key)
            const isSelected = idx >= 0
            return (
              <button key={c.key} onClick={() => toggle(c.key)}
                disabled={!isSelected && selected.length >= 4}
                className={`p-3 rounded-xl border text-center text-xs transition ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : selected.length >= 4
                    ? 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}>
                <div className="text-lg mb-1">{c.icon}</div>
                <div className="leading-tight">{c.label.replace(/^[^\s]+\s/, '')}</div>
                {isSelected && (
                  <div className="text-[10px] mt-1 opacity-80">#{idx + 1}</div>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3">
          <Link to={`/preferences?${params.toString()}`}
            className="flex-1 py-3 text-center text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
            ← Back
          </Link>
          <button onClick={handleNext} disabled={selected.length === 0}
            className={`flex-1 py-3 rounded-lg font-semibold text-sm ${
              selected.length > 0 ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}>
            Compare →
          </button>
        </div>
      </div>
    </div>
  )
}

export default PriorityPage
