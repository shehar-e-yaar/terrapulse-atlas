"""Validate/enrich Lahore records; optionally publish to S3 and Glue/Iceberg.

Default invocation performs local validation only. --upload writes a GeoJSON
export to an existing bucket. --iceberg writes/replaces this scenario table's
snapshot (not arbitrary user tables). AWS SDK uses the standard credential chain.
"""
import argparse, json, math, hashlib
from pathlib import Path

BASE32='0123456789bcdefghjkmnpqrstuvwxyz'
def geohash(lon,lat,precision=7):
    bounds=[[-180.,180.],[-90.,90.]];out='';bit=0;value=0;axis=0
    while len(out)<precision:
        low,high=bounds[axis];mid=(low+high)/2
        yes=(lon if axis==0 else lat)>=mid
        value=(value<<1)|int(yes);bounds[axis][0 if yes else 1]=mid
        axis=1-axis;bit+=1
        if bit==5:out+=BASE32[value];bit=0;value=0
    return out

def clean(path):
    records=json.loads(Path(path).read_text(encoding='utf-8'));seen=set();cleaned=[]
    for r in records:
        if r['id'] in seen:raise ValueError('Duplicate ID: '+r['id'])
        seen.add(r['id']);lon,lat=r['coordinates']
        if not (-180<=lon<=180 and -90<=lat<=90):raise ValueError('Invalid coordinates')
        for field in ['temp_c','canopy_pct','risk','vulnerability']:
            if not isinstance(r[field],(int,float)) or not math.isfinite(r[field]):raise ValueError('Invalid '+field)
        if r['heat_kind']!='modeled' or r['observed_at'] is not None:raise ValueError('Scenario provenance mismatch')
        p={**r,'longitude':lon,'latitude':lat,'geohash':geohash(lon,lat),'dataset_version':'lahore-scenario-v1'}
        cleaned.append(p)
    return cleaned

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--input',default='src/data/places.json');parser.add_argument('--bucket');parser.add_argument('--region',default='ap-south-1');parser.add_argument('--upload',action='store_true');parser.add_argument('--iceberg',action='store_true');args=parser.parse_args()
    rows=clean(args.input)
    geo={'type':'FeatureCollection','attribution':'© OpenStreetMap contributors · ODbL; manually curated anchors marked','features':[{'type':'Feature','id':r['id'],'geometry':{'type':'Point','coordinates':r['coordinates']},'properties':{k:v for k,v in r.items() if k!='coordinates'}}for r in rows]}
    encoded=json.dumps(geo,ensure_ascii=False).encode();digest=hashlib.sha256(encoded).hexdigest()
    print(json.dumps({'validated_records':len(rows),'sha256':digest,'environmental_fields':'modeled','upload_requested':args.upload,'iceberg_requested':args.iceberg}))
    if not(args.upload or args.iceberg):return
    if not args.bucket:parser.error('--bucket is required for cloud writes')
    import boto3
    session=boto3.Session(region_name=args.region)
    if args.upload:
        key='exports/lahore-scenario-v1.geojson';session.client('s3').put_object(Bucket=args.bucket,Key=key,Body=encoded,ContentType='application/geo+json',ServerSideEncryption='AES256',Metadata={'sha256':digest,'heat-kind':'modeled'})
        print('Uploaded s3://'+args.bucket+'/'+key)
    if args.iceberg:
        import pyarrow as pa
        from pyiceberg.catalog import load_catalog
        from pyiceberg.exceptions import NoSuchTableError
        from pyiceberg.partitioning import PartitionSpec,PartitionField
        from pyiceberg.transforms import IdentityTransform
        from pyiceberg.schema import Schema
        from pyiceberg.types import NestedField,StringType,DoubleType,IntegerType
        schema=Schema(NestedField(1,'id',StringType(),required=False),NestedField(2,'name',StringType(),required=False),NestedField(3,'longitude',DoubleType(),required=False),NestedField(4,'latitude',DoubleType(),required=False),NestedField(5,'temp_c',DoubleType(),required=False),NestedField(6,'canopy_pct',IntegerType(),required=False),NestedField(7,'region',StringType(),required=False),NestedField(8,'geohash',StringType(),required=False),NestedField(9,'heat_kind',StringType(),required=False),NestedField(10,'source_url',StringType(),required=False))
        cat=load_catalog('terrapulse',type='glue',**{'warehouse':f's3://{args.bucket}/warehouse','glue.region':args.region,'s3.region':args.region})
        cat.create_namespace_if_not_exists('terrapulse');identifier='terrapulse.lahore_scenario_v1'
        try:table=cat.load_table(identifier)
        except NoSuchTableError:table=cat.create_table(identifier,schema=schema,partition_spec=PartitionSpec(PartitionField(source_id=7,field_id=1000,transform=IdentityTransform(),name='region')))
        arrow_schema=pa.schema([('id',pa.string()),('name',pa.string()),('longitude',pa.float64()),('latitude',pa.float64()),('temp_c',pa.float64()),('canopy_pct',pa.int32()),('region',pa.string()),('geohash',pa.string()),('heat_kind',pa.string()),('source_url',pa.string())])
        arrow=pa.Table.from_pylist([{k:r[k] for k in arrow_schema.names}for r in rows],schema=arrow_schema)
        table.overwrite(arrow)
        print('Committed Iceberg snapshot for '+identifier)

if __name__=='__main__':main()
