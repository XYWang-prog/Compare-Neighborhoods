import { livingAreas } from '../data/mock/livingAreas'

/** Euclidean distance between two neighborhoods (normalized features) */
function distance(a: any, b: any): number {
  const features = [
    (a.metrics.rentByBedroom.oneBr - b.metrics.rentByBedroom.oneBr) / 2000,
    ((a.metrics.restaurantCount || 0) - (b.metrics.restaurantCount || 0)) / 100,
    ((a.metrics.barCount || 0) - (b.metrics.barCount || 0)) / 50,
    ((a.metrics.supermarketCount || 0) - (b.metrics.supermarketCount || 0)) / 20,
    ((a.demographics?.medianAge || 35) - (b.demographics?.medianAge || 35)) / 10,
    ((a.demographics?.white || 50) - (b.demographics?.white || 50)) / 20,
    ((a.metrics.crimeRate || 25) - (b.metrics.crimeRate || 25)) / 10,
  ]
  return Math.sqrt(features.reduce((s, v) => s + v * v, 0))
}

/** Haversine distance in km */
function haversine(a: any, b: any): number {
  const R = 6371
  const dlat = (b.centroid[1] - a.centroid[1]) * Math.PI / 180
  const dlng = (b.centroid[0] - a.centroid[0]) * Math.PI / 180
  const lat1 = a.centroid[1] * Math.PI / 180
  const lat2 = b.centroid[1] * Math.PI / 180
  const h = Math.sin(dlat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h))
}

/** Find top N similar neighborhoods within maxDist km, excluding selected ones */
export function findSimilar(area: any, excludeIds: string[], count = 2, maxDistKm = 5): any[] {
  return livingAreas
    .filter(a => !excludeIds.includes(a.id) && haversine(area, a) <= maxDistKm)
    .map(a => ({ ...a, simScore: Math.round((1 - distance(area, a) / 5) * 100) }))
    .filter(a => a.simScore > 0)
    .sort((a, b) => b.simScore - a.simScore)
    .slice(0, count)
}
