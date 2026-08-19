/**
 * 格式化工具函数
 */

/** 格式化金额：$2,800 */
export function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US')
}

/** 格式化范围：$2,800 - $3,500 */
export function formatRange(min: number, max: number): string {
  return `${formatCurrency(min)} – ${formatCurrency(max)}`
}

/** 格式化百分比：8% / -3% */
export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${Math.round(value)}%`
}

/** 格式化变化量：+12 / -3 */
export function formatChange(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}`
}

/** 格式化通勤时间：25分钟 */
export function formatMinutes(minutes: number): string {
  return `约${minutes}分钟`
}
