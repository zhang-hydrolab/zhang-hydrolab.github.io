import{a as Y,b as _,c as k,d as O,f as j,g as X,j as $,k as b,l as K}from"./chunk-5S4CCUR3.js";var ae=.25,V=`
uniform sampler2D uHeight;
uniform float uRise;
uniform float uDepth;

// The image stores the square root of relative height, with 0 for the sea. A coarser level
// is read for the mesh: the block is a model of the landscape, not a survey of every ridge.
float heightAt(vec2 uv) {
  float v = textureLod(uHeight, uv, 2.4).r;
  float h = max(v - 0.04, 0.0) / 0.96;
  return h * h;
}

vec3 placeAt(vec2 uv) {
  return vec3(uv.x * 2.0 - 1.0, heightAt(uv) * ${ae.toFixed(2)} * uRise, (uv.y * 2.0 - 1.0) * uDepth);
}`,re=`#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
uniform mat4 uCamera;
out vec2 vUv;
out float vHeight;
${V}
void main() {
  vUv = aGrid;
  vec3 p = placeAt(aGrid);
  vHeight = heightAt(aGrid);
  gl_Position = uCamera * vec4(p, 1.0);
}`,ie=`#version 300 es
precision highp float;
in vec2 vUv;
in float vHeight;
out vec4 outColor;
uniform sampler2D uHeight;
uniform vec2 uTexel;
uniform float uMeters;
uniform float uBase;
uniform float uContour;
uniform float uTime;
uniform float uRise;
uniform float uDry;

const vec3 SUN = normalize(vec3(-0.55, 0.72, 0.42));

float at(vec2 uv) {
  float h = max(textureLod(uHeight, uv, 2.1).r - 0.04, 0.0) / 0.96;
  return h * h;
}

void main() {
  float raw = texture(uHeight, vUv).r;
  float land = smoothstep(0.012, 0.03, raw);

  float slopeX = at(vUv + vec2(uTexel.x, 0.0)) - at(vUv - vec2(uTexel.x, 0.0));
  float slopeZ = at(vUv + vec2(0.0, uTexel.y)) - at(vUv - vec2(0.0, uTexel.y));
  vec3 normal = normalize(vec3(-slopeX * 26.0, 1.0, -slopeZ * 26.0));
  float lit = dot(normal, SUN);

  vec3 shade = vec3(0.640, 0.735, 0.835);
  vec3 bright = vec3(0.998, 0.999, 1.000);
  vec3 colour = mix(shade, bright, smoothstep(0.12, 0.84, lit));
  colour = mix(colour, colour * vec3(0.90, 0.94, 0.985), smoothstep(0.1, 0.9, sqrt(vHeight)));
  // A view may dry the land, for a drought: pale sand, more so on the lower ground.
  colour = mix(colour, colour * vec3(1.0, 0.915, 0.79), uDry * (0.42 + 0.3 * (1.0 - sqrt(vHeight))));

  // Contours in metres, every fifth one heavier, the way a survey map draws them.
  float metres = uBase + at(vUv) * uMeters;
  float level = metres / uContour;
  float width = fwidth(level);
  float line = 1.0 - smoothstep(0.0, 1.2, abs(fract(level - 0.5) - 0.5) / max(width, 1e-4));
  float major = metres / (uContour * 5.0);
  float widthMajor = fwidth(major);
  float heavy = 1.0 - smoothstep(0.0, 1.6, abs(fract(major - 0.5) - 0.5) / max(widthMajor, 1e-4));
  float crowded = smoothstep(0.30, 0.10, width);
  float crowdedMajor = smoothstep(0.34, 0.12, widthMajor);
  colour = mix(colour, vec3(0.170, 0.420, 0.660), max(line * 0.16 * crowded, heavy * 0.30 * crowdedMajor) * uRise);

  // Sea: flat, with slow swells of lighter water.
  float swell = sin(vUv.x * 90.0 + vUv.y * 34.0 + uTime * 0.7) * sin(vUv.y * 120.0 - uTime * 0.5);
  vec3 sea = mix(vec3(0.250, 0.530, 0.780), vec3(0.380, 0.640, 0.860), 0.5 + 0.25 * swell);
  outColor = vec4(mix(sea, colour, land), 1.0);
}`,ne=`#version 300 es
precision highp float;
layout(location = 0) in vec3 aWall;
uniform mat4 uCamera;
out float vLevel;
${V}
void main() {
  vec3 p = placeAt(aWall.xy);
  p.y = mix(p.y, -0.13, aWall.z);
  vLevel = p.y;
  gl_Position = uCamera * vec4(p, 1.0);
}`,ue=`#version 300 es
precision highp float;
in float vLevel;
out vec4 outColor;
void main() {
  // Level bands, as in a geological section: ground, water table, bedrock.
  vec3 ground = vec3(0.835, 0.895, 0.950);
  vec3 water = vec3(0.330, 0.570, 0.790);
  vec3 rock = vec3(0.075, 0.270, 0.470);
  float colour1 = smoothstep(-0.018, -0.052, vLevel);
  float colour2 = smoothstep(-0.066, -0.118, vLevel);
  outColor = vec4(mix(mix(ground, water, colour1), rock, colour2), 1.0);
}`,se=`#version 300 es
precision highp float;
layout(location = 0) in vec3 aStart;
layout(location = 1) in vec3 aEnd;
layout(location = 2) in float aGrade;
uniform mat4 uCamera;
uniform vec4 uBounds;
uniform vec2 uCanvas;
uniform float uThickness;
uniform float uDry;
out float vKm;
out float vEdge;
out float vHalf;
out float vGrade;
${V}
vec2 uvOf(vec2 lonLat) {
  return vec2((lonLat.x - uBounds.x) / (uBounds.z - uBounds.x), (uBounds.w - lonLat.y) / (uBounds.w - uBounds.y));
}
void main() {
  float end = float(gl_VertexID & 1);
  float side = float((gl_VertexID >> 1) & 1) * 2.0 - 1.0;
  vec4 a = uCamera * vec4(placeAt(uvOf(aStart.xy)) + vec3(0.0, 0.003, 0.0), 1.0);
  vec4 b = uCamera * vec4(placeAt(uvOf(aEnd.xy)) + vec3(0.0, 0.003, 0.0), 1.0);
  vec2 pa = a.xy / a.w;
  vec2 pb = b.xy / b.w;
  vec2 line = (pb - pa) * uCanvas;
  float size = length(line);
  vec2 across = size > 1e-4 ? vec2(-line.y, line.x) / size : vec2(0.0, 1.0);

  vHalf = (0.5 + 1.7 * aGrade * aGrade * aGrade + 0.4 * aGrade) * uThickness * 0.5 * (1.0 - 0.45 * uDry);
  vEdge = side * (vHalf + 1.0);
  vKm = mix(aStart.z, aEnd.z, end);
  vGrade = aGrade;
  vec4 here = mix(a, b, end);
  gl_Position = vec4(here.xy + across * vEdge * 2.0 / uCanvas * here.w, here.z - 0.0012 * here.w, here.w);
}`,le=`#version 300 es
precision highp float;
in float vKm;
in float vEdge;
in float vHalf;
in float vGrade;
out vec4 outColor;
uniform float uTime;
uniform float uFlow;
uniform float uWave;
uniform float uRise;
uniform float uDry;
uniform float uBoost;
void main() {
  float cover = clamp(vHalf + 0.5 - abs(vEdge), 0.0, 1.0);
  // Streams dry from the smallest up; reaches above half the largest flow keep running.
  float dry = min(uDry, 1.0) * 0.5;
  float running = smoothstep(dry - 0.06, dry + 0.02, vGrade) + step(uDry, 0.001);
  // Pulses of light water travel down every channel. Distance is counted from the mouth, so a
  // falling distance is a pulse moving downstream; larger rivers carry brighter ones.
  float wave = fract(vKm / uWave + uTime * uFlow);
  float crest = smoothstep(0.0, 0.05, wave) * smoothstep(0.34, 0.05, wave);
  vec3 colour = mix(vec3(0.075, 0.345, 0.630), vec3(0.560, 0.850, 1.000), min(1.0, crest * (0.6 + 0.4 * vGrade) * (1.0 + 1.6 * uBoost)));
  colour = mix(colour, vec3(0.600, 0.880, 1.000), uBoost * 0.35);
  outColor = vec4(colour, 1.0) * cover * uRise * min(vHalf * 2.0, 1.0) * min(running, 1.0);
}`;function ce(t,i,n,r){let s=1/Math.tan(t/2);return[s/i,0,0,0,0,s,0,0,0,0,(r+n)/(n-r),-1,0,0,2*r*n/(n-r),0]}function fe([t,i,n],[r,s,h]){let a=t-r,l=i-s,c=n-h,m=Math.hypot(a,l,c);a/=m,l/=m,c/=m;let y=c,d=0,w=-a,e=Math.hypot(y,d,w);y/=e,w/=e;let T=l*w-c*d,M=c*y-a*w,B=a*d-l*y;return[y,T,a,0,d,M,l,0,w,B,c,0,-(y*t+w*n),-(T*t+M*i+B*n),-(a*t+l*i+c*n),1]}function ve(t,i){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let s=0;s<4;s+=1)n[r*4+s]=t[s]*i[r*4]+t[s+4]*i[r*4+1]+t[s+8]*i[r*4+2]+t[s+12]*i[r*4+3];return n}function he(t,i,n){let r=new Float32Array((i+1)*(n+1)*2),s=0;for(let l=0;l<=n;l+=1)for(let c=0;c<=i;c+=1)r[s++]=c/i,r[s++]=l/n;let h=new Uint32Array(i*n*6);s=0;for(let l=0;l<n;l+=1)for(let c=0;c<i;c+=1){let m=l*(i+1)+c,y=m+1,d=m+i+1,w=d+1;h.set([m,d,y,y,d,w],s),s+=6}let a=t.createVertexArray();return t.bindVertexArray(a),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,r,t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ELEMENT_ARRAY_BUFFER,h,t.STATIC_DRAW),t.bindVertexArray(null),{vao:a,count:h.length}}function me(t,i,n){let r=[];for(let a=0;a<=i;a+=1)r.push([a/i,1]);for(let a=n-1;a>=0;a-=1)r.push([1,a/n]);for(let a=i-1;a>=0;a-=1)r.push([a/i,0]);for(let a=1;a<=n;a+=1)r.push([0,a/n]);let s=new Float32Array(r.length*2*3);r.forEach(([a,l],c)=>{s.set([a,l,0,a,l,1],c*6)});let h=t.createVertexArray();return t.bindVertexArray(h),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,3,t.FLOAT,!1,0,0),t.bindVertexArray(null),{vao:h,count:r.length*2}}var E=Math.PI/180;async function xe(t,{scene:i,base:n="/earth",yaw:r=-24,pitch:s=32,distance:h=3.5,aim:a=-.03,contour:l=200,swing:c=7,reduceMotion:m=!1,flow:y=.42,extra:d,onFrame:w}){let e=Y(t,{depth:!0});if(!e)return null;let[T,M]=await Promise.all([O(e,`${n}/${i}.webp`),k(`${n}/${i}.bin`)]),{reaches:B,count:q,header:Z}=j(M,6),[L,U,D,G,H,P]=Z,I=T.height/T.width,Q=(D-L)*111.2*Math.cos((U+G)/2*E)/7,A=_(e,re,ie),S=_(e,ne,ue),p=_(e,se,le),N=340,z=Math.round(N*I),C=he(e,N,z),W=me(e,N,z),J=X(e,B),o={yaw:r*E,pitch:s*E,baseYaw:r*E,aimYaw:0,aimPitch:0,time:0,rise:m?1:0,started:0,width:1,height:1,cssWidth:1,cssHeight:1,aspect:1,camera:new Float32Array(16),flow:y,dry:0,boost:0,paused:!1};e.enable(e.DEPTH_TEST),e.clearColor(0,0,0,0);let x={gl:e,state:o,depth:I,bounds:{lon0:L,lat0:U,lon1:D,lat1:G,hMin:H,hMax:P},sample:null,project(u,f,R){let v=o.camera,g=v[3]*u+v[7]*f+v[11]*R+v[15];return{x:((v[0]*u+v[4]*f+v[8]*R+v[12])/g+1)/2*o.cssWidth,y:(1-(v[1]*u+v[5]*f+v[9]*R+v[13])/g)/2*o.cssHeight}},heights(u){e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,T.texture),e.uniform1i(u.u.uHeight,0),e.uniform1f(u.u.uRise,o.rise),e.uniform1f(u.u.uDepth,I)},ground(u){x.heights(u),e.uniformMatrix4fv(u.u.uCamera,!1,o.camera),e.depthFunc(e.LEQUAL),e.depthMask(!1),e.bindVertexArray(C.vao),e.drawElements(e.TRIANGLES,C.count,e.UNSIGNED_INT,0),e.depthMask(!0),e.depthFunc(e.LESS)}},F=K(t,{draw:(u,f)=>{if(o.started||(o.started=u),F.running&&(o.time+=f/1e3),!m){let oe=b((u-o.started)/1700,0,1);o.rise=$(oe)}let v=m?0:Math.sin(o.time*.13)*3*E,g=1-Math.exp(-f/240);o.yaw+=(o.baseYaw+v+o.aimYaw*c*E-o.yaw)*g,o.pitch+=(s*E+o.aimPitch*2.2*E-o.pitch)*g;let ee=[Math.sin(o.yaw)*Math.cos(o.pitch)*h,Math.sin(o.pitch)*h,Math.cos(o.yaw)*Math.cos(o.pitch)*h],te=2*Math.atan(Math.tan(13.5*E)*Math.max(1,1.5/o.aspect));return o.camera=ve(ce(te,o.aspect,.1,20),fe(ee,[0,a,0])),d?.(x,u,f,"before"),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.useProgram(S.handle),x.heights(S),e.uniformMatrix4fv(S.u.uCamera,!1,o.camera),e.bindVertexArray(W.vao),e.drawArrays(e.TRIANGLE_STRIP,0,W.count),e.useProgram(A.handle),x.heights(A),e.uniformMatrix4fv(A.u.uCamera,!1,o.camera),e.uniform2f(A.u.uTexel,3/T.width,3/T.height),e.uniform1f(A.u.uMeters,P-H),e.uniform1f(A.u.uBase,H),e.uniform1f(A.u.uContour,l),e.uniform1f(A.u.uTime,o.time),e.uniform1f(A.u.uDry,o.dry),e.bindVertexArray(C.vao),e.drawElements(e.TRIANGLES,C.count,e.UNSIGNED_INT,0),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.useProgram(p.handle),x.heights(p),e.uniformMatrix4fv(p.u.uCamera,!1,o.camera),e.uniform4f(p.u.uBounds,L,U,D,G),e.uniform2f(p.u.uCanvas,o.width/2,o.height/2),e.uniform1f(p.u.uThickness,b(o.height/620,.8,2.4)),e.uniform1f(p.u.uTime,o.time),e.uniform1f(p.u.uFlow,o.flow),e.uniform1f(p.u.uWave,Q),e.uniform1f(p.u.uDry,o.dry),e.uniform1f(p.u.uBoost,o.boost),d?.(x,u,f,"ground"),e.useProgram(p.handle),e.bindVertexArray(J),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,q),d?.(x,u,f,"air"),e.disable(e.BLEND),e.bindVertexArray(null),w?.(x),!0},resize:(u,f,R,v)=>{Object.assign(o,{width:u,height:f,cssWidth:R,cssHeight:v,aspect:u/f}),e.viewport(0,0,u,f)}});return x.loop=F,m||(t.parentElement.addEventListener("pointermove",u=>{let f=t.getBoundingClientRect();o.aimYaw=b((u.clientX-f.left)/f.width-.5,-.5,.5)*2,o.aimPitch=b((u.clientY-f.top)/f.height-.5,-.5,.5)*2}),t.parentElement.addEventListener("pointerleave",()=>{o.aimYaw=0,o.aimPitch=0})),x.pause=u=>{o.paused=u,u?F.stop():F.start()},x}export{ae as a,V as b,xe as c};
