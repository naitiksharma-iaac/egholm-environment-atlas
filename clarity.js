"use strict";
const waterDatasets={};
palettes.thermal=['#138b19','#8bd000','#ffff00','#ff9700','#e71913'];
let activeWaterStops=[0,2,5,10,20],temperatureTimer,temperatureFixed=false;
let temperatureSettings={};try{temperatureSettings=JSON.parse(localStorage.getItem('egholm-temperature-legends-v1')||'{}')||{}}catch{}
function temperatureKey(){return $('waterVariable').value+':'+$('clarityMonth').value}
function isTemperature(){return $('waterVariable').value.startsWith('temperature')}
function temperatureSetting(){const s=temperatureSettings[temperatureKey()];return s&&['auto','fixed','custom'].includes(s.mode)&& (s.mode!=='custom'||Number.isFinite(s.min)&&Number.isFinite(s.max)&&s.min<s.max)?s:{mode:'auto'}}
function saveTemperatureSetting(s){temperatureSettings[temperatureKey()]=s;try{localStorage.setItem('egholm-temperature-legends-v1',JSON.stringify(temperatureSettings))}catch{}}
function updateWaterScale(){
 activeWaterStops=waterConfig().stops.slice();$('temperatureLegendControls').hidden=!isTemperature();
 if(isTemperature()){
 const s=temperatureFixed?{mode:"fixed"}:temperatureSetting(),mi=clarityData.months.findIndex(r=>r.month===$('clarityMonth').value),field=$('clarityMode').value==='source'?'original':'value';let low=Infinity,high=-Infinity;
 for(const p of bakedRows){const v=p.turbidity?.[mi]?.[field];if(Number.isFinite(v)){low=Math.min(low,v);high=Math.max(high,v)}}
 const hasData=Number.isFinite(low),range=hasData?low.toFixed(2)+'–'+high.toFixed(2)+'°C':'no supported values';
 if(s.mode==='custom')activeWaterStops=Array.from({length:5},(_,i)=>s.min+(s.max-s.min)*i/4);
 else if(s.mode==='auto'&&hasData){let min=Math.floor(low*100)/100,max=Math.ceil(high*100)/100;if(max-min<.01){min-=.01;max+=.01}activeWaterStops=Array.from({length:5},(_,i)=>min+(max-min)*i/4)}
 $('temperatureScale').value=s.mode;$('temperatureMin').value=activeWaterStops[0].toFixed(2);$('temperatureMax').value=activeWaterStops[4].toFixed(2);
 for(const [id,value] of [['temperatureMinSlider',activeWaterStops[0]],['temperatureMaxSlider',activeWaterStops[4]]]){const el=$(id);el.min=Math.min(-5,activeWaterStops[0]-1);el.max=Math.max(35,activeWaterStops[4]+1);el.value=value}
 $('temperatureScaleNote').textContent=(clarityRecord()?.label||'Selected time')+' · grid range: '+range+'. '+(s.mode==='fixed'?'Fixed scale: colours can be compared between months.':'Month-specific scale: colours cannot be compared directly between months. Small model differences are amplified.')+' Outside legend bounds, colours clamp to the endpoints. Temperature values are unchanged.';
 }
 $('waterLegendLabels').textContent=activeWaterStops.map(v=>Number(v.toFixed(4))).join(' / ')+' '+waterConfig().unit;
}
function applyTemperatureBounds(){const a=$('temperatureMin').value,b=$('temperatureMax').value,min=Number(a),max=Number(b);if(!a.trim()||!b.trim()||!Number.isFinite(min)||!Number.isFinite(max)||min>=max){$('temperatureScaleError').textContent='Enter a minimum lower than the maximum.';return} $('temperatureScaleError').textContent='';temperatureFixed=false;saveTemperatureSetting({mode:'custom',min,max});renderClarity()}

