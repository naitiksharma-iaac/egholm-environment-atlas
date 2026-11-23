import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,DEFAULT_SCENARIO,SCENARIOS,evaluateLoads,farmGeometry,requiredDepth,substrateLength,waveNumber,validateConfig} from '../farm-engine.mjs';
const near=(actual,expected,tol=1e-8)=>assert.ok(Math.abs(actual-expected)<tol,`${actual} != ${expected}`);

test('design presets preserve earlier growing-substrate quantities and depth envelopes',()=>{
  const expected={A:[648,4.5],B:[97.5,3],C:[58.5,2.5],D:[240,3],E:[97.5,3],F:[97.5,4],G:[9,2.5]};
  for(const [id,[length,depth]] of Object.entries(expected)){
    near(substrateLength(PRESETS[id]),length);near(requiredDepth(PRESETS[id]),depth);
  }
});
test('pilot actual loop polylines have the reported growing length and remain inside the body',()=>{
  const g=farmGeometry(PRESETS.G,{depth:4.5});let length=0;
  assert.equal(g.collectors.length,6);assert.equal(g.floats.length,4);
  for(const loop of g.collectors) for(let i=1;i<loop.points.length;i++){
    const a=loop.points[i-1],b=loop.points[i];length+=Math.hypot(...b.map((x,k)=>x-a[k]));
    assert.ok(Math.abs(b[0])<=8&&Math.abs(b[1])<=3&&b[2]<=-.5&&b[2]>=-1);
  }
  near(length,9);near(g.floats.reduce((sum,f)=>sum+f.volumeM3,0),1.2);
  assert.deepEqual(g.mooringEnvelope[0],[-28,-13,0]);
  assert.ok(g.anchors.every(a=>a[2]===-4.5));
});
test('wave dispersion satisfies its defining relation in shallow and deep water',()=>{
  for(const depth of [1,3,4.5,10,1000]) for(const period of [.25,2,4,10,60]) {
    const k=waveNumber(depth,period),omega=2*Math.PI/period;
    near(9.81*k*Math.tanh(k*depth),omega**2,1e-8);
  }
});
test('common-depth S3 comparison reproduces independent prior Python results',()=>{
  const expected={A:73.71306597063861,B:16.111671090995138,C:11.59143464595192,D:35.866663252773094,
    E:24.840836221185764,F:12.918348483444312,G:3.1781366073461683};
  for(const [id,line] of Object.entries(expected)) {
    const r=evaluateLoads(PRESETS[id],{...SCENARIOS.S3,depth:4.5});
    near(r.lineDemandKN,line,1e-8);
    assert.equal(r.certifiedSurvival,false);assert.equal(r.biologicalStatus,'unknown');
  }
});
test('zero flow and wind leave pretension and static mass, not invented hydrodynamic load',()=>{
  const r=evaluateLoads(PRESETS.G,{current:0,waveHeight:0,wind:0,pretensionKN:0});
  near(r.horizontalForceKN,0);near(r.lineDemandKN,0);
  near(r.floatRequiredM3,(80+9*16*.2)/(.65*1020));
});
test('steady drag is quadratic in current speed',()=>{
  const c={...PRESETS.G,waterArea:0,airArea:0};
  const a=evaluateLoads(c,{current:.2,waveHeight:0,wind:0}),b=evaluateLoads(c,{current:.4,waveHeight:0,wind:0});
  near(b.horizontalForceKN,4*a.horizontalForceKN);
  near(a.horizontalForceKN,.5*1020*1.6*.12*9*.2**2/1000);
});
test('capacity changes affect utilisation but never the external load demand',()=>{
  const a=evaluateLoads(PRESETS.B,{...SCENARIOS.S3,lineCapacity:10});
  const b=evaluateLoads(PRESETS.B,{...SCENARIOS.S3,lineCapacity:30});
  near(a.lineDemandKN,b.lineDemandKN);near(a.lineUtilisation,3*b.lineUtilisation);
  assert.equal(a.linePass,false);assert.equal(b.linePass,true);
  const c=evaluateLoads({...PRESETS.B,floatVolume:4.8},SCENARIOS.S3);
  near(c.floatRequiredM3,a.floatRequiredM3);near(c.floatUtilisation,a.floatUtilisation/2);
});
test('missing or invalid depth is not silently treated as measured zero or default',()=>{
  for(const depth of [null,NaN,-1,0,'4']){
    const r=evaluateLoads(PRESETS.G,{depth});assert.equal(r.valid,false);assert.equal(r.conditionalPass,false);
  }
  const invalid=evaluateLoads(PRESETS.G,{wavePeriod:1e-300});assert.equal(invalid.valid,false);
});
test('collector below seabed has no load-pass claim and a clearance failure also blocks pass',()=>{
  const a=evaluateLoads(PRESETS.A,{depth:2});assert.equal(a.status,'depth-conflict');assert.equal(a.lineDemandKN,null);
  const b=evaluateLoads(PRESETS.G,{depth:2});assert.equal(b.depthPass,false);assert.equal(b.conditionalPass,false);
  const c=evaluateLoads(PRESETS.G,{depth:3,depthDeficit:.6});assert.equal(c.depthPass,false);
});
test('invalid or overlapping geometry is rejected, and presets are not mutated',()=>{
  assert.equal(validateConfig({...PRESETS.G,rows:1.5}).valid,false);
  assert.equal(validateConfig({...PRESETS.G,lineLength:30}).valid,false);
  assert.equal(validateConfig({...PRESETS.G,interval:.2}).valid,false);
  const g=farmGeometry({...PRESETS.G,width:-2});assert.equal(g.valid,false);
  assert.equal(PRESETS.G.span,.5);evaluateLoads({...PRESETS.G,span:1});assert.equal(PRESETS.G.span,.5);
});
test('pilot stays within assumed envelopes across the earlier 81 scenarios without certifying biology',()=>{
  let n=0,maxDemand=0;
  const crops=[{diameter:.08,wetKgPerM:8,apparentFraction:.15},
    {diameter:.12,wetKgPerM:16,apparentFraction:.2},{diameter:.16,wetKgPerM:24,apparentFraction:.3}];
  for(const depth of [3,4.5,6])for(const s of Object.values(SCENARIOS))for(const crop of crops)for(const Cd of [1.1,1.6,2]){
    const r=evaluateLoads(PRESETS.G,{...s,...crop,depth,Cd});n++;maxDemand=Math.max(maxDemand,r.lineDemandKN);
    assert.equal(r.conditionalPass,true);assert.equal(r.gates.biology,'unknown');
  }
  assert.equal(n,81);near(maxDemand,4.449145821550928,1e-8);
});
