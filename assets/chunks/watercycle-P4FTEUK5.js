import{a as F,b as V}from"./chunk-BKNLTEUW.js";import{b as w,g as T,h as g,j as z}from"./chunk-7HGTF7VO.js";var N=`#version 300 es
precision highp float;
layout(location = 0) in vec3 aSeed;
uniform mat4 uCamera;
uniform float uTime;
uniform float uRate;
uniform float uUp;
uniform float uSize;
out float vLife;
${F}
void main() {
  float t = fract(aSeed.z + uTime * uRate);
  vec3 ground = placeAt(aSeed.xy);
  float high = 0.52 + aSeed.z * 0.08;
  float y = uUp > 0.5 ? mix(ground.y + 0.01, high, t) : mix(high, ground.y + 0.005, t);
  vLife = sin(t * 3.14159) * uRise;
  gl_Position = uCamera * vec4(ground.x, y, ground.z, 1.0);
  gl_PointSize = uSize;
}`,O=`#version 300 es
precision highp float;
in float vLife;
out vec4 outColor;
uniform float uUp;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  // Rain is a short streak and vapour a small round drop.
  float shape = uUp > 0.5
    ? 1.0 - smoothstep(0.22, 0.5, length(p))
    : (1.0 - smoothstep(0.02, 0.07, abs(p.x))) * (1.0 - smoothstep(0.2, 0.5, abs(p.y)));
  vec3 colour = uUp > 0.5 ? vec3(0.47, 0.70, 0.90) : vec3(0.13, 0.43, 0.72);
  outColor = vec4(colour, 1.0) * shape * sqrt(max(vLife, 0.0)) * (uUp > 0.5 ? 0.5 : 0.42);
}`,R=.84,n={rain:900,vapour:800,seaRain:190,seaVapour:210};function b(a,l,m,s){let p=12345,u=()=>(p=p*48271%2147483647,p/2147483647),f=new Float32Array(l*3);for(let r=0;r<l;r+=1)f[r*3]=m+u()*(s-m),f[r*3+1]=.02+u()*.96,f[r*3+2]=u();let y=a.createVertexArray();return a.bindVertexArray(y),a.bindBuffer(a.ARRAY_BUFFER,a.createBuffer()),a.bufferData(a.ARRAY_BUFFER,f,a.STATIC_DRAW),a.enableVertexAttribArray(0),a.vertexAttribPointer(0,3,a.FLOAT,!1,0,0),a.bindVertexArray(null),y}function q(a,{reduceMotion:l}){let m=a.closest("section"),{flows:s}=JSON.parse(m.querySelector("#budget-data").textContent),p=[...a.querySelectorAll("[data-flux]")].map(e=>({el:e,id:e.dataset.flux,at:e.dataset.at.split(",").map(Number),value:e.querySelector("[data-flux-value]")})),u="historical",f=()=>{for(let e of p){let o=s[e.id][u]??s[e.id].historical;e.value.textContent=`${o[0].toFixed(1)} \xB1 ${o[1].toFixed(1)}`}},y=e=>{if(!(innerWidth<760))for(let o of p){let[c,v,S]=o.at,{x:A,y:t}=e.project(c*2-1,v,(S*2-1)*e.depth);o.el.style.transform=`translate(${A.toFixed(1)}px, ${t.toFixed(1)}px)`}},r={rain:1,vapour:1,seaRain:1,seaVapour:1,river:1},d={...r},i;m.addEventListener("lab:period",e=>{u=e.detail,f();let o=c=>(s[c][u]??s[c].historical)[0]/s[c].historical[0];d.rain=o("land_precipitation"),d.vapour=o("land_et"),d.seaRain=o("ocean_precipitation"),d.seaVapour=o("ocean_evaporation"),d.river=o("river_flow"),i&&!i.loop.running&&i.loop.once()}),g(a,async()=>{let e,o,c=(v,S,A)=>{let{gl:t,state:x}=v;e||(e=w(t,N,O),o=[{vao:b(t,n.rain,.02,R),size:n.rain*.9,key:"rain",up:0,rate:.42,dot:11},{vao:b(t,n.vapour,.02,R),size:n.vapour*.9,key:"vapour",up:1,rate:.1,dot:3.6},{vao:b(t,n.seaRain,R+.02,.985),size:n.seaRain*.9,key:"seaRain",up:0,rate:.42,dot:11},{vao:b(t,n.seaVapour,R+.02,.985),size:n.seaVapour*.9,key:"seaVapour",up:1,rate:.1,dot:3.6}]);let _=1-Math.exp(-A/300);for(let h of Object.keys(r))r[h]+=(d[h]-r[h])*_;x.flow=.3*r.river,t.depthMask(!1),t.useProgram(e.handle),v.heights(e),t.uniformMatrix4fv(e.u.uCamera,!1,x.camera),t.uniform1f(e.u.uTime,x.time);let k=z(x.height/620,.9,2.2);for(let{vao:h,size:C,key:U,up:E,rate:P,dot:L}of o)t.bindVertexArray(h),t.uniform1f(e.u.uUp,E),t.uniform1f(e.u.uRate,P),t.uniform1f(e.u.uSize,L*k),t.drawArrays(t.POINTS,0,Math.round(C*r[U]));t.depthMask(!0)};try{i=await V(a.querySelector("canvas"),{scene:"water",yaw:-20,pitch:30,distance:3.05,contour:500,swing:6,reduceMotion:l,extra:c,onFrame:y})}catch(v){console.warn("Terrain not available:",v.message)}i&&(a.classList.add("is-live"),l?i.loop.once():i.loop.start(),T(a,i,l))})}export{q as default};
