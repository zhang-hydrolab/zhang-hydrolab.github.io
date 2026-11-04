import{a as _,b as R,c as C,d as F,f as N,g as M,h as H,j as D,k as S,l as G}from"./chunk-5S4CCUR3.js";var q=`#version 300 es
out vec2 vPosition;
void main() {
  vPosition = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  gl_Position = vec4(vPosition, 0.0, 1.0);
}`,W=`#version 300 es
precision highp float;
in vec2 vPosition;
out vec4 outColor;
uniform mat3 uTurn;
uniform vec2 uFit;
uniform float uCamera;
uniform float uFocal;
uniform float uPixel;
uniform float uTexels;
uniform sampler2D uRelief;

const float PI = 3.14159265;
const vec3 SUN = normalize(vec3(-0.52, 0.62, 0.59));
const vec3 HALO = vec3(0.56, 0.76, 0.93);
const vec3 SEA_DEEP = vec3(0.145, 0.416, 0.690);
const vec3 SEA_SHORE = vec3(0.420, 0.680, 0.875);
const vec3 LAND_LIT = vec3(0.992, 0.996, 1.000);
const vec3 LAND_SHADE = vec3(0.700, 0.778, 0.860);

vec2 mapOf(vec3 p) {
  return vec2(atan(p.x, p.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(p.y, -1.0, 1.0)) / PI);
}

float heightAt(vec2 uv, float lod) {
  return max(textureLod(uRelief, uv, lod).r - 0.46, 0.0);
}

void main() {
  vec3 origin = vec3(0.0, 0.0, uCamera);
  vec3 ray = normalize(vec3(vPosition * uFit, -uFocal));
  float along = dot(origin, ray);
  float miss = sqrt(max(dot(origin, origin) - along * along, 0.0));
  float inside = smoothstep(1.0 + uPixel, 1.0 - uPixel, miss);

  // A soft edge of air, which is the only thing that separates the globe from a white page.
  float air = clamp((1.13 - miss) / 0.13, 0.0, 1.0);
  vec4 halo = vec4(HALO, 1.0) * air * air * air * 0.62;
  if (inside <= 0.0) {
    outColor = halo;
    return;
  }

  float depth = -along - sqrt(max(along * along - dot(origin, origin) + 1.0, 0.0));
  vec3 point = origin + ray * depth;
  vec3 normal = normalize(point);
  vec3 place = normal * uTurn;
  float facing = max(dot(normal, -ray), 0.02);

  // Mipmaps by hand, because the longitude seam would upset the automatic choice.
  float lod = clamp(log2(uTexels * uPixel / facing), 0.0, 5.0);
  float step1 = pow(2.0, lod) / 2048.0;
  vec2 uv = mapOf(place);
  float cosLat = max(sqrt(1.0 - place.y * place.y), 0.05);

  float value = textureLod(uRelief, uv, lod).r;
  float soft = 0.012 + 0.03 * lod;
  float land = smoothstep(0.38 - soft, 0.38 + soft, value);

  // Relief as a tilted normal: the slope of the height field in east and north.
  vec2 du = vec2(step1 / cosLat, 0.0);
  vec2 dv = vec2(0.0, step1);
  float east = heightAt(uv + du, lod) - heightAt(uv - du, lod);
  float north = heightAt(uv - dv, lod) - heightAt(uv + dv, lod);
  vec3 eastward = normalize(cross(vec3(0.0, 1.0, 0.0) * transpose(uTurn), normal) + 1e-5);
  vec3 northward = cross(normal, eastward);
  vec3 bumped = normalize(normal - (eastward * east + northward * north) * 15.0);

  float light = dot(normal, SUN) * 0.5 + 0.5;
  float reliefLight = clamp(dot(bumped, SUN) - dot(normal, SUN), -1.0, 1.0);

  float altitude = max(value - 0.46, 0.0) / 0.54;
  vec3 ground = mix(LAND_SHADE, LAND_LIT, smoothstep(0.10, 0.74, light + reliefLight * 1.5));
  ground = mix(ground, ground * vec3(0.90, 0.935, 0.975), smoothstep(0.25, 0.8, altitude));

  // Read a coarser level for the sea, which has no detail of its own to lose.
  float seaShade = clamp(textureLod(uRelief, uv, lod + 3.0).r / 0.30, 0.0, 1.0) * (1.0 - land);
  vec3 sea = mix(SEA_DEEP, SEA_SHORE, seaShade * seaShade) * (0.74 + 0.30 * light);
  vec3 glint = reflect(ray, normal);
  sea += vec3(0.65, 0.78, 0.90) * pow(max(dot(glint, SUN), 0.0), 40.0) * 0.28;

  // Parallels and meridians every 30 degrees, faint, as on a printed globe.
  vec2 degrees = vec2(uv.x * 360.0, uv.y * 180.0);
  vec2 cell = abs(fract(degrees / 30.0 + 0.5) - 0.5) * 30.0;
  float width = 1.5 * uPixel * 57.3 / facing;
  float grid = 1.0 - smoothstep(width * 0.3, width, min(cell.x * cosLat, cell.y));
  grid *= smoothstep(0.985, 0.93, abs(place.y));

  vec3 colour = mix(sea, ground, land);
  colour = mix(colour, mix(vec3(1.0), vec3(0.56, 0.70, 0.83), land), grid * mix(0.16, 0.20, land));

  // The limb takes the colour of the air, as it does from orbit.
  float limb = pow(1.0 - facing, 3.2);
  colour = mix(colour, vec3(0.74, 0.87, 0.97), limb * 0.72);

  outColor = vec4(colour, 1.0) * inside + halo * (1.0 - inside);
}`,K=`
const float EPS = 1e-4;
vec3 onSphere(vec2 lonLat) {
  float lon = radians(lonLat.x);
  float lat = radians(lonLat.y);
  float c = cos(lat);
  return vec3(c * sin(lon), sin(lat), c * cos(lon));
}
vec3 project(vec3 v, float camera, float focal, vec2 fit) {
  float depth = camera - v.z;
  return vec3(v.xy * focal / depth / fit, depth);
}`,$=`#version 300 es
precision highp float;
layout(location = 0) in vec3 aStart;
layout(location = 1) in vec3 aEnd;
layout(location = 2) in float aGrade;
uniform mat3 uTurn;
uniform vec2 uFit;
uniform vec2 uCanvas;
uniform float uCamera;
uniform float uFocal;
uniform float uThickness;
out float vKm;
out float vEdge;
out float vHalf;
out float vFace;
out float vGrade;
${K}
void main() {
  float end = float(gl_VertexID & 1);
  float side = float((gl_VertexID >> 1) & 1) * 2.0 - 1.0;

  vec3 a = uTurn * onSphere(aStart.xy) * 1.0015;
  vec3 b = uTurn * onSphere(aEnd.xy) * 1.0015;
  vec3 here = mix(a, b, end);
  vec2 pa = project(a, uCamera, uFocal, uFit).xy;
  vec2 pb = project(b, uCamera, uFocal, uFit).xy;

  vec2 line = (pb - pa) * uCanvas;
  float length_ = length(line);
  vec2 across = length_ > EPS ? vec2(-line.y, line.x) / length_ : vec2(0.0, 1.0);

  // Thin rivers fade rather than break up when they fall under a pixel.
  float widthPx = (0.55 + 2.9 * aGrade * aGrade * aGrade + 0.45 * aGrade) * uThickness;
  vHalf = widthPx * 0.5;
  vEdge = side * (vHalf + 1.0);
  vKm = mix(aStart.z, aEnd.z, end);
  vGrade = aGrade;
  vFace = smoothstep(1.0 / uCamera, 1.0 / uCamera + 0.16, here.z);

  vec2 centre = mix(pa, pb, end);
  gl_Position = vec4(centre + across * vEdge * 2.0 / uCanvas, 0.0, 1.0);
}`,Y=`#version 300 es
precision highp float;
in float vKm;
in float vEdge;
in float vHalf;
in float vFace;
in float vGrade;
out vec4 outColor;
uniform float uTime;
uniform float uReach;

const vec3 CHANNEL = vec3(0.070, 0.345, 0.620);
const vec3 CREST = vec3(0.000, 0.610, 0.960);

void main() {
  if (vKm > uReach) discard;
  float width = min(vHalf * 2.0, 1.0);
  float cover = clamp(vHalf + 0.5 - abs(vEdge), 0.0, 1.0) * width;

  // Bands of water, a few hundred kilometres long, running towards the mouth.
  float wave = fract(vKm / 1500.0 + uTime * 0.16);
  float crest = smoothstep(0.0, 0.05, wave) * smoothstep(0.34, 0.05, wave);
  vec3 colour = mix(CHANNEL, CREST, crest);
  float alpha = cover * vFace * (0.62 + 0.30 * vGrade + 0.34 * crest);
  outColor = vec4(colour, 1.0) * clamp(alpha, 0.0, 1.0);
}`,m=Math.PI/180,y=4.6,Q=.86;function V(o,i){let n=Math.cos(o),l=Math.sin(o),h=Math.cos(i),s=Math.sin(i);return new Float32Array([n,s*l,-h*l,0,h,s,l,-s*n,h*n])}function O(o,i){let n=Math.cos(i*m);return[n*Math.sin(o*m),Math.sin(i*m),n*Math.cos(o*m)]}function J(o,[i,n,l]){return[o[0]*i+o[3]*n+o[6]*l,o[1]*i+o[4]*n+o[7]*l,o[2]*i+o[5]*n+o[8]*l]}async function U(o,{base:i="/earth",centre:n=[104,24],speed:l=3.2,reduceMotion:h=!1,intro:s=!0,radius:u=Q,extra:E,onFrame:b}){let t=_(o);if(!t)return null;let g=R(t,q,W),p=R(t,$,Y),[I,z]=await Promise.all([F(t,`${i}/relief.webp`,{repeat:!0}),C(`${i}/rivers.bin`)]),{reaches:B,count:X}=N(z),j=M(t,B),k=t.createVertexArray(),e={spin:-n[0]*m,tilt:n[1]*m,velocity:0,dragging:!1,idleSince:0,time:0,reach:s&&!h?0:1e5,started:0,width:1,height:1,cssWidth:1,cssHeight:1,fit:[1,1],focal:1,pixel:.002,target:null,turn:V(0,0)};t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0);let x={gl:t,state:e,distance:y,project(a){let r=J(e.turn,a),d=y-r[2],c=r[0]*e.focal/d/e.fit[0],v=r[1]*e.focal/d/e.fit[1];return{x:(c+1)/2*e.cssWidth,y:(1-v)/2*e.cssHeight,front:r[2]-1/y}},aim(a,r){e.target={spin:-a*m,tilt:S(r,-50,60)*m},(e.paused||!f.running)&&(e.spin=e.target.spin,e.tilt=e.target.tilt,e.target=null,f.once())},uniforms(a){t.uniformMatrix3fv(a.u.uTurn,!1,e.turn),t.uniform2fv(a.u.uFit,e.fit),t.uniform2f(a.u.uCanvas,e.width/2,e.height/2),t.uniform1f(a.u.uCamera,y),t.uniform1f(a.u.uFocal,e.focal)}},f=G(o,{draw:(a,r)=>{e.started||(e.started=a);let d=f.running&&!e.paused;if(d&&(e.time+=r/1e3),e.target){let v=((e.target.spin-e.spin)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI,T=1-Math.exp(-r/260);e.spin+=v*T,e.tilt+=(e.target.tilt-e.tilt)*T,Math.abs(v)<.002&&(e.target=null)}else if(!e.dragging&&d){e.velocity*=Math.exp(-r/700);let c=a-e.idleSince>1800&&!h?l*m/1e3:0;e.spin+=(e.velocity+c)*r}if(e.reach<1e5){let c=S((a-e.started)/2600,0,1);e.reach=c===1?1e5:80+6400*D(c)}return e.turn=V(e.spin,e.tilt),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(g.handle),t.bindVertexArray(k),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,I.texture),t.uniform1i(g.u.uRelief,0),x.uniforms(g),t.uniform1f(g.u.uPixel,e.pixel),t.uniform1f(g.u.uTexels,I.width/(2*Math.PI)),t.drawArrays(t.TRIANGLE_STRIP,0,4),t.useProgram(p.handle),t.bindVertexArray(j),x.uniforms(p),t.uniform1f(p.u.uTime,e.time),t.uniform1f(p.u.uReach,e.reach),t.uniform1f(p.u.uThickness,S(e.height/1e3*1.05,.72,2.2)),t.drawArraysInstanced(t.TRIANGLE_STRIP,0,4,X),E?.(x,a,r),t.bindVertexArray(null),b?.(x),!0},resize:(a,r,d,c)=>{Object.assign(e,{width:a,height:r,cssWidth:d,cssHeight:c}),t.viewport(0,0,a,r);let v=Math.min(a,r);e.fit=[a/v,r/v];let T=1/Math.sqrt(y*y-1);e.focal=u/T,e.pixel=2/(u*v)}});x.loop=f;let w=0,P=0,L=0;o.addEventListener("pointerdown",a=>{a.button===0&&(e.dragging=!0,e.target=null,e.velocity=0,w=a.clientX,P=a.clientY,L=a.timeStamp,o.setPointerCapture(a.pointerId),o.classList.add("is-dragging"),f.running||f.once())}),o.addEventListener("pointermove",a=>{if(!e.dragging)return;let r=1/(Math.min(e.cssWidth,e.cssHeight)*.42),d=(a.clientX-w)*r,c=(a.clientY-P)*r,v=Math.max(a.timeStamp-L,1);e.spin+=d,e.tilt=S(e.tilt+c,-1.2,1.2),e.velocity=d/v,w=a.clientX,P=a.clientY,L=a.timeStamp,f.running||f.once()});let A=()=>{e.dragging&&(e.dragging=!1,e.idleSince=performance.now(),o.classList.remove("is-dragging"))};return o.addEventListener("pointerup",A),o.addEventListener("pointercancel",A),o.addEventListener("lostpointercapture",A),x.pause=a=>{e.paused=a,a?f.stop():f.start()},x}async function Z(o,{reduceMotion:i}){let n=o.querySelector("canvas"),l=[...o.querySelectorAll("[data-lon]")].map(u=>({el:u,place:O(Number(u.dataset.lon),Number(u.dataset.lat))})),h=u=>{for(let E of l){let{x:b,y:t,front:g}=u.project(E.place),p=g>.22;E.el.classList.toggle("is-on",p),p&&(E.el.style.transform=`translate(${b.toFixed(1)}px, ${t.toFixed(1)}px)`)}},s;try{s=await U(n,{reduceMotion:i,onFrame:h,intro:performance.now()<1800})}catch(u){console.warn("Globe not available:",u.message)}s&&(o.classList.add("is-live"),i?s.loop.once():s.loop.start(),H(o,s,i))}export{Z as default};
