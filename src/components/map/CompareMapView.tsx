import { useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { MAPBOX_TOKEN, MAP_CENTER, MAP_DEFAULT_ZOOM } from '../../data/constants'
import { VENUE_POINTS } from '../../data/mock/venuePoints'
import type { LivingArea } from '../../data/types'

mapboxgl.accessToken = MAPBOX_TOKEN

interface CompareMapViewProps {
  areaA: LivingArea
  areaB: LivingArea
  areaC?: LivingArea | null
  venueType: string | null
}

function CompareMapView({ areaA, areaB, areaC, venueType }: CompareMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const ready = useRef(false)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    const map = new mapboxgl.Map({
      container: mapContainer.current, style: 'mapbox://styles/mapbox/light-v11',
      center: MAP_CENTER, zoom: MAP_DEFAULT_ZOOM,
    })
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    mapRef.current = map

    map.on('style.load', () => {
      ready.current = true
      // Area A (blue)
      map.addSource('a', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: areaA.geometry } as any })
      map.addLayer({ id: 'fill-a', type: 'fill', source: 'a', paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.35 } })
      map.addLayer({ id: 'line-a', type: 'line', source: 'a', paint: { 'line-color': '#1D4ED8', 'line-width': 2 } })
      // Area B (orange)
      map.addSource('b', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: areaB.geometry } as any })
      map.addLayer({ id: 'fill-b', type: 'fill', source: 'b', paint: { 'fill-color': '#EA580C', 'fill-opacity': 0.35 } })
      map.addLayer({ id: 'line-b', type: 'line', source: 'b', paint: { 'line-color': '#C2410C', 'line-width': 2 } })
      // Area C (green)
      if (areaC) {
        map.addSource('c', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: areaC.geometry } as any })
        map.addLayer({ id: 'fill-c', type: 'fill', source: 'c', paint: { 'fill-color': '#10B981', 'fill-opacity': 0.35 } })
        map.addLayer({ id: 'line-c', type: 'line', source: 'c', paint: { 'line-color': '#059669', 'line-width': 2 } })
      }
      // Centers
      const cfs: any[] = [
        { type: 'Feature', properties: { name: areaA.name }, geometry: { type: 'Point', coordinates: areaA.centroid } },
        { type: 'Feature', properties: { name: areaB.name }, geometry: { type: 'Point', coordinates: areaB.centroid } },
      ]
      if (areaC) cfs.push({ type: 'Feature', properties: { name: areaC.name }, geometry: { type: 'Point', coordinates: areaC.centroid } })
      map.addSource('centers', { type: 'geojson', data: { type: 'FeatureCollection', features: cfs } as any })
      map.addLayer({ id: 'dot-a', type: 'circle', source: 'centers', filter: ['==', ['get', 'name'], areaA.name], paint: { 'circle-radius': 6, 'circle-color': '#2563EB', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      map.addLayer({ id: 'dot-b', type: 'circle', source: 'centers', filter: ['==', ['get', 'name'], areaB.name], paint: { 'circle-radius': 6, 'circle-color': '#EA580C', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      if (areaC) map.addLayer({ id: 'dot-c', type: 'circle', source: 'centers', filter: ['==', ['get', 'name'], areaC.name], paint: { 'circle-radius': 6, 'circle-color': '#10B981', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
      // Venues
      map.addSource('venues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'venue-dots', type: 'circle', source: 'venues', paint: { 'circle-radius': 3.5, 'circle-color': ['get', 'color'], 'circle-opacity': 0.7, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })
      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
      map.on('mousemove', 'venue-dots', (e: any) => {
        if (e.features?.[0]?.properties?.venueName) {
          map.getCanvas().style.cursor = 'pointer'
          popup.setLngLat(e.lngLat).setHTML(`<span style='font-size:11px'>${e.features[0].properties.venueName}</span>`).addTo(map)
        }
      })
      map.on('mouseleave', 'venue-dots', () => { map.getCanvas().style.cursor = ''; popup.remove() })
      // Fit bounds
      const bounds = new mapboxgl.LngLatBounds()
      for (const area of [areaA, areaB, areaC].filter(Boolean)) {
        const coords = area!.geometry.type === 'MultiPolygon' ? area!.geometry.coordinates[0][0] : area!.geometry.coordinates[0]
        for (const c of coords) bounds.extend(c as [number, number])
      }
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 })
    })
    return () => { map.remove(); mapRef.current = null; ready.current = false }
  }, [])

  useEffect(() => {
    const map = mapRef.current; if (!map || !ready.current) return
    const src = map.getSource('venues') as mapboxgl.GeoJSONSource; if (!src) return
    if (venueType) {
      const colors: Record<string, string> = { restaurant: '#EF4444', bar: '#F59E0B', supermarket: '#10B981', cafe: '#F97316', gym: '#8B5CF6', pharmacy: '#EC4899', subway: '#1D4ED8', bus_stop: '#6B7280', mall: '#D946EF' }
      const pts = VENUE_POINTS[venueType] || []; const color = colors[venueType] || '#6B7280'
      const inside = (lng: number, lat: number, ring: any[]) => {
        let r = false; let j = ring.length - 1
        for (let i = 0; i < ring.length; i++) { const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]; if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) r = !r; j = i }
        return r
      }
      const rings: any[][] = []
      for (const area of [areaA, areaB, areaC].filter(Boolean)) {
        const r = area!.geometry.type === 'MultiPolygon' ? (area!.geometry as any).coordinates[0][0] : (area!.geometry as any).coordinates[0]
        rings.push(r)
      }
      const features = pts.filter((p: any) => rings.some((r: any) => inside(p[0], p[1], r))).map((p: any) => ({
        type: 'Feature', properties: { color, venueName: p[2] || '' }, geometry: { type: 'Point', coordinates: [p[0], p[1]] },
      }))
      src.setData({ type: 'FeatureCollection', features } as any)
    } else { src.setData({ type: 'FeatureCollection', features: [] }) }
  }, [venueType, areaA, areaB, areaC])

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute bottom-10 left-3 bg-white/90 rounded-lg px-3 py-2 text-xs shadow">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
          <span className="text-gray-700">{areaA.name}</span>
        </div>
        {areaC ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-orange-600 inline-block" />
              <span className="text-gray-700">{areaB.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-600 inline-block" />
              <span className="text-gray-700">{areaC.name}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-600 inline-block" />
            <span className="text-gray-700">{areaB.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompareMapView
