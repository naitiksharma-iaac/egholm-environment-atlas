const test=require('node:test'),assert=require('node:assert/strict'),E=require('./engine.js'),L=require('./landscape.js');
const settings={...E.defaults,unitsPerMetre:.23,pathWidthMetres:3};
function run(points,options=settings,env=null){const b=new E.FlowBrush(points[0].x,points[0].y,options,env),s=E.newStroke(options);E.append(s,{a:[points[0].x,points[0].y],b:[points[0].x,points[0].y],width:s.width,lateral:0});let t=0;for(const p of points){b.aim(p.x,p.y,p.time-t);for(const f of b.step(p.time-t))E.append(s,f);t=p.time;}for(let i=0;i<480;i++)for(const f of b.step(1/240))E.append(s,f);return E.finish(s);}
test('metric straight routes have one shared centreline and stop without overshoot',()=>{
  const points=Array.from({length:121},(_,i)=>({x:i,y:0,time:i/60})),s=run(points);
  assert.deepEqual(s.tracks[0],s.tracks[1]);assert.equal(s.events.loops,0);assert.equal(s.events.splits,0);
  for(const [i,p] of s.tracks[0].entries()){assert.equal(p[1],0);assert.ok(p[0]<=120);if(i)assert.ok(p[0]>=s.tracks[0][i-1][0]);}
});
test('automatic loops are compact separate branches attached exactly to the main route',()=>{
  for(const spread of [10,70,140]){const s=run(E.exampleGesture(),{...settings,spread});assert.ok(s.closedLoops.length>0);assert.ok(s.events.splits>0);
    for(const loop of s.closedLoops){assert.ok(loop.track>=2);const line=s.tracks[loop.track],a=line[0];assert.deepEqual(a,line.at(-1));assert.ok(s.tracks[0].some(p=>p[0]===a[0]&&p[1]===a[1]),'loop touches main route');
      let diameter=0;for(const p of line)for(const q of line)diameter=Math.max(diameter,Math.hypot(p[0]-q[0],p[1]-q[1])/.23);assert.ok(diameter<=60,'loop diameter stays below 60 m');
    }
    assert.deepEqual(s.tracks[0].at(-1),s.tracks[1].at(-1));assert.ok(!/NaN|Infinity/.test(E.svgDocument([s])));
  }
});
test('landscape response stays local and an unmoved pointer draws nothing',()=>{
  const env=new L.Landscape({influence:100}),points=Array.from({length:181},(_,i)=>({x:-300+i*.5,y:-70,time:i/60}));
  const plain=run(points),land=run(points,settings,env);assert.notDeepEqual(land.tracks,plain.tracks);
  const a=plain.tracks[0].at(-1),b=land.tracks[0].at(-1);assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])/.23<30);
  const brush=new E.FlowBrush(150,60,settings,env);for(const frame of brush.step(.1)){assert.deepEqual(frame.a,[150,60]);assert.deepEqual(frame.b,[150,60]);}
});
test('refinement preserves source data, ink and widths and removes old oversized loop tracks',()=>{
  const oldSettings={...E.defaults},old=run(E.exampleGesture(),oldSettings,new L.Landscape());E.scaleStroke(old,.23);const before=JSON.stringify(old),s=E.refineStroke(old,settings);
  assert.equal(JSON.stringify(old),before);assert.equal(s.routeRule,1);assert.equal(s.ink,old.ink);assert.equal(s.width,old.width);assert.ok(s.closedLoops.length>0);
  for(const loop of s.closedLoops){const p=s.tracks[loop.track];assert.deepEqual(p[0],p.at(-1));assert.ok(Math.abs(E.signedArea(p))<160);}
  assert.ok(s.tracks.every((l,i)=>l.length===s.widths[i].length));
});
