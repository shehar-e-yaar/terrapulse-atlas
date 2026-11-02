"""Fetch real Sentinel-2 scene metadata from AWS Open Data's public S3 bucket.

No credentials, no resource creation. The downloaded metadata is an imagery
context record, never a source of invented thermal measurements.
"""
import json
import urllib.request
import urllib.parse
from pathlib import Path
import xml.etree.ElementTree as ET

bucket='https://sentinel-cogs.s3.us-west-2.amazonaws.com'
prefix='sentinel-s2-l2a-cogs/43/R/DQ/2024/6/'
url=bucket+'/?'+urllib.parse.urlencode({'list-type':'2','prefix':prefix,'max-keys':'100'})
with urllib.request.urlopen(url,timeout=40) as r:
    raw=r.read()
root=ET.fromstring(raw)
keys=[e.text for e in root.findall('.//{*}Key') if e.text and e.text.endswith('.json')]
if not keys: raise RuntimeError('No metadata found for configured scene prefix')
for key in keys:
    source=bucket+'/'+key
    with urllib.request.urlopen(source,timeout=40) as r:
        item=json.load(r)
    bbox=item.get('bbox',[])
    if len(bbox)>=4 and bbox[0]<=74.34<=bbox[2] and bbox[1]<=31.55<=bbox[3]:
        break
else: raise RuntimeError('No scene covers central Lahore; choose another MGRS tile')
Path('pipeline/aws-scene-source.json').write_text(json.dumps(item,indent=2),encoding='utf-8')
out={'service':'Amazon S3','bucket':'sentinel-cogs','region':'us-west-2','source_url':source,'scene_id':item['id'],'datetime':item['properties'].get('datetime'),'cloud_cover_pct':item['properties'].get('eo:cloud_cover'),'bbox':bbox,'purpose':'Real satellite scene metadata covering Lahore. Optical imagery context only; no thermal or canopy values derived.','license_url':'https://registry.opendata.aws/sentinel-2-l2a-cogs/','verification':'Downloaded directly from public Amazon S3 by pipeline/fetch_aws_context.py'}
Path('public/data/aws-context.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
print(json.dumps(out,indent=2))
