# TerraPulse Agentic Atlas — A city. Two climates.

**Builder:** Muhammad Sheheryar · BS Computer Science · UVAS, Lahore, Pakistan

**Project:** TerraPulse Agentic Atlas

**Live map:** https://shehar-e-yaar.github.io/terrapulse-atlas/

**Code:** https://github.com/shehar-e-yaar/terrapulse-atlas

**Design:** https://www.figma.com/design/7Qs4XTqMHkIIIJRReWqoOv

**Demo video:** Add the public video URL after recording the supplied two-minute walkthrough. This document is not a completed submission until that link is supplied and deployment is verified.

## Why I built it

I study at the University of Veterinary and Animal Sciences in Lahore. I wanted to make spatial data feel connected to places I know: UVAS, Shahdara, Mall Road, Gulberg, the canal and the industrial south. TerraPulse asks a simple scenario question: when a city holds heat unevenly, how can an interactive map make the next useful question easier to ask?

Instead of a passive collection of pins, the map has a spatial copilot. Ask about a place or threshold and watch a compact execution log show the operations that filter the records, rank a park candidate, move the camera and draw a connection. Click a citation and the map follows it.

## The dataset

The project starts with real OpenStreetMap place nodes and park feature centers downloaded through Overpass on November 2, 2026. The exact source response and query are included. The final dataset has 797 records, including 201 features tagged as parks and ten clearly marked approximate local anchors. Each record includes a coordinate source link and quality label.

The temperature, canopy, vulnerability and risk fields are deterministic **illustrative scenario inputs**, not sensor readings or satellite-derived measurements. They are generated from the place category and record ID; `observed_at` is null. The application makes that distinction visible in its legend, copilot, data panel and inspector. It does not claim observed heat disparities or verified emergency cooling centers.

A second, real geospatial source comes from **Amazon S3**: Sentinel-2 scene metadata in the public `sentinel-cogs` AWS Open Data bucket. The pipeline successfully downloaded scene `S2A_43RDQ_20240605_0_L2A`, checked its bounding box against central Lahore and retained its acquisition date and 98.116308% cloud cover. This high cloud cover is displayed openly. It is an optical imagery context record; the heat scenario is not derived from it.

## How I put it on the map

Python converts the curated records to GeoJSON. MapLibre GL JS renders a dark, pitched vector map with thermal density, clustered place markers, park candidates and extruded scenario columns. Selecting a record reveals a two-sided glass inspector: readable telemetry on the front and provenance on the back.

The default app needs no paid API key. It uses an OpenFreeMap/OSM basemap and a deterministic local spatial engine. The public demo is configured for GitHub Pages. The project includes AWS Amplify Hosting configuration as an alternative host; it does not claim an Amplify deployment unless one is actually completed.

**AWS service actually used:** the read-only S3 data pipeline and in-app metadata verification. S3 is appropriate because scene metadata is addressable, publicly accessible, reproducible and directly linked to the original object. No private AWS credentials are needed for the starting dataset.

**Additional integrations implemented:** Amazon Location Maps V2, Places V2 and Routes V2 adapters activate when configured with a scoped key. An optional ETL publishes a GeoJSON export to an existing S3 bucket and writes a region-partitioned Iceberg table through AWS Glue. An optional Bedrock Converse Lambda adds a labeled model summary. These optional paid/account-backed paths are included as reusable implementation, not represented as deployed services.

## What is original

The core interaction connects a natural-language request to visible, inspectable spatial actions. The log shows real application operations and elapsed time, rather than an invented model chain of thought or simulated AWS query. The engine filters the actual dataset and computes distances; final numerical answers come from those records.

For example, “Find a cooler place near Shahdara” resolves a real anchor, ranks park candidates using geographic distance, and moves the map. Without a routing key, the app says “straight-line estimate” and gives no invented walking time. With Amazon Location configured, it attempts a pedestrian route and labels the provider.

Original editable desktop and mobile Figma screens establish the glass interface, mint route accents, coral thermal layer and violet execution log. The four-stop story turns the map into a short narrative about asking spatial questions in familiar places.

## Usefulness and reuse

The immediate output is an explorable prototype for discussing urban heat data and its uncertainty. It demonstrates how a future measured dataset could be investigated; it does not offer operational heat alerts. The inspection cards make it easy to distinguish a place coordinate, a scenario assumption and an actual satellite metadata fact.

Builders can replace the schema-compatible GeoJSON, map center, story stops and aliases to reuse the copilot/map pattern in another city. The repository includes provenance, source licenses, an ETL, AWS adapters, deployment workflows and automated tests. A new dataset still needs its own measurement and access validation.

## What judges can try

1. Ask for a cooler place near Shahdara and follow the execution accordion and map movement.
2. Compare industrial and canal scenario temperatures, then filter for canopy below 10%.
3. Zoom clusters, switch on 3D columns, click a point and flip its source card.
4. Play the spatial story and open AWS architecture to inspect the real S3 metadata source.

## Scope and next steps

The next data step is measured satellite land-surface temperature and validated canopy coverage with acquisition timestamps and uncertainty. The next operational step is locally verified public cooling facilities, access hours and pedestrian routing. Those are future work, not claims made by this submission.
