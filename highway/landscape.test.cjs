const test=require('node:test'),assert=require('node:assert/strict'),E=require('./engine.js'),L=require('./landscape.js');
function run(env,points=E.exampleGesture()){
  const brush=new E.FlowBrush(points[0].x,points[0].y,E.defaults,env),stroke=E.newStroke(E.defaults);let time=0;
  for(const p of points){brush.aim(p.x,p.y,p.time-time);for(const f of brush.step(p.time-time))E.append(stroke,f);time=p.time;}
  for(let i=0;i<480;i++)for(const f of brush.step(1/240))E.append(stroke,f);
  return E.finish(stroke);
}
test('zero influence preserves gesture-only geometry exactly',()=>{assert.deepEqual(run(new L.Landscape({influence:0})),run(null));});
test('water resists inland, a wet-patch edge pushes out, and a dyke attracts along its tangent',()=>{
  const env=new L.Landscape();assert.ok(env.sample(500,0).fx<-.9);assert.equal(env.sample(500,0).zone,'Water');
  const wet=env.sample(-220,-80);assert.ok(wet.fx>0&&wet.resistance>.8);assert.equal(wet.zone,'Wet patch');
  const dyke=env.sample(-200,-190);assert.ok(dyke.fy<0&&dyke.alignment>.4);assert.ok(Math.abs(dyke.tangent[0])>.9);
  assert.ok(env.sample(-115,-5).pocket>.95);
  // Find a mapped woodland interior, independent of feature ordering.
  assert.ok(env.woods.some(w=>{const b=w.box,s=env.sample((b.minX+b.maxX)/2,(b.minY+b.maxY)/2);return s.zone==='Woodland'&&s.resistance>=.75;}));
});
test('wetter scenario increases the resistance footprint and changes real trail geometry',()=>{
  const dry=new L.Landscape({wetness:0}),wet=new L.Landscape({wetness:100});
  assert.ok(wet.sample(-185,-80).resistance>dry.sample(-185,-80).resistance+.3);
  const a=run(dry),b=run(wet);assert.notDeepEqual(a.tracks,b.tracks);
});
test('identical freehand input bends differently with the landscape enabled',()=>{
  const points=Array.from({length:121},(_,i)=>({x:-330+i*1.6,y:-65,time:(i+1)/60}));
  const plain=run(null,points),land=run(new L.Landscape({influence:100}),points);
  assert.ok(plain.tracks[0].every(p=>p[1]===-65));assert.ok(land.tracks[0].some(p=>Math.abs(p[1]+65)>20));
});
test('environment steering preserves visible exact closed loops at wetness and influence extremes',()=>{
  for(const wetness of [0,100])for(const influence of [25,100]){const s=run(new L.Landscape({wetness,influence}));assert.ok(s.closedLoops.length>0);
    for(const loop of s.closedLoops){const pts=s.tracks[loop.track].slice(loop.from,loop.to+1);assert.deepEqual(pts[0],pts.at(-1));assert.ok(Math.abs(E.signedArea(pts))>1000);}
    for(const l of s.tracks)for(const p of l)assert.ok(p.every(Number.isFinite));
  }
});
test('environment alone does not generate a stroke from an unmoved pointer',()=>{const b=new E.FlowBrush(-220,-80,E.defaults,new L.Landscape());const frames=b.step(.1);for(const f of frames){assert.deepEqual(f.a,[-220,-80]);assert.deepEqual(f.b,[-220,-80]);}});
test('SVG exports support landscape only, combined drawing, and path-only with source attribution',()=>{
  const env=new L.Landscape(),s=run(env),full=E.svgDocument([s],env),only=E.svgDocument([s]);
  assert.ok(full.includes('id="landscape"')&&full.includes('OpenStreetMap')&&full.includes('illustrative scenarios'));
  assert.ok(!only.includes('id="landscape"'));assert.ok(E.svgDocument([],env).includes('island-clip'));
  assert.ok(!/NaN|Infinity|undefined/.test(full));assert.ok(full.indexOf('id="landscape"')<full.indexOf('fill="#333832"'));
  const b=E.combinedBounds([s],env);assert.ok(b.minX<=env.bounds.minX&&b.maxY>=env.bounds.maxY);
});
test('metric footprints have a 3 metre default, an 8 metre pocket limit and no exterior outline inflation',()=>{
  const settings={...E.defaults,unitsPerMetre:.23,pathWidthMetres:3},s=E.newStroke(settings),b=new E.FlowBrush(-320,-75,settings,new L.Landscape());let t=0;
  for(const p of E.exampleGesture()){b.aim(p.x,p.y,p.time-t);for(const f of b.step(p.time-t))E.append(s,f);t=p.time;}
  assert.ok(Math.abs(s.width/.23-3)<1e-9);assert.ok(s.widths[0].some(w=>w>s.width));assert.ok(E.maxWidth([s])/.23<=8+1e-9);
  const outline=E.outlinePolygon(s,[[0,0],[100,0]],2,false),ys=outline.map(p=>p[1]);
  assert.ok(Math.abs((Math.max(...ys)-Math.min(...ys))/.23-3)<1e-9);
  for(const m of [1.5,6])assert.ok(E.physicalWidth(150,6,m,.23)<=8*.23);
});
test('old oversized drawings shrink once without moving routes or opening loops',()=>{
  const s=run(new L.Landscape()),tracks=JSON.stringify(s.tracks),loops=JSON.stringify(s.closedLoops);
  E.scaleStroke(s,.23);assert.equal(JSON.stringify(s.tracks),tracks);assert.equal(JSON.stringify(s.closedLoops),loops);
  assert.ok(Math.abs(s.width/.23-3)<1e-9);assert.ok(E.maxWidth([s])/.23<=8+1e-9);
  const first=JSON.stringify(s);E.scaleStroke(s,.23);assert.equal(JSON.stringify(s),first);
  assert.ok(!/NaN|Infinity/.test(E.svgDocument([s])));
});
