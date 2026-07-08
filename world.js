import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ============================================================
   ÆTHER — a scroll-driven WebGL world
   ============================================================ */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 4000);
camera.position.set(0, 28, 60);

/* ---------- palette: shifts as you descend through the world ---------- */
// Five "moods" keyed to the five station zones. Camera lerps between them.
const MOODS = [
  { sky:[0x12102a, 0x533a6b, 0xe7a78c], fog:0x3a2e57, sun:0xffd9a0, key:0xffcaa0 }, // dawn ridge
  { sky:[0x0f2233, 0x1f6f8b, 0x8fd6c9], fog:0x255064, sun:0xa9f0e6, key:0x9fe9da }, // teal liquidity valley
  { sky:[0x1a1340, 0x6a4aa0, 0xd9a6e0], fog:0x402a66, sun:0xe9bfff, key:0xc9a3ff }, // violet floating vaults
  { sky:[0x081a2e, 0x2a5a86, 0xf0c27a], fog:0x1d3a55, sun:0xffd98a, key:0xffd28a }, // gold sky bridges
  { sky:[0x0a0a1c, 0x3a2a55, 0xc46b6b], fog:0x241836, sun:0xff9d7a, key:0xff9d8a }, // dusk living ledger
  { sky:[0x05060f, 0x241a3a, 0xe8b07a], fog:0x140f24, sun:0xffd9a0, key:0xffc89a }, // final doorway
];

// Daylight twin of each mood — used when the site is in light theme.
const MOODS_DAY = [
  { sky:[0x8fbfe6, 0xcfe2ef, 0xfdeed3], fog:0xe8e2d2, sun:0xfff4d6, key:0xfff0cf }, // soft morning
  { sky:[0x9ed2d8, 0xd6ecea, 0xf6f0da], fog:0xdcebe4, sun:0xf2fff4, key:0xe8f7ea }, // sea-glass noon
  { sky:[0xb9b3e4, 0xe0d9f0, 0xf9e9dc], fog:0xe6dfec, sun:0xfdf1ff, key:0xf3e6f8 }, // lavender haze
  { sky:[0xa7c4e2, 0xe3e5e0, 0xfae3b8], fog:0xe9e3cf, sun:0xffefc2, key:0xffe9b8 }, // golden afternoon
  { sky:[0xc4b4d8, 0xecd9d4, 0xf7d9b8], fog:0xeadfd4, sun:0xffe0c0, key:0xffdcc0 }, // rose evening light
  { sky:[0xa9c0dd, 0xdfd8e6, 0xfbe6c4], fog:0xe7e0d0, sun:0xfff0cc, key:0xffe9c4 }, // bright doorway
];

// 0 = night (dark theme) → 1 = day (light theme); eased every frame.
let themeTarget = (document.documentElement.dataset.theme === 'light') ? 1 : 0;
let themeMix = themeTarget;
addEventListener('themechange', (e) => {
  themeTarget = (e.detail && e.detail.theme === 'light') ? 1 : 0;
});

const c = (hex) => new THREE.Color(hex);
const skyTop = c(MOODS[0].sky[0]), skyMid = c(MOODS[0].sky[1]), skyBot = c(MOODS[0].sky[2]);
const fogCol = c(MOODS[0].fog), sunCol = c(MOODS[0].sun), keyCol = c(MOODS[0].key);

scene.fog = new THREE.FogExp2(fogCol.clone(), 0.0019);

/* ---------- lights ---------- */
const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x20122e, 0.55);
scene.add(hemi);
const key = new THREE.DirectionalLight(keyCol.clone(), 2.1);
key.position.set(-120, 90, -160);
scene.add(key);
const rim = new THREE.DirectionalLight(0x88aaff, 0.5);
rim.position.set(140, 40, 120);
scene.add(rim);

/* ============================================================
   SKY DOME — vertical gradient shader
   ============================================================ */
const skyUniforms = {
  uTop:{ value: skyTop }, uMid:{ value: skyMid }, uBot:{ value: skyBot },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(2200, 32, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: skyUniforms,
    vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`
      varying vec3 vP; uniform vec3 uTop,uMid,uBot;
      void main(){
        float h = normalize(vP).y*0.5+0.5;          // 0 bottom -> 1 top
        vec3 col = mix(uBot, uMid, smoothstep(0.0,0.5,h));
        col = mix(col, uTop, smoothstep(0.45,1.0,h));
        // soft band of light near horizon
        col += vec3(0.9,0.6,0.4)*0.12*exp(-pow((h-0.46)*7.0,2.0));
        gl_FragColor = vec4(col,1.0);
      }`
  })
);
scene.add(sky);

