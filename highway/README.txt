HIGHWAY — FREEHAND PATHS / VERSION 6: CONNECTED METRIC ROUTES

Public: https://naitiksharma-iaac.github.io/egholm-environment-atlas/highway/
Independent interaction study inspired by Jeune Homme's Highway designer:
https://www.instagram.com/reel/DXz91ltIGps/
Our own rules, not the reel creator's source code or a verified algorithmic copy.

Plain HTML/CSS/Canvas/JavaScript. No build, framework, backend or account.
Open index.html or serve the directory with a static HTTP server.
Google Fonts are optional; system fonts work offline.

DRAWING
Drag freely. No bar and no behaviour mode selectors. Metric routes use a smooth
main centreline with no underdamped follower oscillation. Gradual turns can open
short side branches that rejoin. Sustained turns can attach closed circular
loops, drawn on separate tracks so no chase line cuts across the drawing after
closure. Loop entries coincide with stored main-route vertices.

The path footprint defaults to 3 m (adjustable 1.5–6 m), with widening capped at
8 m. The source map transform is 0.23 drawing units/metre. Borders are inside
footprints. At overview zoom, solid ink keeps the small geometry legible; zoom
in to inspect the outlined paths. A scale indicator follows zoom.

At default Spread 70, loops have about 20 m radius; their diameter stays below
60 m across the current controls. Side branches extend about 108 m along the
route and separate by at most 12 m. Separation shrinks through tight bends to
avoid offset folds. Feature spacing is distance-based (120 m for splits, 140 m
for loops). Recent loop envelopes help choose a free side. These are experimental
design parameters, not validated ecological, access or engineering standards.

Flow controls smoothing. Spread controls branch opening and loop radius. Changes
apply to new strokes. Slow curves and illustrative clearings can create wider
pockets. The example feeds the same drawing engine; it has no preset loop paths.

REFINING OLDER DRAWINGS
Refine paths rebuilds legacy strokes from their stored main route, discarding
old secondary oscillations and oversized generated circles. It simplifies small
kinks (3 m tolerance), then applies the current metric behaviour. This is an
approximation of the old main route, not a replay of the original pointer input.
Landscape forces are not applied a second time. Ink and base widths are retained.
The operation is undoable; current-generation strokes are left intact.

LANDSCAPE CANVAS
Water/coast, woodland and illustrative wet patches resist; clearings attract and
widen; illustrative dyke lines attract and align. The shared main route receives
a smoothly changing local steering offset (up to about 28 m at full influence),
instead of large independent offsets on two followers. Influence 0 disables this
steering. Wetness changes scenario patch size, not measured water level.

These are soft drawing influences. Routes may cross water, woodland or one
another. The tool does not provide collision-free routing, protected-area
permission, Boolean-unioned graph topology, flood prediction or buildability.
The project remains a 2D drawing experiment, without architecture or 3D placement.

DATA AND ATTRIBUTION
landscape-data.js contains simplified copies of the existing project shoreline
and vegetation GeoJSON, originally derived from OpenStreetMap (coast way
156597303). Source files are untouched. EPSG:25832 coordinates are transformed
into north-up drawing space; transform metadata is included in the data module.
The copied geographic data is available under ODbL 1.0:
https://opendatacommons.org/licenses/odbl/1-0/
© OpenStreetMap contributors: https://www.openstreetmap.org/copyright
prepare_landscape.py regenerates the copy in the original studio workspace.
Ground colours, puddles/wet patches, clearings and dyke lines are illustrative
scenarios, not surveyed land cover or habitat boundaries. No new water data is
implied. The mainland is outside this isolated drawing experiment.

SAVING AND EXPORT
Canvas settings and ink save under highway-freehand-v6. v5, v4, v3, v2 and v1
load as fallbacks. Original keys remain as backups. Old widths are converted to
metres once; Refine paths is a separate explicit geometry operation. No drawing
is uploaded. Browser storage is local to the browser/origin; export a portable
copy. Undo history lasts for the current page session.
SVG/PNG include current landscape colours optionally. Geometry has the same
physical dimensions on screen and in exports; PNG is limited to 4096 pixels on
its longest side. Crossings are visual joins, not a validated route network.

Wheel zooms; Space + drag pans; F fits island and drawing. Ctrl/Command Z undoes;
Shift Z redoes. Clear is undoable. Esc stops the example. Mouse, touch and stylus
are supported. The old unscaled spring engine stays available in engine.js for
compatibility and regression checks; the application uses the metric RouteBrush.

Checks: node --test engine.test.cjs landscape.test.cjs routes.test.cjs
Syntax: node --check app.js
Only /highway/ is changed in the existing public repository.
