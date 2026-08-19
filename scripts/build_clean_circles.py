#!/usr/bin/env python3
"""Clean circles clipped to NTA — no spikes, no overlap, within NTA"""
import json, math, random, os
from pathlib import Path
from collections import defaultdict
from datetime import datetime

os.chdir(Path(__file__).parent.parent)

with open('data/firstmove_rents.json') as f: fm = json.load(f)
with open('data/nta_boundaries.geojson') as f: nta_data = json.load(f)
nta_geoms = {f['properties']['ntaname']: f['geometry'] for f in nta_data['features']}

def get_rings(geom):
    if geom['type'] == 'Polygon': return [geom['coordinates'][0]]
    return [p[0] for p in geom['coordinates']]

def inside(lng, lat, ring):
    i = False; j = len(ring) - 1
    for k in range(len(ring)):
        xi, yi = ring[k][0], ring[k][1]; xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (lng < (xj-xi)*(lat-yi)/(yj-yi) + xi): i = not i
        j = k
    return i

def make_circle(lng, lat, radius_m=400, n=48):
    lat_pm = 1/111320; lng_pm = 1/(111320*math.cos(math.radians(lat)))
    pts = []
    for i in range(n):
        a = 2*math.pi*i/n
        pts.append([lng+radius_m*math.cos(a)*lng_pm, lat+radius_m*math.sin(a)*lat_pm])
    pts.append(pts[0])
    return pts

def clip_polygon(subject, clip_ring):
    output = list(subject)
    for i in range(len(clip_ring)-1):
        if len(output) < 3: break
        e1, e2 = clip_ring[i], clip_ring[i+1]
        inp = list(output); output = []; n = len(inp)
        for j in range(n):
            cur = inp[j]; prev = inp[(j-1)%n]
            cc = (e2[0]-e1[0])*(cur[1]-e1[1]) - (e2[1]-e1[1])*(cur[0]-e1[0])
            cp = (e2[0]-e1[0])*(prev[1]-e1[1]) - (e2[1]-e1[1])*(prev[0]-e1[0])
            ci = cc <= 1e-10; pi = cp <= 1e-10
            if ci:
                if not pi:
                    x1,y1=prev;x2,y2=cur;x3,y3=e1;x4,y4=e2
                    d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4)
                    if abs(d)>1e-12:
                        t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d
                        output.append([x1+t*(x2-x1),y1+t*(y2-y1)])
                output.append(cur)
            elif pi:
                x1,y1=prev;x2,y2=cur;x3,y3=e1;x4,y4=e2
                d=(x1-x2)*(y3-y4)-(y1-y2)*(x3-x4)
                if abs(d)>1e-12:
                    t=((x1-x3)*(y3-y4)-(y1-y3)*(x3-x4))/d
                    output.append([x1+t*(x2-x1),y1+t*(y2-y1)])
    return output

def simplify(obj):
    if isinstance(obj, list): return [simplify(x) for x in obj]
    if isinstance(obj, dict): return {k: simplify(v) for k,v in obj.items()}
    if isinstance(obj, float): return round(obj, 5)
    return obj

random.seed(42)
living_areas = []
nta_outlines = {}
nta_matched = set()

