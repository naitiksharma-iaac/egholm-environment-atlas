# Egholm Environmental Atlas

Static environmental viewer for Egholm, Limfjord. Open index.html through an HTTP server, or visit the GitHub Pages deployment.

## Combined monthly dataset

`data/all-monthly-grid-100m.csv`: 43,968 rows (3,664 water points x 12 calendar months), 44 columns. Includes turbidity, chlorophyll-a, monthly temperature, monthly net current and wind, with separate source months and estimate flags. Excludes single-timestamp DMI forecasts and static bathymetry. December satellite values are missing. See `data/monthly-dataset-metadata.json` for provenance and settings. The live download respects the current grid spacing and route exclusions.

## Data and attribution

The viewer's Sources & method dialog records source definitions, licences and limitations. Sources include Copernicus Marine, DMI DKSS, EMODnet Bathymetry, ERA5 via Open-Meteo (CC BY 4.0), and OpenStreetMap contributors (ODbL). Vendored libraries retain their upstream notices. Source dataset terms continue to apply; this repository does not relicense third-party data.

Interpolated and extrapolated values are estimates, not new observations. Monthly current magnitude is the magnitude of the mean velocity vector, not average current speed. Route buffers are analysis exclusions, not official navigation clearances. This is an architectural research viewer, not a navigation chart.

## Hosting

GitHub Pages serves the repository root on `main`; `.nojekyll` preserves the static asset layout. All application assets and data use relative URLs.

## Mussel farm designer

Open [Farm designer](farm/) for the 3D Egholm/Aalborg workbench, seven editable cultivation designs, whole-footprint location screening, mechanical scenarios and dated water evidence. Use the labelled map marker or See farm design to inspect the actual geometry. [Direct farm detail](farm/?view=farm) opens the current browser-local design at true scale.

The atlas marker follows the same browser-local project. Save project / Open exchanges designs with group members; the public site does not synchronise everyone's edits. The initial marker is a study position, not a safe or approved installation. Regional observations, historical oxygen and snapshots are distinguished from contemporary site evidence. See farm/README.txt and the data notebook for limitations.

Validation: `node --test farm/tests/*.test.mjs` (21 mechanics/spatial tests). Existing atlas data and tools are preserved.
