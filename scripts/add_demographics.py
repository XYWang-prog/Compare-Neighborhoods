#!/usr/bin/env python3
"""Add race demographics + fix YoY changes to absolute numbers + sparkline values"""
import json, random, requests, os
from pathlib import Path
from collections import defaultdict
from collections import defaultdict

os.chdir(Path(__file__).parent.parent)

def read_key(name):
    # 从环境变量或 .env.local 读取 API key（不硬编码在代码里，公开仓库安全）
    val = os.environ.get(name, '').strip()
    if val:
        return val
    env_file = Path(__file__).parent.parent / '.env.local'
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            if line.startswith(name + '='):
                return line.split('=', 1)[1].strip()
    raise SystemExit(f'缺少 {name}：请在 .env.local 或环境变量中配置')

# Fetch ACS race data
key = read_key('CENSUS_API_KEY')
url = 'https://api.census.gov/data/2023/acs/acs5'
vars_race = 'B03002_001E,B03002_003E,B03002_004E,B03002_006E,B03002_012E'

print('Fetching ACS race data...')
acs_race = {}
for state, county in [('36','061'),('36','047'),('36','081'),('36','005'),('36','085')]:
    r = requests.get(url, params={'get': vars_race, 'for': 'tract:*', 'in': f'state:{state} county:{county}', 'key': key}, timeout=30)
    data = r.json()
    for row in data[1:]:
        d = dict(zip(data[0], row))
        geoid = d['state'] + d['county'] + d['tract']
        acs_race[geoid] = d
    print(f'  county={county}: {len(data)-1}')
print(f'  Total: {len(acs_race)}')

# Load living areas
with open('src/data/mock/livingAreas.ts', 'r', encoding='utf-8') as f: ts = f.read()
start = ts.find('export const livingAreas: LivingArea[] = ') + len('export const livingAreas: LivingArea[] = ')
end = start; depth = 0
for i in range(start, len(ts)):
    if ts[i] == '[': depth += 1
    elif ts[i] == ']':
        depth -= 1
        if depth == 0: end = i + 1; break
areas = json.loads(ts[start:end])

# Aggregate race data by TRACT (from the NTA raw data)
print('Aggregating race by tract...')
# We have tract→NTA mapping from nta_raw.geojson
with open('data/nta_raw.geojson') as f: nta_raw = json.load(f)

# Build: NTA name → list of tract GEOIDs
nta_tracts = defaultdict(list)
for feat in nta_raw['features']:
    nta = feat['properties']['ntaname']
    gid = feat['properties'].get('geoid', '')
    if nta and gid:
        nta_tracts[nta].append(gid)

# For each Living Area (FirstMove name → NTA name), aggregate race
print('Adding race demographics...')
race_by_area = {}
for a in areas:
    nta_name = a.get('neighborhood', '')  # NTA name from build_clean_circles
    geoids = nta_tracts.get(nta_name, [])

    # If no NTA match, use centroid to find nearest NTA
    if not geoids:
        cent = a.get('centroid', [-74, 40.7])
        best_nta = None; best_d = float('inf')
        for nta, gids in nta_tracts.items():
            if not gids: continue
            d = (cent[0] + 74)**2 + (cent[1] - 40.7)**2
            if d < best_d: best_d = d; best_nta = nta
        if best_nta:
            geoids = nta_tracts[best_nta]

    totals = {'white': 0, 'black': 0, 'asian': 0, 'hispanic': 0, 'total': 0}
    for gid in geoids:
        acs = acs_race.get(gid, {})
        for key, race_key in [('B03002_003E','white'),('B03002_004E','black'),('B03002_006E','asian'),('B03002_012E','hispanic'),('B03002_001E','total')]:
            try:
                v = int(float(acs.get(key, 0) or 0))
                if v > 0: totals[race_key] += v
            except: pass

    if totals['total'] > 0:
        race_by_area[a['id']] = {
            'white': round(totals['white'] / totals['total'] * 100),
            'black': round(totals['black'] / totals['total'] * 100),
            'asian': round(totals['asian'] / totals['total'] * 100),
            'hispanic': round(totals['hispanic'] / totals['total'] * 100),
            'other': round(100 - (totals['white']+totals['black']+totals['asian']+totals['hispanic']) / totals['total'] * 100),
        }

