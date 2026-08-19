import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { WORK_LOCATIONS, geocodeAddress } from '../data/constants'

function PreferencesPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // 从 URL 参数恢复之前的选择（从对比页点 Back 回来时不丢失）
  const backLat = parseFloat(params.get('workLat') || '')
  const backLng = parseFloat(params.get('workLng') || '')
  const [rentMin, setRentMin] = useState(parseInt(params.get('rentMin') || '') || 2000)
  const [rentMax, setRentMax] = useState(parseInt(params.get('rentMax') || '') || 5000)
  const [aptType, setAptType] = useState(params.get('aptType') || '1br')
  const [commuteTime, setCommuteTime] = useState(parseInt(params.get('commuteTime') || '') || 30)
  const [commuteMode, setCommuteMode] = useState(params.get('commuteMode') || 'subway')
  // 通勤目的地
  const [destination, setDestination] = useState(params.get('commuteDest') || '')
  const [workCoords, setWorkCoords] = useState<[number, number] | null>(
    !isNaN(backLat) && !isNaN(backLng) ? [backLng, backLat] : null,
  )
  const [geocoding, setGeocoding] = useState(false)
  const [showPresets, setShowPresets] = useState(false)

  // 处理预设地点选择
  const selectPreset = (label: string, coords: [number, number]) => {
    setDestination(label)
    setWorkCoords(coords)
    setShowPresets(false)
  }

  // 处理自定义地址 geocoding
  const handleGeocode = async () => {
    if (!destination.trim()) return
    setGeocoding(true)
    const coords = await geocodeAddress(destination)
    if (coords) {
      setWorkCoords(coords)
    }
    setGeocoding(false)
  }

  const handleNext = () => {
    const areaA = params.get('areaA') || ''
    const areaB = params.get('areaB') || ''
    const areaC = params.get('areaC') || ''
    let url = `/priority?areaA=${areaA}&areaB=${areaB}`
    if (areaC) url += `&areaC=${areaC}`
    url += `&rentMin=${rentMin}&rentMax=${rentMax}`
    url += `&aptType=${aptType}&commuteTime=${commuteTime}&commuteMode=${commuteMode}`
    if (destination.trim()) url += `&commuteDest=${encodeURIComponent(destination)}`
    if (workCoords) url += `&workLat=${workCoords[1]}&workLng=${workCoords[0]}`
    // 从对比页返回时，把已选的社区特征优先级继续往下传
    const priorities = params.get('priorities') || ''
    if (priorities) url += `&priorities=${priorities}`
    navigate(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-10 w-full max-w-md">
        <div className="text-xs text-gray-400 mb-1">Step 2 of 3</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Preferences</h1>
        <p className="text-sm text-gray-500 mb-8">Help us understand your needs</p>

        {/* Rent */}
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          💰 Monthly Rent Budget
          <span className="text-blue-600 ml-2">${rentMin.toLocaleString()} – ${rentMax.toLocaleString()}</span>
        </label>
        <div className="mb-6">
          <input type="range" min={1000} max={8000} step={100} value={rentMin}
            onChange={e => { const v = +e.target.value; if (v <= rentMax) setRentMin(v) }}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
          <input type="range" min={1000} max={8000} step={100} value={rentMax}
            onChange={e => { const v = +e.target.value; if (v >= rentMin) setRentMax(v) }}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600 mt-1" />
        </div>

        {/* Apartment Type */}
        <label className="block text-sm font-semibold text-gray-700 mb-2">🏠 Apartment Type</label>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[{ value: 'studio', label: 'Studio' }, { value: '1br', label: '1BR' }, { value: '2br', label: '2BR' }].map(opt => (
            <button key={opt.value} onClick={() => setAptType(opt.value)}
              className={`py-2 rounded-lg text-xs font-medium border transition ${
                aptType === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Commute Destination */}
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          📍 Commute Destination
        </label>
        <div className="relative mb-3">
          <input
            type="text"
            value={destination}
            onChange={e => { setDestination(e.target.value); setWorkCoords(null) }}
            onFocus={() => setShowPresets(true)}
            onBlur={() => { handleGeocode(); setTimeout(() => setShowPresets(false), 200) }}
            onKeyDown={e => { if (e.key === 'Enter') { handleGeocode(); setShowPresets(false) } }}
            placeholder="e.g. Midtown Manhattan, or type an address..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {/* Geocoding indicator */}
          {geocoding && (
            <span className="absolute right-3 top-2 text-xs text-gray-400">Searching...</span>
          )}
          {workCoords && !geocoding && (
            <span className="absolute right-3 top-2 text-xs text-green-500">✓ Located</span>
          )}

          {/* Preset locations dropdown */}
          {showPresets && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {WORK_LOCATIONS.map(loc => (
                <button
                  key={loc.label}
                  onMouseDown={() => selectPreset(loc.label, loc.coords)}
                  className="w-full text-left px-3 py-2 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {loc.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Commute Mode */}
        <label className="block text-sm font-semibold text-gray-700 mb-2">Commute Mode</label>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { value: 'subway', label: '🚇 Subway' },
            { value: 'bus', label: '🚌 Bus' },
            { value: 'driving', label: '🚗 Drive' },
            { value: 'walk', label: '🚶 Walk' },
          ].map(opt => (
            <button key={opt.value} onClick={() => setCommuteMode(opt.value)}
              className={`py-1.5 rounded-lg text-xs font-medium border transition ${
                commuteMode === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Max Commute Time */}
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          ⏱ Max Commute: <span className="text-blue-600">{commuteTime} min</span>
        </label>
        <input type="range" min={10} max={90} step={5} value={commuteTime}
          onChange={e => setCommuteTime(+e.target.value)}
          className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-blue-600 mb-8" />

        <div className="flex gap-3">
          <Link to={`/?${params.toString()}`} className="flex-1 py-3 text-center text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
            ← Back
          </Link>
          <button onClick={handleNext}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700">
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

export default PreferencesPage
