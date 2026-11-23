/** Read-only regressions against the actual deployed-source spatial module/data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {prepareContext,assessPlacement,rectangle,polygonIntersects,inPolygon,intersects,distanceSegment,minimumDepth,routeDistance,nearestGrid} from '../spatial.mjs';
import {PRESETS} from '../farm-engine.mjs';
const actual=prepareContext(JSON.parse(fs.readFileSync(new URL('../data/context.json',import.meta.url))));
const near=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const ring=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
function synthetic({land=[],natura=[],routes=[],grid}={}){
  grid??=Array.from({length:7},(_,i)=>Array.from({length:7},(_,j)=>[(i-3)*100,(j-3)*100,10,0,1000])).flat();
  return prepareContext({landPolygons:land,naturaPolygons:natura,routes,grid});
}

test('actual G survey target reproduces prior Python distance and depth',()=>{
  const p=assessPlacement(actual,PRESETS.G,{x:0,y:-1900,rotation:150},{routeBuffer:100,depthDeficit:.5,planUncertainty:0});
  near(p.routeDistance,100.56436725238292,.001);near(p.depth,4.298259,.0001);
  assert.equal(p.land,false);assert.equal(p.natura,false);assert.equal(p.pass,true);
  const uncertain=assessPlacement(actual,PRESETS.G,{x:0,y:-1900,rotation:150},{routeBuffer:100,depthDeficit:.5,planUncertainty:5});
  assert.equal(uncertain.pass,false);near(uncertain.routeMargin,-4.43542969987277,1e-6);
});
test('actual island and mainland envelopes cannot pass the land check',()=>{
  for(const name of ['Egholm','Aalborg mainland','Norresundby']){
    const p=actual.labels.find(l=>l.name===name);
    const a=assessPlacement(actual,PRESETS.G,{x:p.x,y:p.y,rotation:0});
    assert.equal(a.land,true,`${name} is land`);assert.equal(a.pass,false);
  }
});
test('actual mapped Natura point remains excluded',()=>{
  const p=actual.grid.find(p=>p[3]===1&&p[2]>3);
  assert.ok(p);
  const a=assessPlacement(actual,PRESETS.G,{x:p[0],y:p[1],rotation:0});
  assert.equal(a.natura,true);assert.equal(a.pass,false);
});
test('polygon holes stay open while their boundaries and surrounding polygon block occupation',()=>{
  const poly={rings:[ring(-100,-100,100,100),ring(-40,-40,40,40)]};
  assert.equal(inPolygon([0,0],poly.rings),false);
  assert.equal(inPolygon([70,0],poly.rings),true);
  assert.equal(polygonIntersects(ring(-10,-10,10,10),poly),false);
  assert.equal(polygonIntersects(ring(35,-10,45,10),poly),true);
  assert.equal(polygonIntersects(ring(40,-10,50,10),poly),true);
  assert.equal(polygonIntersects(ring(120,-10,140,10),poly),false);
  assert.equal(polygonIntersects(ring(-150,-150,150,150),poly),true);
});
test('segment intersection handles crossing, endpoint touching, collinear overlap and separated lines',()=>{
  assert.equal(intersects([0,0],[10,10],[0,10],[10,0]),true);
  assert.equal(intersects([0,0],[10,0],[10,0],[20,0]),true);
  assert.equal(intersects([0,0],[10,0],[4,0],[6,0]),true);
  assert.equal(intersects([0,0],[10,0],[11,0],[20,0]),false);
  assert.equal(intersects([0,0],[10,0],[0,1],[10,1]),false);
  near(distanceSegment([5,3],[0,0],[10,0]),3);
  near(distanceSegment([0,5],[0,0],[0,0]),5);
});
test('route distance uses complete segments, including a line wholly inside a farm',()=>{
  const footprint=ring(-10,-10,10,10);
  const inside=synthetic({routes:[{lines:[[[0,0],[5,0]]]}]});near(routeDistance(inside,footprint),0);
  const crossing=synthetic({routes:[{lines:[[[-20,0],[20,0]]]}]});near(routeDistance(crossing,footprint),0);
  const outside=synthetic({routes:[{lines:[[[-20,30],[20,30]]]}]});near(routeDistance(outside,footprint),20);
  const endpoint=synthetic({routes:[{lines:[[[30,30],[40,40]]]}]});near(routeDistance(endpoint,footprint),Math.sqrt(800));
});
test('missing or null support cells produce unknown depth, not zero or a permissive pass',()=>{
  const ctx=synthetic(),r=rectangle(16,6,{x:50,y:50,rotation:0});near(minimumDepth(ctx,r),10);
  ctx.depthMap.get('0,0').depth=null;assert.equal(minimumDepth(ctx,r),null);
  const a=assessPlacement(ctx,PRESETS.G,{x:50,y:50,rotation:0});assert.equal(a.depth,null);assert.equal(a.pass,false);assert.equal(a.status,'unknown');
  ctx.depthMap.delete('0,0');assert.equal(minimumDepth(ctx,r),null);
  const outside=assessPlacement(ctx,PRESETS.G,{x:10000,y:10000,rotation:0});assert.equal(outside.depth,null);assert.equal(outside.pass,false);
});
test('minimum depth covers every source cell touched by the rotated cultivation body',()=>{
  const ctx=synthetic();ctx.depthMap.get('100,100').depth=2;
  const r=rectangle(16,6,{x:50,y:50,rotation:45});near(minimumDepth(ctx,r),2);
  const p=assessPlacement(ctx,PRESETS.G,{x:50,y:50,rotation:45},{depthDeficit:.5});assert.equal(p.pass,false);near(p.depthMargin,-1);
});
test('land and Natura checks apply to the mooring envelope beyond the cultivation body',()=>{
  const obstruction={rings:[ring(20,-2,25,2)]};
  const pos={x:0,y:0,rotation:0};
  const land=assessPlacement(synthetic({land:[obstruction]}),PRESETS.G,pos);
  assert.equal(land.land,true);assert.equal(land.pass,false);
  const natura=assessPlacement(synthetic({natura:[obstruction]}),PRESETS.G,pos);
  assert.equal(natura.natura,true);assert.equal(natura.pass,false);
  assert.equal(polygonIntersects(land.body,obstruction),false);
});
test('nearest sample can retain null and reports distance rather than fabricating a value',()=>{
  const ctx=synthetic({grid:[[0,0,null,0,0],[100,0,5,0,0]]});
  const n=nearestGrid(ctx,10,0);assert.equal(n.i,0);assert.equal(n.point[2],null);near(n.distance,10);
});
