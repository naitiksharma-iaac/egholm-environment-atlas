HIGHWAY — FREEHAND PATHS / VERSION 3

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
it has no height, programme, structure or Egholm site data attached to it.

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
