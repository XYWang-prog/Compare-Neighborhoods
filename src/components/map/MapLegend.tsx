import { TREND_COLORS } from '../../data/constants'

/**
 * Map legend: Growing / Stable / Declining
 */
function MapLegend() {
  const trends = [
    { key: 'developing', ...TREND_COLORS.developing },
    { key: 'stable', ...TREND_COLORS.stable },
    { key: 'declining', ...TREND_COLORS.declining },
  ] as const

  return (
    <div className="flex items-center gap-4 text-xs text-gray-600">
      {trends.map((t) => (
        <div key={t.key} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: t.hex }}
          />
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  )
}

export default MapLegend
