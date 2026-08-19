import { useRef, useEffect } from 'react'
import mapboxgl from 'mapbox-gl'
import { MAPBOX_TOKEN, MAP_CENTER, MAP_DEFAULT_ZOOM, TREND_COLORS } from '../../data/constants'
import { useAppStore } from '../../store/useAppStore'
import type { LivingArea } from '../../data/types'
import type { FeatureCollection, Feature, GeoJsonProperties } from 'geojson'

mapboxgl.accessToken = MAPBOX_TOKEN

const FILL_LAYERS = ['la-developing', 'la-stable', 'la-declining']

interface ResultMapProps {
  areas: LivingArea[]
  venuePoints?: { type: string; points: [number, number, string?, string?][] } | null
}

function centersToGeoJSON(areas: LivingArea[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: areas.map((area) => ({
      type: 'Feature' as const,
      properties: { name: area.name },
      geometry: { type: 'Point' as const, coordinates: area.centroid },
    })),
  }
}

function tractsToGeoJSON(areas: LivingArea[]): FeatureCollection {
  const features: Feature[] = areas.map((area) => ({
    type: 'Feature' as const,
    properties: {
      id: area.id,
      name: area.name,
      overall: area.trends.overall,
      matchScore: area.matchScore,
    } as GeoJsonProperties,
    geometry: area.geometry,
  }))
  return { type: 'FeatureCollection', features }
}

function ResultMap({ areas, venuePoints }: ResultMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const ready = useRef(false)

  const selectArea = useAppStore((s) => s.selectArea)
  const selectedAreaId = useAppStore((s) => s.selectedAreaId)

  // Init map once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: MAP_CENTER,
      zoom: MAP_DEFAULT_ZOOM,
    })
    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.on('style.load', () => {
      ready.current = true

      // Tract fill layers
      map.addSource('tracts', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'la-developing', type: 'fill', source: 'tracts', filter: ['==', ['get', 'overall'], 'developing'], paint: { 'fill-color': TREND_COLORS.developing.hex, 'fill-opacity': 0.35 } })
      map.addLayer({ id: 'la-stable', type: 'fill', source: 'tracts', filter: ['==', ['get', 'overall'], 'stable'], paint: { 'fill-color': TREND_COLORS.stable.hex, 'fill-opacity': 0.35 } })
      map.addLayer({ id: 'la-declining', type: 'fill', source: 'tracts', filter: ['==', ['get', 'overall'], 'declining'], paint: { 'fill-color': TREND_COLORS.declining.hex, 'fill-opacity': 0.35 } })
      map.addLayer({ id: 'la-outline', type: 'line', source: 'tracts', paint: { 'line-color': '#000', 'line-width': 0 } })

      // NTA bold outline — rendered AFTER fills so it's on top
      // Center point markers (black dots)
      map.addSource('centers', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'center-points', type: 'circle', source: 'centers', paint: { 'circle-radius': 5, 'circle-color': '#1D4ED8', 'circle-opacity': 0.9, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })

      // Venue markers (restaurant/bar/supermarket dots)
      map.addSource('venues', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      const venuePopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 8 })
      map.addLayer({ id: 'venue-dots', type: 'circle', source: 'venues', paint: { 'circle-radius': 4, 'circle-color': ['get', 'color'], 'circle-opacity': 0.7, 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } })
      map.on('mousemove', 'venue-dots', (e) => {
        if (e.features?.[0]) {
          const p = e.features[0].properties
          const name = p?.name
          const desc = p?.desc
          if (name) {
            map.getCanvas().style.cursor = 'pointer'
            const html = desc ? `<strong style='font-size:11px'>${name}</strong><br/><span style='font-size:10px;color:#666'>${desc}</span>` : `<span style='font-size:11px'>${name}</span>`
            venuePopup.setLngLat(e.lngLat).setHTML(html).addTo(map)
          }
        }
      })
      map.on('mouseleave', 'venue-dots', () => {
        map.getCanvas().style.cursor = ''
        venuePopup.remove()
      })

      // Click on fill layers
      for (const lid of FILL_LAYERS) {
        map.on('click', lid, (e) => { if (e.features?.[0]) selectArea(e.features[0].properties!.id) })
      }
      map.on('click', (e) => {
        if (!map.queryRenderedFeatures(e.point, { layers: FILL_LAYERS }).length) selectArea(null)
      })

      // Initial data
      updateData(map)
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; ready.current = false }
  }, [])

  function updateData(map: mapboxgl.Map) {
    const src = map.getSource('tracts') as mapboxgl.GeoJSONSource
    if (src) src.setData(tractsToGeoJSON(areas))

    const centerSrc = map.getSource('centers') as mapboxgl.GeoJSONSource
    if (centerSrc) centerSrc.setData(centersToGeoJSON(areas))

    if (areas.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      for (const area of areas) {
        const coords = area.geometry.type === 'MultiPolygon'
          ? area.geometry.coordinates[0][0]
          : area.geometry.coordinates[0]
        for (const coord of coords) bounds.extend(coord as [number, number])
      }
      map.fitBounds(bounds, { padding: 50, maxZoom: 14 })
    }
  }

  // Update on data change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current) return
    updateData(map)
  }, [areas])

  // Venue markers update
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current) return
    const source = map.getSource('venues') as mapboxgl.GeoJSONSource
    if (!source) return
    if (venuePoints && venuePoints.points.length > 0) {
      const colors: Record<string, string> = { restaurant: '#EF4444', bar: '#F59E0B', supermarket: '#10B981', gym: '#8B5CF6', pharmacy: '#EC4899', cafe: '#F97316', subway: '#1D4ED8', bus_stop: '#6B7280' }
      const color = colors[venuePoints.type] || '#6B7280'
      const features = venuePoints.points.map(([lng, lat, name, desc]) => ({
        type: 'Feature' as const, properties: { color, name: name || '', desc: desc || '' },
        geometry: { type: 'Point' as const, coordinates: [lng, lat] },
      }))
      source.setData({ type: 'FeatureCollection', features } as any)
    } else {
      source.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [venuePoints])

  // Selected highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready.current) return
    if (selectedAreaId) {
      map.setFilter('la-outline', ['==', ['get', 'id'], selectedAreaId])
      map.setPaintProperty('la-outline', 'line-width', 2)
      map.setPaintProperty('la-outline', 'line-color', '#1D4ED8')
    } else {
      map.setPaintProperty('la-outline', 'line-width', 0)
    }
  }, [selectedAreaId])

  return <div ref={mapContainer} className="w-full h-full" />
}

export default ResultMap
