"""Reproducible real-place / modeled-environment dataset. No sensor claims."""
import json, hashlib, math
from pathlib import Path
raw=json.loads(Path('pipeline/osm-places.json').read_text(encoding='utf-8'))
elements=raw['elements']
rows=[]
seen=set()
for e in elements:
    tags=e['tags']; name=tags.get('name:en',tags.get('name',''))
    if name.casefold() in seen: continue
    pos=e.get('center',e)
    if not pos.get('lat') or not pos.get('lon'): continue
    seen.add(name.casefold())
    kind='park' if tags.get('leisure')=='park' else 'industrial' if any(x in name.lower() for x in ['industrial','kot lakhpat','sundar']) else 'urban'
    rows.append({'id':f"osm-{e['type']}-{e['id']}",'name':name,'coordinates':[pos['lon'],pos['lat']],'kind':kind,'source_url':f"https://www.openstreetmap.org/{e['type']}/{e['id']}",'coordinate_quality':'OSM feature center' if 'center' in e else 'OSM node'})
# Locally curated anchors complement the raw extract. Coordinates are approximate,
# explicitly distinguished from imported OSM features and not survey-grade.
anchors=[('UVAS Campus',74.3007,31.5763,'campus'),('Shahdara',74.291278,31.614444,'urban'),('Mall Road',74.326,31.559,'urban'),('Gulberg',74.348,31.515,'urban'),('Canal Bank · Jail Road',74.351,31.535,'canal'),('Canal Bank · Punjab University',74.310,31.489,'canal'),('Canal Bank · Dharampura',74.370,31.550,'canal'),('Sundar Industrial Estate',74.167,31.299,'industrial'),('Kot Lakhpat Industrial Area',74.339,31.448,'industrial'),('Ravi Riverfront',74.286,31.605,'urban')]
for i,(name,lon,lat,kind) in enumerate(anchors):
    rows=[r for r in rows if r['name'].casefold()!=name.casefold()]
    rows.append({'id':f'curated-{i:02}','name':name,'coordinates':[lon,lat],'kind':kind,'source_url':f'https://www.openstreetmap.org/?mlat={lat}&mlon={lon}#map=16/{lat}/{lon}','coordinate_quality':'Manually curated approximate anchor'})
for p in rows:
    seed=int(hashlib.sha256(p['id'].encode()).hexdigest()[:8],16)
    kind=p['kind']; green=kind in ['park','canal']
    canopy=45+seed%36 if green else 3+seed%18
    temp=round((36.5 if green else 43 if kind=='industrial' else 40.5)+(seed%29)/10,1)
    vulnerability=25+seed%66
    risk=min(100,round((temp-35)*6+(100-canopy)*.20+vulnerability*.15))
    p.update(region='north' if p['coordinates'][1]>31.59 else 'south' if p['coordinates'][1]<31.50 else 'central',temp_c=temp,canopy_pct=canopy,vulnerability=vulnerability,risk=risk,heat_kind='modeled',observed_at=None)
    p['partition']='lahore/'+p['region']
rows.sort(key=lambda p:p['name'])
Path('src/data/places.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
fc={'type':'FeatureCollection','name':'Lahore real places with illustrative heat scenario','attribution':'© OpenStreetMap contributors, ODbL; curated anchors separately marked','features':[{'type':'Feature','id':p['id'],'geometry':{'type':'Point','coordinates':p['coordinates']},'properties':{k:v for k,v in p.items() if k!='coordinates'}}for p in rows]}
Path('public/data/lahore.geojson').write_text(json.dumps(fc,ensure_ascii=False),encoding='utf-8')
Path('src/data/lahore.geojson').write_text(json.dumps(fc,ensure_ascii=False),encoding='utf-8')
# Local connections intentionally remain straight lines, not road routes.
def km(a,b):
    x=math.radians(b[0]-a[0])*math.cos(math.radians((a[1]+b[1])/2));y=math.radians(b[1]-a[1]);return 6371*math.hypot(x,y)
parks=[r for r in rows if r['kind']=='park']
routes=[]
for p in rows:
    if p['kind']=='park' or not parks: continue
    to=min(parks,key=lambda r:km(p['coordinates'],r['coordinates']))
    routes.append({'from':p['id'],'to':to['id'],'distance_km':round(km(p['coordinates'],to['coordinates']),3),'geometry':{'type':'LineString','coordinates':[p['coordinates'],to['coordinates']]},'kind':'straight-line estimate, not navigable'})
Path('public/data/connections.json').write_text(json.dumps(routes),encoding='utf-8')
print(f'{len(rows)} places, {len(parks)} parks, {len(routes)} direct connections. Environmental fields are modeled.')
