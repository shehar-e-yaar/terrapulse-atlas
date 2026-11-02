"""Fetch attributable, real Lahore places. Never fabricate sensor measurements."""
import json, urllib.request, urllib.parse
from pathlib import Path

query = '[out:json][timeout:20];(node["name"]["place"](31.40,74.20,31.66,74.50);way["name"]["leisure"="park"](31.48,74.25,31.63,74.40););out center tags;'
url = 'https://overpass-api.de/api/interpreter'
request = urllib.request.Request(url, data=urllib.parse.urlencode({'data':query}).encode(), headers={'User-Agent':'TerraPulse-Hackathon/1.0 (public spatial data research)'})
with urllib.request.urlopen(request, timeout=80) as response:
    raw = response.read()
Path('pipeline/osm-places.json').write_bytes(raw)
print(f'Saved {len(raw)} bytes of OpenStreetMap source data')
