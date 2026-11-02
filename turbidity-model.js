(function(root){
'use strict';
function sample(data,record,lon,lat,minimum=1){
 if(record?.u){
  const a=sample(data,{...record,u:undefined,values:record.u},lon,lat,minimum),b=sample(data,{...record,u:undefined,values:record.v},lon,lat,minimum);
  const value=a.value===null||b.value===null?null:Math.hypot(a.value,b.value);
  return {...a,value,original:a.original===null||b.original===null?null:Math.hypot(a.original,b.original),u:a.value,v:b.value,direction:value===null||value<(data.directionThreshold??.01)?null:(Math.atan2(a.value,b.value)*180/Math.PI+360)%360,originalDirection:a.original===null||b.original===null||Math.hypot(a.original,b.original)<(data.directionThreshold??.01)?null:(Math.atan2(a.original,b.original)*180/Math.PI+360)%360};
 }
 const empty={value:null,original:null,support:0,minCount:null};if(!record||record.status)return empty;
 const g=record.grid||data,dx=g.longitude[1]-g.longitude[0],dy=g.latitude[1]-g.latitude[0],x=(lon-g.longitude[0])/dx,y=(lat-g.latitude[0])/dy;
 const get=(i,j)=>{if(i<0||j<0||i>=g.width||j>=g.height)return null;const k=j*g.width+i,v=record.values[k],n=record.counts[k];return v!==null&&Number.isFinite(v)&&n>=minimum?{v,n}:null};
 const original=get(Math.round(x),Math.round(y));
 if(!original){
  if(!['temperature_monthly','currents_monthly'].includes(data.variable)||!data.coastalGapFillEnabled)return empty;
  // Regional monthly fields only: bounded spatial extrapolation, never an observation.
  const radius=2500,metresX=111320*Math.cos(lat*Math.PI/180),metresY=111320,candidates=[];
  for(let j=Math.max(0,Math.floor(y)-2);j<=Math.min(g.height-1,Math.ceil(y)+2);j++)for(let i=Math.max(0,Math.floor(x)-2);i<=Math.min(g.width-1,Math.ceil(x)+2);i++){
   const z=get(i,j);if(!z)continue;const distance=Math.hypot((g.longitude[i]-lon)*metresX,(g.latitude[j]-lat)*metresY);if(distance<=radius)candidates.push({...z,distance});
  }
  candidates.sort((a,b)=>a.distance-b.distance);const neighbours=candidates.slice(0,4);if(!neighbours.length)return empty;
  let sum=0,total=0;for(const z of neighbours){const w=1/Math.max(z.distance,1)**2;sum+=w*z.v;total+=w}
  return {value:sum/total,original:null,support:neighbours.length,minCount:null,coastalEstimate:true,nearestSourceMetres:neighbours[0].distance};
 }
 const a=Math.floor(x),b=Math.floor(y),u=x-a,v=y-b;let total=0,sum=0,support=0,minCount=Infinity;
 for(const [i,j,w] of [[a,b,(1-u)*(1-v)],[a+1,b,u*(1-v)],[a,b+1,(1-u)*v],[a+1,b+1,u*v]]){if(w<1e-12)continue;const z=get(i,j);if(z){sum+=z.v*w;total+=w;support++;minCount=Math.min(minCount,z.n)}}
 return {value:total?sum/total:null,original:original.v,support,minCount:total?minCount:null};
}
root.Turbidity={sample};if(typeof module!=='undefined')module.exports=root.Turbidity;
})(typeof globalThis!=='undefined'?globalThis:this);
