// Read the same browser-local project as the 3D designer; this is a study marker.
(() => {
  const layer = L.layerGroup().addTo(map);
  proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');
  const origin = [550000, 6325000];
  const toLatLng = (x, y) => proj4('EPSG:25832', 'EPSG:4326', [x + origin[0], y + origin[1]]).reverse();
  let centre;
  function refresh() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem('egholm-studio-project')); } catch {}
    const valid = saved?.format === 'egholm-mussel-studio' && ['x','y','rotation'].every(k => Number.isFinite(saved.position?.[k]));
    const p = valid ? saved.position : {x:0,y:-1900,rotation:150};
    const c = valid ? saved.config : {length:16,width:6,mooringEnd:20,mooringSide:10};
    centre = toLatLng(p.x, p.y);
    layer.clearLayers();
    const angle = p.rotation * Math.PI / 180;
    const ring = (length,width) => [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b]) => {
      const x = a*length/2, y=b*width/2;
      return toLatLng(p.x+x*Math.cos(angle)-y*Math.sin(angle),p.y+x*Math.sin(angle)+y*Math.cos(angle));
    });
    if ([c.length,c.width,c.mooringEnd,c.mooringSide].every(Number.isFinite)) {
      L.polygon(ring(c.length+2*c.mooringEnd,c.width+2*c.mooringSide),{color:'#a95525',weight:2,dashArray:'5 4',fillOpacity:.08}).addTo(layer);
      L.polygon(ring(c.length,c.width),{color:'#a95525',weight:2,fillOpacity:.35}).addTo(layer);
    }
    L.marker(centre,{zIndexOffset:1000,icon:L.divIcon({className:'farm-study-pin',html:'<span>● FARM STUDY</span>',iconSize:[126,30],iconAnchor:[63,15]})})
      .addTo(layer).bindPopup('<b>Mussel farm design position</b><br>'+centre[0].toFixed(5)+'° N, '+centre[1].toFixed(5)+'° E<br>Concept / survey target; not an approved farm.<br><a href="farm/?view=farm">Open the 3D farm design →</a>');
    document.getElementById('farmLocationNote').textContent = (valid?'Your saved design':'Initial study position')+' · '+centre[0].toFixed(5)+'° N, '+centre[1].toFixed(5)+'° E. Site and survival checks are in the designer.';
  }
  document.getElementById('locateFarm').onclick = () => map.setView(centre,15);
  addEventListener('storage', refresh);
  addEventListener('focus', refresh);
  refresh();
})();
