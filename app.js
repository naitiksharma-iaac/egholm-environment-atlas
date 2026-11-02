'use strict';
const $=id=>document.getElementById(id);
const study=L.latLngBounds([[57.015,9.700],[57.130,9.930]]);
const map=L.map('map',{zoomControl:false,preferCanvas:true,minZoom:8,maxZoom:18}).fitBounds(study,{padding:[30,30]});
L.control.zoom({position:'topright'}).addTo(map);L.control.scale({imperial:false,position:'bottomleft'}).addTo(map);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
let tilesLoaded=0;
tiles.on('tileload',()=>{tilesLoaded++;$('tileError').hidden=true});
tiles.on('tileerror',()=>{if(!tilesLoaded)$('tileError').hidden=false});
$('retry').onclick=()=>{tilesLoaded=0;tiles.redraw()};
const boundary=L.rectangle(study,{color:'#446c57',weight:1.5,dashArray:'6 7',fill:false,interactive:false}).addTo(map);
let waterGeometry=null;
const points=L.layerGroup();let selection=null;let gridCount=0;
proj4.defs('EPSG:32632','+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs');
function selectPoint(p){
 if(selection)map.removeLayer(selection);
 selection=L.circleMarker([p.lat,p.lon],{radius:8,color:'#a1712f',weight:2,fillColor:'#eecb85',fillOpacity:0.8}).addTo(map);
 $('pointTitle').textContent=p.id;$('pointHint').hidden=true;$('pointDetails').hidden=false;
 const items=[['Latitude',p.lat.toFixed(6)+'° N'],['Longitude',p.lon.toFixed(6)+'° E'],['UTM easting',p.e.toLocaleString('en-GB')+' m'],['UTM northing',p.n.toLocaleString('en-GB')+' m'],['Grid spacing',p.spacing+' m']];
 inspectDepth(p.lat,p.lon);$('pointDetails').replaceChildren();for(const [a,b]of items){let dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=a;dd.textContent=b;$('pointDetails').append(dt,dd)}
}
function clearPoint(){if(typeof clearWindSelection==='function')clearWindSelection();if(typeof clearClaritySelection==='function')clearClaritySelection();if(selection){map.removeLayer(selection);selection=null}$('pointTitle').textContent='Select a location';$('pointHint').hidden=false;$('pointDetails').hidden=true;$('depthValue').textContent='Select a location';$('depthNote').textContent='Source raster values; not a new field measurement.'}
function buildGrid(){
 points.clearLayers();clearPoint();if(!waterGeometry){$('pointCount').textContent='—';return}resetDepthCache();const spacing=Number($('spacing').value);gridCount=0;
 const corners=[[study.getWest(),study.getSouth()],[study.getEast(),study.getSouth()],[study.getWest(),study.getNorth()],[study.getEast(),study.getNorth()]].map(p=>proj4('EPSG:4326','EPSG:32632',p));
 const emin=Math.floor(Math.min(...corners.map(p=>p[0]))/spacing)*spacing,emax=Math.max(...corners.map(p=>p[0]));
 const nmin=Math.floor(Math.min(...corners.map(p=>p[1]))/spacing)*spacing,nmax=Math.max(...corners.map(p=>p[1]));
 for(let e=emin;e<=emax;e+=spacing)for(let n=nmin;n<=nmax;n+=spacing){
  const [lon,lat]=proj4('EPSG:32632','EPSG:4326',[e,n]);if(!study.contains([lat,lon])||!inWater(lon,lat))continue;
  const excludedRoute=typeof routeExcluded==='function'?routeExcluded(lon,lat):null;const p={id:`G${spacing}-${e}-${n}`,lat,lon,e,n,spacing,active:!excludedRoute,excludedRoute};
  const marker=L.circleMarker([lat,lon],{radius:spacing<=100?1.7:2.5,stroke:false,fillColor:'#22584e',fillOpacity:p.active?0.55:0,interactive:p.active,bubblingMouseEvents:false}).on('click',()=>selectPoint(p)).addTo(points);marker.atlasPoint=p;gridCount++;
 }
 $('pointCount').textContent=gridCount.toLocaleString('en-GB');if(typeof routeGridStatus==='function')routeGridStatus();if(typeof bakeWind==='function')bakeWind();if(typeof scheduleMonthlyBake==='function')scheduleMonthlyBake();
 requestDepthRender(true);
 if(typeof renderClarity==='function')renderClarity();
}
buildGrid();$('spacing').onchange=buildGrid;
$('grid').onchange=e=>{if(e.target.checked)points.addTo(map);else{map.removeLayer(points);clearPoint()}};
$('boundary').onchange=e=>e.target.checked?boundary.addTo(map):map.removeLayer(boundary);
$('home').onclick=()=>map.fitBounds(study,{padding:[30,30]});$('clear').onclick=clearPoint;
map.on('mousemove',e=>$('coords').textContent=`${e.latlng.lat.toFixed(5)}° N  /  ${e.latlng.lng.toFixed(5)}° E`);
$('sourcesBtn').onclick=()=>$('sources').showModal();$('closeSources').onclick=()=>$('sources').close();
$('sources').addEventListener('click',e=>{if(e.target===$('sources')){const r=$('sources').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('sources').close()}});
$('mobilePanel').onclick=()=>{const open=$('sidebar').classList.toggle('open');$('mobilePanel').textContent=open?'Close panel':'Layers & grid';$('mobilePanel').setAttribute('aria-expanded',String(open))};

