import{a as A,b as I,c as R}from"./chunk-NJHOBASZ.js";import{b as T,g as _,h as C,j as F}from"./chunk-7HGTF7VO.js";var P=64,N=`#version 300 es
precision highp float;
layout(location = 0) in vec3 aFrom;
layout(location = 1) in vec3 aTo;
layout(location = 2) in float aLift;
layout(location = 3) in float aIndex;
uniform mat3 uTurn;
uniform vec2 uFit;
uniform vec2 uCanvas;
uniform float uCamera;
uniform float uFocal;
uniform float uThickness;
out float vAlong;
out float vEdge;
out float vFace;
flat out float vIndex;

vec3 onArc(float t) {
  float angle = acos(clamp(dot(aFrom, aTo), -1.0, 1.0));
  vec3 p = (sin((1.0 - t) * angle) * aFrom + sin(t * angle) * aTo) / sin(angle);
  return p * (1.0 + aLift * 4.0 * t * (1.0 - t));
}

vec2 toScreen(vec3 v) {
  return v.xy * uFocal / (uCamera - v.z) / uFit;
}

void main() {
  float step_ = 1.0 / ${P}.0;
  float segment = floor(float(gl_VertexID) / 2.0);
  float side = float(gl_VertexID & 1) * 2.0 - 1.0;
  float t = segment * step_;
  vec3 here = uTurn * onArc(t);
  vec3 near = uTurn * onArc(clamp(t + step_ * 0.5, 0.0, 1.0));
  vec3 back = uTurn * onArc(clamp(t - step_ * 0.5, 0.0, 1.0));
  vec2 line = (toScreen(near) - toScreen(back)) * uCanvas;
  vec2 across = vec2(-line.y, line.x) / max(length(line), 1e-4);
  vEdge = side * 2.4 * uThickness;
  vAlong = t;
  vIndex = aIndex;
  float limb = 1.0 / uCamera;
  // An arc above the surface can be seen past the edge of the globe, but not through it.
  vFace = 1.0 - step(here.z, limb) * step(length(here.xy), 1.0);
  gl_Position = vec4(toScreen(here) + across * vEdge * 2.0 / uCanvas, 0.0, 1.0);
}`,V=`#version 300 es
precision highp float;
in float vAlong;
in float vEdge;
in float vFace;
flat in float vIndex;
out vec4 outColor;
uniform float uTime;
uniform float uDraw;
uniform float uFocus;
uniform float uThickness;
void main() {
  float reveal = clamp(uDraw * 2.2 - vIndex * 0.14, 0.0, 1.0);
  if (vAlong > reveal) discard;
  bool chosen = abs(vIndex - uFocus) < 0.5;
  float half_ = (chosen ? 1.5 : 0.85) * uThickness;
  float cover = clamp(half_ + 0.5 - abs(vEdge), 0.0, 1.0);
  float pulse = fract(vAlong * 1.5 - uTime * 0.28 + vIndex * 0.17);
  float crest = smoothstep(0.86, 0.98, pulse) * (1.0 - smoothstep(0.98, 1.0, pulse));
  vec3 base = chosen ? vec3(0.000, 0.300, 0.620) : vec3(0.040, 0.300, 0.540);
  vec3 colour = mix(base, vec3(0.000, 0.640, 0.980), crest);
  float dim = uFocus < 0.0 || chosen ? 1.0 : 0.42;
  outColor = vec4(colour, 1.0) * cover * vFace * dim;
}`,w=`#version 300 es
precision highp float;
layout(location = 0) in vec3 aPlace;
layout(location = 1) in float aIndex;
uniform mat3 uTurn;
uniform vec2 uFit;
uniform float uCamera;
uniform float uFocal;
uniform float uSize;
uniform float uFocus;
out float vFace;
flat out float vChosen;
void main() {
  vec3 v = uTurn * aPlace * 1.002;
  vChosen = abs(aIndex - uFocus) < 0.5 ? 1.0 : 0.0;
  vFace = smoothstep(1.0 / uCamera, 1.0 / uCamera + 0.06, v.z);
  gl_Position = vec4(v.xy * uFocal / (uCamera - v.z) / uFit, 0.0, 1.0);
  gl_PointSize = uSize * (vChosen > 0.5 ? 2.6 : 1.8);
}`,D=`#version 300 es
precision highp float;
in float vFace;
flat in float vChosen;
out vec4 outColor;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float dot_ = 1.0 - smoothstep(0.34, 0.42, r);
  float ring = (1.0 - smoothstep(0.86, 1.0, r)) * smoothstep(0.42, 0.5, r);
  vec3 colour = vec3(0.040, 0.300, 0.540);
  float alpha = max(dot_, ring * 0.3);
  outColor = vec4(colour, 1.0) * alpha * vFace;
}`;function k(t,r,u){let a=A(r.lon,r.lat),v=(P+1)*2,d=[];u.forEach((f,i)=>{let l=A(f.lon,f.lat),b=Math.acos(F(a[0]*l[0]+a[1]*l[1]+a[2]*l[2],-1,1));d.push(...a,...l,.05+.2*(b/Math.PI),i)});let c=t.createVertexArray();t.bindVertexArray(c),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,new Float32Array(d),t.STATIC_DRAW);let s=32;return[[0,3,0],[1,3,12],[2,1,24],[3,1,28]].forEach(([f,i,l])=>{t.enableVertexAttribArray(f),t.vertexAttribPointer(f,i,t.FLOAT,!1,s,l),t.vertexAttribDivisor(f,1)}),t.bindVertexArray(null),{vao:c,rows:v,count:u.length}}function z(t,r,u){let a=[];u.forEach((d,c)=>a.push(...A(d.lon,d.lat),c)),a.push(...A(r.lon,r.lat),-5);let v=t.createVertexArray();return t.bindVertexArray(v),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,new Float32Array(a),t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,3,t.FLOAT,!1,16,0),t.enableVertexAttribArray(1),t.vertexAttribPointer(1,1,t.FLOAT,!1,16,12),t.bindVertexArray(null),{vao:v,count:u.length+1}}function M(t,r){let[u,a,v]=[t[0]+r[0],t[1]+r[1],t[2]+r[2]],d=Math.hypot(u,a,v)||1;return{lon:Math.atan2(u,v)*180/Math.PI,lat:Math.asin(a/d)*180/Math.PI}}function B(t,{reduceMotion:r}){let u=t.closest("section"),a={lon:Number(t.dataset.lon),lat:Number(t.dataset.lat)},v=A(a.lon,a.lat),c=[...t.querySelectorAll("[data-city]")].map(s=>({el:s,city:s.dataset.city,lon:Number(s.dataset.lon),lat:Number(s.dataset.lat),place:A(Number(s.dataset.lon),Number(s.dataset.lat))}));C(t,async()=>{let s,f,i,l,b=-1,E=0,g=(e,n)=>{let{gl:o,state:m}=e;i||(i=T(o,N,V),l=T(o,w,D),s=k(o,a,c),f=z(o,a,c),E=n);let p=F(m.height/760,.8,2);o.useProgram(i.handle),e.uniforms(i),o.uniform1f(i.u.uThickness,p),o.uniform1f(i.u.uTime,m.time),o.uniform1f(i.u.uDraw,r?1:F((n-E)/2200,0,1)),o.uniform1f(i.u.uFocus,b),o.bindVertexArray(s.vao),o.drawArraysInstanced(o.TRIANGLE_STRIP,0,s.rows,s.count),o.useProgram(l.handle),e.uniforms(l),o.uniform1f(l.u.uSize,9*p),o.uniform1f(l.u.uFocus,b),o.bindVertexArray(f.vao),o.drawArrays(o.POINTS,0,f.count)},L=e=>{let n=[];for(let o of c){let p=I(e.state.turn,o.place)[2]>1/e.distance+.04;o.el.classList.toggle("is-on",p),p&&n.push({el:o.el,...e.project(o.place)})}n.sort((o,m)=>o.y-m.y),n.forEach((o,m)=>{let p=n.slice(0,m).filter(x=>Math.abs(x.x-o.x)<96),S=Math.max(o.y,...p.map(x=>x.y+24));o.y=S,o.el.style.transform=`translate(${o.x.toFixed(1)}px, ${o.y.toFixed(1)}px)`})},h;try{h=await R(t.querySelector("canvas"),{centre:[75,34],speed:0,reduceMotion:r,intro:!1,radius:.88,extra:g,onFrame:L})}catch(e){console.warn("Globe not available:",e.message)}if(!h)return;u.classList.add("has-globe"),t.classList.add("is-live"),r?h.loop.once():h.loop.start(),_(t,h,r);let y=e=>{if(b!==e){b=e;for(let[n,o]of c.entries())o.el.classList.toggle("is-focus",n===e);if(e>=0){let{lon:n,lat:o}=M(v,c[e].place);h.aim(n,o)}h.loop.running||h.loop.once()}};c.forEach((e,n)=>{e.el.addEventListener("pointerenter",()=>y(n)),e.el.addEventListener("focus",()=>y(n)),e.el.addEventListener("pointerleave",()=>y(-1)),e.el.addEventListener("blur",()=>y(-1))});for(let e of u.querySelectorAll(".collab")){let n=e.dataset.city,o=c.findIndex(m=>m.city===n);o<0||(e.addEventListener("pointerenter",()=>y(o)),e.addEventListener("pointerleave",()=>y(-1)))}})}export{B as default};
