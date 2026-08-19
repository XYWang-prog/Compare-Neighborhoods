import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { livingAreas } from '../data/mock/livingAreas'

function OnboardingPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // 从 URL 恢复之前选的区域（从后页返回时不丢失），只接受合法的区域 id
  const validIds = new Set(livingAreas.map(a => a.id))
  const fromParam = (key: string) => {
    const v = params.get(key) || ''
    return validIds.has(v) ? v : ''
  }
  const [areaA, setAreaA] = useState(() => fromParam('areaA'))
  const [areaB, setAreaB] = useState(() => fromParam('areaB'))
  const [areaC, setAreaC] = useState(() => fromParam('areaC'))

  const handleCompare = () => {
    if (!areaA || !areaB) return
    let url = `/preferences?areaA=${areaA}&areaB=${areaB}`
    if (areaC) url += `&areaC=${areaC}`
    // 把 URL 里已有的其他参数（租金/户型/通勤/优先级）原样带过去，全程不丢失
    const rest = new URLSearchParams(params.toString())
    rest.delete('areaA'); rest.delete('areaB'); rest.delete('areaC')
    const restStr = rest.toString()
    if (restStr) url += `&${restStr}`
    navigate(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-10 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Compare Neighborhoods
        </h1>

        {/* Area A */}
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Neighborhood A
        </label>
        <select
          value={areaA}
          onChange={(e) => setAreaA(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a neighborhood...</option>
          {[...livingAreas].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Area B */}
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Neighborhood B
        </label>
        <select
          value={areaB}
          onChange={(e) => setAreaB(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm mb-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a neighborhood...</option>
          {[...livingAreas].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Area C (optional) */}
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Neighborhood C <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <select
          value={areaC}
          onChange={(e) => setAreaC(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm mb-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a neighborhood...</option>
          {[...livingAreas].sort((a, b) => a.name.localeCompare(b.name)).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <button
          onClick={handleCompare}
          disabled={!areaA || !areaB}
          className={`w-full py-3 rounded-lg font-semibold text-sm transition ${
            areaA && areaB
              ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Compare →
        </button>
      </div>
    </div>
  )
}

export default OnboardingPage
