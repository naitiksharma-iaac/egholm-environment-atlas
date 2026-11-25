/* Two independent followers of a freehand gesture. No bar and no behaviour modes. */
(function(root){
  'use strict';
  const PAPER='#fbfaf7',clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const defaults={flow:65,spread:70,roadWidth:6,ink:'#333832'};
  // Gesture dynamics keep their own units. Physical footprint widths use map units/metre.
  function physicalWidth(width,base,metres,units){return Math.min(8,metres*Math.max(1,width/base))*units;}
  function scaleStroke(stroke,units,metres=3){
    if(stroke.unitsPerMetre)return stroke;
    const oldWidth=stroke.width;stroke.width=metres*units;
    if(stroke.widths)stroke.widths=stroke.widths.map(ws=>ws.map(w=>physicalWidth(w,oldWidth,metres,units)));
    stroke.unitsPerMetre=units;delete stroke.paths;return stroke;
  }
  // Metric routes use a shared centreline. Only deliberate features separate it.
  // The legacy spring brush below remains available for old unscaled studies.
  class RouteBrush{
    constructor(x,y,settings,environment){
      this.settings={...defaults,...settings};this.u=settings.unitsPerMetre;this.environment=environment?.strength>0?environment:null;
      this.target={x,y};this.a={x,y};this.b={x,y};this.lastInput={x,y};this.turnSample={x,y};this.heading=null;this.routeHeading=0;
      this.turnMemory=0;this.sinceFeature=100*this.u;this.turnTravel=0;this.age=0;this.accumulator=0;this.speed=0;this.intent='Straight';this.zone='Open ground';
      this.orbit=null;this.fork=null;this.pendingLoop=false;this.pendingFork=false;this.recentLoops=[];this.field={x:0,y:0};this.curvature=0;this.width=(settings.pathWidthMetres||3)*this.u;
    }
    aim(x,y,dt=1/60){
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      const travel=Math.hypot(x-this.lastInput.x,y-this.lastInput.y);this.target={x,y};
      if(travel<.01*this.u)return;
      this.age=0;this.speed=travel/Math.max(.002,dt)/this.u;this.lastInput={x,y};
      const dx=x-this.turnSample.x,dy=y-this.turnSample.y,d=Math.hypot(dx,dy);
      if(d<2*this.u)return;
      const heading=Math.atan2(dy,dx),change=this.heading===null?0:wrap(heading-this.heading);
      if(this.heading===null)this.routeHeading=heading;
      this.turnMemory=this.turnMemory*Math.exp(-d/(140*this.u))+clamp(change,-1.8,1.8);
      this.turnTravel+=d;this.heading=heading;this.turnSample={x,y};
      if(Math.abs(this.turnMemory)>.95&&this.turnTravel>12*this.u)this.pendingLoop=true;
      else if(Math.abs(this.turnMemory)>.28&&this.turnTravel>20*this.u)this.pendingFork=true;
    }
    step(dt){
      this.accumulator+=clamp(dt,0,.1);const frames=[],h=1/240,u=this.u,base=(this.settings.pathWidthMetres||3)*u;
      while(this.accumulator+1e-10>=h){
        this.accumulator-=h;this.age+=h;
        const env=this.heading===null?null:this.environment,s=env?.sample(this.target.x,this.target.y);
        this.zone=s?.zone||'Open ground';
        let fx=0,fy=0;
        if(s){const hx=Math.cos(this.routeHeading),hy=Math.sin(this.routeHeading),sign=hx*s.tangent[0]+hy*s.tangent[1]<0?-1:1;
          fx=env.strength*u*(s.fx*18+(sign*s.tangent[0]-hx)*s.alignment*5);
          fy=env.strength*u*(s.fy*18+(sign*s.tangent[1]-hy)*s.alignment*5);
        }
        const smooth=1-Math.exp(-h*18);this.field.x+=(fx-this.field.x)*smooth;this.field.y+=(fy-this.field.y)*smooth;
        const px=this.a.x,py=this.a.y,follow=1-Math.exp(-h*(36-this.settings.flow*.12));
        this.a.x+=(this.target.x+this.field.x-this.a.x)*follow;this.a.y+=(this.target.y+this.field.y-this.a.y)*follow;
        const dx=this.a.x-px,dy=this.a.y-py,d=Math.hypot(dx,dy);this.sinceFeature+=d;
        if(d>.005*u){const turn=wrap(Math.atan2(dy,dx)-this.routeHeading)*(1-Math.exp(-d/(5*u)));this.routeHeading+=turn;this.curvature+=(Math.abs(turn)/d-this.curvature)*(1-Math.exp(-d/(5*u)));}
        let branchStart=false,branchEnd=false,loopPoint=null;
        if(this.pendingLoop&&!this.orbit&&!this.fork&&this.sinceFeature>140*u){
          const radius=Math.max((12+this.settings.spread*.12)*u,base*4),tx=Math.cos(this.routeHeading),ty=Math.sin(this.routeHeading);
          const cost=side=>{let score=0;for(let i=0;i<12;i++){const a=i/12*Math.PI*2,x=this.a.x+tx*radius*Math.sin(a)-ty*side*radius*(1-Math.cos(a)),y=this.a.y+ty*radius*Math.sin(a)+tx*side*radius*(1-Math.cos(a));score+=env?.sample(x,y).resistance||0;}const cx=this.a.x-ty*side*radius,cy=this.a.y+tx*side*radius;for(const l of this.recentLoops)if(Math.hypot(cx-l.x,cy-l.y)<radius+l.r+base*2)score+=100;return score;};
          const left=cost(1),right=cost(-1),side=left<right?1:-1;
          if(Math.min(left,right)<100){this.orbit={anchor:[this.a.x,this.a.y],tx,ty,side,radius,elapsed:0,duration:.6};this.recentLoops.push({x:this.a.x-ty*side*radius,y:this.a.y+tx*side*radius,r:radius});if(this.recentLoops.length>32)this.recentLoops.shift();branchStart=true;this.sinceFeature=0;}
          this.pendingLoop=false;this.pendingFork=false;this.turnMemory=0;this.turnTravel=0;
        }else if(this.pendingFork&&!this.pendingLoop&&!this.fork&&!this.orbit&&this.sinceFeature>120*u){
          this.fork={distance:0,length:(80+this.settings.spread*.4)*u,offset:(5+this.settings.spread*.1)*u,side:this.turnMemory<0?1:-1};
          this.pendingFork=false;this.sinceFeature=0;
        }
        let offset=0,forkEnd=false;
        if(this.fork){const f=this.fork;f.distance+=d+(this.age>.12?h*f.length/.18:0);const t=clamp(f.distance/f.length,0,1),safeOffset=Math.min(f.offset,.45/Math.max(1e-6,this.curvature));offset=f.side*safeOffset*Math.sin(Math.PI*t)**2;if(t>=1){this.fork=null;offset=0;forkEnd=true;}}
        this.b={x:this.a.x-Math.sin(this.routeHeading)*offset,y:this.a.y+Math.cos(this.routeHeading)*offset};
        if(this.orbit){const o=this.orbit;if(!branchStart)o.elapsed=Math.min(o.duration,o.elapsed+h);const a=o.elapsed/o.duration*Math.PI*2;
          loopPoint=[o.anchor[0]+o.tx*o.radius*Math.sin(a)-o.ty*o.side*o.radius*(1-Math.cos(a)),o.anchor[1]+o.ty*o.radius*Math.sin(a)+o.tx*o.side*o.radius*(1-Math.cos(a))];
          if(o.elapsed>=o.duration){loopPoint=o.anchor.slice();branchEnd=true;this.orbit=null;}
        }
        const slow=clamp((300-this.speed)/220,0,1)*(this.age<.12?1:0),bend=clamp(Math.abs(this.turnMemory)/.5,0,1),pocket=Math.max(bend*.6,(s?.pocket||0)*(env?.strength||0));
        this.width+=(Math.min(8*u,base*(1+1.4*pocket*slow))-this.width)*(1-Math.exp(-h*12));
        this.intent=loopPoint?'Looping':this.fork?'Splitting':this.width>base*1.2?'Pocket':Math.abs(this.turnMemory)>.1?'Curving':'Straight';
        frames.push({a:[this.a.x,this.a.y],b:[this.b.x,this.b.y],width:this.width,lateral:Math.abs(offset),intent:this.intent,loopPoint,branchStart,branchEnd,forkEnd});
      }return frames;
    }
  }
  class FlowBrush{
    constructor(x,y,settings={},environment=null){
      if(settings.unitsPerMetre)return new RouteBrush(x,y,settings,environment);
      this.environment=environment?.strength>0?environment:null;this.engaged=false;this.zone='Open ground';
      this.settings={...defaults,...settings};this.target={x,y};this.lastInput={x,y};
      this.a={x,y,vx:0,vy:0};this.b={x,y,vx:0,vy:0};this.heading=0;this.hasHeading=false;
      this.speed=0;this.turn=0;this.turnTarget=0;this.speedTarget=0;this.age=0;this.accumulator=0;
      this.width=this.settings.roadWidth;this.intent='Straight';
      this.loopSample={x,y};this.loopHeading=null;this.turnMemory=0;this.loopTravel=0;
      this.turnDistance=0;this.pendingLoop=false;this.orbit=null;
    }
    aim(x,y,dt=1/60){
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      const dx=x-this.lastInput.x,dy=y-this.lastInput.y,d=Math.hypot(dx,dy);this.target={x,y};this.age=0;
      if(d>.04){
        this.engaged=true;
        const heading=Math.atan2(dy,dx),delta=this.hasHeading?wrap(heading-this.heading):0,mix=1-Math.exp(-d/12);
        this.turnTarget+=(clamp(delta/Math.max(d,1),-.12,.12)-this.turnTarget)*mix;
        this.speedTarget=clamp(d/Math.max(.002,dt),0,1800);this.heading=heading;this.hasHeading=true;this.lastInput={x,y};
        // Resample meaningful movement before detecting a turn; ignore pointer jitter.
        const sx=x-this.loopSample.x,sy=y-this.loopSample.y,travel=Math.hypot(sx,sy);
        if(travel>=3){
          const direction=Math.atan2(sy,sx),change=this.loopHeading===null?0:wrap(direction-this.loopHeading);
          this.loopTravel+=travel;this.turnMemory=this.turnMemory*Math.exp(-travel/150)+change;
          const threshold=1.15-.45*this.settings.flow/100;
          this.turnDistance=Math.abs(this.turnMemory)>threshold?this.turnDistance+travel:0;
          if(!this.orbit&&this.loopTravel>=Math.max(75,this.settings.spread*1.4,this.settings.roadWidth*9)&&this.turnDistance>=9&&this.speedTarget>18)this.pendingLoop=true;
          this.loopSample={x,y};this.loopHeading=direction;
        }
      }
    }
    step(dt){
      this.accumulator+=clamp(dt,0,.1);const frames=[],h=1/240;
      while(this.accumulator+1e-10>=h){
        this.accumulator-=h;this.age+=h;
        const freshness=Math.exp(-Math.max(0,this.age-.06)*14);
        this.speed+=(this.speedTarget*freshness-this.speed)*(1-Math.exp(-h*12));
        this.turn+=(this.turnTarget*freshness-this.turn)*(1-Math.exp(-h*10));
        const f=this.settings.flow/100,span=this.settings.spread,nx=-Math.sin(this.heading),ny=Math.cos(this.heading);
        const offset=span*Math.tanh(this.turn*32)*clamp(this.speed/45,0,1);
        const integrate=(p,tx,ty,k,d)=>{p.vx+=(k*(tx-p.x)-d*p.vx)*h;p.vy+=(k*(ty-p.y)-d*p.vy)*h;p.x+=p.vx*h;p.y+=p.vy*h;};
        const env=this.engaged?this.environment:null;
        const ea=env?env.steer(this.target.x,this.target.y,this.heading,.85):null;
        const eb=env?env.steer(this.target.x+nx*offset,this.target.y+ny*offset,this.heading,1.15):null;
        this.zone=ea?.zone||'Open ground';
        integrate(this.a,ea?.x??this.target.x,ea?.y??this.target.y,700/(1+(ea?.resistance||0)*(env?.strength||0)),49);
        const k=95-60*f,d=2*Math.sqrt(k)*(.9-.48*f);let loopStart=false,loopEnd=false;
        if(this.pendingLoop&&!this.orbit){
          this.pendingLoop=false;loopStart=true;
          const velocity=Math.hypot(this.b.vx,this.b.vy),angle=velocity>8?Math.atan2(this.b.vy,this.b.vx):this.heading;
          const tx=Math.cos(angle),ty=Math.sin(angle);let side=(this.a.x-this.b.x)*(-ty)+(this.a.y-this.b.y)*tx>0?-1:1;
          const rx=clamp(20+.075*this.speed+span*.2,this.settings.roadWidth*3.2,Math.max(90,this.settings.roadWidth*4));
          if(env){const cost=s=>env.sample(this.b.x-ty*s*rx,this.b.y+tx*s*rx).resistance;if(cost(side)>cost(-side)+.15)side=-side;}
          this.orbit={anchor:[this.b.x,this.b.y],tx,ty,side,rx,ry:rx*(.68+.23*Math.min(1,Math.abs(this.turnMemory)/1.8)),elapsed:0,duration:.65+rx*.003,speed:velocity};
          this.turnMemory=0;this.turnDistance=0;this.loopTravel=0;
        }
        if(this.orbit){
          const o=this.orbit;if(!loopStart)o.elapsed=Math.min(o.duration,o.elapsed+h);
          const angle=o.elapsed/o.duration*Math.PI*2,u=o.rx*Math.sin(angle),v=o.side*o.ry*(1-Math.cos(angle));
          this.b.x=o.anchor[0]+o.tx*u-o.ty*v;this.b.y=o.anchor[1]+o.ty*u+o.tx*v;
          if(env){const f=env.sample(this.b.x,this.b.y),fade=Math.sin(angle/2)**2,scale=Math.min(o.rx,o.ry)*.2*env.strength*fade;this.b.x+=f.fx*scale;this.b.y+=f.fy*scale;}
          if(o.elapsed>=o.duration){
            this.b.x=o.anchor[0];this.b.y=o.anchor[1];this.b.vx=o.tx*o.speed;this.b.vy=o.ty*o.speed;
            loopEnd=true;this.orbit=null;this.turnMemory=0;this.turnDistance=0;this.loopTravel=0;
          }
        }else integrate(this.b,eb?.x??this.target.x+nx*offset,eb?.y??this.target.y+ny*offset,k/(1+(eb?.resistance||0)*(env?.strength||0)),d);
        // Slow, gentle curves widen; a stationary pointer never creates a pocket.
        const bend=Math.abs(this.turn),gentle=clamp(bend/.008,0,1)*clamp((.06-bend)/.035,0,1);
        const slow=clamp((170-this.speedTarget)/115,0,1)*clamp((this.speedTarget-8)/25,0,1)*freshness;
        const clearing=(ea?.pocket||0)*(env?.strength||0);
        this.width+=(this.settings.roadWidth+span*(.58*gentle+.28*clearing)*slow-this.width)*(1-Math.exp(-h*7));
        const lateral=Math.abs((this.b.x-this.a.x)*nx+(this.b.y-this.a.y)*ny);
        this.intent=this.orbit?'Looping':this.width>this.settings.roadWidth+5?'Pocket':lateral>this.settings.roadWidth*1.5?'Splitting':bend>.025?'Curling':bend>.004?'Curving':'Straight';
        const footprint=this.settings.unitsPerMetre?physicalWidth(this.width,this.settings.roadWidth,this.settings.pathWidthMetres||3,this.settings.unitsPerMetre):this.width;
        frames.push({a:[this.a.x,this.a.y],b:[this.b.x,this.b.y],width:footprint,lateral,intent:this.intent,loopStart,loopEnd});
      }
      return frames;
    }
  }
  function intersect(a,b,c,d){
    const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],den=rx*sy-ry*sx;if(Math.abs(den)<1e-8)return null;
    const qx=c[0]-a[0],qy=c[1]-a[1],t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;
    return t>0&&t<=1&&u>=0&&u<=1?[a[0]+t*rx,a[1]+t*ry]:null;
  }
  function newStroke(settings){const s={tracks:[[],[]],widths:[[],[]],bridges:[],closedLoops:[],loopRule:1,width:settings.roadWidth,ink:settings.ink,style:'outline',events:{loops:0,splits:0,pockets:0,crossings:0},_split:false,_pocket:false,_lastCross:null};if(settings.unitsPerMetre){s.routeRule=1;return scaleStroke(s,settings.unitsPerMetre,settings.pathWidthMetres||3);}return s;}
  function signedArea(points){let area=0;for(let i=1;i<points.length;i++)area+=points[i-1][0]*points[i][1]-points[i][0]*points[i-1][1];return area/2;}
  function append(stroke,sample){
    for(let k=0;k<2;k++){
      const line=stroke.tracks[k],p=k?sample.b:sample.a,last=line.at(-1),spacing=stroke.routeRule ? .6*stroke.unitsPerMetre : .85;if(last&&Math.hypot(last[0]-p[0],last[1]-p[1])<spacing&&!sample.branchStart&&!(k&&(sample.loopStart||sample.loopEnd)))continue;
      if(last&&line.length>12){let distance=0;
        for(let j=line.length-2;j>=Math.max(0,line.length-650);j--){
          distance+=Math.hypot(line[j+1][0]-line[j][0],line[j+1][1]-line[j][1]);if(distance<Math.max(18,stroke.width*4))continue;
          const hit=intersect(last,p,line[j],line[j+1]);
          if(hit&&(!stroke._lastCross||Math.hypot(hit[0]-stroke._lastCross[0],hit[1]-stroke._lastCross[1])>stroke.width*3)){stroke.events.crossings++;stroke._lastCross=hit;break;}
        }
      }
      line.push(p.map(n=>Math.round(n*100)/100));stroke.widths[k].push(k?stroke.width:sample.width);
      if(k&&sample.loopStart)stroke._loopStart=line.length-1;
      if(k&&sample.loopEnd&&stroke._loopStart!==undefined){
        const from=stroke._loopStart,to=line.length-1,area=Math.abs(signedArea(line.slice(from,to+1)));
        if(area>stroke.width*stroke.width*9){stroke.closedLoops.push({track:1,from,to,area});stroke.events.loops++;}
        delete stroke._loopStart;
      }
    }
    if(sample.loopPoint){
      if(sample.branchStart){stroke._branchLoop=stroke.tracks.length;stroke.tracks.push([]);stroke.widths.push([]);}
      const track=stroke._branchLoop;if(track!==undefined){const line=stroke.tracks[track];line.push(sample.loopPoint.map(n=>Math.round(n*100)/100));stroke.widths[track].push(stroke.width);
        if(sample.branchEnd){stroke.closedLoops.push({track,from:0,to:line.length-1,area:Math.abs(signedArea(line))});stroke.events.loops++;delete stroke._branchLoop;}
      }
    }
    if(sample.lateral>stroke.width*(stroke.routeRule?1.2:2)&&!stroke._split){stroke.events.splits++;stroke._split=true;}
    if(stroke.routeRule?sample.forkEnd:sample.lateral<stroke.width*.6)stroke._split=false;
    if(sample.width>(stroke.unitsPerMetre?stroke.width*1.5:stroke.width+8)&&!stroke._pocket){stroke.events.pockets++;stroke._pocket=true;}
    if(sample.width<(stroke.unitsPerMetre?stroke.width*1.2:stroke.width+3))stroke._pocket=false;
  }
  function finish(stroke){
    // Rejoin remaining follower lag at release using a short tangent-aware curve.
    const a=stroke.tracks[0].at(-1),b=stroke.tracks[1].at(-1);
    if(a&&b&&Math.hypot(a[0]-b[0],a[1]-b[1])>.5){
      const line=stroke.tracks[1],prev=line[Math.max(0,line.length-5)]||b,len=Math.hypot(a[0]-b[0],a[1]-b[1]),vl=Math.hypot(b[0]-prev[0],b[1]-prev[1])||1;
      const c=[b[0]+(b[0]-prev[0])/vl*len*.35,b[1]+(b[1]-prev[1])/vl*len*.35];
      for(let i=1;i<=20;i++){const t=i/20,u=1-t;line.push([u*u*b[0]+2*u*t*c[0]+t*t*a[0],u*u*b[1]+2*u*t*c[1]+t*t*a[1]]);stroke.widths[1].push(stroke.width);}
    }
    delete stroke._split;delete stroke._pocket;delete stroke._lastCross;delete stroke._loopStart;delete stroke._branchLoop;return stroke;
  }
  function polygon(line,widths,width,pad=0){
    if(!line.length)return [];const left=[],right=[];
    for(let i=0;i<line.length;i++){
      const p=line[i],prev=line[Math.max(0,i-1)],next=line[Math.min(line.length-1,i+1)],dx=next[0]-prev[0],dy=next[1]-prev[1],len=Math.hypot(dx,dy)||1,r=(widths?.[i]??width)/2+pad;
      left.push([p[0]-dy/len*r,p[1]+dx/len*r]);right.push([p[0]+dy/len*r,p[1]-dx/len*r]);
    }
    const cap=(p,q,r)=>{const angle=Math.atan2(p[1]-q[1],p[0]-q[0]),out=[];for(let i=1;i<9;i++){const a=angle+Math.PI/2-i*Math.PI/9;out.push([p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r]);}return out;};
    const end=line.at(-1),start=line[0];
    return [...left,...cap(end,line.at(-2)||[end[0]-1,end[1]],(widths?.at(-1)??width)/2+pad),...right.reverse(),...cap(start,line[1]||[start[0]+1,start[1]],(widths?.[0]??width)/2+pad)];
  }
  const linesOf=s=>[...s.tracks,...(s.bridges||[])];
  function outlinePolygon(s,line,i,interior){
    // Put the outline INSIDE a metric footprint: display borders cannot add metres.
    const width=(s.style==='ink'&&!s.unitsPerMetre) ? .9 : s.width;
    const pad=s.unitsPerMetre?(interior?-Math.min(s.width*.2,s.unitsPerMetre*.65):0):(interior||s.style!=='outline'?0:.7);
    return polygon(line,s.widths?.[i],width,pad);
  }
  function bounds(strokes){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const s of strokes)for(const line of linesOf(s))for(const p of line){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);}
    return Number.isFinite(minX)?{minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY}:null;
  }
  const pathData=points=>points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
  const maxWidth=strokes=>strokes.reduce((m,s)=>Math.max(m,s.width,...(s.widths||[]).map(ws=>ws.reduce((n,w)=>Math.max(n,w),0))),0);
  function svgDocument(strokes,environment=null){
    const b=combinedBounds(strokes,environment);if(!b)return null;const pad=Math.max(30,maxWidth(strokes)),x=b.minX-pad,y=b.minY-pad,w=Math.max(1,b.width+2*pad),h=Math.max(1,b.height+2*pad);
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}" width="${Math.ceil(w)}" height="${Math.ceil(h)}"><title>Highway freehand drawing</title><desc>Two-dimensional freehand path study. No engineering or site assessment.</desc><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}"/>`;
    if(environment)svg+=environment.svg({minX:x,minY:y,width:w,height:h});
    for(const interior of [false,true])for(const s of strokes){if(interior&&s.style!=='outline')continue;
      linesOf(s).forEach((line,i)=>{if(line.length<2)return;const points=outlinePolygon(s,line,i,interior);svg+=`<path d="${pathData(points)}Z" fill="${interior?PAPER:s.ink}"/>`;});
    }
    if(environment)svg+=`<text x="${b.minX}" y="${b.maxY+pad-10}" font-family="sans-serif" font-size="8" fill="#536b64">© OpenStreetMap contributors · ODbL 1.0 · Other landscape layers are illustrative</text>`;
    return svg+'</svg>';
  }
  function combinedBounds(strokes,environment=null){const a=bounds(strokes),b=environment?.bounds;if(!b)return a;if(!a)return {...b};const minX=Math.min(a.minX,b.minX),minY=Math.min(a.minY,b.minY),maxX=Math.max(a.maxX,b.maxX),maxY=Math.max(a.maxY,b.maxY);return {minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY};}
  function refineStroke(old,settings){
    const u=settings.unitsPerMetre,source=old.tracks[0];if(source.length<2)return old;
    // Simplify the existing main trail, not the old secondary oscillation or circles.
    const keep=new Set([0,source.length-1]),stack=[[0,source.length-1]],tolerance=3*u;
    while(stack.length){const [a,b]=stack.pop(),p=source[a],q=source[b],dx=q[0]-p[0],dy=q[1]-p[1],dd=dx*dx+dy*dy;let best=tolerance,index=-1;
      for(let i=a+1;i<b;i++){const t=dd?clamp(((source[i][0]-p[0])*dx+(source[i][1]-p[1])*dy)/dd,0,1):0,d=Math.hypot(source[i][0]-p[0]-t*dx,source[i][1]-p[1]-t*dy);if(d>best){best=d;index=i;}}
      if(index>=0){keep.add(index);stack.push([a,index],[index,b]);}
    }
    const points=[...keep].sort((a,b)=>a-b).map(i=>source[i]),options={...settings,ink:old.ink,pathWidthMetres:clamp(old.width/u,1.5,6)},out=newStroke(options),brush=new RouteBrush(...points[0],options,null);
    out.environment=old.environment;out.refined=true;append(out,{a:points[0],b:points[0],width:out.width,lateral:0});
    for(let j=1;j<points.length;j++){const a=points[j-1],b=points[j],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/(3*u)));
      for(let i=1;i<=n;i++){const t=i/n;brush.aim(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,1/60);for(const f of brush.step(1/60))append(out,f);}
    }
    for(let i=0;i<240;i++)for(const f of brush.step(1/240))append(out,f);return finish(out);
  }
  // Pointer coordinates only: the demonstration has no special shape-generation code.
  function exampleGesture(){
    const pts=[];let time=0;const add=(x,y,dt=.016)=>{time+=dt;pts.push({x,y,time});};
    for(let i=0;i<=100;i++)add(-320+i*1.6,-75);
    for(let i=1;i<=100;i++)add(-160,-75+i*1.4,.014);
    for(let i=1;i<=100;i++)add(-160+i*1.6,65,.014);
    for(let i=1;i<=160;i++){const a=i/160*Math.PI/2;add(75*Math.sin(a),65+75*(1-Math.cos(a)),.025);}
    for(let i=1;i<=100;i++)add(75+2.3*i,140-i*1.5,.012);
    return pts;
  }
  const api={FlowBrush,RouteBrush,defaults,newStroke,append,finish,polygon,outlinePolygon,physicalWidth,scaleStroke,refineStroke,bounds,combinedBounds,pathData,maxWidth,svgDocument,intersect,signedArea,exampleGesture};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HighwayEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
