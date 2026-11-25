/* A drawing environment, not a habitat survey or route feasibility model. */
(function(root){
  'use strict';
  const data=typeof module!=='undefined'&&module.exports?require('./landscape-data.js'):root.EgholmLandscapeData;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const colors={water:'#dce9e7',land:'#e7ead7',wood:'#b6c7a6',wet:'#afceca',wetEdge:'#c9dbcf',dyke:'#b6a16d',clearing:'#f3eed7',shore:'#a3b6a1'};
  function inside(p,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
  function inPolygon(p,poly){return inside(p,poly[0])&&!poly.slice(1).some(r=>inside(p,r));}
  function nearest(p,line){let best={distance:Infinity,x:0,y:0,tx:1,ty:0};for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(!length)continue;const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(length*length),0,1),x=a[0]+t*dx,y=a[1]+t*dy,distance=Math.hypot(x-p[0],y-p[1]);if(distance<best.distance)best={distance,x,y,tx:dx/length,ty:dy/length};}return best;}
  function box(poly){const p=poly.flat();return {minX:Math.min(...p.map(a=>a[0])),maxX:Math.max(...p.map(a=>a[0])),minY:Math.min(...p.map(a=>a[1])),maxY:Math.max(...p.map(a=>a[1]))};}
  function ring(cx,cy,rx,ry,seed){return Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2,r=1+.1*Math.sin(a*3+seed)+.07*Math.cos(a*5-seed);return [cx+Math.cos(a)*rx*r,cy+Math.sin(a)*ry*r];});}
  const pathD=rings=>rings.map(r=>'M'+r.map(p=>p.map(n=>n.toFixed(2)).join(',')).join('L')+'Z').join('');
  const lineD=line=>'M'+line.map(p=>p.map(n=>n.toFixed(2)).join(',')).join('L');
  const defaults={enabled:true,influence:65,wetness:45,exportCanvas:true};
  class Landscape{
    constructor(settings={}){
      this.settings={...defaults,...settings};this.strength=this.settings.enabled?clamp(this.settings.influence/100,0,1):0;
      this.coast=data.coast;this.woods=data.woods.map(poly=>({poly,box:box(poly)}));
      this.bounds={minX:-505,minY:-335,maxX:505,maxY:335,width:1010,height:670};
      const wet=.55+clamp(this.settings.wetness,0,100)/100;
      this.puddles=[[-245,-80,48,29,1],[-30,-120,40,24,3],[150,60,52,32,5],[-100,145,34,20,7]].map(([x,y,rx,ry,seed])=>({x,y,rx:rx*wet,ry:ry*wet,ring:ring(x,y,rx*wet,ry*wet,seed)}));
      this.clearings=[{x:-115,y:-5,r:38},{x:75,y:-50,r:32},{x:10,y:160,r:27}];
      this.dykes=[[[-390,-115],[-340,-170],[-200,-208],[-60,-229],[100,-208],[200,-194]],[[-310,85],[-230,130],[-140,174],[-40,216],[70,201],[175,175],[270,125]]];
    }
    sample(x,y){
      const p=[x,y],onLand=this.coast.some(poly=>inPolygon(p,poly));let fx=0,fy=0,resistance=0,pocket=0,alignment=0,tangent=[1,0],zone=onLand?'Open ground':'Water';
      let edge={distance:Infinity};for(const poly of this.coast)for(const r of poly){const n=nearest(p,r);if(n.distance<edge.distance)edge=n;}
      // Offshore, pull toward land; close to shore, bias inland without a hard barrier.
      if(!onLand||edge.distance<24){const amount=onLand?Math.pow(1-edge.distance/24,2)*.7:Math.min(1,edge.distance/24+.3),sign=onLand?-1:1,d=Math.max(.01,edge.distance);fx+=sign*(edge.x-x)/d*amount;fy+=sign*(edge.y-y)/d*amount;resistance=onLand?amount*.5:.95;if(onLand)zone='Coast edge';}
      if(onLand){
        for(const item of this.woods){const b=item.box;if(x<b.minX-22||x>b.maxX+22||y<b.minY-22||y>b.maxY+22)continue;let n={distance:Infinity};for(const r of item.poly){const q=nearest(p,r);if(q.distance<n.distance)n=q;}const within=inPolygon(p,item.poly),f=within?.8:clamp(1-n.distance/22,0,1)*.65,d=Math.max(.01,n.distance),sign=within?1:-1;fx+=sign*(n.x-x)/d*f;fy+=sign*(n.y-y)/d*f;resistance=Math.max(resistance,within?.75:f*.7);if(within)zone='Woodland';}
        for(const wet of this.puddles){const dx=(x-wet.x)/wet.rx,dy=(y-wet.y)/wet.ry,q=Math.hypot(dx,dy);if(q<1.6){const gx=dx/wet.rx,gy=dy/wet.ry,n=Math.hypot(gx,gy)||1,f=clamp((1.6-q)/.85,0,1);fx+=gx/n*f;fy+=gy/n*f;resistance=Math.max(resistance,f*.9);if(q<1)zone='Wet patch';}}
        for(const c of this.clearings){const dx=c.x-x,dy=c.y-y,d=Math.hypot(dx,dy),f=clamp(1-d/(c.r*2),0,1);fx+=dx/Math.max(1,d)*f*.45;fy+=dy/Math.max(1,d)*f*.45;pocket=Math.max(pocket,f);if(d<c.r&&resistance<.4)zone='Clearing';}
        for(const line of this.dykes){const n=nearest(p,line),f=clamp(1-n.distance/35,0,1);if(f>alignment){alignment=f;tangent=[n.tx,n.ty];}fx+=(n.x-x)/Math.max(1,n.distance)*f*.5;fy+=(n.y-y)/Math.max(1,n.distance)*f*.5;if(n.distance<9&&resistance<.5)zone='Dyke scenario';}
      }
      const length=Math.hypot(fx,fy);if(length>1){fx/=length;fy/=length;}
      return {fx,fy,resistance,pocket,alignment,tangent,zone};
    }
    steer(x,y,heading,gain=1){const s=this.sample(x,y),h=[Math.cos(heading),Math.sin(heading)],dot=h[0]*s.tangent[0]+h[1]*s.tangent[1],sign=dot<0?-1:1;
      return {...s,x:x+this.strength*gain*(s.fx*62+(s.tangent[0]*sign-h[0])*s.alignment*22),y:y+this.strength*gain*(s.fy*62+(s.tangent[1]*sign-h[1])*s.alignment*22)};
    }
    // Shared primitives keep the on-screen and exported landscape identical.
    scene(){const items=[],poly=(rings,fill,stroke,width=1)=>items.push({type:'path',rings,fill,stroke,width}),line=(points,stroke,width)=>items.push({type:'line',points,stroke,width}),circle=(x,y,r,fill)=>items.push({type:'circle',x,y,r,fill});
      for(const p of this.coast)poly(p,colors.land,colors.shore,1.2);
      items.push({type:'clip'});
      poly([ring(-220,-120,170,78,3)],'#dfe5ce');poly([ring(105,100,150,83,4)],'#e0e4cb');
      for(const c of this.clearings)poly([ring(c.x,c.y,c.r,c.r*.8,2)],colors.clearing);
      for(const wet of this.puddles){poly([ring(wet.x,wet.y,wet.rx*1.23,wet.ry*1.23,wet.x)],colors.wetEdge);poly([wet.ring],colors.wet,'#94bab7',.6);}
      for(const w of this.woods)poly(w.poly,colors.wood,'#99b18c',.5);
      for(const p of data.trees)circle(...p,1.6,'#94aa80');
      for(const hedge of data.hedges)line(hedge,'#99ae89',2.5);
      for(const dyke of this.dykes){line(dyke,'#d5c79e',7);line(dyke,colors.dyke,1.3);}
      items.push({type:'unclip'});
      items.push({type:'text',x:-425,y:-285,text:'L I M F J O R D',size:10,color:'#769694'});
      items.push({type:'text',x:300,y:242,text:'N ↑',size:11,color:'#728270'});
      return items;
    }
    draw(c,bounds=this.bounds){
      c.save();c.fillStyle=colors.water;c.fillRect(bounds.minX,bounds.minY,bounds.width,bounds.height);
      const trace=rings=>{c.beginPath();for(const ring of rings){c.moveTo(...ring[0]);for(const p of ring.slice(1))c.lineTo(...p);c.closePath();}};
      for(const item of this.scene()){
        if(item.type==='clip'){c.save();trace(this.coast.flat());c.clip('evenodd');}
        else if(item.type==='unclip')c.restore();
        else if(item.type==='path'){trace(item.rings);if(item.fill){c.fillStyle=item.fill;c.fill('evenodd');}if(item.stroke){c.strokeStyle=item.stroke;c.lineWidth=item.width;c.stroke();}}
        else if(item.type==='line'){c.beginPath();c.moveTo(...item.points[0]);for(const p of item.points.slice(1))c.lineTo(...p);c.strokeStyle=item.stroke;c.lineWidth=item.width;c.lineJoin='round';c.stroke();}
        else if(item.type==='circle'){c.beginPath();c.arc(item.x,item.y,item.r,0,Math.PI*2);c.fillStyle=item.fill;c.fill();}
        else if(item.type==='text'){c.font=item.size+'px sans-serif';c.fillStyle=item.color;c.fillText(item.text,item.x,item.y);}
      }c.restore();
    }
    svg(bounds=this.bounds){let out=`<g id="landscape"><desc>Shoreline and vegetation: © OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright. Wet patches, ground colours, clearings and dykes are illustrative scenarios.</desc><rect x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" fill="${colors.water}"/><defs><clipPath id="island-clip"><path d="${this.coast.map(p=>pathD(p)).join('')}" clip-rule="evenodd"/></clipPath></defs>`;
      for(const i of this.scene()){
        if(i.type==='clip')out+='<g clip-path="url(#island-clip)">';
        else if(i.type==='unclip')out+='</g>';
        else if(i.type==='path')out+=`<path d="${pathD(i.rings)}" fill="${i.fill||'none'}" fill-rule="evenodd" stroke="${i.stroke||'none'}" stroke-width="${i.width}"/>`;
        else if(i.type==='line')out+=`<path d="${lineD(i.points)}" fill="none" stroke="${i.stroke}" stroke-width="${i.width}" stroke-linejoin="round"/>`;
        else if(i.type==='circle')out+=`<circle cx="${i.x}" cy="${i.y}" r="${i.r}" fill="${i.fill}"/>`;
        else if(i.type==='text')out+=`<text x="${i.x}" y="${i.y}" font-size="${i.size}" font-family="sans-serif" fill="${i.color}">${i.text}</text>`;
      }return out+'</g>';
    }
  }
  const api={Landscape,defaults,colors,inside,inPolygon,nearest};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HighwayLandscape=api;
})(typeof globalThis!=='undefined'?globalThis:this);
