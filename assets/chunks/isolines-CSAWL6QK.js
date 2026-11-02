var E=`#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,P=`#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPresence;
uniform vec3 uDrops[6];
uniform vec3 uBase;
uniform vec3 uLine;
uniform vec3 uHot;
out vec4 color;

vec2 grad(vec2 p) {
  float a = fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453) * 6.28318;
  return vec2(cos(a), sin(a));
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(grad(i), f);
  float b = dot(grad(i + vec2(1, 0)), f - vec2(1, 0));
  float c = dot(grad(i + vec2(0, 1)), f - vec2(0, 1));
  float d = dot(grad(i + vec2(1, 1)), f - vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float terrain(vec2 p, float t) {
  vec2 warp = vec2(noise(p + t), noise(p - t + 7.3));
  float h = 0.62 * noise(p * 0.9 + warp * 0.5);
  h += 0.26 * noise(p * 2.0 - warp * 0.4 + t * 0.5);
  return h + 0.42 * p.y * 0.3;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.018;
  float h = terrain(p * 1.35, t);

  float d = length(p - uPointer);
  h += uPresence * 0.13 * exp(-d * d * 7.0);

  for (int i = 0; i < 6; i++) {
    float age = uDrops[i].z;
    if (age < 0.0) continue;
    float r = length(p - uDrops[i].xy);
    float front = age * 0.34;
    h += sin((r - front) * 42.0) * exp(-abs(r - front) * 15.0) * exp(-age * 1.1) * 0.05;
  }

  float n = h * 19.0;
  float w = fwidth(n);
  float minor = abs(fract(n - 0.5) - 0.5) / w;
  float major = abs(fract(n / 5.0 - 0.5) - 0.5) * 5.0 / w;
  float a = max((1.0 - smoothstep(0.35, 1.25, minor)) * 0.26, (1.0 - smoothstep(0.7, 1.7, major)) * 0.7);
  float hot = exp(-d * d * 8.0) * uPresence;
  color = vec4(mix(uBase, mix(uLine, uHot, hot), a), 1.0);
}`,b=t=>[1,3,5].map(c=>parseInt(t.slice(c,c+2),16)/255),A={blue:"#1437f5"};function y(t,c,e){let i=t.createShader(c);if(t.shaderSource(i,e),t.compileShader(i),!t.getShaderParameter(i,t.COMPILE_STATUS))throw new Error(t.getShaderInfoLog(i));return i}function R(t,{reduceMotion:c}){let e=t.getContext("webgl2",{antialias:!1,alpha:!1,powerPreference:"low-power"});if(!e)return;let i=e.createProgram();e.attachShader(i,y(e,e.VERTEX_SHADER,E)),e.attachShader(i,y(e,e.FRAGMENT_SHADER,P)),e.linkProgram(i),e.useProgram(i),e.bindVertexArray(e.createVertexArray());let s=r=>e.getUniformLocation(i,r),f={res:s("uRes"),time:s("uTime"),pointer:s("uPointer"),presence:s("uPresence"),drops:s("uDrops")};e.uniform3fv(s("uBase"),b(A.blue)),e.uniform3fv(s("uLine"),[1,1,1]),e.uniform3fv(s("uHot"),b("#c8f031"));let o={x:0,y:0,tx:0,ty:0,presence:0,want:0},u=Array.from({length:6},()=>({x:0,y:0,born:-1})),p=0,d=!0,l=0,v=()=>{let r=Math.min(devicePixelRatio||1,1.5),n=Math.max(1,Math.round(t.clientWidth*r)),a=Math.max(1,Math.round(t.clientHeight*r));t.width===n&&t.height===a||(t.width=n,t.height=a,e.viewport(0,0,n,a),e.uniform2f(f.res,n,a))},g=r=>{let n=t.getBoundingClientRect();return[(r.clientX-n.left-n.width/2)/n.height,(n.height/2-(r.clientY-n.top))/n.height]},x=r=>{let n=r/1e3;o.x+=(o.tx-o.x)*.08,o.y+=(o.ty-o.y)*.08,o.presence+=(o.want-o.presence)*.05,e.uniform1f(f.time,n),e.uniform2f(f.pointer,o.x,o.y),e.uniform1f(f.presence,o.presence),e.uniform3fv(f.drops,u.flatMap(a=>[a.x,a.y,a.born<0?-1:n-a.born])),e.drawArrays(e.TRIANGLES,0,3)};if(v(),addEventListener("resize",v,{passive:!0}),c){x(4e4);return}let w=r=>{l=d&&!document.hidden?requestAnimationFrame(w):0,x(r)},m=()=>{!l&&d&&!document.hidden&&(l=requestAnimationFrame(w))};new IntersectionObserver(([r])=>{d=r.isIntersecting,m()}).observe(t),document.addEventListener("visibilitychange",m);let h=t.parentElement;h.addEventListener("pointermove",r=>{[o.tx,o.ty]=g(r),o.want=1},{passive:!0}),h.addEventListener("pointerleave",()=>{o.want=0}),h.addEventListener("pointerdown",r=>{if(r.target.closest("a, button"))return;let[n,a]=g(r);u[p]={x:n,y:a,born:performance.now()/1e3},p=(p+1)%u.length}),m()}export{R as default};
