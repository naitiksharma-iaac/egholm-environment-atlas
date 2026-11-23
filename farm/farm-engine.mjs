/**
 * Egholm computational farm hypotheses, version 1.
 * Pure ES module: metres, kilograms, seconds and kN; local z is up.
 * Equations reproduce the earlier fixed-cylinder study, not a survival model.
 * No measured data or statutory thresholds are embedded in the defaults.
 */
const common = { mooringEnd:20, mooringSide:10, clearance:1, motionAllowance:0.5,
  loopWidth:0.5, airCd:1.2, supportCd:1.2 };
const rawPresets = [
  ['A','Long collector reference',40,24,4,36,1,2,1,'loop',300,5,5,4],
  ['B','Short-loop module',24,16,3,20,.5,1,1.5,'loop',150,2.4,3,2],
  ['C','Very short-loop module',24,16,3,20,.5,.5,1.5,'loop',150,2.4,3,2],
  ['D','Shallow net curtains',24,16,3,20,.5,1,.5,'net',220,3.6,4,3],
  ['E','Rigid service raft',24,16,3,20,.5,1,1.5,'raft',1800,10,20,8],
  ['F','Deeper suspended module',24,16,3,20,1.5,1,1.5,'loop',200,2.4,1,2],
  ['G','Single-line pilot',16,6,1,12,.5,.5,2,'loop',80,1.2,1,.8]
];
export const PRESETS = Object.freeze(Object.fromEntries(rawPresets.map(
  ([id,name,length,width,rows,lineLength,head,span,interval,kind,gearMass,floatVolume,airArea,waterArea]) =>
  [id,Object.freeze({...common,id,name,length,width,rows,lineLength,head,span,interval,kind,gearMass,floatVolume,airArea,waterArea})]
)));
export const PRESET_LIST = Object.freeze(Object.values(PRESETS));
export const DEFAULT_SCENARIO = Object.freeze({depth:4.5,current:.3,waveHeight:.5,wavePeriod:3,wind:12,
  diameter:.12,wetKgPerM:16,apparentFraction:.2,Cd:1.6,Cm:1.7,lineCapacity:10,
  waterDensity:1020,airDensity:1.225,usableFloatFraction:.65,pretensionKN:1,
  activeMoorings:2,demandMultiplier:1.5,depthDeficit:0});
export const SCENARIOS=Object.freeze({
  S1:Object.freeze({name:'Low forcing hypothesis',current:.1,waveHeight:.2,wavePeriod:2,wind:5}),
  S2:Object.freeze({name:'Elevated forcing hypothesis',current:.3,waveHeight:.5,wavePeriod:3,wind:12}),
  S3:Object.freeze({name:'High forcing hypothesis',current:.6,waveHeight:1,wavePeriod:4,wind:20})
});
export const MODEL_LIMITATIONS=Object.freeze([
  'Forcing and crop inputs are assumptions unless the user supplies matched local measurements.',
  'Fixed-cylinder, coherent load calculation; no shielding or coupled farm motion.',
  'Curtain and raft hydrodynamics are approximated as equivalent collectors plus support drag.',
  'No anchor holding, fatigue, snap loads, ice, collision, slamming or float stability verification.',
  'Biological survival, food supply, oxygen, settlement and seabed impacts remain unknown.',
  'Conditional model checks do not establish permission, suitability or certified survival.'
]);

