#!/usr/bin/env python3
"""Precompute commute times for 20 work locations × 170 neighborhoods × 4 modes"""
import json, requests, time, os
from pathlib import Path

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

key = read_key('GOOGLE_GEOCODE_KEY')

with open('src/data/mock/livingAreas.ts', 'r', encoding='utf-8') as f: ts = f.read()
start = ts.find('export const livingAreas: LivingArea[] = ') + len('export const livingAreas: LivingArea[] = ')
end = start; depth = 0
for i in range(start, len(ts)):
    if ts[i] == '[': depth += 1
    elif ts[i] == ']':
        depth -= 1
        if depth == 0: end = i + 1; break
areas = json.loads(ts[start:end])
centroids = [{'id': a['id'], 'lng': a['centroid'][0], 'lat': a['centroid'][1]} for a in areas]
print(f'Areas: {len(centroids)}')

locations = {
    'Midtown Manhattan': [40.755, -73.980],
    'Downtown / Wall Street': [40.707, -74.009],
    'Hudson Yards': [40.755, -74.002],
    'Chelsea': [40.746, -74.001],
    'Union Square': [40.736, -73.990],
    'Flatiron': [40.740, -73.989],
    'SoHo': [40.723, -74.000],
    'Tribeca': [40.718, -74.009],
    'Upper East Side': [40.774, -73.956],
    'Upper West Side': [40.787, -73.975],
    'Harlem': [40.811, -73.946],
    'Columbia University': [40.808, -73.962],
    'Downtown Brooklyn': [40.693, -73.990],
    'Williamsburg': [40.713, -73.956],
    'DUMBO': [40.703, -73.989],
    'Long Island City': [40.748, -73.946],
    'Astoria': [40.778, -73.922],
    'Jersey City / Exchange Place': [40.717, -74.033],
    'Hoboken': [40.744, -74.032],
    'Newark Penn Station': [40.735, -74.164],
}

modes = ['walking', 'transit', 'driving', 'bicycling']

commute_data = {}
for loc_name, (lat, lng) in locations.items():
    origin = f'{lat},{lng}'
    commute_data[loc_name] = {}
    for mode in modes:
        print(f'{loc_name} {mode}...', end=' ', flush=True)
        results = {}
        for i in range(0, len(centroids), 25):
            batch = centroids[i:i+25]
            dests = '|'.join(f'{c["lat"]},{c["lng"]}' for c in batch)
            try:
                url = f'https://maps.googleapis.com/maps/api/distancematrix/json?origins={origin}&destinations={dests}&mode={mode}&key={key}'
                resp = requests.get(url, timeout=15)
                data = resp.json()
                if data['status'] == 'OK':
                    for j, el in enumerate(data['rows'][0]['elements']):
                        if el['status'] == 'OK':
                            results[batch[j]['id']] = el['duration']['value']
                time.sleep(0.05)
            except Exception as e:
                print(f'ERR:{e}', end=' ')
        print(f'{len(results)}')
        commute_data[loc_name][mode] = results

ts_out = f'export const PRECOMPUTED_COMMUTES: Record<string, Record<string, Record<string, number>>> = {json.dumps(commute_data)}'
Path('src/data/mock/commuteData.ts').write_text(ts_out, encoding='utf-8')
kb = Path('src/data/mock/commuteData.ts').stat().st_size / 1024
print(f'Saved ({kb:.0f} KB)')
