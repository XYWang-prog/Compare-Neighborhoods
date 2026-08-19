import type { OverallTrend } from '../../data/types'

const LABELS: Record<OverallTrend, { emoji: string; text: string; bg: string; color: string; border: string }> = {
  developing: { emoji: '', text: 'Growing', bg: '#DCFCE7', color: '#166534', border: '#86EFAC' },
  stable:     { emoji: '', text: 'Stable',  bg: '#DBEAFE', color: '#1E40AF', border: '#93C5FD' },
  declining:  { emoji: '', text: 'Declining', bg: '#FEE2E2', color: '#991B1B', border: '#FCA5A5' },
}

interface TrendIndicatorProps {
  overall: OverallTrend
}

function TrendIndicator({ overall }: TrendIndicatorProps) {
  const s = LABELS[overall]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{ backgroundColor: s.bg, color: s.color, borderColor: s.border }}
    >
      {s.text}
    </span>
  )
}

export default TrendIndicator
