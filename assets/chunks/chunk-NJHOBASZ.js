import{a as b,b as A,c as I,d as _,e as C,f as M,i as N,j as E,k as F}from"./chunk-7HGTF7VO.js";var X=`#version 300 es
out vec2 vPosition;
void main() {
  vPosition = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1)) * 2.0 - 1.0;
  gl_Position = vec4(vPosition, 0.0, 1.0);
}`,k=`#version 300 es
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
}`,j=`
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
}`,K=`#version 300 es
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
${j}
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
}`,W=`#version 300 es
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
}`,d=Math.PI/180,h=4.6,q=.86;function H(a,n){let r=Math.cos(a),f=Math.sin(a),m=Math.cos(n),p=Math.sin(n);return new Float32Array([r,p*f,-m*f,0,m,p,f,-p*r,m*r])}function Z(a,n){let r=Math.cos(n*d);return[r*Math.sin(a*d),Math.sin(n*d),r*Math.cos(a*d)]}function Y(a,[n,r,f]){return[a[0]*n+a[3]*r+a[6]*f,a[1]*n+a[4]*r+a[7]*f,a[2]*n+a[5]*r+a[8]*f]}async function ee(a,{base:n="/earth",centre:r=[104,24],speed:f=3.2,reduceMotion:m=!1,intro:p=!0,radius:L=q,extra:D,onFrame:G}){let t=b(a);if(!t)return null;let g=A(t,X,k),x=A(t,K,W),[R,V]=await Promise.all([_(t,`${n}/relief.webp`,{repeat:!0}),I(`${n}/rivers.bin`)]),{reaches:O,count:U}=C(V),z=M(t,O),B=t.createVertexArray(),e={spin:-r[0]*d,tilt:r[1]*d,velocity:0,dragging:!1,idleSince:0,time:0,reach:p&&!m?0:1e5,started:0,width:1,height:1,cssWidth:1,cssHeight:1,fit:[1,1],focal:1,pixel:.002,target:null,turn:H(0,0)};t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0);let v={gl:t,state:e,distance:h,project(o){let i=Y(e.turn,o),s=h-i[2],l=i[0]*e.focal/s/e.fit[0],u=i[1]*e.focal/s/e.fit[1];return{x:(l+1)/2*e.cssWidth,y:(1-u)/2*e.cssHeight,front:i[2]-1/h}},aim(o,i){e.target={spin:-o*d,tilt:E(i,-50,60)*d},(e.paused||!c.running)&&(e.spin=e.target.spin,e.tilt=e.target.tilt,e.target=null,c.once())},uniforms(o){t.uniformMatrix3fv(o.u.uTurn,!1,e.turn),t.uniform2fv(o.u.uFit,e.fit),t.uniform2f(o.u.uCanvas,e.width/2,e.height/2),t.uniform1f(o.u.uCamera,h),t.uniform1f(o.u.uFocal,e.focal)}},c=F(a,{draw:(o,i)=>{e.started||(e.started=o);let s=c.running&&!e.paused;if(s&&(e.time+=i/1e3),e.target){let u=((e.target.spin-e.spin)%(Math.PI*2)+Math.PI*3)%(Math.PI*2)-Math.PI,y=1-Math.exp(-i/260);e.spin+=u*y,e.tilt+=(e.target.tilt-e.tilt)*y,Math.abs(u)<.002&&(e.target=null)}else if(!e.dragging&&s){e.velocity*=Math.exp(-i/700);let l=o-e.idleSince>1800&&!m?f*d/1e3:0;e.spin+=(e.velocity+l)*i}if(e.reach<1e5){let l=E((o-e.started)/2600,0,1);e.reach=l===1?1e5:80+6400*N(l)}return e.turn=H(e.spin,e.tilt),t.clear(t.COLOR_BUFFER_BIT),t.useProgram(g.handle),t.bindVertexArray(B),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,R.texture),t.uniform1i(g.u.uRelief,0),v.uniforms(g),t.uniform1f(g.u.uPixel,e.pixel),t.uniform1f(g.u.uTexels,R.width/(2*Math.PI)),t.drawArrays(t.TRIANGLE_STRIP,0,4),t.useProgram(x.handle),t.bindVertexArray(z),v.uniforms(x),t.uniform1f(x.u.uTime,e.time),t.uniform1f(x.u.uReach,e.reach),t.uniform1f(x.u.uThickness,E(e.height/1e3*1.05,.72,2.2)),t.drawArraysInstanced(t.TRIANGLE_STRIP,0,4,U),D?.(v,o,i),t.bindVertexArray(null),G?.(v),!0},resize:(o,i,s,l)=>{Object.assign(e,{width:o,height:i,cssWidth:s,cssHeight:l}),t.viewport(0,0,o,i);let u=Math.min(o,i);e.fit=[o/u,i/u];let y=1/Math.sqrt(h*h-1);e.focal=L/y,e.pixel=2/(L*u)}});v.loop=c;let T=0,S=0,P=0;a.addEventListener("pointerdown",o=>{o.button===0&&(e.dragging=!0,e.target=null,e.velocity=0,T=o.clientX,S=o.clientY,P=o.timeStamp,a.setPointerCapture(o.pointerId),a.classList.add("is-dragging"),c.running||c.once())}),a.addEventListener("pointermove",o=>{if(!e.dragging)return;let i=1/(Math.min(e.cssWidth,e.cssHeight)*.42),s=(o.clientX-T)*i,l=(o.clientY-S)*i,u=Math.max(o.timeStamp-P,1);e.spin+=s,e.tilt=E(e.tilt+l,-1.2,1.2),e.velocity=s/u,T=o.clientX,S=o.clientY,P=o.timeStamp,c.running||c.once()});let w=()=>{e.dragging&&(e.dragging=!1,e.idleSince=performance.now(),a.classList.remove("is-dragging"))};return a.addEventListener("pointerup",w),a.addEventListener("pointercancel",w),a.addEventListener("lostpointercapture",w),v.pause=o=>{e.paused=o,o?c.stop():c.start()},v}export{Z as a,Y as b,ee as c};