# Update living areas: fix YoY to show absolute numbers + add race data
random.seed(42)
for a in areas:
    m = a['metrics']
    sl = a['trends'].get('sparklines', {})

    if sl.get('rent') and len(sl['rent']) >= 12:
        r0, r11 = sl['rent'][0]['value'], sl['rent'][11]['value']
        c0, c11 = sl['crime'][0]['value'], sl['crime'][11]['value']
        rest0, rest11 = sl['restaurantCount'][0]['value'], sl['restaurantCount'][11]['value']

        rent_chg = round((r11 - r0) / r0 * 100, 1)
        crime_chg = round(c11 - c0, 1)
        resto_chg = int(rest11 - rest0)
        pop = m.get('populationDensity', 50000)
        pop_chg = int(pop * random.uniform(-0.03, 0.05))

        # Store absolute numbers + sparkline values
        a['trends']['sparklineValues'] = {
            'rentCurrent': int(r11),
            'rentChange': rent_chg,
            'crimeCurrent': round(c11, 1),
            'crimeChange': crime_chg,
            'restaurantCurrent': int(rest11),
            'restaurantChange': resto_chg,
            'population': pop,
            'populationChange': pop_chg,
        }

        # YoY changes with absolute numbers
        a['trends']['changes'] = [
            {'label': f'Rent ${int(r11):,}/mo', 'value': f'{rent_chg:+.1f}%', 'direction': 'worsening' if rent_chg > 0 else 'improving', 'icon': 'rent', 'detail': f'was ${int(r0):,}'},
            {'label': f'Crime rate {c11:.1f}', 'value': f'{crime_chg:+.1f}', 'direction': 'improving' if crime_chg < 0 else 'worsening', 'icon': 'crime', 'detail': f'was {c0:.1f}'},
            {'label': f'Restaurants: {int(rest11)}', 'value': f'{resto_chg:+d}', 'direction': 'improving' if resto_chg >= 0 else 'worsening', 'icon': 'restaurant', 'detail': f'was {int(rest0)}'},
            {'label': f'Population: {pop:,}', 'value': f'{pop_chg:+,}', 'direction': 'improving' if pop_chg >= 0 else 'worsening', 'icon': 'rent', 'detail': 'YoY change'},
        ]

    # Add race demographics + age distribution
    if a['id'] in race_by_area:
        a['demographics'] = race_by_area[a['id']]
    else:
        a['demographics'] = {'white': 35, 'black': 25, 'asian': 15, 'hispanic': 20, 'other': 5}
    # Add age distribution change (simulated per area)
    a['demographics']['ageChange'] = [
        {'label': '20-29', 'current': random.randint(20, 40), 'change': round(random.uniform(-3, 5), 1)},
        {'label': '30-39', 'current': random.randint(20, 35), 'change': round(random.uniform(-2, 4), 1)},
        {'label': '40-49', 'current': random.randint(15, 30), 'change': round(random.uniform(-2, 3), 1)},
        {'label': '50+', 'current': random.randint(10, 25), 'change': round(random.uniform(-1, 2), 1)},
    ]

new_json = json.dumps(areas, ensure_ascii=False)
new_ts = ts[:start] + new_json + ts[end:]
Path('src/data/mock/livingAreas.ts').write_text(new_ts, encoding='utf-8')
print(f'Saved ({len(new_ts)/1024:.0f} KB)')

# Sample
for a in areas[:3]:
    print(f"\n{a['name']}:")
    for c in a['trends']['changes']:
        print(f"  {c['label']}: {c['value']}")
    if 'demographics' in a:
        d = a['demographics']
        print(f"  Race: W{d.get('white',0)}% B{d.get('black',0)}% A{d.get('asian',0)}% H{d.get('hispanic',0)}%")
