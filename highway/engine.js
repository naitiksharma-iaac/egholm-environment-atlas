/* Independent motion model: a damped translating/rotating bar. No original reel code. */
(function(root){
  'use strict';
  const TAU=Math.PI*2;
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  class BarBrush{
    constructor(x,y,settings,angle=-Math.PI/4){
      this.x=x;this.y=y;this.vx=0;this.vy=0;this.angle=angle;this.omega=0;
      this.targetX=x;this.targetY=y;this.targetAngle=angle;this.settings={...settings};
      this.accumulator=0;this.manual=0;this.locked=false;
    }
    aim(x,y){
      const dx=x-this.targetX,dy=y-this.targetY;
      if(Math.hypot(dx,dy)>.15&&!this.locked)this.targetAngle=Math.atan2(dy,dx)+Math.PI/2+this.manual;
      this.targetX=x;this.targetY=y;
    }
    turn(delta){this.manual+=delta;this.targetAngle+=delta;}
    tips(){const count=this.settings.tracerCount,offsets=count===1?[0]:count===3?[-.5,0,.5]:[-.5,.5];return offsets.map(d=>[this.x+Math.cos(this.angle)*d*this.settings.barLength,this.y+Math.sin(this.angle)*d*this.settings.barLength]);}
    step(dt){
      // Fixed substeps make spring behaviour independent of display frame rate.
      this.accumulator+=clamp(dt,0,.1);const output=[],h=1/240;
      while(this.accumulator+1e-10>=h){
        this.accumulator-=h;
        const swing=this.settings.inertia/100;
        const k=380-180*swing,d=2*Math.sqrt(k)*(.86-.22*swing);
        this.vx+=(k*(this.targetX-this.x)-d*this.vx)*h;this.vy+=(k*(this.targetY-this.y)-d*this.vy)*h;
        this.x+=this.vx*h;this.y+=this.vy*h;
        if(!this.locked){const ak=125-93*swing,ad=2*Math.sqrt(ak)*(.92-.73*swing);this.omega+=(ak*wrap(this.targetAngle-this.angle)-ad*this.omega)*h;this.omega=clamp(this.omega,-16,16);this.angle+=this.omega*h;}
        else this.omega=0;
        if(Math.abs(this.angle)>TAU*100){this.angle=wrap(this.angle);this.targetAngle=wrap(this.targetAngle);}
        output.push(this.tips());
      }
      return output;
    }
    settled(){return Math.hypot(this.targetX-this.x,this.targetY-this.y)<.15&&Math.hypot(this.vx,this.vy)<1&&Math.abs(this.omega)<.03;}
  }
  function bounds(strokes){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const s of strokes)for(const line of [...s.tracks,...(s.bridges||[])])for(const p of line){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);}
    return Number.isFinite(minX)?{minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY}:null;
  }
  function pathData(points){return points.map((p,i)=>(i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2)).join(' ');}
  function svgDocument(strokes){
    const b=bounds(strokes);if(!b)return null;const pad=Math.max(30,...strokes.map(s=>s.width*2)),x=b.minX-pad,y=b.minY-pad,w=Math.max(1,b.width+pad*2),h=Math.max(1,b.height+pad*2);
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}" width="${Math.ceil(w)}" height="${Math.ceil(h)}"><title>Highway drawing</title><desc>Independent rotating-bar drawing experiment. Generated paths, not engineering geometry.</desc><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fbfaf7"/><g fill="none" stroke-linecap="round" stroke-linejoin="round">`;
    // All outline edges first, then all interiors: crossings appear as open junctions.
    for(const s of strokes){const paths=[...s.tracks,...(s.bridges||[])];for(const p of paths)if(p.length>1)svg+=`<path d="${pathData(p)}" stroke="${s.ink}" stroke-width="${s.style==='ink'?.9:s.style==='ribbon'?s.width:s.width+1.35}"/>`;}
    for(const s of strokes)if(s.style==='outline')for(const p of [...s.tracks,...(s.bridges||[])])if(p.length>1)svg+=`<path d="${pathData(p)}" stroke="#fbfaf7" stroke-width="${s.width}"/>`;
    return svg+'</g></svg>';
  }
  const api={BarBrush,bounds,pathData,svgDocument,wrap};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HighwayEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
