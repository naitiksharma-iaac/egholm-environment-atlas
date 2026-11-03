'use strict';
let salinityEvidence=null;
const salinityStations=L.layerGroup();
function showSalinityStations(){
 salinityStations.clearLayers();
 if($('waterVariable').value!=='salinity_historical'){map.removeLayer(salinityStations);return}
 if(!salinityEvidence)return;
 for(const s of salinityEvidence.stations){L.circleMarker([s.latitude,s.longitude],{radius:7,color:'#173e39',fillColor:'#ffffff',fillOpacity:1}).bindPopup(s.id+' historical station group<br>1989–2003 · upper 1 m<br>Actual sample locations are available in the CSV.').addTo(salinityStations)}
 salinityStations.addTo(map);
}
fetch('data/salinity-evidence.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{
 salinityEvidence=d;
 const table=document.createElement('table');table.style.cssText='width:100%;font-size:11px;border-collapse:collapse';
 const head=document.createElement('tr');for(const t of ['Month','West old','East old','West recent']){const th=document.createElement('th');th.textContent=t;head.append(th)}table.append(head);
 for(let i=0;i<12;i++){const tr=document.createElement('tr');for(const t of [new Date(2000,i,1).toLocaleString('en',{month:'short'}),...d.stations.map(s=>s.months[i].value.toFixed(2)),d.recentReference.months[i].value?.toFixed(2)??'—']){const td=document.createElement('td');td.textContent=t;td.style.padding='4px 2px';tr.append(td)}table.append(tr)}
 $('salinityComparison').replaceChildren(table);showSalinityStations();
}).catch(()=>$('salinityComparison').textContent='Station comparison unavailable. Use the downloadable methods file.');
$('waterVariable').addEventListener('change',showSalinityStations);
function exportHistoricalSalinity(){
 if(!clarityData||clarityData.variable!=='salinity_historical')return;
 const headers=['grid_id','longitude_deg','latitude_deg','utm_easting_m','utm_northing_m','grid_spacing_m','calendar_month','salinity','salinity_units','source_period','quality_note','nearest_source_m','active','excluded_route_id'];
 const lines=[headers.join(',')];
 points.eachLayer(layer=>{const p=layer.atlasPoint;if(!p)return;for(let i=0;i<12;i++){
  const z=Turbidity.sample(clarityData,clarityData.months[i],p.lon,p.lat,1);
  lines.push([p.id,p.lon,p.lat,p.e,p.n,p.spacing,i+1,p.active===false?'':z.value.toFixed(6),'PSS-78_dimensionless','1989-2003','historical_two_station_spatial_estimate_not_current_measurement',Math.round(z.nearestSourceMetres),p.active===false?0:1,p.excludedRoute||''].join(','));
 }});
 const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='egholm-salinity-historical-1989-2003-'+gridSpacing()+'m.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
