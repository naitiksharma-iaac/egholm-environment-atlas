/* Plain HTML/CSS/Canvas application. Drawing data never leaves this browser. */
(() => {
  'use strict';
  const {BarBrush,bounds,svgDocument}=HighwayEngine;
  const $=id=>document.getElementById(id),canvas=$('drawing'),paper=$('paper'),ctx=canvas.getContext('2d');
  const storageKey='highway-drawing-v1',paperColor='#fbfaf7';
  const settings={barLength:100,inertia:65,roadWidth:4,tracerCount:2,style:'outline',ink:'#333832'};
  const presets={fluid:{barLength:100,inertia:65,roadWidth:4},precise:{barLength:64,inertia:8,roadWidth:3},wild:{barLength:154,inertia:94,roadWidth:3}};
  let strokes=[],undoStack=[],redoStack=[],brush=null,active=null,pointer=null,pan=null,tool='draw',space=false,shift=false;
  let w=1,h=1,dpr=1,view={x:0,y:0,scale:1},initialized=false,dirty=true,last=0,finishAt=0,demo=null,lastAngle=-Math.PI/4;
  let toastTimer,saveTimer,storageWarning=false,pointBudget=0;
  const round=n=>Math.round(n*100)/100;
  const world=(x,y)=>({x:(x-view.x)/view.scale,y:(y-view.y)/view.scale});
  const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
  function snapshot(){return strokes.slice();}
  function remember(){undoStack.push(snapshot());if(undoStack.length>30)undoStack.shift();redoStack=[];}
  function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify({version:1,strokes:strokes.map(({paths,...s})=>s),settings}));}catch{if(!storageWarning){toast('Browser storage is full. Export your drawing to keep it.');storageWarning=true;}}},300);}
  function syncUI(){
    for(const key of ['barLength','inertia','roadWidth']){$(key).value=settings[key];$(key+'Out').textContent=settings[key]+(key==='inertia'?'%':' px');}
    $('tracerCount').value=settings.tracerCount;$('style').value=settings.style;
    document.querySelectorAll('[data-preset]').forEach(b=>{const match=Object.entries(presets[b.dataset.preset]).every(([k,v])=>settings[k]===v);b.classList.toggle('active',match);b.setAttribute('aria-pressed',match);});
    document.querySelectorAll('[data-ink]').forEach(b=>{const match=b.dataset.ink===settings.ink;b.classList.toggle('active',match);b.setAttribute('aria-pressed',match);});
  }
  function updateStatus(){
    const count=strokes.length+(active?1:0);$('emptyState').hidden=count>0||!!demo;
    $('undo').disabled=!undoStack.length||!!active;$('redo').disabled=!redoStack.length||!!active;
    $('clear').disabled=!count;$('exportSVG').disabled=!count;$('exportPNG').disabled=!count;
    $('strokeStatus').textContent=demo?'Following a gesture…':active?'Drawing — change direction to make a loop.':count?count+' stroke'+(count===1?'':'s')+' · saved in this browser':'A blank page. All yours.';
    $('demoBadge').hidden=!demo;$('demo').textContent=demo?'Stop the demonstration':'↗  Try a moving example';
    $('resetView').textContent=Math.round(view.scale*100)+'%';
  }
  function makePaths(stroke){return [...stroke.tracks,...stroke.bridges].map(line=>{const p=new Path2D();if(line.length){p.moveTo(...line[0]);for(let i=1;i<line.length;i++)p.lineTo(...line[i]);}return p;});}
  function renderArtwork(context,items){
    context.lineCap='round';context.lineJoin='round';
    for(const s of items){context.strokeStyle=s.ink;context.lineWidth=s.style==='ink'?.9:s.style==='ribbon'?s.width:s.width+1.35;const paths=s.paths||makePaths(s);for(const p of paths)context.stroke(p);}
    for(const s of items)if(s.style==='outline'){context.strokeStyle=paperColor;context.lineWidth=s.width;for(const p of s.paths||makePaths(s))context.stroke(p);}
  }
  function render(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle=paperColor;ctx.fillRect(0,0,w,h);
    if($('showGrid').checked){const step=24*view.scale;if(step>=8){ctx.fillStyle='#d8dccf';for(let x=((view.x%step)+step)%step;x<w;x+=step)for(let y=((view.y%step)+step)%step;y<h;y+=step){ctx.beginPath();ctx.arc(x,y,.75,0,Math.PI*2);ctx.fill();}}}
    ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.scale,view.scale);renderArtwork(ctx,active?[...strokes,active]:strokes);
    if(brush&&$('showGuide').checked&&(pointer||active||demo)&&tool==='draw'&&!space){
      const cs=Math.cos(brush.angle)*brush.settings.barLength/2,sn=Math.sin(brush.angle)*brush.settings.barLength/2;
      ctx.beginPath();ctx.moveTo(brush.x-cs,brush.y-sn);ctx.lineTo(brush.x+cs,brush.y+sn);ctx.strokeStyle='#9b663a';ctx.lineWidth=1/view.scale;ctx.stroke();
      ctx.fillStyle=paperColor;ctx.strokeStyle='#8c613a';for(const p of brush.tips()){ctx.beginPath();ctx.arc(p[0],p[1],2.6/view.scale,0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.fillStyle='#8c613a';ctx.beginPath();ctx.arc(brush.x,brush.y,1.8/view.scale,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();dirty=false;
  }
  function resize(){const r=paper.getBoundingClientRect();const oldW=w,oldH=h;w=Math.max(1,r.width-2);h=Math.max(1,r.height-2);dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);if(initialized){view.x+=(w-oldW)/2;view.y+=(h-oldH)/2;}else{view.x=w/2;view.y=h/2;initialized=true;if(strokes.length)fitDrawing();}dirty=true;}
  new ResizeObserver(resize).observe(paper);
  function addSamples(samples){for(const tips of samples){for(let i=0;i<tips.length;i++){const line=active.tracks[i],p=tips[i],prev=line.at(-1);if(!prev||Math.hypot(p[0]-prev[0],p[1]-prev[1])>.45){line.push([round(p[0]),round(p[1])]);pointBudget++;}}}if(pointBudget>100000){finishStroke();stopDemo();toast('This drawing is large. Export it before starting another.');}}
  function beginStroke(p){
    if(active)finishStroke();remember();finishAt=0;
    brush=new BarBrush(p.x,p.y,settings,lastAngle);brush.locked=shift;
    const tips=brush.tips().map(p=>p.map(round));
    active={tracks:tips.map(p=>[p]),bridges:tips.length>1?[[tips[0],tips.at(-1)]]:[],width:settings.roadWidth,style:settings.style,ink:settings.ink};
    dirty=true;updateStatus();
  }
  function finishStroke(){
    if(!active)return;
    const tips=brush.tips().map(p=>p.map(round));for(let i=0;i<tips.length;i++)active.tracks[i].push(tips[i]);
    if(tips.length>1)active.bridges.push([tips[0],tips.at(-1)]);
    active.paths=makePaths(active);strokes.push(active);active=null;finishAt=0;lastAngle=brush.angle;save();dirty=true;updateStatus();
  }
  function stopDemo(){if(!demo)return;demo=null;finishStroke();pointer=null;dirty=true;updateStatus();}
  function setTool(name){tool=name;paper.classList.toggle('panning',name==='pan'||space);$('drawTool').classList.toggle('selected',name==='draw');$('panTool').classList.toggle('selected',name==='pan');$('drawTool').setAttribute('aria-pressed',name==='draw');$('panTool').setAttribute('aria-pressed',name==='pan');dirty=true;}
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.button!==1||pan||active&&!finishAt)return;
    if(demo)stopDemo();const screen=local(e);paper.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointer={...screen,id:e.pointerId};
    if(tool==='pan'||space||e.button===1){if(active)finishStroke();pan={id:e.pointerId,x:e.clientX,y:e.clientY,originX:view.x,originY:view.y};paper.classList.add('dragging');}
    else beginStroke(world(screen.x,screen.y));e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
    if(demo)return;const screen=local(e),p=world(screen.x,screen.y);$('coordinateStatus').textContent=Math.round(p.x)+' / '+Math.round(p.y);
    if(pan){if(e.pointerId!==pan.id)return;view.x=pan.originX+e.clientX-pan.x;view.y=pan.originY+e.clientY-pan.y;dirty=true;return;}
    if(active&&pointer&&e.pointerId!==pointer.id)return;
    pointer={...screen,id:e.pointerId};
    if(active&&!finishAt){brush.locked=shift;brush.aim(p.x,p.y);}else if(!active){if(!brush)brush=new BarBrush(p.x,p.y,settings,lastAngle);brush.settings={...settings};brush.aim(p.x,p.y);}
    dirty=true;
  });
  function release(e){if(pan?.id===e.pointerId){pan=null;paper.classList.remove('dragging');}else if(active&&pointer?.id===e.pointerId)finishAt=performance.now()+350;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',e=>{release(e);finishStroke();pointer=null;});
  canvas.addEventListener('lostpointercapture',()=>{if(active&&!demo&&!finishAt)finishAt=performance.now()+200;pan=null;paper.classList.remove('dragging');});
  canvas.addEventListener('pointerleave',()=>{if(!active&&!pan){pointer=null;dirty=true;}});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();const screen=local(e);
    if(e.ctrlKey||e.metaKey||tool==='pan'||space){const p=world(screen.x,screen.y);view.scale=Math.max(.2,Math.min(5,view.scale*Math.exp(-e.deltaY*.003)));view.x=screen.x-p.x*view.scale;view.y=screen.y-p.y*view.scale;updateStatus();}
    else{const p=world(screen.x,screen.y);if(!brush)brush=new BarBrush(p.x,p.y,settings,lastAngle);brush.turn(Math.sign(e.deltaY)*.18);pointer={...screen};lastAngle=brush.targetAngle;}
    dirty=true;
  },{passive:false});
  function fitDrawing(){const b=bounds(active?[...strokes,active]:strokes);if(!b)return resetView();view.scale=Math.max(.2,Math.min(2.4,(w-100)/Math.max(1,b.width),(h-100)/Math.max(1,b.height)));view.x=w/2-(b.minX+b.maxX)/2*view.scale;view.y=h/2-(b.minY+b.maxY)/2*view.scale;dirty=true;updateStatus();}
  function resetView(){view={x:w/2,y:h/2,scale:1};dirty=true;updateStatus();}
  function undo(){if(demo)stopDemo();if(active)finishStroke();if(!undoStack.length)return;redoStack.push(snapshot());strokes=undoStack.pop();countPoints();save();dirty=true;updateStatus();}
  function redo(){if(demo)stopDemo();if(active)finishStroke();if(!redoStack.length)return;undoStack.push(snapshot());strokes=redoStack.pop();countPoints();save();dirty=true;updateStatus();}
  function countPoints(){pointBudget=strokes.reduce((n,s)=>n+s.tracks.reduce((m,l)=>m+l.length,0),0);}
  $('drawTool').onclick=()=>setTool('draw');$('panTool').onclick=()=>setTool('pan');$('undo').onclick=undo;$('redo').onclick=redo;$('fit').onclick=fitDrawing;$('resetView').onclick=resetView;
  $('clear').onclick=()=>{stopDemo();finishStroke();if(!strokes.length)return;remember();strokes=[];brush=null;pointBudget=0;save();dirty=true;updateStatus();toast('Page cleared. Undo brings it back.');};
  function adjust(){if(active)finishStroke();if(demo)stopDemo();for(const k of ['barLength','inertia','roadWidth','tracerCount'])settings[k]=Number($(k).value);settings.style=$('style').value;if(brush)brush.settings={...settings};syncUI();save();dirty=true;}
  for(const id of ['barLength','inertia','roadWidth','tracerCount','style'])$(id).addEventListener('input',adjust);
  document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{stopDemo();finishStroke();Object.assign(settings,presets[b.dataset.preset]);if(brush)brush.settings={...settings};syncUI();save();dirty=true;});
  document.querySelectorAll('[data-ink]').forEach(b=>b.onclick=()=>{finishStroke();stopDemo();settings.ink=b.dataset.ink;syncUI();save();dirty=true;});
  $('showGuide').onchange=$('showGrid').onchange=()=>{dirty=true;};
  $('settingsToggle').onclick=()=>{const on=$('settingsPanel').classList.toggle('open');$('settingsToggle').setAttribute('aria-expanded',on);};
  function startDemo(){
    if(demo)return stopDemo();finishStroke();setTool('draw');resetView();
    const width=Math.min(w*.63,700),height=Math.min(h*.61,480);
    // A scripted pointer gesture drives the exact same spring and tracing code.
    const at=t=>{const a=t*2*Math.PI;return {x:width*(.29*Math.sin(a)+.12*Math.sin(3*a+.4)),y:height*(.39*Math.cos(a+.2)+.1*Math.sin(4*a))};};
    demo={start:performance.now(),duration:10500,at};const p=at(0);beginStroke(p);brush.targetAngle=brush.angle=-Math.PI/3;updateStatus();dirty=true;
  }
  $('demo').onclick=$('emptyDemo').onclick=startDemo;$('stopDemo').onclick=stopDemo;
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  function exportReady(){stopDemo();finishStroke();return strokes.length>0;}
  $('exportSVG').onclick=()=>{if(!exportReady())return;download(new Blob([svgDocument(strokes)],{type:'image/svg+xml'}),'highway-drawing.svg');toast('SVG exported — editable vector paths.');};
  $('exportPNG').onclick=()=>{if(!exportReady())return;const b=bounds(strokes),pad=Math.max(30,...strokes.map(s=>s.width*2)),ww=Math.max(1,b.width+2*pad),hh=Math.max(1,b.height+2*pad),scale=Math.min(2,4096/Math.max(ww,hh));const out=document.createElement('canvas');out.width=Math.ceil(ww*scale);out.height=Math.ceil(hh*scale);const c=out.getContext('2d');c.fillStyle=paperColor;c.fillRect(0,0,out.width,out.height);c.scale(scale,scale);c.translate(-b.minX+pad,-b.minY+pad);renderArtwork(c,strokes);out.toBlob(blob=>{if(blob){download(blob,'highway-drawing.png');toast('PNG exported.');}else toast('Export could not finish. Try SVG.');},'image/png');};
  $('aboutButton').onclick=()=>$('about').showModal();$('closeAbout').onclick=$('backToDrawing').onclick=()=>$('about').close();
  $('about').addEventListener('click',e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();}});
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)||$('about').open)return;
    if(e.code==='Space'){e.preventDefault();space=true;paper.classList.add('panning');}
    if(e.key==='Shift'){shift=true;if(brush)brush.locked=true;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
    else if(!e.ctrlKey&&!e.metaKey){if(e.key.toLowerCase()==='d')setTool('draw');if(e.key.toLowerCase()==='h')setTool('pan');if(e.key.toLowerCase()==='f')fitDrawing();if(e.key==='Escape'){stopDemo();$('settingsPanel').classList.remove('open');$('settingsToggle').setAttribute('aria-expanded','false');}if(brush&&['q','e'].includes(e.key.toLowerCase())){brush.turn(e.key.toLowerCase()==='q'?-.2:.2);dirty=true;}}
  });
  document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;paper.classList.toggle('panning',tool==='pan');}if(e.key==='Shift'){shift=false;if(brush)brush.locked=false;}});
  addEventListener('blur',()=>{space=false;shift=false;pan=null;paper.classList.remove('dragging');paper.classList.toggle('panning',tool==='pan');if(brush)brush.locked=false;stopDemo();finishStroke();});
  document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){stopDemo();finishStroke();}});
  function animate(now){
    const dt=last?Math.min(.05,(now-last)/1000):1/60;last=now;
    if(demo){const t=Math.min(1,(now-demo.start)/demo.duration);const p=demo.at(t);brush.aim(p.x,p.y);if(t===1){demo=null;finishAt=now+400;updateStatus();}}
    if(brush&&(active||pointer)&&!pan){const pts=brush.step(dt);if(active){addSamples(pts);dirty=true;}else if(!brush.settled())dirty=true;}
    if(finishAt&&now>=finishAt)finishStroke();if(dirty)render();requestAnimationFrame(animate);
  }
  function validStroke(s){return s&&/^#[0-9a-f]{6}$/i.test(s.ink)&&['outline','ink','ribbon'].includes(s.style)&&Number.isFinite(s.width)&&s.width>=1&&s.width<=14&&Array.isArray(s.tracks)&&s.tracks.length>=1&&s.tracks.length<=3&&Array.isArray(s.bridges)&&[...s.tracks,...s.bridges].every(line=>Array.isArray(line)&&line.length<100001&&line.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1000000)));}
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved?.version===1&&Array.isArray(saved.strokes)&&saved.strokes.length<=500&&saved.strokes.every(validStroke)){
    strokes=saved.strokes;strokes.forEach(s=>s.paths=makePaths(s));countPoints();
    const restored=saved.settings;
    if(restored&&typeof restored==='object'){
      for(const key of ['barLength','inertia','roadWidth'])if(Number.isFinite(restored[key])&&restored[key]>=Number($(key).min)&&restored[key]<=Number($(key).max))settings[key]=restored[key];
      if([1,2,3].includes(restored.tracerCount))settings.tracerCount=restored.tracerCount;
      if(['outline','ink','ribbon'].includes(restored.style))settings.style=restored.style;
      if(['#333832','#284c69','#a24b36','#5c6850'].includes(restored.ink))settings.ink=restored.ink;
    }
  }}catch{}
  syncUI();resize();updateStatus();requestAnimationFrame(animate);
})();