let clarityData=null,clarityOverlay=null,clarityLocation=null;
let bakeKey=null,bakedRows=[],clarityNodeCache=new Map();
map.createPane('clarity');map.getPane('clarity').style.zIndex=270;map.getPane('clarity').style.pointerEvents='none';
const waterConfigs={turbidity:{name:'Surface turbidity',unit:'FNU',file:'water-clarity',source:'Copernicus',stops:[0,2,5,10,20],description:'Monthly satellite snapshots from different years (2025–2026), not a climatology. Lower values generally indicate clearer water.'},chlorophyll:{name:'Chlorophyll-a',unit:'mg/m³',file:'chlorophyll',source:'Copernicus',stops:[0,2,5,10,20],description:'Monthly satellite estimates of chlorophyll-a, an indicator of phytoplankton abundance. Month snapshots come from different years (2025–2026); December is unavailable.'},salinity:{name:'Surface salinity',unit:'g/kg',file:'salinity',source:'DMI DKSS Limfjord',stops:[0,10,20,25,35],description:'Timestamped surface salinity model forecast. This is not a monthly observation. Northern water outside the model and unsupported cells remain blank.'}};
waterConfigs.temperature={name:'Surface water temperature',unit:'°C',file:'temperature',source:'DMI DKSS Limfjord',stops:[-2,5,10,15,25],description:'Dated surface water-temperature model forecast in Celsius. Not a monthly average or a seabed temperature measurement.'};
waterConfigs.currents={name:'Surface current speed & direction',unit:'m/s',file:'currents',source:'DMI DKSS Limfjord',stops:[0,.1,.25,.5,1],description:'Dated surface current forecast. Colour shows speed; arrows point towards flow. Components are interpolated before speed and direction are calculated.'};
const currentArrowLayer=L.layerGroup().addTo(map),currentNodeCache=new Map();
waterConfigs.temperature_monthly={name:'Monthly temperature · regional context',unit:'°C',file:'temperature_monthly',source:'Copernicus Baltic reanalysis',stops:[-2,5,10,15,25],description:'January–December monthly means from 2025, at approximately 0.5 m depth. Coarse 1.85 km model: seasonal context only, not local differences around Egholm. Smooth 100 m grid values do not add source detail. Coastal estimates extend nearby values into coarse-model shoreline gaps; these are labelled separately. Original source mode preserves gaps.'};
waterConfigs.currents_monthly={name:'Monthly net current · regional context',unit:'m/s',file:'currents_monthly',source:'Copernicus Baltic reanalysis',stops:[0,.001,.0025,.005,.01],description:'January–December 2025 monthly mean velocity vectors at about 0.5 m depth. Colours show net flow magnitude, NOT average current speed. Reversing flows cancel. Coarse 1.85 km regional model: exploratory context only; Egholm channels and local currents are unresolved. Optional coastal estimates extend nearby vectors into shoreline gaps; these do not model local channel flow.'};
waterConfigs.salinity_historical={name:'Salinity · historical monthly estimate',unit:'PSS-78',file:'salinity_historical',source:'ICES observations · 1989–2003',stops:[20,23,25,27,30],description:'January–December seasonal estimates from historical main-channel measurements at 0–1 m depth, 1989–2003. Not current-year salinity. Two station seasonal means are interpolated across the water grid; shoreline-scale differences are unresolved. The 2021–2025 western station comparison is shown below.'};
function waterPrecision(){return $('waterVariable').value==='currents_monthly'?4:2}
function isModelKey(key){return ['salinity','temperature','currents','temperature_monthly','currents_monthly'].includes(key)}
function waterConfig(){return waterConfigs[$('waterVariable').value]}
function clarityRecord(){return clarityData?.months.find(m=>m.month===$('clarityMonth').value)}
function clarityCell(lat,lon){
 const d=clarityRecord()?.grid||clarityData;if(!d||!waterGeometry||!inWater(lon,lat))return null;
 const dx=d.longitude[1]-d.longitude[0],dy=d.latitude[1]-d.latitude[0],x=Math.round((lon-d.longitude[0])/dx),y=Math.round((lat-d.latitude[0])/dy);
 return x<0||y<0||x>=d.width||y>=d.height?null:y*d.width+x;
}
function inspectClarity(lat,lon){
 clarityLocation=[lat,lon];if(typeof routeExcluded==='function'&&routeExcluded(lon,lat)){$('clarityValue').textContent='Inactive route corridor';$('clarityNote').textContent='Environmental values withheld by your selected route exclusion.';return}const r=clarityRecord(),i=clarityCell(lat,lon);
 if(!r){$('clarityValue').textContent='Data not loaded';return}
 if(r.status){$('clarityValue').textContent='No December observations';$('clarityNote').textContent='No supported December values in this downloaded dataset. No other month is substituted.';return}
 const v=i===null?null:r.values[i],n=i===null?null:r.counts[i];
 const sampled=i===null?{value:null,support:0,minCount:null}:Turbidity.sample(clarityData,r,lon,lat,Number($('clarityMin').value));
 const en=proj4('EPSG:4326','EPSG:32632',[lon,lat]);
 const estimate=sampled.value===null?null:claritySurface(en[0],en[1]);
 $('clarityValue').textContent=v===null||v===undefined?'No source value':n<Number($('clarityMin').value)?'Below observation filter':v.toFixed(waterPrecision())+' '+waterConfig().unit;
 if($('clarityMode').value==='smooth'){$('clarityValue').textContent=estimate===null?'No supported estimate':estimate.toFixed(waterPrecision())+' '+waterConfig().unit+' · estimated';$('clarityNote').textContent=r.month+' · '+gridSpacing()+' m grid · original cell '+(v===null||v===undefined?'missing':v.toFixed(waterPrecision())+' '+waterConfig().unit)+' · source support '+sampled.support+' cells (minimum '+(sampled.minCount??'—')+' daily observations).'}else $('clarityNote').textContent=r.month+' · '+(n===null||n===undefined?'no observation count':n+' daily observations')+' · original satellite monthly cell';
 if(clarityData.kind==='model')$('clarityNote').textContent=r.month+' · model run '+clarityData.modelRun+' · '+gridSpacing()+' m grid · original cell '+(v==null?'missing':v.toFixed(waterPrecision())+' '+waterConfig().unit)+' · '+sampled.support+' supporting model cells; not observations.';
 if(clarityData.variable==='currents_monthly')$('clarityNote').textContent=r.month+' monthly mean vector · ~0.5 m depth · 1.85 km source · '+gridSpacing()+' m display grid · original net magnitude '+(v==null?'missing':v.toFixed(4)+' m/s')+'. Not mean speed; reversing flows cancel. Regional estimate, not local channel conditions.';
 if(r.u){const z=$('clarityMode').value==='source'?{direction:sampled.originalDirection}:currentSurface(...en);$('clarityNote').textContent+=' Flow towards '+(sampled.value===null?'unavailable':z?.direction==null?'undefined / near-calm':z.direction.toFixed(1)+'° true north bearing')+'.';}
 if(clarityData.variable==='temperature_monthly')$('clarityNote').textContent=r.month+' monthly mean · ~0.5 m depth · 1.85 km source · '+gridSpacing()+' m display grid · original cell '+(v==null?'missing':v.toFixed(waterPrecision())+' °C')+'. Regional context only; not resolved local conditions.';
 if(clarityData.variable==='salinity_historical'){$('clarityNote').textContent='Historical 1989–2003 seasonal spatial estimate at 0–1 m depth. Not measured at this grid point; not present-day salinity. Two station references; dates and sampling counts in Sources & method.';}
 if(sampled.coastalEstimate){$('clarityNote').textContent+=' Coastal gap estimate from '+sampled.support+' source cells; nearest '+Math.round(sampled.nearestSourceMetres)+' m. No source value at this location.';if($('clarityMode').value==='smooth'&&estimate!==null)$('clarityValue').textContent=estimate.toFixed(waterPrecision())+' '+waterConfig().unit+' · coastal estimate';}
}
function clarityColor(v){const stops=activeWaterStops,cs=palettes[$('clarityPalette').value];let j=0;while(j<4&&v>=stops[j+1])j++;if(j===4)return rgb(cs[4]);const t=Math.max(0,(v-stops[j])/(stops[j+1]-stops[j]));return rgb(cs[j]).map((a,k)=>Math.round(a+(rgb(cs[j+1])[k]-a)*t))}
function renderClarity(){
 if(!clarityData||!waterGeometry)return;
 bakeClarityGrid();updateWaterScale();clarityNodeCache.clear();currentNodeCache.clear();currentArrowLayer.clearLayers();if($('clarity').checked)colorClarityGrid();
 if(clarityOverlay){map.removeLayer(clarityOverlay);clarityOverlay=null}
 const r=clarityRecord();if(!r)return;
 const cs=palettes[$('clarityPalette').value];$('clarityRamp').style.background='linear-gradient(to right,'+cs.map((c,i)=>c+' '+((activeWaterStops[i]-activeWaterStops[0])/(activeWaterStops[4]-activeWaterStops[0])*100)+'%').join(',')+')';
 if(r.status){$('clarityStatus').textContent=r.label+': no valid observations found. No values are substituted from other months.';if(clarityLocation)inspectClarity(...clarityLocation);return}
 const min=Number($('clarityMin').value),count=r.values.filter((v,i)=>v!==null&&r.counts[i]>=min).length;
 const total=(r.grid||clarityData).waterCells;
 $('clarityStatus').textContent=r.label+' · '+count.toLocaleString()+' / '+total.toLocaleString()+' water-cell centres pass the filter ('+Math.round(count/total*100)+'%). Transparent gaps have no displayed value.';
 if(clarityData.kind==='model')$('clarityStatus').textContent=r.label+' UTC · '+count.toLocaleString()+' supported model cells. Northern coverage ends near 57.109° N. This saved forecast is not a monthly average.';
 if(clarityData.temporalType==='monthly'){const mi=clarityData.months.indexOf(r),filled=bakedRows.filter(p=>p.turbidity[mi]?.coastalEstimate).length;$('clarityStatus').textContent=r.label+' 2025 · 1.85 km regional model. '+($('clarityMode').value==='source'?'Original source cells; coastal gaps retained.':clarityData.coastalGapFillEnabled?filled+' water-grid points use coastal estimates (up to 2.5 km from source centres).':'Coastal estimates off; source gaps retained.');}
 if(clarityData.variable==='currents_monthly')$('clarityStatus').textContent+=' Monthly NET flow, not average speed. Fixed 0–0.01 m/s scale.';
 if(clarityData.variable==='salinity_historical'){$('clarityStatus').textContent=r.label+' · 1989–2003 historical seasonal estimate. Two source stations, not 100 m observations.';}
 if($('clarity').checked){
 const d=r.grid||clarityData,width=720,merc=lat=>Math.log(Math.tan(Math.PI/4+lat*Math.PI/360)),north=merc(study.getNorth()),south=merc(study.getSouth()),west=study.getWest(),east=study.getEast(),height=Math.round(width*(north-south)/((east-west)*Math.PI/180));
 const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d'),im=ctx.createImageData(width,height),dx=d.longitude[1]-d.longitude[0],dy=d.latitude[1]-d.latitude[0];
 const original=$('clarityMode').value==='source';
 for(let y=0;y<height;y++){const lat=(2*Math.atan(Math.exp(north-(y+.5)/height*(north-south)))-Math.PI/2)*180/Math.PI;
 for(let x=0;x<width;x++){const lon=west+(x+.5)/width*(east-west);if(typeof routeExcluded==='function'&&routeExcluded(lon,lat))continue;const support=Turbidity.sample(clarityData,r,lon,lat,min);let value=support.original;
 if(!original&&support.value!==null){const en=proj4('EPSG:4326','EPSG:32632',[lon,lat]);value=claritySurface(...en)}
 if(value!==null)im.data.set([...clarityColor(value),230],(y*width+x)*4)}}ctx.putImageData(im,0,0);
 ctx.globalCompositeOperation='destination-in';ctx.beginPath();const polys=waterGeometry.type==='Polygon'?[waterGeometry.coordinates]:waterGeometry.coordinates;
 for(const poly of polys)for(const ring of poly){ring.forEach(([lon,lat],i)=>{const x=(lon-west)/(east-west)*width,y=(north-merc(lat))/(north-south)*height;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath()}ctx.fill('evenodd');
 clarityOverlay=L.imageOverlay(c.toDataURL(),study,{pane:'clarity',interactive:false,attribution:'Water properties: '+waterConfig().source}).addTo(map);
 }
 renderCurrentArrows();if(clarityLocation)inspectClarity(...clarityLocation);
}
$('clarity').onchange=()=>{if($('clarity').checked){$('bathy').checked=false;map.removeLayer(depthLayer)}renderClarity()};
$('bathy').addEventListener('change',()=>{if($('bathy').checked){$('clarity').checked=false;renderClarity()}});
for(const id of ['clarityMonth','clarityMin','clarityPalette','clarityMode'])$(id).onchange=renderClarity;
async function activateWater(){
 const key=$('waterVariable').value,cfg=waterConfigs[key];
 clearTimeout(temperatureTimer);$('temperatureScaleError').textContent='';$('clarityPalette').value=isTemperature()?'thermal':'viridis';
 clarityData=null;bakeKey=null;clarityNodeCache.clear();currentNodeCache.clear();currentArrowLayer.clearLayers();if(clarityOverlay){map.removeLayer(clarityOverlay);clarityOverlay=null}
 $('clarityMonth').disabled=true;$('clarityStatus').textContent='Loading '+cfg.name+'…';
 $('coastalControls').hidden=!['temperature_monthly','currents_monthly'].includes(key);$('currentControls').hidden=!key.startsWith('currents');$('waterDescription').textContent=cfg.description;$('waterInspectorTitle').textContent=cfg.name+' · '+cfg.source;
 if(!clarityLocation)clearClaritySelection();
 $('waterTimeLabel').textContent=key.endsWith('_monthly')?'Calendar month · 2025':isModelKey(key)?'Model valid time (UTC)':'Calendar month';
 if(key==='salinity_historical')$('waterTimeLabel').textContent='Calendar month · historical 1989–2003';
 $('clarityMode').disabled=key==='salinity_historical';if(key==='salinity_historical')$('clarityMode').value='smooth';
 $('currentDirectionNote').textContent=key==='currents_monthly'?'Arrows show net monthly flow towards a bearing clockwise from true north. Fixed length; colour shows net magnitude, not average speed. Directions below 0.0001 m/s are hidden (display threshold only).':'Arrows point towards flow; 0° north, 90° east. Fixed length; colour shows speed. Directions below 0.01 m/s are hidden.';
 $('clarityMin').disabled=isModelKey(key);$('clarityMin').previousElementSibling.textContent=isModelKey(key)?'Model support (not observation counts)':'Minimum daily observations per cell';if(isModelKey(key)||key==='salinity_historical')$('clarityMin').value='1';if(key==='salinity_historical'){$('clarityMin').disabled=true;$('clarityMin').previousElementSibling.textContent='Two historical source stations';}
 $('waterLegendLabels').textContent=cfg.stops.join(' / ')+'+ '+cfg.unit;
 $('waterSourceDownload').href='data/'+cfg.file+'.json';$('waterGridDownload').href='data/'+key+'-grid-100m.csv';
 try{if(!waterDatasets[key]){const response=await fetch('data/'+cfg.file+'.json');if(!response.ok)throw Error(response.status);waterDatasets[key]=await response.json()}
 if($('waterVariable').value!==key)return;clarityData=waterDatasets[key];if(key.endsWith('_monthly'))clarityData.coastalGapFillEnabled=$('coastalEstimates').checked;
 $('clarityMonth').replaceChildren();for(const m of clarityData.months){const o=document.createElement('option');o.value=m.month;o.textContent=m.label+(m.status?' · no data':'');$('clarityMonth').append(o)}
 $('clarityMonth').value=clarityData.months.find(m=>m.validCells>0)?.month||clarityData.months[0].month;$('clarityMonth').disabled=false;
 if($('clarity').checked){$('bathy').checked=false;map.removeLayer(depthLayer)}renderClarity();
 }catch(err){if($('waterVariable').value===key){$('clarityStatus').textContent=cfg.name+' could not load. Select the property again to retry.';$('clarityValue').textContent='Data unavailable'}}
}
$('temperatureScale').onchange=()=>{const mode=$('temperatureScale').value;temperatureFixed=mode==='fixed';if(temperatureFixed){renderClarity();return}if(mode==='custom'){applyTemperatureBounds();return}saveTemperatureSetting({mode});$('temperatureScaleError').textContent='';renderClarity()};
for(const id of ['temperatureMin','temperatureMax'])$(id).onchange=applyTemperatureBounds;
for(const [slider,field] of [['temperatureMinSlider','temperatureMin'],['temperatureMaxSlider','temperatureMax']])$(slider).oninput=()=>{$(field).value=$(slider).value;clearTimeout(temperatureTimer);temperatureTimer=setTimeout(applyTemperatureBounds,120)};
$('temperatureApply').onclick=applyTemperatureBounds;
$('temperatureReset').onclick=()=>{clearTimeout(temperatureTimer);temperatureFixed=false;saveTemperatureSetting({mode:'auto'});$('temperatureScaleError').textContent='';renderClarity()};
$('clarityMonth').onchange=()=>{clearTimeout(temperatureTimer);$('temperatureScaleError').textContent='';renderClarity()};
$('coastalEstimates').onchange=()=>{if(clarityData?.temporalType==='monthly'){clarityData.coastalGapFillEnabled=$('coastalEstimates').checked;renderClarity()}};
$('waterVariable').onchange=activateWater;activateWater();

$('clear').addEventListener('click',()=>{clarityLocation=null;$('clarityValue').textContent='Select a water location';$('clarityNote').textContent=waterConfig().name+' · '+waterConfig().unit});

function bakeClarityGrid(){
 if(!clarityData||!waterGeometry)return;const key=$('waterVariable').value+':'+!!clarityData.coastalGapFillEnabled+':'+gridSpacing()+':'+$('clarityMin').value+':'+gridCount+':'+(typeof routeRevision==='undefined'?0:routeRevision);
 if(bakeKey===key&&points.getLayers().every(p=>p.atlasPoint?.turbidity))return;
 bakeKey=key;bakedRows=[];const min=Number($('clarityMin').value);
 points.eachLayer(layer=>{const p=layer.atlasPoint;if(!p)return;p.turbidity=clarityData.months.map(r=>p.active===false?{value:null,original:null,support:0,minCount:null}:Turbidity.sample(clarityData,r,p.lon,p.lat,min));p.waterData??={};p.waterData[$('waterVariable').value]=p.turbidity;bakedRows.push(p)});
 $('gridBakeStatus').textContent=bakedRows.length.toLocaleString()+' water points × '+clarityData.months.length+' time records baked at '+gridSpacing()+' m. Missing values remain blank.';
}
function clarityNode(i,j){const key=i+','+j;if(clarityNodeCache.has(key))return clarityNodeCache.get(key);const [lon,lat]=proj4('EPSG:32632','EPSG:4326',[i*gridSpacing(),j*gridSpacing()]);const value=inWater(lon,lat)?Turbidity.sample(clarityData,clarityRecord(),lon,lat,Number($('clarityMin').value)).value:null;clarityNodeCache.set(key,value);return value}
function currentNode(i,j){const key=i+','+j;if(currentNodeCache.has(key))return currentNodeCache.get(key);const [lon,lat]=proj4('EPSG:32632','EPSG:4326',[i*gridSpacing(),j*gridSpacing()]);const value=inWater(lon,lat)?Turbidity.sample(clarityData,clarityRecord(),lon,lat,1):null;currentNodeCache.set(key,value);return value}
function currentSurface(e,n){const u=weighted(e/gridSpacing(),n/gridSpacing(),(i,j)=>currentNode(i,j)?.u??null),v=weighted(e/gridSpacing(),n/gridSpacing(),(i,j)=>currentNode(i,j)?.v??null);return u===null||v===null?null:{u,v,value:Math.hypot(u,v),direction:Math.hypot(u,v)<(clarityData.directionThreshold??.01)?null:(Math.atan2(u,v)*180/Math.PI+360)%360}}
function claritySurface(e,n){return clarityRecord()?.u?currentSurface(e,n)?.value??null:weighted(e/gridSpacing(),n/gridSpacing(),clarityNode)}
function renderCurrentArrows(){
 currentArrowLayer.clearLayers();if(!$('clarity').checked||!$('currentArrows').checked||!clarityRecord()?.u)return;
 const used=new Set();points.eachLayer(layer=>{const p=layer.atlasPoint;if(!p||p.active===false||!map.getBounds().contains([p.lat,p.lon]))return;const xy=map.latLngToContainerPoint([p.lat,p.lon]),cell=Math.floor(xy.x/42)+','+Math.floor(xy.y/42);if(used.has(cell))return;
 const z=Turbidity.sample(clarityData,clarityRecord(),p.lon,p.lat,1),direction=$('clarityMode').value==='source'?z.originalDirection:z.direction;if(direction==null)return;used.add(cell);
 L.marker([p.lat,p.lon],{interactive:false,keyboard:false,icon:L.divIcon({className:'current-arrow',iconSize:[24,24],iconAnchor:[12,12],html:'<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate('+direction+'deg)"><path d="M12 22V3M5 10L12 3L19 10" fill="none" stroke="white" stroke-width="5"/><path d="M12 22V3M5 10L12 3L19 10" fill="none" stroke="#173e39" stroke-width="2"/></svg>'})}).addTo(currentArrowLayer);
 });
}
$('currentArrows').onchange=renderCurrentArrows;map.on('moveend zoomend',renderCurrentArrows);
function colorClarityGrid(){if(!clarityData)return;const mi=clarityData.months.findIndex(r=>r.month===$('clarityMonth').value);points.eachLayer(layer=>{if(layer.atlasPoint?.active===false){layer.setStyle({fillOpacity:0,opacity:0,stroke:false});return}const z=layer.atlasPoint?.turbidity?.[mi];const v=$('clarityMode').value==='source'?z?.original:z?.value;layer.setStyle({fillColor:v===null||v===undefined?'#ffffff':'rgb('+clarityColor(v).join(',')+')',color:'#173e39',stroke:true,weight:.5,fillOpacity:.9})})}
function gridCSV(rows,data){
 const model=data.kind==='model',vectors=data.variable?.startsWith('currents'),unit=(data.units||'FNU').replace(/[^a-zA-Z0-9]/g,'_');
 const headers=['id','longitude','latitude','utm_easting_m','utm_northing_m','spacing_m','minimum_daily_observations','active','excluded_route_id'];
 for(const r of data.months){headers.push(r.label+'_source_time',r.label+'_estimated_'+(data.variable==='currents_monthly'?'net_magnitude_':'')+unit,r.label+'_original_'+unit,r.label+'_support_cells',r.label+'_minimum_daily_count',r.label+'_coastal_estimate',r.label+'_nearest_source_m');if(vectors)headers.push(r.label+'_u_east_m_s',r.label+'_v_north_m_s',r.label+'_direction_towards_deg',r.label+'_original_direction_towards_deg')}
 const lines=[headers.join(',')];for(const p of rows){const row=[p.id,p.lon,p.lat,p.e,p.n,p.spacing,model?'':Number($('clarityMin').value),p.active===false?0:1,p.excludedRoute||''];p.turbidity.forEach((v,i)=>{row.push(data.months[i].status?'':data.months[i].month,v.value==null?'':v.value.toFixed(6),v.original==null?'':v.original.toFixed(6),v.support,model?'':v.minCount??'',v.coastalEstimate?1:0,v.nearestSourceMetres==null?'':Math.round(v.nearestSourceMetres));if(vectors)row.push(v.u??'',v.v??'',v.direction??'',v.originalDirection??'')});lines.push(row.join(','))}return lines.join('\r\n')}
$('exportClarityGrid').onclick=()=>{if(clarityData?.variable==='salinity_historical'){exportHistoricalSalinity();return}bakeClarityGrid();if(!bakedRows.length)return;const a=document.createElement('a'),url=URL.createObjectURL(new Blob([gridCSV(bakedRows,clarityData)],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='egholm-'+$('waterVariable').value+'-all-times-'+gridSpacing()+'m-min'+$('clarityMin').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};

function clearClaritySelection(){clarityLocation=null;$('clarityValue').textContent='Select a water location';$('clarityNote').textContent=waterConfig().name+' · '+waterConfig().unit}