const finite = x => typeof x === 'number' && Number.isFinite(x);
export function normaliseConfig(input={}) { return {...(PRESETS[input?.id]||PRESETS.G),...input}; }
export function normaliseScenario(input={}) { return {...DEFAULT_SCENARIO,...input}; }
export function validateConfig(input={}) {
  const c=normaliseConfig(input), errors=[];
  for(const key of ['length','width','lineLength','span','interval','floatVolume','mooringEnd','loopWidth'])
    if(!finite(c[key]) || c[key]<=0) errors.push(`${key} must be a finite positive number.`);
  for(const key of ['head','mooringSide','clearance','motionAllowance','gearMass','airArea','waterArea','airCd','supportCd'])
    if(!finite(c[key]) || c[key]<0) errors.push(`${key} must be a finite nonnegative number.`);
  if(!Number.isInteger(c.rows)||c.rows<1||c.rows>100) errors.push('rows must be an integer from 1 to 100.');
  if(!['loop','net','raft'].includes(c.kind)) errors.push('kind must be loop, net or raft.');
  if(c.lineLength>c.length) errors.push('lineLength must fit inside length.');
  if(c.interval>c.lineLength) errors.push('interval must allow at least one collector per row.');
  if(c.kind!=='net' && c.interval<c.loopWidth) errors.push('Loop interval must be at least the loop width.');
  if(c.length>2000||c.width>2000||c.span>100||c.head>100) errors.push('Geometry exceeds this local study tool range.');
  if(c.rows*Math.ceil(c.lineLength/c.interval)>20000) errors.push('Collector count exceeds the interactive geometry limit.');
  return {valid:errors.length===0,errors,config:c};
}
export function validateScenario(input={}) {
  const s=normaliseScenario(input),errors=[];
  for(const key of ['depth','wavePeriod','diameter','lineCapacity','waterDensity','airDensity','activeMoorings','demandMultiplier'])
    if(!finite(s[key])||s[key]<=0) errors.push(`${key} must be a finite positive number.`);
  for(const key of ['current','waveHeight','wind','wetKgPerM','Cd','Cm','pretensionKN','depthDeficit'])
    if(!finite(s[key])||s[key]<0) errors.push(`${key} must be a finite nonnegative number.`);
  for(const key of ['apparentFraction','usableFloatFraction'])
    if(!finite(s[key])||s[key]<=0||s[key]>1) errors.push(`${key} must be greater than 0 and no more than 1.`);
  if(s.wavePeriod<.25||s.wavePeriod>120||s.depth>10000||s.current>20||s.wind>200||
    s.waveHeight>100||s.diameter>5||s.Cd>20||s.Cm>20||s.wetKgPerM>10000)
    errors.push('Scenario exceeds the numerical range of this local farm screening tool.');
  return {valid:errors.length===0,errors,scenario:s};
}
export function requiredDepth(input={}) {
  const v=validateConfig(input);
  return v.valid ? v.config.head+v.config.span+v.config.clearance+v.config.motionAllowance : null;
}
export function substrateLength(input={}) {
  const v=validateConfig(input); if(!v.valid) return null;
  const c=v.config;
  return c.kind==='net' ? c.rows*c.lineLength*c.span*2/c.interval :
    c.rows*Math.floor(c.lineLength/c.interval)*(2*c.span+c.loopWidth);
}
function rectangle(length,width,z=0) {return [[-length/2,-width/2,z],[length/2,-width/2,z],
  [length/2,width/2,z],[-length/2,width/2,z],[-length/2,-width/2,z]];}

