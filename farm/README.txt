EGHOLM MUSSEL DESIGN STUDIO
Created 23 November 2026. Separate from all existing viewers and workflows.

START
python -m http.server 8766 --bind 127.0.0.1 --directory .
Then open http://127.0.0.1:8766/ in a modern WebGL browser.
No build step or npm installation required. Three.js r160 and proj4 are vendored.
Fonts are optional remote Google Fonts; system fallbacks work without them.

TOOLS
Explore: 3D land/coast and seabed, Natura polygons, navigation, monthly water
layers, dated DMI forecast fields and source-valid coverage. Click to preview
a location without moving the farm; explicitly commit a placement.
Design: seven presets; dimensions, rows, collector depth/spacing, moorings,
flotation, orientation and coordinates. True-scale detail, dated-flow alignment.
Search: whole footprint checks with conservative depth support and explicit
route buffer, depth deficit and extra route-position allowance. Candidate
centres are on the 100 m data grid. Results are geometric survey targets only.
Compare: up to 12 alternatives. Export comparison CSV, GeoJSON, 3D OBJ,
scene PNG and project JSON. Projects auto-save in browser localStorage.
Data notebook: source records, limitations, gaps and downloadable datasets.
Records: hourly wind/water levels, dated forecasts and oxygen time series.
Mechanics: editable hypothetical waves/current/crop assumptions; 27-case sweep.

DATA
Water data are downloaded snapshots, NOT a live telemetry connection.
29 new-water catalogue entries: 17 available datasets and 12 requested forecast
series with no source values. All-null series remain visibly unavailable.
Historic monthly salinity: 1989-2003. Near-island oxygen: 1989-1997.
Recent regional oxygen: 2024-2025, approximately 12 km west, not local evidence.
Monthly current vectors are residuals, not average speed or storm peaks.
Gauge water levels use DVR90, bathymetry LAT, forecast deviations their own model
reference. They are never numerically added as if they shared a vertical datum.
Land terrain is DVR90; the display is schematic at the water/land datum interface.
Native regional grids do not become farm-scale measurements through resampling.
Forecast wave-grid nearest-cell display uses a 1.2 km support cutoff; DKSS uses
300 m. These displayed samples are not downscaled simulations.

SOURCE WORKFLOWS (in the parent project, kept separate)
output/mussel_studio_data/fetch_water_data.py
output/mussel_studio_data/data/provenance.json and verification.json
output/mussel_studio_spatial/prepare_spatial.py
output/mussel_studio_spatial/provenance.json and verification.json
These are dated retrieval/preparation scripts, not a scheduled update service.
Inspect hard-coded dates and source paths before an intentional future refresh.
Copy verified new JSON files into dist/data and redeploy to update the site.

VALIDATION
node --check app.js
node --test tests/farm-engine.test.mjs tests/spatial.test.mjs
21 tests cover analytical mechanics, independent Python regression, missing
values, depth conflicts, full mooring occupation, land, Natura, holes, segments
and the earlier G location. Browser QA covers layers, missing records, editable
parameters, comparisons and actual site search/selection.

SCOPE
This is a research configurator, not CFD, a farm-survival model, a navigation
chart or permission to install. Unknown ecological gates remain unknown.
Route buffers are user assumptions. The initial 10 kN line limit is a reference,
not specified certified equipment. Scaling up requires new carrying-capacity,
navigation, structural and seabed investigations.

HOSTING
Published as /farm/ inside the existing egholm-environment-atlas repository.
GitHub Pages serves main at the repository root. The original atlas stays at /.
All URLs are relative and no server or build step is required.
Project files save in each browser; use Save project / Open to exchange designs.

ATTRIBUTION
Three.js Authors (MIT); proj4js contributors (MIT).
EMODnet, DMI, Copernicus Marine, ICES, ERA5/Open-Meteo,
Danmarks Miljoportal, Danish terrain data and OpenStreetMap contributors (ODbL).
Source dataset licences and attribution remain applicable.
