# AWS deployment handoff

## Already executed without account credentials

`python pipeline/fetch_aws_context.py` successfully retrieved real Sentinel-2 metadata from public Amazon S3, checked scene coverage and saved the context record consumed by the application. This is the verified AWS data pipeline integration. It creates no cloud resources.

## Amplify Hosting

1. In your AWS account, open Amplify Hosting and connect `shehar-e-yaar/terrapulse-atlas`, branch `main`.
2. Use the repository's `amplify.yml`; it runs `npm ci`, tests and production build, then publishes `dist`.
3. Use Node 24 in the hosting build image. Leave `VITE_BASE_PATH` unset for a root-domain Amplify deployment.
4. Add optional `VITE_AWS_REGION`, `VITE_AWS_LOCATION_API_KEY`, `VITE_SPATIAL_DATA_URL` or a protected `VITE_AGENT_ENDPOINT` as needed. Rebuild after changes.
5. Open the returned HTTPS URL and verify map, filters, copilot, source links and mobile layout. Replace the hosting URL in the submission only after success.

No AWS account, hosting resource or billable backend was provisioned during local development. GitHub Pages can host the frontend while the S3 data integration remains active.

## Amazon Location

Create an API key scoped to only Maps, SearchText and CalculateRoutes as needed, with your frontend origin/referrer restrictions and a short expiry. Select an available region that supports the intended map provider and route coverage. Keep AWS IAM secret access keys out of the frontend. Browser Location API keys are visible to users by design; constrain their use and monitor cost.

The adapter uses:

- `GET https://maps.geo.REGION.amazonaws.com/v2/styles/Standard/descriptor?color-scheme=Dark&key=...`
- `POST https://places.geo.REGION.amazonaws.com/v2/search-text?key=...`
- `POST https://routes.geo.REGION.amazonaws.com/v2/routes?key=...`

Without a configured key, geocoding remains a local place search and route output is a geographic connection with no travel time. With a key, actual requests can still fail due to quota or coverage; the UI reports its fallback.

## Private S3 warehouse and public export

Use an existing dedicated bucket. Install `pipeline/requirements.txt`, configure an AWS profile or role, then run `etl_to_s3_iceberg.py --bucket BUCKET --upload` and optionally `--iceberg`. The script validates schema/provenance and geohashes coordinates. Iceberg uses Glue and region partitions. These write branches require S3/Glue IAM permissions and have not been integration-tested against a private account.

Expose only the `exports/lahore-scenario-v1.geojson` intended for the public app, preferably through CloudFront with private S3 origin access. Keep raw and warehouse prefixes private. Configure CORS on the export origin with the exact frontend origin, GET/HEAD methods and appropriate cache lifetime. Set `VITE_SPATIAL_DATA_URL` to the resulting HTTPS URL. The app accepts only the documented point record schema and falls back to the bundled dataset if validation fails.

## Optional model

See `server/README.md`. Deploy the Lambda behind authenticated, rate-limited API Gateway, scope Bedrock permissions, set an allowed origin and budget. CORS alone is not authentication. An unavailable endpoint must leave the deterministic copilot usable.

## Example analytical query (not executed by the frontend)

```sql
SELECT id, name, longitude, latitude, temp_c, canopy_pct, heat_kind
FROM terrapulse.lahore_scenario_v1
WHERE region = 'north' AND canopy_pct < 10
ORDER BY temp_c DESC;
```

This SQL is a warehouse reuse example. The browser's visible execution trace describes JavaScript filters; it does not pretend to run Athena or Iceberg SQL.
