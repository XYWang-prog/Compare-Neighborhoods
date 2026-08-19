#!/usr/bin/env python3
"""Precompute AI community tags using OpenAI GPT-4o-mini"""
import json, os, time
from pathlib import Path
import requests

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
    return ''

# Read API key
API_KEY = read_key('OPENAI_KEY')

if not API_KEY or API_KEY == 'your_key_here':
    print('ERROR: Set your OpenAI API key in .env first')
    exit(1)

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

# Load cache if exists
cache_path = Path('data/community_tags.json')
cache = {}
if cache_path.exists():
    with open(cache_path) as f: cache = json.load(f)

PROMPT = """You are a NYC neighborhood analyst. Based ONLY on the following real data, generate 4-8 lifestyle tags for this neighborhood. Each tag must reference specific metrics. Never invent information.

Output format: JSON array of objects with "tag" (emoji + short name) and "reason" (one sentence with data).

Rules:
- Only use the provided data
- 4-6 tags — pick only the most prominent features
- Prefer positive, but include negative when clearly supported
- No subjective words like "amazing", "best", "perfect"
- If multiple tags overlap, choose the strongest one only
- Every tag must include a short explanation

Neighborhood data:"""

print(f'Starting tag generation for {len(areas)} neighborhoods...')
print(f'Cached: {len(cache)}')

for i, area in enumerate(areas):
    name = area['name']
    aid = area['id']

    if aid in cache:
        print(f'[{i+1}/{len(areas)}] {name} (cached)')
        continue

    # Build data context
    m = area['metrics']
    d = area.get('demographics', {})
    context = json.dumps({
        'neighborhood': name,
        'nta': area.get('neighborhood', ''),
        'rent': {'studio': m['rentByBedroom']['studio'], 'oneBr': m['rentByBedroom']['oneBr'], 'twoBr': m['rentByBedroom']['twoBr']},
        'restaurants': m.get('restaurantCount', 0),
        'cafes': m.get('cafeCount', 0),
        'bars': m.get('barCount', 0),
        'supermarkets': m.get('supermarketCount', 0),
        'gyms': m.get('gymCount', 0),
        'pharmacies': m.get('pharmacyCount', 0),
        'subwayStations': m.get('subwayStations', 0),
        'busRoutes': m.get('busRoutes', 0),
        'medianAge': d.get('medianAge', 'N/A'),
        'ageDistribution': {
          'under20': d.get('under20', 0), '20to29': d.get('20to29', 0),
          '30to39': d.get('30to39', 0), '40to49': d.get('40to49', 0),
          '50to64': d.get('50to64', 0), '65plus': d.get('65plus', 0),
        },
        'population': d.get('totalPopulation', m.get('populationDensity', 'N/A')),
        'crimeRate': m.get('crimeRate', 'N/A'),
        'demographics': {'white': d.get('white',0), 'black': d.get('black',0), 'asian': d.get('asian',0)},
    }, ensure_ascii=False)

    try:
        resp = requests.post(
            'https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'},
            json={
                'model': 'gpt-4o-mini',
                'messages': [
                    {'role': 'system', 'content': 'You output only valid JSON arrays. No markdown, no explanation.'},
                    {'role': 'user', 'content': PROMPT + '\n\n' + context},
                ],
                'temperature': 0.3,
                'max_tokens': 300,
            },
            timeout=30,
        )
        data = resp.json()

        if 'choices' in data and data['choices']:
            content = data['choices'][0]['message']['content']
            # Clean up any markdown
            content = content.strip()
            if content.startswith('```'): content = content.split('\n', 1)[1].rsplit('\n```', 1)[0]
            try:
                tags = json.loads(content)
                cache[aid] = tags
                print(f'[{i+1}/{len(areas)}] {name} → {len(tags)} tags')
            except:
                print(f'[{i+1}/{len(areas)}] {name} → JSON parse error, retrying...')
                cache[aid] = []
        else:
            print(f'[{i+1}/{len(areas)}] {name} → API error: {data.get("error",{}).get("message","?")}')
            if 'insufficient_quota' in str(data):
                print('QUOTA EXCEEDED — stopping')
                break
            cache[aid] = []

        # Save after each to avoid losing progress
        with open(cache_path, 'w') as f: json.dump(cache, f)

        # Rate limit
        if (i+1) % 10 == 0: time.sleep(1.5)
        else: time.sleep(0.3)

    except Exception as e:
        print(f'[{i+1}/{len(areas)}] {name} → Error: {e}')
        cache[aid] = []
        with open(cache_path, 'w') as f: json.dump(cache, f)

# Final save
with open(cache_path, 'w') as f: json.dump(cache, f)
print(f'\nDone! {len(cache)} neighborhoods tagged.')

# Generate TypeScript file
ts_type = 'Record<string, {tag: string, reason: string}[]>'
ts_out = 'export const COMMUNITY_TAGS: ' + ts_type + ' = ' + json.dumps(cache, ensure_ascii=False)
Path('src/data/mock/communityTags.ts').write_text(ts_out, encoding='utf-8')
kb = Path('src/data/mock/communityTags.ts').stat().st_size / 1024
print(f'Saved src/data/mock/communityTags.ts ({kb:.0f} KB)')
