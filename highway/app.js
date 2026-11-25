/* Browser-local, two-dimensional freehand instrument. */
(() => {
  'use strict';
  const E=HighwayEngine,$=id=>document.getElementById(id),canvas=$('drawing'),paper=$('paper'),ctx=canvas.getContext('2d');
  const storageKey='highway-freehand-v3',paperColor='#fbfaf7',settings={...E.defaults};
  let strokes=[],undoStack=[],redoStack=[],active=null,brush=null,pointerId=null,inputTime=0,finishAt=0,demo=null;
  let w=1,h=1,dpr=1,view={x:0,y:0,scale:1},initialized=false,dirty=true,last=0,pan=null,space=false,tool='draw';
  let toastTimer,saveTimer,storageWarning=false,pointBudget=0,lastLoop=0,loopUntil=0,lastStats='';
  const world=(x,y)=>({x:(x-view.x)/view.scale,y:(y-view.y)/view.scale});
  const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
  function remember(){undoStack.push(strokes.slice());if(undoStack.length>30)undoStack.shift();redoStack=[];}
  function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify({version:3,settings,strokes:strokes.map(({paths,...s})=>s)}));}catch{storageWarning=true;toast('Browser storage is full. Export your drawing to keep it.');updateStatus();}},300);}
  function syncUI(){for(const k of ['flow','spread','roadWidth']){$(k).value=settings[k];$(k+'Out').textContent=settings[k]+(k==='flow'?'%':' px');}document.querySelectorAll('[data-ink]').forEach(b=>{b.classList.toggle('active',b.dataset.ink===settings.ink);b.setAttribute('aria-pressed',b.dataset.ink===settings.ink);});}
  function updateStatus(){
    const count=strokes.length+(active?1:0);$('emptyState').hidden=!!count||!!demo;
    $('undo').disabled=!undoStack.length||!!active;$('redo').disabled=!redoStack.length||!!active;
    $('clear').disabled=!count;$('exportSVG').disabled=!count;$('exportPNG').disabled=!count;
    $('strokeStatus').textContent=demo?'Following a freehand gesture…':active?'Drawing freely…':count?count+' stroke'+(count===1?'':'s')+(storageWarning?' · export to keep':' · saved in this browser'):'A blank page. All yours.';
    $('demoBadge').hidden=!demo;$('demo').textContent=demo?'Stop the example':'↗ Watch a freehand example';$('resetView').textContent=Math.round(view.scale*100)+'%';
    const totals={loops:0,splits:0,pockets:0};for(const s of active?[...strokes,active]:strokes)for(const k in totals)totals[k]+=s.events?.[k]||0;
    $('drawingStats').textContent=[['loops','closed loop'],['splits','separation'],['pockets','pocket']].map(([key,label])=>totals[key]+' '+label+(totals[key]===1?'':'s')).join(' · ');
    if(!active){$('liveState').textContent='Ready to follow';$('liveState').dataset.state='ready';}
  }
  function path(points){const p=new Path2D();if(points.length){p.moveTo(...points[0]);for(let i=1;i<points.length;i++)p.lineTo(...points[i]);p.closePath();}return p;}
  function makePaths(s){const lines=[...s.tracks,...(s.bridges||[])];return [false,true].map(inside=>lines.map((l,i)=>path(E.polygon(l,s.widths?.[i],s.style==='ink'?.9:s.width,inside||s.style!=='outline'?0:.7))));}
  function renderArtwork(c,items){
    const paths=items.map(s=>s.paths||makePaths(s));
    for(let layer=0;layer<2;layer++)items.forEach((s,i)=>{if(layer&&s.style!=='outline')return;c.fillStyle=layer?paperColor:s.ink;for(const p of paths[i][layer])c.fill(p);});
  }
  function render(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle=paperColor;ctx.fillRect(0,0,w,h);
    if($('showGrid').checked){const step=24*view.scale;if(step>=8){ctx.fillStyle='#d8dccf';for(let x=((view.x%step)+step)%step;x<w;x+=step)for(let y=((view.y%step)+step)%step;y<h;y+=step){ctx.beginPath();ctx.arc(x,y,.75,0,Math.PI*2);ctx.fill();}}}
    ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);renderArtwork(ctx,active?[...strokes,active]:strokes);ctx.restore();dirty=false;
  }
  function resize(){const r=paper.getBoundingClientRect(),oldW=w,oldH=h;w=Math.max(1,r.width-2);h=Math.max(1,r.height-2);dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);if(initialized){view.x+=(w-oldW)/2;view.y+=(h-oldH)/2;}else{view.x=w/2;view.y=h/2;initialized=true;if(strokes.length)fitDrawing();}dirty=true;}
  function samples(frames){
    if(!active)return;for(const f of frames)E.append(active,f);
    const stats=Object.values(active.events).join('/');if(stats!==lastStats){lastStats=stats;updateStatus();}
    if(active.events.loops>lastLoop){lastLoop=active.events.loops;loopUntil=performance.now()+700;}
    $('liveState').textContent=performance.now()<loopUntil?'Loop closed':({Straight:'Flowing straight',Curving:'Following a curve',Splitting:'Paths separating',Curling:'Curling back',Pocket:'Opening a pocket',Looping:'Closing a loop'}[brush.intent]);
    $('liveState').dataset.state=brush.intent.toLowerCase();
    const n=active.tracks.reduce((a,l)=>a+l.length,0);if(n>16000||n+pointBudget>100000){finishStroke();demo=null;toast('A large drawing. Export it or clear the page to continue.');}dirty=true;
  }
  function beginStroke(p){
    if(pointBudget>=100000){toast('Export or clear this drawing before adding more.');return false;}
    if(active)finishStroke();remember();finishAt=0;lastLoop=0;loopUntil=0;
    brush=new E.FlowBrush(p.x,p.y,settings);active=E.newStroke(settings);E.append(active,{a:[p.x,p.y],b:[p.x,p.y],width:settings.roadWidth,lateral:0});
    last=performance.now();inputTime=last;updateStatus();dirty=true;return true;
  }
  function finishStroke(){
    if(!active)return;
    // Export, undo, blur or a new stroke must not leave a started loop half open.
    for(let i=0;brush?.orbit&&i<480;i++)for(const frame of brush.step(1/240))E.append(active,frame);
    if(active.tracks.every(l=>l.length<2))undoStack.pop();
    else{E.finish(active);active.paths=makePaths(active);strokes.push(active);countPoints();save();}
    active=null;brush=null;finishAt=0;pointerId=null;dirty=true;updateStatus();
  }
  function stopDemo(){if(!demo)return;demo=null;finishStroke();updateStatus();}
  function setTool(name){tool=name;paper.classList.toggle('panning',name==='pan'||space);for(const t of ['draw','pan']){$(t+'Tool').classList.toggle('selected',t===name);$(t+'Tool').setAttribute('aria-pressed',t===name);}dirty=true;}
  canvas.addEventListener('pointerdown',e=>{
    if(![0,1].includes(e.button)||pan)return;if(demo)stopDemo();if(active&&!finishAt)return;if(active)finishStroke();
    const p=local(e);paper.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointerId=e.pointerId;
    if(tool==='pan'||space||e.button===1){pan={id:e.pointerId,x:e.clientX,y:e.clientY,originX:view.x,originY:view.y};paper.classList.add('dragging');}
    else{beginStroke(world(p.x,p.y));pointerId=e.pointerId;}e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
    const screen=local(e),p=world(screen.x,screen.y);$('coordinateStatus').textContent=Math.round(p.x)+' / '+Math.round(p.y);
    if(demo)return;
    if(pan){if(e.pointerId!==pan.id)return;view.x=pan.originX+e.clientX-pan.x;view.y=pan.originY+e.clientY-pan.y;dirty=true;return;}
    if(!active||finishAt||e.pointerId!==pointerId)return;
    const events=e.getCoalescedEvents?.()||[];
    for(const q of events.length?events:[e]){const a=local(q),b=world(a.x,a.y),t=q.timeStamp;brush.aim(b.x,b.y,Math.max(.002,(t-inputTime)/1000));inputTime=t;}
  });
  function release(e){if(pan?.id===e.pointerId){pan=null;paper.classList.remove('dragging');}else if(active&&e.pointerId===pointerId){finishAt=performance.now()+400;pointerId=null;}if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',e=>{release(e);finishStroke();});
  canvas.addEventListener('lostpointercapture',()=>{if(active&&!demo&&!finishAt)finishAt=performance.now()+200;pan=null;paper.classList.remove('dragging');});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{e.preventDefault();const s=local(e),p=world(s.x,s.y);view.scale=Math.max(.15,Math.min(6,view.scale*Math.exp(-e.deltaY*.002)));view.x=s.x-p.x*view.scale;view.y=s.y-p.y*view.scale;updateStatus();dirty=true;},{passive:false});
  function fitDrawing(){const b=E.bounds(active?[...strokes,active]:strokes);if(!b)return resetView();const pad=Math.max(70,E.maxWidth(strokes)*2);view.scale=Math.max(.15,Math.min(2.4,(w-pad)/Math.max(1,b.width),(h-pad)/Math.max(1,b.height)));view.x=w/2-(b.minX+b.maxX)/2*view.scale;view.y=h/2-(b.minY+b.maxY)/2*view.scale;dirty=true;updateStatus();}
  function resetView(){view={x:w/2,y:h/2,scale:1};dirty=true;updateStatus();}
  function countPoints(){pointBudget=strokes.reduce((n,s)=>n+s.tracks.reduce((m,l)=>m+l.length,0),0);}
  function undo(){stopDemo();finishStroke();if(!undoStack.length)return;redoStack.push(strokes.slice());strokes=undoStack.pop();countPoints();save();dirty=true;updateStatus();}
  function redo(){stopDemo();finishStroke();if(!redoStack.length)return;undoStack.push(strokes.slice());strokes=redoStack.pop();countPoints();save();dirty=true;updateStatus();}
  $('drawTool').onclick=()=>setTool('draw');$('panTool').onclick=()=>setTool('pan');$('undo').onclick=undo;$('redo').onclick=redo;$('fit').onclick=fitDrawing;$('resetView').onclick=resetView;
  $('clear').onclick=()=>{stopDemo();finishStroke();if(!strokes.length)return;remember();strokes=[];pointBudget=0;save();dirty=true;updateStatus();toast('Page cleared. Undo brings it back.');};
  function adjust(){stopDemo();finishStroke();for(const k of ['flow','spread','roadWidth'])settings[k]=Number($(k).value);syncUI();save();}
  for(const id of ['flow','spread','roadWidth'])$(id).addEventListener('input',adjust);
  document.querySelectorAll('[data-ink]').forEach(b=>b.onclick=()=>{stopDemo();finishStroke();settings.ink=b.dataset.ink;syncUI();save();});
  $('showGrid').onchange=()=>{dirty=true;};
  $('settingsToggle').onclick=()=>{const on=$('settingsPanel').classList.toggle('open');$('settingsToggle').setAttribute('aria-expanded',on);};
  function startDemo(){
    if(demo)return stopDemo();finishStroke();setTool('draw');const points=E.exampleGesture(),p=points[0];
    view.scale=Math.min(1.3,(w-65)/720,(h-70)/370);view.x=w/2;view.y=h/2-40*view.scale;
    if(!beginStroke(p))return;demo={points,index:0,start:performance.now(),previous:0};updateStatus();dirty=true;
  }
  $('demo').onclick=$('emptyDemo').onclick=startDemo;$('stopDemo').onclick=stopDemo;
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function exportReady(){stopDemo();finishStroke();return strokes.length>0;}
  $('exportSVG').onclick=()=>{if(!exportReady())return;download(new Blob([E.svgDocument(strokes)],{type:'image/svg+xml'}),'highway-freehand.svg');toast('SVG exported — editable vector outlines.');};
  $('exportPNG').onclick=()=>{if(!exportReady())return;const b=E.bounds(strokes),pad=Math.max(30,E.maxWidth(strokes)),ww=Math.max(1,b.width+2*pad),hh=Math.max(1,b.height+2*pad),scale=Math.min(2,4096/Math.max(ww,hh)),out=document.createElement('canvas');out.width=Math.ceil(ww*scale);out.height=Math.ceil(hh*scale);const c=out.getContext('2d');c.fillStyle=paperColor;c.fillRect(0,0,out.width,out.height);c.scale(scale,scale);c.translate(-b.minX+pad,-b.minY+pad);renderArtwork(c,strokes);out.toBlob(blob=>{if(blob){download(blob,'highway-freehand.png');toast('PNG exported.');}else toast('Export could not finish. Try SVG.');},'image/png');};
  $('aboutButton').onclick=()=>$('about').showModal();$('closeAbout').onclick=$('backToDrawing').onclick=()=>$('about').close();
  $('about').addEventListener('click',e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();}});
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)||$('about').open)return;
    if(e.code==='Space'){e.preventDefault();space=true;paper.classList.add('panning');}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
    else if(!e.ctrlKey&&!e.metaKey){if(e.key.toLowerCase()==='d')setTool('draw');if(e.key.toLowerCase()==='h')setTool('pan');if(e.key.toLowerCase()==='f')fitDrawing();if(e.key==='Escape'){stopDemo();$('settingsPanel').classList.remove('open');$('settingsToggle').setAttribute('aria-expanded','false');}}
  });
  document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;paper.classList.toggle('panning',tool==='pan');}});
  addEventListener('blur',()=>{space=false;pan=null;paper.classList.remove('dragging');paper.classList.toggle('panning',tool==='pan');stopDemo();finishStroke();});
  document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){stopDemo();finishStroke();}});
  function animate(now){
    const dt=last?Math.min(.05,(now-last)/1000):1/60;last=now;
    if(demo){const elapsed=(now-demo.start)/1000;
      while(demo&&demo.index<demo.points.length&&demo.points[demo.index].time<=elapsed){const p=demo.points[demo.index++],delta=p.time-demo.previous;demo.previous=p.time;brush.aim(p.x,p.y,delta);samples(brush.step(delta));}
      if(demo&&demo.index===demo.points.length){demo=null;finishAt=now+400;updateStatus();}
    }else if(active&&brush)samples(brush.step(dt));
    if(finishAt&&now>=finishAt&&!brush?.orbit)finishStroke();if(dirty)render();requestAnimationFrame(animate);
  }
  function validStroke(s){return s&&/^#[0-9a-f]{6}$/i.test(s.ink)&&['outline','ink','ribbon'].includes(s.style)&&Number.isFinite(s.width)&&s.width>=1&&s.width<=18&&Array.isArray(s.tracks)&&s.tracks.length>=1&&s.tracks.length<=3&&Array.isArray(s.bridges)&&[...s.tracks,...s.bridges].every(l=>Array.isArray(l)&&l.length<=100000&&l.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1000000)))&&(!s.widths||Array.isArray(s.widths)&&s.widths.length===s.tracks.length&&s.widths.every((ws,i)=>Array.isArray(ws)&&ws.length===s.tracks[i].length&&ws.every(n=>Number.isFinite(n)&&n>0&&n<=150)));}
  try{
    const saved=JSON.parse(localStorage.getItem(storageKey)||localStorage.getItem('highway-freehand-v2')||localStorage.getItem('highway-drawing-v1'));
    if([1,2,3].includes(saved?.version)&&Array.isArray(saved.strokes)&&saved.strokes.length<=500&&saved.strokes.every(validStroke)){
      strokes=saved.strokes;strokes.forEach(s=>{if(!s.loopRule&&s.events){s.events.crossings=s.events.loops||0;s.events.loops=0;}s.paths=makePaths(s);});countPoints();
      if(saved.version>=2&&saved.settings){for(const k of ['flow','spread','roadWidth'])if(Number.isFinite(saved.settings[k])&&saved.settings[k]>=Number($(k).min)&&saved.settings[k]<=Number($(k).max))settings[k]=saved.settings[k];if(['#333832','#284c69','#a24b36','#5c6850'].includes(saved.settings.ink))settings.ink=saved.settings.ink;}
    }
  }catch{}
  syncUI();resize();updateStatus();new ResizeObserver(resize).observe(paper);requestAnimationFrame(animate);
})();
