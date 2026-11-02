# Browser validation — November 2, 2026

## Functional checks

| Check | Observed result |
| --- | --- |
| Shahdara nearest park | Farkhabad Park, 0.74 km straight-line estimate, 4.4°C modeled difference; camera and connection update |
| Industrial/canal comparison | 44.1°C versus 37.5°C modeled category averages, 6.6°C modeled difference |
| Canopy below 10% | 220 matching records and clickable citations |
| UVAS | One UVAS Campus record, 42.9°C and 6% modeled canopy |
| Temperature above 43°C | 57 matching records |
| Temperature below 38°C | 96 matching records |
| Inspector flip | Raw ID, modeled provenance, null observed timestamp, partition and coordinate source appear |
| 3D columns | Toggle state changes; column height encodes the model risk score |
| Cluster click | Zoom reveals the clustered places; overlapping park does not open an inspector |
| Story | Start, pause and next stop show the UVAS narrative and move the map |
| Mobile | 390 × 844 viewport, no horizontal overflow; copilot footer stays inside viewport |
| AWS S3 context | Public deployment displays the actual scene ID and “Live S3 metadata verified” |
| Public deployment | Latest production bundle opened at https://shehar-e-yaar.github.io/terrapulse-atlas/ |

Six queries were exercised against the running app. The public deployment was separately checked for the Shahdara interaction, S3 verification and corrected cluster selection. No new runtime errors were observed after the worker configuration fix. A camera-padding warning found during mobile testing was corrected using MapLibre's absolute fit padding; its earlier log entry remained in the browser's historical logs, with no new occurrence in the subsequent public tests.

Automated checks: 13 passing tests, successful TypeScript/Vite production build, local validation of all 797 ETL records, Python syntax compilation. Cloud-write ETL branches, private AWS account services and optional LLM inference were not executed.

`terrapulse-live.png` and `terrapulse-mobile.png` are captured previews of the public app. Browser compositor capture can blur translucent surfaces; use the live URL to assess interaction and text clarity directly. Screenshots are evidence of the UI, not replacements for the interactive map.