/** farmGeometry(config, {depth}) returns local geometry; rotation/placement belongs to caller. */
export function farmGeometry(input={}, options={}) {
  const v=validateConfig(input),empty={backbones:[],collectors:[],floats:[],anchors:[],moorings:[]};
  if(!v.valid) return {valid:false,errors:v.errors,...empty};
  const c=v.config, depth=finite(options.depth)&&options.depth>0?options.depth:requiredDepth(c);
  const backbones=[],collectors=[],floats=[],anchors=[],moorings=[];
  const rowWidth=c.rows===1?0:c.width*.7;
  const rowYs=Array.from({length:c.rows},(_,i)=>c.rows===1?0:-rowWidth/2+i*rowWidth/(c.rows-1));
  for(const y of rowYs) {
    backbones.push([[-c.lineLength/2,y,-c.head],[c.lineLength/2,y,-c.head]]);
    if(c.kind==='net') {
      // Edge-inclusive display grid; analytical substrate uses continuous mesh density.
      const nx=Math.ceil(c.lineLength/c.interval),nz=Math.ceil(c.span/c.interval);
      for(let i=0;i<=nx;i++) {
        const x=-c.lineLength/2+c.lineLength*i/nx;
        collectors.push({type:'net-vertical',points:[[x,y,-c.head],[x,y,-c.head-c.span]]});
      }
      for(let i=0;i<=nz;i++) {
        const z=-c.head-c.span*i/nz;
        collectors.push({type:'net-horizontal',points:[[-c.lineLength/2,y,z],[c.lineLength/2,y,z]]});
      }
    } else {
      const n=Math.floor(c.lineLength/c.interval),occupied=(n-1)*c.interval+c.loopWidth,start=-occupied/2;
      for(let i=0;i<n;i++) {
        const x=start+i*c.interval;
        collectors.push({type:'loop',points:[[x,y,-c.head],[x,y,-c.head-c.span],
          [x+c.loopWidth,y,-c.head-c.span],[x+c.loopWidth,y,-c.head]]});
      }
    }
    for(let i=0;i<4;i++) floats.push({position:[-c.lineLength/2+c.lineLength*i/3,y,0],volumeM3:c.floatVolume/(c.rows*4)});
  }
  for(const sx of [-1,1]) for(const sy of [-1,1]) {
    const anchor=[sx*(c.length/2+c.mooringEnd),sy*(c.width/2+c.mooringSide),-depth];
    anchors.push(anchor);moorings.push([[sx*c.length/2,sy*c.width/2,-c.head],anchor]);
  }
  return {valid:true,errors:[],config:c,body:rectangle(c.length,c.width),
    mooringEnvelope:rectangle(c.length+2*c.mooringEnd,c.width+2*c.mooringSide),
    bodyArea:c.length*c.width,mooringArea:(c.length+2*c.mooringEnd)*(c.width+2*c.mooringSide),
    requiredDepth:requiredDepth(c),substrateLength:substrateLength(c),
    backbones,collectors,floats,anchors,moorings,raft:c.kind==='raft'?rectangle(c.length,c.width,.15):null,
    note:'Local x/y metres; z up. Net drawing is illustrative; footprint is an assumed occupation, not an engineered anchor sweep.'};
}