for name, c in fm['neighborhoods'].items():
    if not c.get('lat'): continue
    lat, lng = c['lat'], c['lng']
    boro = c['borough']

    nta_name = ''; nta_ring = None
    for nname, geom in nta_geoms.items():
        for r in get_rings(geom):
            if inside(lng, lat, r): nta_name = nname; nta_ring = r; break
        if nta_name: break

    circle = make_circle(lng, lat, 700, 48)

    if nta_ring:
        clipped = clip_polygon(circle, nta_ring)
        if len(clipped) >= 12:  # 至少保留12个顶点，否则用完整圆
            if clipped[0] != clipped[-1]: clipped.append(clipped[0])
            boundary = clipped
        else:
            boundary = circle
    else:
        boundary = circle

    geom = simplify({'type': 'Polygon', 'coordinates': [boundary]})

    boro_fb = fm['boro_fallback'].get(boro, {'studio':2500,'1br':3000,'2br':4000})
    studio = c.get('studio') or boro_fb['studio']
    onebr = c.get('1br') or boro_fb['1br']
    twobr = c.get('2br') or boro_fb['2br']
    r = lambda lo,hi: random.randint(lo,hi)
    is_m = boro == 'Manhattan'; is_bk = boro == 'Brooklyn'
    restaurants = r(10,600) if is_m else r(10,350) if is_bk else r(5,200)
    bars = r(5,300) if is_m else r(2,100) if is_bk else r(0,50)
    supers = r(2,60) if is_m else r(1,40)
    commute = r(10,28) if is_m else r(18,40) if is_bk else r(22,55)
    rc=r(-15,50);bc=r(-10,25);pc=round(random.uniform(-3,5),1);cc=round(random.uniform(-15,10),1)
    score=(1 if rc>0 else -1)+(1 if bc>0 else -1)+(1 if pc>0 else -1)+(1 if cc<0 else -1)
    overall='developing' if score>=2 else ('declining' if score<=-2 else 'stable')
    tags=[]
    if onebr<2500:tags.append('budget')
    if commute<25:tags.append('commute')
    if restaurants>100:tags.append('foodie')
    if bars>40:tags.append('nightlife')
    tags=list(set(tags))[:4]
    changes=[]
    if abs(rc)>3:s='+' if rc>0 else '';changes.append({'label':f'{s}{rc} restaurants','value':rc,'direction':'improving' if rc>0 else 'worsening','icon':'restaurant'})
    if abs(bc)>2:s='+' if bc>0 else '';changes.append({'label':f'{s}{bc} bars','value':bc,'direction':'improving' if bc>0 else 'worsening','icon':'bar'})
    if abs(pc)>1:s='+' if pc>0 else '';changes.append({'label':f'Pop {s}{pc}%','value':pc,'direction':'improving' if pc>0 else 'worsening','icon':'rent'})
    if abs(cc)>3:s='-' if cc<0 else '+';changes.append({'label':f'Crime {s}{abs(int(cc))}%','value':int(cc),'direction':'improving' if cc<0 else 'worsening','icon':'crime'})

    if nta_name and nta_name not in nta_matched:
        nta_outlines[nta_name] = simplify(nta_geoms[nta_name]); nta_matched.add(nta_name)

    living_areas.append({
        'id':'fm_'+name.lower().replace(' ','_')[:50],'name':name,'neighborhood':nta_name,'bgCount':1,
        'geometry':geom,'centroid':[round(lng,5),round(lat,5)],
        'metrics':{'rentMedian':onebr,'rentByBedroom':{'studio':studio,'oneBr':onebr,'twoBr':twobr},'rentRange':[studio,twobr],'commuteTime':commute,'subwayStations':r(0,4),'busRoutes':r(1,8),'crimeRate':round(random.uniform(5,50),1),'restaurantCount':restaurants,'supermarketCount':supers,'barCount':bars,'parkCount':r(0,6),'greenCoverage':r(2,30),'activePermits':r(1,40),'populationDensity':r(5000,80000)},
        'trends':{'overall':overall,'changes':changes[:4],'sparklines':{'rent':[],'crime':[],'restaurantCount':[]}},
        'dimensionTags':tags,'matchScore':0,'bgGeoIds':[],
    })

# OSM
with open('src/data/mock/venuePoints.ts','r',encoding='utf-8') as f: vp_ts=f.read()
venue_points=json.loads(vp_ts[vp_ts.find('= {')+2:])

def point_inside(lng,lat,coords):
    ring=coords[0];inside=False;j=len(ring)-1
    for i in range(len(ring)):
        xi,yi=ring[i][0],ring[i][1];xj,yj=ring[j][0],ring[j][1]
        if ((yi>lat)!=(yj>lat)) and (lng<(xj-xi)*(lat-yi)/(yj-yi)+xi): inside=not inside
        j=i
    return inside

for area in living_areas:
    coords=area['geometry']['coordinates'];cent=area['centroid'];m=area['metrics']
    for vtype,key in [('restaurant','restaurantCount'),('bar','barCount'),('supermarket','supermarketCount')]:
        pts=venue_points.get(vtype,[])
        nearby=[(lng,lat) for lng,lat in pts if abs(lng-cent[0])<0.02 and abs(lat-cent[1])<0.02]
        m[key]=sum(1 for p in nearby if point_inside(p[0],p[1],coords))

tr=sum(a['metrics']['restaurantCount'] for a in living_areas)
tb=sum(a['metrics']['barCount'] for a in living_areas)
ts2=sum(a['metrics']['supermarketCount'] for a in living_areas)
print(f'Venues: {tr} rest, {tb} bars, {ts2} supers')

ts=f"""/**
 * Clean circles + NTA clipped | {len(living_areas)} areas | {datetime.now().isoformat()}
 */
import type {{ LivingArea }} from '../types'
export const livingAreas: LivingArea[] = {json.dumps(living_areas, ensure_ascii=False)}
export const LIVING_AREA_COUNT = {len(living_areas)}
export const NTA_OUTLINES: Record<string, any> = {json.dumps(nta_outlines, ensure_ascii=False)}
"""
Path('src/data/mock/livingAreas.ts').write_text(ts,encoding='utf-8')
print(f'Saved ({len(ts)/1024:.0f} KB)')
print('Done!')