let bathyData=null;
map.createPane('bathymetry');map.getPane('bathymetry').style.zIndex=250;
map.getPane('bathymetry').style.pointerEvents='none';
map.getPane('bathymetry').style.opacity=0.75;
const depthLayer=L.layerGroup().addTo(map);
function inspectDepth(lat,lon){
 if(typeof inspectClarity==='function')inspectClarity(lat,lon);if(typeof inspectWind==='function')inspectWind(lat,lon);if(typeof routeExcluded==='function'&&routeExcluded(lon,lat)){$('depthValue').textContent='Inactive route corridor';$('depthNote').textContent='Environmental values withheld by your selected route exclusion.';return}
 if(!bathyData||!waterGeometry){$('depthValue').textContent='Data not loaded';return}
 if(!inWater(lon,lat)){$('depthValue').textContent='Outside coastal water mask';$('depthNote').textContent='No depth estimate on land or outside the study window.';return}
 const raw=originalDepth(lon,lat),mode=$('depthMode').value;
 const xy=proj4('EPSG:4326','EPSG:32632',[lon,lat]);
 const estimated=mode==='source'?raw:sourceEstimate(lon,lat)===null?null:mode==='cells'?nodeDepth(Math.round(xy[0]/gridSpacing()),Math.round(xy[1]/gridSpacing())):surfaceDepth(xy[0],xy[1]);
 $('depthValue').textContent=estimated===null?'No supported depth value':`${estimated.toFixed(1)} m below LAT`;
 $('depthNote').textContent=(mode==='source'?'Original source cell.':'Interpolated estimate. Original cell: '+(raw===null?'no depth value':raw.toFixed(1)+' m')+'.')+' Grid '+gridSpacing()+' m.';
}
map.on('click',e=>{
 if(selection)map.removeLayer(selection);
 selection=L.circleMarker(e.latlng,{radius:7,color:'#a1712f',fillColor:'#eecb85',fillOpacity:0.8}).addTo(map);
 $('pointTitle').textContent='Depth at location';$('pointHint').hidden=false;
 $('pointHint').textContent=`${e.latlng.lat.toFixed(6)}° N / ${e.latlng.lng.toFixed(6)}° E`;
 $('pointDetails').hidden=true;inspectDepth(e.latlng.lat,e.latlng.lng);
});
$('bathy').onchange=e=>e.target.checked?depthLayer.addTo(map):map.removeLayer(depthLayer);
$('opacity').oninput=e=>{map.getPane('bathymetry').style.opacity=Number(e.target.value)/100;$('opacityValue').textContent=e.target.value+'%'};
fetch('data/bathymetry.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json()}).then(d=>{bathyData=d;buildGrid();requestDepthRender(true)}).catch(()=>{$('bathyStatus').textContent='Bathymetry failed to load. Reload to retry.'});

const ringCache=new WeakMap();
function ringContains(x,y,ring){
 let idx=ringCache.get(ring);
 if(!idx){const ys=ring.map(p=>p[1]),xs=ring.map(p=>p[0]);idx={minY:Math.min(...ys),maxY:Math.max(...ys),minX:Math.min(...xs),maxX:Math.max(...xs),bins:Array.from({length:128},()=>[])};idx.scale=127/(idx.maxY-idx.minY||1);
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i],lo=Math.max(0,Math.floor((Math.min(a[1],b[1])-idx.minY)*idx.scale)),hi=Math.min(127,Math.floor((Math.max(a[1],b[1])-idx.minY)*idx.scale));for(let k=lo;k<=hi;k++)idx.bins[k].push([a,b])}ringCache.set(ring,idx)}
 if(x<idx.minX||x>idx.maxX||y<idx.minY||y>idx.maxY)return false;let inside=false;
 for(const [[ax,ay],[bx,by]] of idx.bins[Math.min(127,Math.max(0,Math.floor((y-idx.minY)*idx.scale)))]){
 const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
 if(Math.abs(cross)<1e-14&&x>=Math.min(ax,bx)&&x<=Math.max(ax,bx)&&y>=Math.min(ay,by)&&y<=Math.max(ay,by))return null;
 if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }return inside;
}
function inWater(x,y){
 const polys=waterGeometry.type==='Polygon'?[waterGeometry.coordinates]:waterGeometry.coordinates;
 return polys.some(poly=>ringContains(x,y,poly[0])===true&&!poly.slice(1).some(r=>ringContains(x,y,r)!==false));
}
const coastLayer=L.layerGroup().addTo(map);
$('coast').onchange=e=>e.target.checked?coastLayer.addTo(map):map.removeLayer(coastLayer);
Promise.all(['water-mask','coastlines'].map(name=>fetch(`data/${name}.geojson`).then(r=>{if(!r.ok)throw Error(r.status);return r.json()}))).then(([water,coast])=>{
 waterGeometry=water.features[0].geometry;
 L.geoJSON(coast,{style:{color:'#a35d24',weight:2,opacity:0.95},interactive:false}).addTo(coastLayer);
 buildGrid();if(typeof renderClarity==='function')renderClarity();$('coastStatus').textContent='Coastline loaded · water-only grid active';
}).catch(()=>{$('coastStatus').textContent='Coastline could not load. Grid withheld; reload to retry.';points.clearLayers();$('pointCount').textContent='—'});