/* ---------- the sun/moon orb (additive glow) ---------- */
const sunTex = (() => {
  const c2 = document.createElement('canvas'); c2.width = c2.height = 256;
  const g = c2.getContext('2d');
  const grd = g.createRadialGradient(128,128,0,128,128,128);
  grd.addColorStop(0,'rgba(255,255,255,1)');
  grd.addColorStop(0.18,'rgba(255,240,210,0.95)');
  grd.addColorStop(0.5,'rgba(255,200,150,0.35)');
  grd.addColorStop(1,'rgba(255,180,140,0)');
  g.fillStyle = grd; g.fillRect(0,0,256,256);
  return new THREE.CanvasTexture(c2);
})();
const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: sunCol.clone(), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
sun.scale.set(620,620,1);
sun.position.set(-360, 150, -900);
scene.add(sun);

/* ============================================================
   PAINTERLY MOUNTAINS — layered ridges (aerial perspective)
   ============================================================ */
// lightweight value-noise fbm
function hash(x,y){ const s=Math.sin(x*127.1+y*311.7)*43758.5453; return s-Math.floor(s); }
function vnoise(x,y){
  const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
  const a=hash(xi,yi), b=hash(xi+1,yi), cc=hash(xi,yi+1), d=hash(xi+1,yi+1);
  return a*(1-u)*(1-v)+b*u*(1-v)+cc*(1-u)*v+d*u*v;
}
function fbm(x,y){ let t=0,amp=0.5,f=1; for(let i=0;i<5;i++){ t+=amp*vnoise(x*f,y*f); f*=2; amp*=0.5; } return t; }

const terrainGroup = new THREE.Group();
scene.add(terrainGroup);

// Several wide terrain "ranges" placed deeper into -z, each tinted lighter (aerial perspective)
const ridges = [];
function makeRange(z, width, depth, height, segX, segZ, color, rough, yBase){
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI/2);
  const pos = geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), zz=pos.getZ(i);
    let h = fbm((x+z*0.3)*rough*0.01+50, (zz+z)*rough*0.01+50);
    h = Math.pow(h, 1.6);
    // ridge sharpening
    const ridge = 1.0 - Math.abs(fbm(x*0.004+10, (zz+z)*0.004+10)-0.5)*2.0;
    h = h*0.7 + Math.pow(Math.max(ridge,0),2.0)*0.5;
    pos.setY(i, h*height + (Math.sin(x*0.01)*0.0));
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color, roughness:0.95, metalness:0.0, flatShading:true,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, yBase, z);
  m.userData.baseCol = color.clone();  // preserved for theme blending
  terrainGroup.add(m);
  ridges.push(m);
  return m;
}
const dayHaze = new THREE.Color(0xbcb4c8); // light-mode silhouette tint

// foreground travel terrain (camera flies low over this)
makeRange(  -120, 900, 1400, 70,  220, 320, c(0x241a33), 1.6, -20);
// mid ranges
makeRange(  -700, 1500, 700, 150, 120, 80,  c(0x33264a), 1.0, -10);
makeRange( -1300, 2200, 700, 260, 100, 60,  c(0x4a3a63), 0.7,  10);
// distant silhouette ranges (painterly cutouts, lighter = further)
makeRange( -1950, 3000, 600, 360, 70,  40,  c(0x6b5683), 0.55, 30);
makeRange( -2550, 3800, 600, 480, 50,  30,  c(0x8c789f), 0.42, 60);

/* ============================================================
   WATER — the Valley of Liquidity (animated wave plane)
   ============================================================ */
