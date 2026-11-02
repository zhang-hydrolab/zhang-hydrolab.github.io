import{a as O,b as M,c as j,d as W,e as k,f as X,i as $,j as b,k as K}from"./chunk-7HGTF7VO.js";var te=.25,G=`
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
  return vec3(uv.x * 2.0 - 1.0, heightAt(uv) * ${te.toFixed(2)} * uRise, (uv.y * 2.0 - 1.0) * uDepth);
}`,oe=`#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
uniform mat4 uCamera;
out vec2 vUv;
out float vHeight;
${G}
void main() {
  vUv = aGrid;
  vec3 p = placeAt(aGrid);
  vHeight = heightAt(aGrid);
  gl_Position = uCamera * vec4(p, 1.0);
}`,ae=`#version 300 es
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
}`,re=`#version 300 es
precision highp float;
layout(location = 0) in vec3 aWall;
uniform mat4 uCamera;
out float vLevel;
${G}
void main() {
  vec3 p = placeAt(aWall.xy);
  p.y = mix(p.y, -0.13, aWall.z);
  vLevel = p.y;
  gl_Position = uCamera * vec4(p, 1.0);
}`,ie=`#version 300 es
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
}`,ne=`#version 300 es
precision highp float;
layout(location = 0) in vec3 aStart;
layout(location = 1) in vec3 aEnd;
layout(location = 2) in float aGrade;
uniform mat4 uCamera;
uniform vec4 uBounds;
uniform vec2 uCanvas;
uniform float uThickness;
out float vKm;
out float vEdge;
out float vHalf;
out float vGrade;
${G}
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

  vHalf = (0.5 + 1.7 * aGrade * aGrade * aGrade + 0.4 * aGrade) * uThickness * 0.5;
  vEdge = side * (vHalf + 1.0);
  vKm = mix(aStart.z, aEnd.z, end);
  vGrade = aGrade;
  vec4 here = mix(a, b, end);
  gl_Position = vec4(here.xy + across * vEdge * 2.0 / uCanvas * here.w, here.z - 0.0012 * here.w, here.w);
}`,se=`#version 300 es
precision highp float;
in float vKm;
in float vEdge;
in float vHalf;
in float vGrade;
out vec4 outColor;
uniform float uTime;
uniform float uFlow;
uniform float uRise;
void main() {
  float cover = clamp(vHalf + 0.5 - abs(vEdge), 0.0, 1.0);
  float wave = fract(vKm / 260.0 + uTime * uFlow);
  float crest = smoothstep(0.0, 0.06, wave) * smoothstep(0.42, 0.06, wave);
  vec3 colour = mix(vec3(0.085, 0.370, 0.650), vec3(0.000, 0.640, 0.980), crest);
  outColor = vec4(colour, 1.0) * cover * uRise * min(vHalf * 2.0, 1.0);
}`;function ue(t,i,n,r){let s=1/Math.tan(t/2);return[s/i,0,0,0,0,s,0,0,0,0,(r+n)/(n-r),-1,0,0,2*r*n/(n-r),0]}function ce([t,i,n],[r,s,h]){let a=t-r,l=i-s,u=n-h,p=Math.hypot(a,l,u);a/=p,l/=p,u/=p;let m=u,d=0,e=-a,x=Math.hypot(m,d,e);m/=x,e/=x;let g=l*e-u*d,C=u*m-a*e,_=a*d-l*m;return[m,g,a,0,d,C,l,0,e,_,u,0,-(m*t+e*n),-(g*t+C*i+_*n),-(a*t+l*i+u*n),1]}function le(t,i){let n=new Float32Array(16);for(let r=0;r<4;r+=1)for(let s=0;s<4;s+=1)n[r*4+s]=t[s]*i[r*4]+t[s+4]*i[r*4+1]+t[s+8]*i[r*4+2]+t[s+12]*i[r*4+3];return n}function ve(t,i,n){let r=new Float32Array((i+1)*(n+1)*2),s=0;for(let l=0;l<=n;l+=1)for(let u=0;u<=i;u+=1)r[s++]=u/i,r[s++]=l/n;let h=new Uint32Array(i*n*6);s=0;for(let l=0;l<n;l+=1)for(let u=0;u<i;u+=1){let p=l*(i+1)+u,m=p+1,d=p+i+1,e=d+1;h.set([p,d,m,m,d,e],s),s+=6}let a=t.createVertexArray();return t.bindVertexArray(a),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,r,t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ELEMENT_ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ELEMENT_ARRAY_BUFFER,h,t.STATIC_DRAW),t.bindVertexArray(null),{vao:a,count:h.length}}function fe(t,i,n){let r=[];for(let a=0;a<=i;a+=1)r.push([a/i,1]);for(let a=n-1;a>=0;a-=1)r.push([1,a/n]);for(let a=i-1;a>=0;a-=1)r.push([a/i,0]);for(let a=1;a<=n;a+=1)r.push([0,a/n]);let s=new Float32Array(r.length*2*3);r.forEach(([a,l],u)=>{s.set([a,l,0,a,l,1],u*6)});let h=t.createVertexArray();return t.bindVertexArray(h),t.bindBuffer(t.ARRAY_BUFFER,t.createBuffer()),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.enableVertexAttribArray(0),t.vertexAttribPointer(0,3,t.FLOAT,!1,0,0),t.bindVertexArray(null),{vao:h,count:r.length*2}}var E=Math.PI/180;async function pe(t,{scene:i,base:n="/earth",yaw:r=-24,pitch:s=32,distance:h=3.5,contour:a=200,swing:l=7,reduceMotion:u=!1,flow:p=.32,extra:m,onFrame:d}){let e=O(t,{depth:!0});if(!e)return null;let[x,g]=await Promise.all([W(e,`${n}/${i}.webp`),j(`${n}/${i}.bin`)]),{reaches:C,count:_,header:q}=k(g,6),[I,V,D,N,B,P]=q,L=x.height/x.width,A=M(e,oe,ae),U=M(e,re,ie),w=M(e,ne,se),H=340,S=Math.round(H*L),z=ve(e,H,S),Y=fe(e,H,S),Z=X(e,C),o={yaw:r*E,pitch:s*E,baseYaw:r*E,aimYaw:0,aimPitch:0,time:0,rise:u?1:0,started:0,width:1,height:1,cssWidth:1,cssHeight:1,aspect:1,camera:new Float32Array(16),flow:p,paused:!1};e.enable(e.DEPTH_TEST),e.clearColor(0,0,0,0);let y={gl:e,state:o,depth:L,bounds:{lon0:I,lat0:V,lon1:D,lat1:N,hMin:B,hMax:P},sample:null,project(c,v,T){let f=o.camera,R=f[3]*c+f[7]*v+f[11]*T+f[15];return{x:((f[0]*c+f[4]*v+f[8]*T+f[12])/R+1)/2*o.cssWidth,y:(1-(f[1]*c+f[5]*v+f[9]*T+f[13])/R)/2*o.cssHeight}},heights(c){e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,x.texture),e.uniform1i(c.u.uHeight,0),e.uniform1f(c.u.uRise,o.rise),e.uniform1f(c.u.uDepth,L)}},F=K(t,{draw:(c,v)=>{if(o.started||(o.started=c),F.running&&(o.time+=v/1e3),!u){let ee=b((c-o.started)/1700,0,1);o.rise=$(ee)}let f=u?0:Math.sin(o.time*.13)*3*E,R=1-Math.exp(-v/240);o.yaw+=(o.baseYaw+f+o.aimYaw*l*E-o.yaw)*R,o.pitch+=(s*E+o.aimPitch*2.2*E-o.pitch)*R;let J=[Math.sin(o.yaw)*Math.cos(o.pitch)*h,Math.sin(o.pitch)*h,Math.cos(o.yaw)*Math.cos(o.pitch)*h],Q=2*Math.atan(Math.tan(13.5*E)*Math.max(1,1.5/o.aspect));return o.camera=le(ue(Q,o.aspect,.1,20),ce(J,[0,-.03,0])),e.clear(e.COLOR_BUFFER_BIT|e.DEPTH_BUFFER_BIT),e.useProgram(U.handle),y.heights(U),e.uniformMatrix4fv(U.u.uCamera,!1,o.camera),e.bindVertexArray(Y.vao),e.drawArrays(e.TRIANGLE_STRIP,0,Y.count),e.useProgram(A.handle),y.heights(A),e.uniformMatrix4fv(A.u.uCamera,!1,o.camera),e.uniform2f(A.u.uTexel,3/x.width,3/x.height),e.uniform1f(A.u.uMeters,P-B),e.uniform1f(A.u.uBase,B),e.uniform1f(A.u.uContour,a),e.uniform1f(A.u.uTime,o.time),e.bindVertexArray(z.vao),e.drawElements(e.TRIANGLES,z.count,e.UNSIGNED_INT,0),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.useProgram(w.handle),y.heights(w),e.uniformMatrix4fv(w.u.uCamera,!1,o.camera),e.uniform4f(w.u.uBounds,I,V,D,N),e.uniform2f(w.u.uCanvas,o.width/2,o.height/2),e.uniform1f(w.u.uThickness,b(o.height/620,.8,2.4)),e.uniform1f(w.u.uTime,o.time),e.uniform1f(w.u.uFlow,o.flow),e.bindVertexArray(Z),e.drawArraysInstanced(e.TRIANGLE_STRIP,0,4,_),m?.(y,c,v),e.disable(e.BLEND),e.bindVertexArray(null),d?.(y),!0},resize:(c,v,T,f)=>{Object.assign(o,{width:c,height:v,cssWidth:T,cssHeight:f,aspect:c/v}),e.viewport(0,0,c,v)}});return y.loop=F,u||(t.parentElement.addEventListener("pointermove",c=>{let v=t.getBoundingClientRect();o.aimYaw=b((c.clientX-v.left)/v.width-.5,-.5,.5)*2,o.aimPitch=b((c.clientY-v.top)/v.height-.5,-.5,.5)*2}),t.parentElement.addEventListener("pointerleave",()=>{o.aimYaw=0,o.aimPitch=0})),y.pause=c=>{o.paused=c,c?F.stop():F.start()},y}export{G as a,pe as b};