const palettes={ocean:['#e0f4ef','#9bd5d5','#53aebc','#287e9e','#17476b'],viridis:['#440154','#3b528b','#21918c','#5ec962','#fde725'],magma:['#000004','#51127c','#b73779','#fc8961','#fcfdbf'],earth:['#f5e6ba','#b7d4b1','#6fb6a3','#287f83','#123d53']};
let colors=[...palettes.ocean],breaks=[2,5,10,15],gridCache=new Map(),sourceCache=new Map(),surfaceValues=null,imageLayer=null,renderQueued=false;
const gridSpacing=()=>Number($('spacing').value);
function resetDepthCache(){if(!bathyData)return;gridCache.clear();sourceCache.clear();surfaceValues=null}
function originalDepth(lon,lat){const d=bathyData,x=Math.floor((lon-d.west)/d.dx),y=Math.floor((d.north-lat)/d.dy);if(x<0||y<0||x>=d.width||y>=d.height)return null;const v=d.values[y*d.width+x];return v!==null&&v<0?-v:null}
function sourceNode(x,y){const d=bathyData;if(x<0||y<0||x>=d.width||y>=d.height)return null;const key=y*d.width+x;if(sourceCache.has(key))return sourceCache.get(key);const v=d.values[key],lon=d.west+(x+.5)*d.dx,lat=d.north-(y+.5)*d.dy;const result=v!==null&&v<0&&inWater(lon,lat)?-v:null;sourceCache.set(key,result);return result}
function weighted(x,y,get){const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;let sum=0,total=0;for(const [dx,dy,w] of [[0,0,(1-u)*(1-v)],[1,0,u*(1-v)],[0,1,(1-u)*v],[1,1,u*v]]){if(w<1e-12)continue;const z=get(a+dx,b+dy);if(z!==null){sum+=z*w;total+=w}}return total>1e-12?sum/total:null}
function sourceEstimate(lon,lat){const d=bathyData;if(lon<d.west||lon>=d.west+d.width*d.dx||lat>d.north||lat<=d.north-d.height*d.dy)return null;return weighted((lon-d.west)/d.dx-.5,(d.north-lat)/d.dy-.5,sourceNode)}
function nodeDepth(i,j){const key=i+','+j;if(gridCache.has(key))return gridCache.get(key);const p=proj4('EPSG:32632','EPSG:4326',[i*gridSpacing(),j*gridSpacing()]);const z=inWater(...p)?sourceEstimate(...p):null;gridCache.set(key,z);return z}
function surfaceDepth(e,n){return weighted(e/gridSpacing(),n/gridSpacing(),nodeDepth)}
function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))}
function colorAt(z){const levels=[0,...breaks];let i=0;while(i<4&&z>=levels[i+1])i++;if($('colourMode').value==='classes'||i===4)return rgb(colors[i]);const t=Math.max(0,Math.min(1,(z-levels[i])/(levels[i+1]-levels[i]))),a=rgb(colors[i]),b=rgb(colors[i+1]);return a.map((c,k)=>Math.round(c+(b[k]-c)*t))}
function requestDepthRender(resample=false){if(!bathyData||!waterGeometry)return;if(resample)surfaceValues=null;if(renderQueued)return;renderQueued=true;$('bathyStatus').textContent='Updating depth view…';requestAnimationFrame(()=>{renderQueued=false;renderDepth()})}
function renderDepth(){
 const width=720,merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)),north=merc(study.getNorth()),south=merc(study.getSouth()),west=study.getWest(),east=study.getEast();
 const height=Math.round(width*(north-south)/((east-west)*Math.PI/180));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),im=ctx.createImageData(width,height);
 const mode=$('depthMode').value;
 if(!surfaceValues){surfaceValues=new Float32Array(width*height);surfaceValues.fill(NaN);for(let y=0;y<height;y++){const lat=(2*Math.atan(Math.exp(north-(y+.5)/height*(north-south)))-Math.PI/2)*180/Math.PI;for(let x=0;x<width;x++){const lon=west+(x+.5)/width*(east-west);if(typeof routeExcluded==='function'&&routeExcluded(lon,lat))continue;let z;
 if(mode==='source')z=originalDepth(lon,lat);else{const en=proj4('EPSG:4326','EPSG:32632',[lon,lat]);z=sourceEstimate(lon,lat)===null?null:mode==='cells'?nodeDepth(Math.round(en[0]/gridSpacing()),Math.round(en[1]/gridSpacing())):surfaceDepth(...en)}
 if(z!==null)surfaceValues[y*width+x]=z;
 }}}
 for(let k=0;k<surfaceValues.length;k++){const z=surfaceValues[k];if(!Number.isFinite(z))continue;const c=colorAt(z);im.data.set([...c,255],k*4)}ctx.putImageData(im,0,0);
 ctx.globalCompositeOperation='destination-in';ctx.beginPath();const polygons=waterGeometry.type==='Polygon'?[waterGeometry.coordinates]:waterGeometry.coordinates;
 for(const poly of polygons)for(const ring of poly){ring.forEach(([lon,lat],i)=>{const x=(lon-west)/(east-west)*width,y=(north-merc(lat))/(north-south)*height;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath()}ctx.fill('evenodd');
 if(imageLayer)depthLayer.removeLayer(imageLayer);imageLayer=L.imageOverlay(canvas.toDataURL(),study,{pane:'bathymetry',interactive:false}).addTo(depthLayer);
 points.eachLayer(layer=>{if(layer.atlasPoint?.active===false){layer.setStyle({fillOpacity:0,opacity:0,stroke:false});return}const p=layer.getLatLng();const en=proj4('EPSG:4326','EPSG:32632',[p.lng,p.lat]);const z=mode==='source'?originalDepth(p.lng,p.lat):nodeDepth(Math.round(en[0]/gridSpacing()),Math.round(en[1]/gridSpacing()));layer.setStyle({fillColor:z===null?'#7e8582':'rgb('+colorAt(z).join(',')+')',fillOpacity:.9,color:'#173e39',stroke:true,weight:.4})});
 if($('clarity')?.checked&&typeof colorClarityGrid==='function')colorClarityGrid();if($('windSurface')?.checked&&typeof renderWind==='function')renderWind();
 $('bathyStatus').textContent=mode==='source'?'Original source cells · coastline clipped':`Interpolated estimates · ${gridSpacing()} m grid · coastline clipped`;
}
function updateLegend(){
 const stops=[0,...breaks],max=20,bar=$('depthRamp');
 bar.style.background=$('colourMode').value==='classes'?'linear-gradient(to right,'+colors.map((c,i)=>`${c} ${stops[i]/max*100}% ${((stops[i+1]||max)/max)*100}%`).join(',')+')':'linear-gradient(to right,'+colors.map((c,i)=>`${c} ${stops[i]/max*100}%`).join(',')+')';
 bar.replaceChildren();breaks.forEach((v,i)=>{const input=document.createElement('input');input.type='range';input.min=0.1;input.max=19.9;input.step=.1;input.value=v;input.className='legend-handle';input.setAttribute('aria-label','Depth division '+(i+1)+' in metres');input.oninput=()=>{breaks[i]=Math.max(i?breaks[i-1]+.1:.1,Math.min(i<3?breaks[i+1]-.1:19.9,Number(input.value)));breaks[i]=Math.round(breaks[i]*10)/10;input.value=breaks[i];refreshLegendText();requestDepthRender()};input.onchange=()=>refreshLegendText();bar.append(input)});refreshLegendText();
}
function refreshLegendText(){const stops=[0,...breaks];$('breakValues').textContent=stops.map(v=>v.toFixed(1)).join(' / ')+'+ m';const max=20;$('depthRamp').style.background=$('colourMode').value==='classes'?'linear-gradient(to right,'+colors.map((c,i)=>`${c} ${stops[i]/max*100}% ${((stops[i+1]||max)/max)*100}%`).join(',')+')':'linear-gradient(to right,'+colors.map((c,i)=>`${c} ${stops[i]/max*100}%`).join(',')+')'}
function swatches(){ $('swatches').replaceChildren();colors.forEach((c,i)=>{const label=document.createElement('label');label.textContent='Colour '+(i+1);const input=document.createElement('input');input.type='color';input.value=c;input.setAttribute('aria-label','Legend colour '+(i+1));input.oninput=()=>{colors[i]=input.value;refreshLegendText();requestDepthRender()};label.append(input);$('swatches').append(label)})}
$('palette').onchange=()=>{colors=[...palettes[$('palette').value]];swatches();updateLegend();requestDepthRender()};
$('colourMode').onchange=()=>{updateLegend();requestDepthRender()};$('depthMode').onchange=()=>{clearPoint();requestDepthRender(true)};
$('resetStyle').onclick=()=>{colors=[...palettes.ocean];breaks=[2,5,10,15];$('palette').value='ocean';$('colourMode').value='continuous';swatches();updateLegend();requestDepthRender()};
updateLegend();swatches();
