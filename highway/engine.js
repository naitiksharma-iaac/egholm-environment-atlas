/* Two independent followers of a freehand gesture. No bar and no behaviour modes. */
(function(root){
  'use strict';
  const PAPER='#fbfaf7',clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const defaults={flow:65,spread:70,roadWidth:6,ink:'#333832'};
  class FlowBrush{
    constructor(x,y,settings={}){
      this.settings={...defaults,...settings};this.target={x,y};this.lastInput={x,y};
      this.a={x,y,vx:0,vy:0};this.b={x,y,vx:0,vy:0};this.heading=0;this.hasHeading=false;
      this.speed=0;this.turn=0;this.turnTarget=0;this.speedTarget=0;this.age=0;this.accumulator=0;
      this.width=this.settings.roadWidth;this.intent='Straight';
    }
    aim(x,y,dt=1/60){
      if(!Number.isFinite(x)||!Number.isFinite(y))return;
      const dx=x-this.lastInput.x,dy=y-this.lastInput.y,d=Math.hypot(dx,dy);this.target={x,y};this.age=0;
      if(d>.04){
        const heading=Math.atan2(dy,dx),delta=this.hasHeading?wrap(heading-this.heading):0,mix=1-Math.exp(-d/12);
        this.turnTarget+=(clamp(delta/Math.max(d,1),-.12,.12)-this.turnTarget)*mix;
        this.speedTarget=clamp(d/Math.max(.002,dt),0,1800);this.heading=heading;this.hasHeading=true;this.lastInput={x,y};
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
        integrate(this.a,this.target.x,this.target.y,700,49);
        const k=95-60*f,d=2*Math.sqrt(k)*(.9-.48*f);
        integrate(this.b,this.target.x+nx*offset,this.target.y+ny*offset,k,d);
        // Slow, gentle curves widen; a stationary pointer never creates a pocket.
        const bend=Math.abs(this.turn),gentle=clamp(bend/.008,0,1)*clamp((.06-bend)/.035,0,1);
        const slow=clamp((170-this.speedTarget)/115,0,1)*clamp((this.speedTarget-8)/25,0,1)*freshness;
        this.width+=(this.settings.roadWidth+span*.58*gentle*slow-this.width)*(1-Math.exp(-h*7));
        const lateral=Math.abs((this.b.x-this.a.x)*nx+(this.b.y-this.a.y)*ny);
        this.intent=this.width>this.settings.roadWidth+5?'Pocket':lateral>this.settings.roadWidth*1.5?'Splitting':bend>.025?'Curling':bend>.004?'Curving':'Straight';
        frames.push({a:[this.a.x,this.a.y],b:[this.b.x,this.b.y],width:this.width,lateral,intent:this.intent});
      }
      return frames;
    }
  }
  function intersect(a,b,c,d){
    const rx=b[0]-a[0],ry=b[1]-a[1],sx=d[0]-c[0],sy=d[1]-c[1],den=rx*sy-ry*sx;if(Math.abs(den)<1e-8)return null;
    const qx=c[0]-a[0],qy=c[1]-a[1],t=(qx*sy-qy*sx)/den,u=(qx*ry-qy*rx)/den;
    return t>0&&t<=1&&u>=0&&u<=1?[a[0]+t*rx,a[1]+t*ry]:null;
  }
  function newStroke(settings){return {tracks:[[],[]],widths:[[],[]],bridges:[],width:settings.roadWidth,ink:settings.ink,style:'outline',events:{loops:0,splits:0,pockets:0},_split:false,_pocket:false,_lastCross:null};}
  function append(stroke,sample){
    for(let k=0;k<2;k++){
      const line=stroke.tracks[k],p=k?sample.b:sample.a,last=line.at(-1);if(last&&Math.hypot(last[0]-p[0],last[1]-p[1])<.85)continue;
      if(last&&line.length>12){let distance=0;
        for(let j=line.length-2;j>=Math.max(0,line.length-650);j--){
          distance+=Math.hypot(line[j+1][0]-line[j][0],line[j+1][1]-line[j][1]);if(distance<Math.max(18,stroke.width*4))continue;
          const hit=intersect(last,p,line[j],line[j+1]);
          if(hit&&(!stroke._lastCross||Math.hypot(hit[0]-stroke._lastCross[0],hit[1]-stroke._lastCross[1])>stroke.width*3)){stroke.events.loops++;stroke._lastCross=hit;break;}
        }
      }
      line.push(p.map(n=>Math.round(n*100)/100));stroke.widths[k].push(k?stroke.width:sample.width);
    }
    if(sample.lateral>stroke.width*2&&!stroke._split){stroke.events.splits++;stroke._split=true;}
    if(sample.lateral<stroke.width*.6)stroke._split=false;
    if(sample.width>stroke.width+8&&!stroke._pocket){stroke.events.pockets++;stroke._pocket=true;}
    if(sample.width<stroke.width+3)stroke._pocket=false;
  }
  function finish(stroke){
    // Rejoin remaining follower lag at release using a short tangent-aware curve.
    const a=stroke.tracks[0].at(-1),b=stroke.tracks[1].at(-1);
    if(a&&b&&Math.hypot(a[0]-b[0],a[1]-b[1])>.5){
      const line=stroke.tracks[1],prev=line[Math.max(0,line.length-5)]||b,len=Math.hypot(a[0]-b[0],a[1]-b[1]),vl=Math.hypot(b[0]-prev[0],b[1]-prev[1])||1;
      const c=[b[0]+(b[0]-prev[0])/vl*len*.35,b[1]+(b[1]-prev[1])/vl*len*.35];
      for(let i=1;i<=20;i++){const t=i/20,u=1-t;line.push([u*u*b[0]+2*u*t*c[0]+t*t*a[0],u*u*b[1]+2*u*t*c[1]+t*t*a[1]]);stroke.widths[1].push(stroke.width);}
    }
    delete stroke._split;delete stroke._pocket;delete stroke._lastCross;return stroke;
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
  function bounds(strokes){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const s of strokes)for(const line of linesOf(s))for(const p of line){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);}
    return Number.isFinite(minX)?{minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY}:null;
  }
  const pathData=points=>points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');
  const maxWidth=strokes=>strokes.reduce((m,s)=>Math.max(m,s.width,...(s.widths||[]).map(ws=>ws.reduce((n,w)=>Math.max(n,w),0))),0);
  function svgDocument(strokes){
    const b=bounds(strokes);if(!b)return null;const pad=Math.max(30,maxWidth(strokes)),x=b.minX-pad,y=b.minY-pad,w=Math.max(1,b.width+2*pad),h=Math.max(1,b.height+2*pad);
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}" width="${Math.ceil(w)}" height="${Math.ceil(h)}"><title>Highway freehand drawing</title><desc>Two-dimensional freehand path study. No engineering or site assessment.</desc><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}"/>`;
    for(const interior of [false,true])for(const s of strokes){if(interior&&s.style!=='outline')continue;
      linesOf(s).forEach((line,i)=>{if(line.length<2)return;const width=s.style==='ink'?.9:s.width,points=polygon(line,s.widths?.[i],width,interior||s.style!=='outline'?0:.7);svg+=`<path d="${pathData(points)}Z" fill="${interior?PAPER:s.ink}"/>`;});
    }
    return svg+'</svg>';
  }
  // Pointer coordinates only: the demonstration has no special shape-generation code.
  function exampleGesture(){
    const pts=[];let time=0;const add=(x,y,dt=.016)=>{time+=dt;pts.push({x,y,time});};
    for(let i=0;i<=100;i++)add(-330+i*2.2,-95);
    for(let i=1;i<=160;i++){const a=i/160*Math.PI*2.3;add(-110+63*Math.sin(a),-32-63*Math.cos(a),.012);}
    const start=pts.at(-1);
    for(let i=1;i<=100;i++){const t=i/100;add(start.x+(185-start.x)*t,start.y+(30-start.y)*t+70*Math.sin(t*Math.PI),.012);}
    for(let i=1;i<=100;i++){const t=i/100;add(185-145*t,30-100*Math.sin(t*Math.PI),.008);}
    for(let i=1;i<=200;i++){const a=i/200*Math.PI;add(40+75*Math.sin(a),105-75*Math.cos(a),.025);}
    for(let i=1;i<=100;i++)add(40+2.6*i,180-i*.2,.012);
    return pts;
  }
  const api={FlowBrush,defaults,newStroke,append,finish,polygon,bounds,pathData,maxWidth,svgDocument,intersect,exampleGesture};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HighwayEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