const waterUniforms = {
  uTime:{ value:0 }, uColA:{ value:c(0x18516b) }, uColB:{ value:c(0x6fd6c9) },
  uFog:{ value: fogCol.clone() }, uFogDensity:{ value: 0.0019 },
};
const water = new THREE.Mesh(
  new THREE.PlaneGeometry(7000, 7000, 240, 240),
  new THREE.ShaderMaterial({
    transparent:true,
    uniforms: waterUniforms,
    vertexShader:`
      uniform float uTime; varying float vH; varying vec3 vW; varying vec2 vUv;
      void main(){
        vec3 p=position;
        float w = sin(p.x*0.018+uTime*0.5)*0.7 + sin(p.y*0.026-uTime*0.4)*0.55 + sin((p.x+p.y)*0.012+uTime*0.6)*0.4;
        p.z += w; vH=w; vUv=uv;
        vec4 wp = modelMatrix*vec4(p,1.0); vW=wp.xyz;
        gl_Position = projectionMatrix*viewMatrix*wp;
      }`,
    fragmentShader:`
      uniform vec3 uColA,uColB,uFog; uniform float uFogDensity,uTime;
      varying float vH; varying vec3 vW; varying vec2 vUv;
      void main(){
        float t = clamp(vH*0.35+0.5,0.0,1.0);
        vec3 col = mix(uColA,uColB,t);
        // glints
        float gl = pow(max(t-0.62,0.0)*3.0,3.0);
        col += vec3(0.9,1.0,0.95)*gl*0.6;
        col += uColB*0.15;
        // exp2 fog to blend with scene
        float d = length(vW - cameraPosition);
        float f = 1.0 - exp(-uFogDensity*uFogDensity*d*d);
        col = mix(col, uFog, clamp(f,0.0,1.0));
        gl_FragColor = vec4(col, 0.82);
      }`
  })
);
water.rotation.x = -Math.PI/2;
water.position.set(0, -22, -1200);
scene.add(water);

/* ---------- soft radial glow sprite (reused by the creatures) ---------- */
const crystalGlow = (() => {
  const c3 = document.createElement('canvas'); c3.width=c3.height=128;
  const g=c3.getContext('2d'); const grd=g.createRadialGradient(64,64,0,64,64,64);
  grd.addColorStop(0,'rgba(220,180,255,0.9)'); grd.addColorStop(0.4,'rgba(180,140,255,0.35)'); grd.addColorStop(1,'rgba(160,120,255,0)');
  g.fillStyle=grd; g.fillRect(0,0,128,128); return new THREE.CanvasTexture(c3);
})();

/* ============================================================
   A DISTANT FLOCK — a faint sense of life on the horizon
   ============================================================ */
const FLOCK = 90;
const birdGeo = new THREE.ConeGeometry(2.2, 7, 4);
birdGeo.rotateX(Math.PI/2);
const birds = new THREE.InstancedMesh(
  birdGeo,
  new THREE.MeshStandardMaterial({ color:0x12101c, emissive:0xff8a6a, emissiveIntensity:0.5, roughness:0.6, flatShading:true }),
  FLOCK
);
const bird = [];
for(let i=0;i<FLOCK;i++){
  bird.push({
    a: Math.random()*Math.PI*2,
    r: 60 + Math.random()*140,
    y: Math.random()*Math.PI*2,
    sp: 0.15 + Math.random()*0.25,
    yr: 30 + Math.random()*60,
    ph: Math.random()*Math.PI*2,
  });
}
birds.position.set(120, 130, -2300);
scene.add(birds);
const dummy = new THREE.Object3D();

/* ============================================================
   JELLYFISH DRIFTERS — gentle glowing creatures everywhere
   ============================================================ */
const jellies = [];
function makeJelly(x,y,z,tint,scl){
  const grp = new THREE.Group();
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(6, 18, 14, 0, Math.PI*2, 0, Math.PI*0.62),
    new THREE.MeshStandardMaterial({ color:tint, emissive:tint, emissiveIntensity:0.9, roughness:0.3, transparent:true, opacity:0.7, side:THREE.DoubleSide })
  );
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map:crystalGlow, color:tint, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }));
  halo.scale.setScalar(34);
  grp.add(bell, halo);
  // tentacles
  const tcol = new THREE.Color(tint);
  for(let t=0;t<7;t++){
    const pts=[]; const ox=(Math.random()-0.5)*5, oz=(Math.random()-0.5)*5;
    for(let s=0;s<6;s++) pts.push(new THREE.Vector3(ox, -s*3.2, oz));
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color:tcol, transparent:true, opacity:0.45 })
    );
    line.userData.base = pts.map(p=>p.clone());
    grp.add(line);
  }
  grp.position.set(x,y,z);
  grp.scale.setScalar(scl);
  grp.userData = { ph:Math.random()*Math.PI*2, drift:Math.random()*Math.PI*2, sp:0.4+Math.random()*0.5 };
  scene.add(grp);
  jellies.push(grp);
}
const jTints=[0x9fe9da,0xc9a3ff,0xffc89a,0x8fd6c9,0xe89b8c];
for(let i=0;i<16;i++){
  makeJelly((Math.random()-0.5)*500, 20+Math.random()*160, -200 - Math.random()*2200,
            jTints[i%jTints.length], 0.8+Math.random()*1.6);
}

