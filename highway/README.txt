HIGHWAY — FREEHAND PATHS / VERSION 4: LANDSCAPE CANVAS

Public: https://naitiksharma-iaac.github.io/egholm-environment-atlas/highway/
Independent interaction study inspired by Jeune Homme's Highway designer:
https://www.instagram.com/reel/DXz91ltIGps/
Our own model, not the reel creator's source code or a verified algorithmic copy.

Open index.html directly, or serve this directory with a static HTTP server.
Plain HTML/CSS/Canvas/JavaScript. No framework, dependencies, backend or account.
Google Fonts are optional. System fonts work offline.

Drag freely. No bar and no behaviour selectors. Two independent spring followers
share the pointer target; the second has more inertia and a curvature-driven
lateral offset. Straight trajectories overlap and turns separate them. Sustained
turning after sufficient travel automatically sends the following trail around
a closed orbit before it resumes following. Slow gentle curves increase the first
trail's width into a pocket. This is the 2D footprint of the voliere exploration;
it has no height, programme or structure. Version 4 adds a coloured drawing
environment based on the Egholm outline and vegetation in the project data.

LANDSCAPE CANVAS
The canvas is on by default. Water/coast and woodland repel; illustrative wet
patches push paths outward; clearings gently attract and encourage wider pockets
when moving slowly; illustrative dyke lines attract and align both followers.
Influence 0 reproduces gesture-only geometry exactly. Wetness changes patch size,
not water level or measured inundation. Settings affect new ink, never redraw old
strokes. Turn the canvas off for a blank page. There are no behaviour modes.

Implementation: nearest polygon-edge distances, point-in-polygon tests, radial
wet-patch gradients and local dyke tangents form a bounded steering field.
Followers receive distinct gains (0.85 / 1.15), up to 62 drawing units of force
offset plus 22 units of directional alignment, multiplied by influence. Local
resistance slows convergence. At a loop trigger, sampled resistance chooses a
side if one is materially freer; a bounded deformation is zero at both loop
ends, so every completed orbit still closes exactly. Loops are still triggered
by sustained freehand turning, not by random timers or a behaviour selector.
These are soft drawing influences. Ink can cross water and woodland; crossings
are not a claim of ecological permission or physical buildability. A drawn path
is not a navigable graph and the model does not perform collision-free routing.

DATA AND ATTRIBUTION
landscape-data.js contains simplified copies of the existing project shoreline
and vegetation GeoJSON, originally derived from OpenStreetMap (coast way
156597303). The source datasets are untouched. Coordinates are transformed from
EPSG:25832 into a north-up drawing space (0.23 drawing units per metre).
The copied geographic data is available under ODbL 1.0:
https://opendatacommons.org/licenses/odbl/1-0/
Attribution: © OpenStreetMap contributors.
https://www.openstreetmap.org/copyright
The source and transform metadata are included in landscape-data.js.
prepare_landscape.py regenerates the copy in the original studio workspace.
Ground colours, wet patches/puddles, clearings and dyke lines are illustrative
scenarios. They are not surveyed land-cover boundaries, flood predictions,
protected-habitat mappings or a proposed construction layout. No new water data
is implied. The mainland is not part of this isolated drawing experiment.

Canvas settings and ink save under highway-freehand-v4; v3, v2 and v1 drawings
load as fallbacks without deleting their old storage keys. SVG/PNG can export
the landscape with ink, the landscape alone, or ink alone. "Include landscape
canvas" controls export only. A mixed drawing can contain strokes made under
different wetness/influence settings; the background shows the current scenario.

Checks: node --test engine.test.cjs landscape.test.cjs
Includes zero-influence equivalence, landscape response to identical input,
wetness effects, closure at parameter extremes, exports and legacy engine tests.

Flow changes follower response; Spread changes lateral deviation and pocket size;
Path width changes the baseline width. Optional controls affect the next stroke.
The demonstration supplies only a recorded sequence of pointer coordinates and
timestamps through exactly the same engine, with the current drawing settings.

Numerical integration uses fixed 1/240-second substeps. Input turning is filtered
per distance travelled, and speed uses pointer timestamps. A stationary pointer
cannot generate motion indefinitely. Remaining follower lag reconnects through
a short quadratic curve at release. Rapid input changes can produce irregular
shapes; the sliders allow further tuning of this experimental response.

The loop trigger resamples pointer movement every 3 pixels, accumulates signed
turning with distance-based decay, and requires sustained turning plus sufficient
travel. Loop size and orientation depend on speed, spread and incoming direction.
The following trail returns to its exact entry point. The loop counter increases
only after this closure and a minimum enclosed area have been verified. A travel
cooldown prevents a stack of loops at one location. Pauses and subpixel jitter do
not trigger loops. Release/export finishes a started loop rather than cutting it.

The example contains open straight runs and bends, with no circular input gesture.
Counters report completed generated loops, lateral separations and widened pockets.
Old self-crossing counts are retained as metadata but no longer labelled as loops.
These are not graph-theoretic counts of every cycle in a complete route network.
Overlap is composited visually. SVG exports editable filled outline paths, not a
Boolean-unioned route graph. Both Canvas and SVG share variable-width polygons.
These are drawing geometries, not engineering or accessibility assessments.

Wheel zooms; Space + drag pans; F fits; Ctrl/Command Z undoes; Shift Z redoes.
Clear is undoable. Esc stops the example. Mouse, touch and stylus are supported.
PNG exports have a maximum longest side of 4096 pixels. SVG preserves vectors.

Drawings save locally under highway-freehand-v3. Existing v2 and v1 drawings load
when no v3 drawing exists; their original browser-storage keys are left intact.
No drawings are uploaded. Browser storage is scoped to this browser/origin.
Exports are the portable copy; clearing browser storage removes local drafts.

This update touches only /highway/ in the existing public repository.
Tests: node --test engine.test.cjs
Syntax: node --check app.js