/** Linear-wave dispersion, solved by bisection; k is radians per metre. */
export function waveNumber(depth,period) {
  if(!finite(depth)||depth<=0||!finite(period)||period<=0) return null;
  const omega=2*Math.PI/period, target=omega**2;
  let lo=0,hi=Math.max(target/9.81,omega/Math.sqrt(9.81*depth))*2;
  while(9.81*hi*Math.tanh(hi*depth)<target) hi*=2;
  for(let i=0;i<80;i++) {const mid=(lo+hi)/2;if(9.81*mid*Math.tanh(mid*depth)<target)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
function coshOverSinh(a,b) {
  // Stable at deep-water/high-frequency inputs; here 0 <= a <= b.
  if(b<300) return Math.cosh(a)/Math.sinh(b);
  return (Math.exp(a-b)+Math.exp(-a-b))/(1-Math.exp(-2*b));
}
export function evaluateLoads(input={}, scenario={}) {
  const cv=validateConfig(input),sv=validateScenario(scenario),errors=[...cv.errors,...sv.errors];
  const base={valid:errors.length===0,errors,biologicalStatus:'unknown',certifiedSurvival:false,
    limitations:[...MODEL_LIMITATIONS]};
  if(errors.length) return {...base,conditionalPass:false,status:'invalid-input',warnings:errors,
    requiredDepth:cv.valid?requiredDepth(cv.config):null,substrateLength:cv.valid?substrateLength(cv.config):null};
  const c=cv.config,s=sv.scenario,l=substrateLength(c),need=requiredDepth(c),effectiveDepth=s.depth-s.depthDeficit;
  const depthPass=effectiveDepth>=need, warnings=[];
  if(!depthPass) warnings.push('The depth/clearance envelope does not fit this water-depth scenario.');
  // No physically meaningful submerged collector calculation if it extends below the bed.
  if(effectiveDepth<=0 || c.head+c.span>effectiveDepth) return {...base,config:c,scenario:s,
    status:'depth-conflict',requiredDepth:need,substrateLength:l,effectiveDepth,depthPass:false,
    conditionalPass:false,warnings,mechanicalStatus:'not-evaluated',lineDemandKN:null,floatRequiredM3:null,
    horizontalForceKN:null,lineUtilisation:null,floatUtilisation:null,KC:null};
  const omega=2*Math.PI/s.wavePeriod,k=waveNumber(effectiveDepth,s.wavePeriod);
  const z=-(c.head+c.span/2),uw=s.waveHeight/2*omega*coshOverSinh(k*(z+effectiveDepth),k*effectiveDepth);
  let cropPeak=0;
  for(let phaseIndex=0;phaseIndex<=720;phaseIndex++) {
    const phase=phaseIndex*2*Math.PI/720,u=s.current+uw*Math.cos(phase),accel=-omega*uw*Math.sin(phase);
    const force=.5*s.waterDensity*s.Cd*s.diameter*l*u*Math.abs(u)+
      s.waterDensity*s.Cm*Math.PI*s.diameter**2/4*l*accel;
    cropPeak=Math.max(cropPeak,Math.abs(force));
  }
  const support=.5*s.waterDensity*c.supportCd*c.waterArea*(s.current+uw)**2;
  const wind=.5*s.airDensity*c.airCd*c.airArea*s.wind**2, peak=cropPeak+support+wind;
  const angle=Math.atan(effectiveDepth/c.mooringEnd);
  const lineDemandKN=s.pretensionKN+s.demandMultiplier*peak/1000/(s.activeMoorings*Math.cos(angle));
  const cropApparentKg=l*s.wetKgPerM*s.apparentFraction;
  const mooringDownKg=s.activeMoorings*lineDemandKN*1000*Math.sin(angle)/9.81;
  const supportMassKg=c.gearMass+cropApparentKg+mooringDownKg;
  const floatRequiredM3=supportMassKg/(s.usableFloatFraction*s.waterDensity);
  const lineUtilisation=lineDemandKN/s.lineCapacity,floatUtilisation=floatRequiredM3/c.floatVolume;
  const linePass=lineUtilisation<=1,floatPass=floatUtilisation<=1,KC=uw*s.wavePeriod/s.diameter;
  if(!linePass) warnings.push('Line demand exceeds the user-defined reference capacity.');
  if(!floatPass) warnings.push('Flotation demand exceeds the proposed volume at the assumed reserve.');
  if(s.waveHeight/effectiveDepth>.3) warnings.push('Wave-height/depth ratio exceeds 0.3; linear-wave approximation is especially uncertain.');
  if(KC<40||KC>90) warnings.push('KC lies outside the 40–90 range of the cited oscillatory-flow coefficient study.');
  if(c.kind==='net'||c.kind==='raft') warnings.push('Net/raft geometry uses an unvalidated equivalent-collector approximation.');
  const conditionalPass=depthPass&&linePass&&floatPass;
  return {...base,config:c,scenario:s,status:conditionalPass?'within-assumed-envelope':'assumed-envelope-exceeded',
    mechanicalStatus:'idealised-scenario-only',requiredDepth:need,substrateLength:l,effectiveDepth,
    depthMargin:effectiveDepth-need,depthPass,linePass,floatPass,conditionalPass,
    horizontalForceKN:peak/1000,cropForceKN:cropPeak/1000,supportForceKN:support/1000,windForceKN:wind/1000,
    lineDemandKN,floatRequiredM3,lineUtilisation,floatUtilisation,
    cropWetMassKg:l*s.wetKgPerM,cropApparentMassKg:cropApparentKg,mooringDownMassKg:mooringDownKg,
    waveVelocity:uw,waveNumber:k,KC,warnings,
    gates:{depth:depthPass?'conditional-pass':'conflict',line:linePass?'conditional-pass':'exceeds-reference',
      flotation:floatPass?'conditional-pass':'exceeds-reference',biology:'unknown',anchors:'unknown',
      habitat:'unknown',navigation:'unknown',fatigue:'unknown'}};
}

export const SOURCES=Object.freeze([
  {title:'Holbach et al. (2020): spatial mussel mitigation model',url:'https://doi.org/10.1016/j.scitotenv.2020.139624'},
  {title:'Landmann et al. (2024): oscillatory-flow dropper coefficients',url:'https://doi.org/10.1007/s40722-023-00306-w'},
  {title:'Landmann et al. (2021): drag and inertia of live/surrogate dropper lines',url:'https://www.sciencedirect.com/science/article/pii/S0029801821007915'}
]);