/* ============================================================
   ATMOSPHERIC PARTICLES — drifting motes / fireflies
   ============================================================ */
const PCOUNT = 1400;
const pPos = new Float32Array(PCOUNT*3);
const pSeed = new Float32Array(PCOUNT);
for(let i=0;i<PCOUNT;i++){
  pPos[i*3]   = (Math.random()-0.5)*900;
  pPos[i*3+1] = Math.random()*260 - 20;
  pPos[i*3+2] = -Math.random()*2600 + 100;
  pSeed[i] = Math.random()*Math.PI*2;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,3));
pGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed,1));
const dust = new THREE.Points(pGeo, new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
  uniforms:{ uTime:{value:0}, uColor:{value:c(0xffe6c2)} },
  vertexShader:`
    attribute float aSeed; uniform float uTime; varying float vA;
    void main(){
      vec3 p=position;
      p.y += sin(uTime*0.5+aSeed)*4.0;
      p.x += cos(uTime*0.3+aSeed)*3.0;
      vec4 mv = modelViewMatrix*vec4(p,1.0);
      gl_PointSize = (40.0/-mv.z)*(0.6+0.4*sin(uTime+aSeed));
      gl_Position = projectionMatrix*mv;
      vA = 0.4+0.6*sin(uTime*1.4+aSeed);
    }`,
  fragmentShader:`
    uniform vec3 uColor; varying float vA;
    void main(){
      float d=length(gl_PointCoord-0.5);
      if(d>0.5) discard;
      float a=smoothstep(0.5,0.0,d)*vA;
      gl_FragColor=vec4(uColor,a*0.6);
    }`
}));
scene.add(dust);

/* ============================================================
   CAMERA PATH — a CatmullRom journey through the world
   ============================================================ */
const path = new THREE.CatmullRomCurve3([
  new THREE.Vector3(   0,  34,   80),  // 0 hero — high, looking out over ridge
  new THREE.Vector3( -36,  18,  -260), // 1 descend toward the liquidity valley
  new THREE.Vector3(  44,  26,  -640), // 2 skim over the water
  new THREE.Vector3( -30,  72, -1080), // 3 rise into the floating vaults
  new THREE.Vector3(  60, 110, -1620), // 4 the sky bridges
  new THREE.Vector3( -40, 150, -2200), // 5 up among the flock
  new THREE.Vector3(   0, 110, -2560), // 6 the doorway, facing the dawn
]);
path.curveType = 'catmullrom'; path.tension = 0.5;

// look-at targets offset ahead of each camera node (keeps gaze cinematic)
const lookPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(   0,  10, -200),
  new THREE.Vector3(  10, -10, -560),
  new THREE.Vector3( -20,  10, -900),
  new THREE.Vector3(  30,  60, -1350),
  new THREE.Vector3( -10,  90, -1900),
  new THREE.Vector3(  20, 120, -2400),
  new THREE.Vector3(   0, 130, -3000),
]);

/* ============================================================
   POST-PROCESSING — cinematic bloom + soft vignette/grade
   ============================================================ */
