HIGHWAY — A DRAWING INSTRUMENT

Independent reconstruction of the visible interaction in Jeune Homme's reel:
https://www.instagram.com/reel/DXz91ltIGps/
This is not the original source code or a verified algorithmic copy.

Open index.html directly, or serve this directory with a static HTTP server.
Plain HTML, CSS and JavaScript. No framework, build, account or backend.
Fonts are optional Google Fonts; system fonts work offline.

Drag to draw. The ends of a translating/rotating bar trace paths.
Angular spring damping produces lag and loops. Motion integrates at 240 Hz
independently of display frame rate. Outline interiors are drawn after edges
so intersecting roads form white junctions. These are graphic paths only.

Shift holds the current angle. Mouse wheel rotates the bar; Q/E also rotate.
Space + drag pans. Pan mode or Ctrl/Command + wheel zooms. F fits the drawing.
Ctrl/Command Z undoes; Shift Z redoes. Clear is undoable. Esc stops the demo.
Touch/stylus drawing supports one active pointer; use sliders for motion tuning.

SVG and PNG exports contain the artwork with paper background, without guides.
PNG is limited to 4096 pixels on its longest side. SVG retains vector paths.
Drawings auto-save in localStorage on this browser/origin. They are not uploaded
or shared with other visitors. Export a file before clearing browser storage.

Published in the existing egholm-environment-atlas repository under /highway/.
The environmental atlas and farm designer are not modified by this experiment.

Run numerical/export checks: node --test engine.test.cjs