let composer = null, bloom = null;
try{
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.65, 0.18);
  composer.addPass(bloom);
  // gentle color grade + vignette
  const grade = new ShaderPass({
    uniforms:{ tDiffuse:{value:null}, uVig:{value:0.0} },
    vertexShader:`varying vec2 v; void main(){ v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`
      uniform sampler2D tDiffuse; uniform float uVig; varying vec2 v;
      void main(){
        vec3 col = texture2D(tDiffuse,v).rgb;
        col = pow(col, vec3(0.94));            // lift
        col *= vec3(1.03,1.0,0.98);            // warm grade
        float d = distance(v, vec2(0.5));
        col *= smoothstep(0.85,0.35,d)*0.4+0.6;// vignette
        gl_FragColor = vec4(col,1.0);
      }`
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
}catch(e){ console.warn('Postprocessing unavailable, falling back to plain render', e); composer=null; }

/* ============================================================
   SCROLL  ->  PROGRESS  (smoothed)
   ============================================================ */
let targetP = 0, smoothP = 0;
// The camera journey is bound to the immersive stations only — once the
// portfolio (the designer's content) begins, the camera holds at the doorway.
const portfolioEl = document.querySelector('.portfolio');
function computeScroll(){
  const journeyMax = portfolioEl
    ? Math.max(1, portfolioEl.offsetTop - innerHeight)
    : (document.documentElement.scrollHeight - innerHeight);
  targetP = Math.min(1, Math.max(0, scrollY / journeyMax));
}
addEventListener('scroll', computeScroll, { passive:true });
addEventListener('load', computeScroll);
computeScroll();

/* station reveal + rail + hint */
const stations = [...document.querySelectorAll('.station')];
const rail = document.getElementById('rail');
const railBtns = stations.map((_,i)=>{
  const b=document.createElement('button'); b.dataset.i=i;
  b.addEventListener('click',()=> stations[i].scrollIntoView({behavior:'smooth'}));
  rail.appendChild(b); return b;
});
const hint = document.getElementById('hint');
const scrim = document.getElementById('scrim');

const io = new IntersectionObserver((es)=>{
  es.forEach(en=>{ if(en.isIntersecting) en.target.classList.add('show'); });
},{ threshold:0.4 });
stations.forEach(s=>io.observe(s));

// portfolio blocks reveal on a lighter threshold (they are taller)
const ioPf = new IntersectionObserver((es)=>{
  es.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('show'); ioPf.unobserve(en.target); } });
},{ threshold:0.18 });
document.querySelectorAll('.reveal').forEach(el=>ioPf.observe(el));

// stamp the year
const yr = document.getElementById('yr'); if(yr) yr.textContent = new Date().getFullYear();

/* ---------- mood interpolation helper ---------- */
const tmpA=new THREE.Color(), tmpB=new THREE.Color(), tmpDay=new THREE.Color();
function sampleMood(pal, field, idxF, out, sub){
  const i0=Math.floor(idxF), i1=Math.min(pal.length-1,i0+1), t=idxF-i0;
  const a = sub!=null ? pal[i0][field][sub] : pal[i0][field];
  const b = sub!=null ? pal[i1][field][sub] : pal[i1][field];
  tmpA.set(a); tmpB.set(b); out.copy(tmpA).lerp(tmpB, t);
}
function moodColor(field, idxF, out, sub){
  sampleMood(MOODS, field, idxF, out, sub);           // night
  if(themeMix > 0.001){
    sampleMood(MOODS_DAY, field, idxF, tmpDay, sub);  // day
    out.lerp(tmpDay, themeMix);
  }
}

/* ============================================================
   POINTER PARALLAX (subtle, dreamlike)
   ============================================================ */
const ptr = { x:0, y:0, tx:0, ty:0 };
addEventListener('pointermove', e=>{
  ptr.tx = (e.clientX/innerWidth - 0.5);
  ptr.ty = (e.clientY/innerHeight - 0.5);
});

/* ============================================================
   RENDER LOOP
   ============================================================ */
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const curLook = new THREE.Vector3(0,10,-200);

function frame(){
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // smooth scroll progress (buttery camera)
  smoothP += (targetP - smoothP) * Math.min(1, dt*3.2);
  const p = smoothP;

  // --- camera travels the curve ---
  path.getPointAt(p, camPos);
  lookPath.getPointAt(p, camLook);
  ptr.x += (ptr.tx-ptr.x)*0.04; ptr.y += (ptr.ty-ptr.y)*0.04;
  camPos.x += ptr.x*22; camPos.y += -ptr.y*14;
  camera.position.lerp(camPos, Math.min(1, dt*4));
  curLook.lerp(camLook, Math.min(1, dt*3));
  camera.lookAt(curLook);

  // --- theme blend (dark world ⇄ daylight world) ---
  themeMix += (themeTarget - themeMix) * Math.min(1, dt*2.2);
  renderer.toneMappingExposure = 1.05 + 0.18*themeMix;
  hemi.intensity = 0.55 + 0.55*themeMix;
  key.intensity  = 2.1  - 0.7*themeMix;
  ridges.forEach(r=>{ r.material.color.copy(r.userData.baseCol).lerp(dayHaze, themeMix*0.55); });

  // --- mood / palette shifts ---
  const moodF = p * (MOODS.length-1);
  moodColor('sky', moodF, skyTop, 0);
  moodColor('sky', moodF, skyMid, 1);
  moodColor('sky', moodF, skyBot, 2);
  moodColor('fog', moodF, fogCol);
  moodColor('sun', moodF, sunCol);
  moodColor('key', moodF, keyCol);
  scene.fog.color.copy(fogCol);
  scene.fog.density = 0.0013 + 0.0004*Math.sin(p*Math.PI); // gently thicker mid-journey
  sun.material.color.copy(sunCol);
  key.color.copy(keyCol);
  waterUniforms.uFog.value.copy(fogCol);
  // the sea reflects the sky, kept deep so foreground copy stays legible
  waterUniforms.uColA.value.copy(fogCol).multiplyScalar(0.5);
  waterUniforms.uColB.value.copy(skyBot).multiplyScalar(0.78);
  dust.material.uniforms.uColor.value.copy(sunCol).lerp(c(0xffffff),0.3);

  // sky, sun & sea follow the camera so the world feels endless
  sky.position.copy(camera.position);
  sun.position.set(camera.position.x-360, camera.position.y+120, camera.position.z-900);
  water.position.x = camera.position.x;
  water.position.z = camera.position.z - 1200;

  // --- animate water ---
  waterUniforms.uTime.value = t;

  // --- flock keeps to the far horizon ahead of the camera ---
  birds.position.set(camera.position.x + 90, 120 + ptr.y*-10, camera.position.z - 760);
  for(let i=0;i<FLOCK;i++){
    const bd=bird[i]; bd.a += bd.sp*dt;
    const x=Math.cos(bd.a)*bd.r + Math.sin(t*0.3+bd.ph)*12;
    const z=Math.sin(bd.a)*bd.r*0.6;
    const y=Math.sin(t*0.6+bd.y)*bd.yr;
    dummy.position.set(x,y,z);
    // face direction of travel
    dummy.rotation.set(0, -bd.a + Math.PI/2, Math.sin(t*8+bd.ph)*0.5);
    const flap = 0.7+0.5*Math.abs(Math.sin(t*7+bd.ph));
    dummy.scale.set(flap,1,1.2);
    dummy.updateMatrix();
    birds.setMatrixAt(i, dummy.matrix);
  }
  birds.instanceMatrix.needsUpdate = true;

  // --- jellyfish drift + tentacle sway ---
  jellies.forEach(g=>{
    const u=g.userData;
    g.position.y += Math.sin(t*u.sp + u.ph)*6*dt;
    g.position.x += Math.cos(t*0.2 + u.drift)*4*dt;
    const sq = 1+0.08*Math.sin(t*u.sp*2+u.ph);
    g.children[0].scale.set(1/sq,sq,1/sq);          // bell pulse
    for(let k=2;k<g.children.length;k++){
      const line=g.children[k]; const base=line.userData.base;
      const arr=line.geometry.attributes.position;
      for(let s=0;s<base.length;s++){
        arr.setX(s, base[s].x + Math.sin(t*2 + s*0.6 + k)*s*0.25);
        arr.setZ(s, base[s].z + Math.cos(t*1.7 + s*0.5 + k)*s*0.2);
      }
      arr.needsUpdate=true;
    }
  });

  // --- particles ---
  dust.material.uniforms.uTime.value = t;

  // --- UI: rail + hint + scrim ---
  const active = Math.round(p*(stations.length-1));
  railBtns.forEach((b,i)=> b.classList.toggle('on', i===active));
  if(hint) hint.style.opacity = p>0.02 ? '0' : '0.8';
  if(scrim) scrim.style.opacity = p>0.04 ? '1' : '0';

  // bloom eases up in the luminous mid/late zones
  if(bloom) bloom.strength = (0.44 + 0.26*Math.sin(Math.min(p,0.95)*Math.PI)) * (1 - 0.55*themeMix);

  if(composer) composer.render(); else renderer.render(scene, camera);
}

/* ============================================================
   RESIZE + BOOT
   ============================================================ */
addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  if(composer) composer.setSize(innerWidth, innerHeight);
  computeScroll();
});

// loader: we have no async assets, so animate a quick "summon" then reveal
const loader=document.getElementById('loader'), fill=document.getElementById('loadFill'), ltxt=document.getElementById('loadTxt');
const phrases=['summoning the world','raising the mountains','seeding the rivers','waking the creatures','opening the doorway'];
let prog=0;
const boot=setInterval(()=>{
  prog=Math.min(100, prog + 8 + Math.random()*16);
  fill.style.width=prog+'%';
  ltxt.textContent = phrases[Math.min(phrases.length-1, Math.floor(prog/22))];
  if(prog>=100){
    clearInterval(boot);
    setTimeout(()=>{ loader.classList.add('hidden'); }, 350);
  }
},160);

frame();
