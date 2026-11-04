import{a as g,b as w,d as u,h as b,i as E,l as P}from"./chunk-5S4CCUR3.js";var L=`#version 300 es
out vec2 vXY;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vXY = corner * 2.0 - 1.0;
  gl_Position = vec4(vXY, 0.0, 1.0);
}`,M=`#version 300 es
precision highp float;
in vec2 vXY;
uniform sampler2D uMonths;
uniform sampler2D uRelief;
uniform float uMonth;
uniform float uYaw;
uniform float uTilt;
uniform float uPixel;
out vec4 outColor;

const float PI = 3.14159265;
const vec3 SUN = normalize(vec3(-0.45, 0.5, 0.75));

float month(vec2 lonLat, float m) {
  float index = mod(m, 12.0);
  vec2 tile = vec2(mod(index, 4.0), floor(index / 4.0));
  vec2 inner = clamp(lonLat, vec2(0.5 / 720.0, 0.5 / 360.0), vec2(1.0 - 0.5 / 720.0, 1.0 - 0.5 / 360.0));
  // Level 0 throughout: mipmaps would bleed between tiles and draw a seam at the date line.
  return textureLod(uMonths, (tile + inner) / vec2(4.0, 3.0), 0.0).r;
}

vec3 ramp(float v) {
  vec3 a = vec3(0.955, 0.972, 0.986);
  vec3 b = vec3(0.640, 0.800, 0.925);
  vec3 c = vec3(0.250, 0.530, 0.790);
  vec3 d = vec3(0.040, 0.250, 0.470);
  return v < 0.33 ? mix(a, b, v / 0.33) : v < 0.66 ? mix(b, c, (v - 0.33) / 0.33) : mix(c, d, (v - 0.66) / 0.34);
}

void main() {
  float r = length(vXY);
  float edge = 1.0 - smoothstep(1.0 - uPixel * 1.5, 1.0, r);
  if (edge <= 0.0) {
    outColor = vec4(0.0);
    return;
  }
  vec3 p = vec3(vXY, sqrt(max(0.0, 1.0 - r * r)));
  float light = 0.86 + 0.14 * max(dot(p, SUN), 0.0);

  // Tilt towards the viewer, then turn about the pole.
  float ct = cos(uTilt), st = sin(uTilt);
  vec3 q = vec3(p.x, p.y * ct + p.z * st, -p.y * st + p.z * ct);
  float lat = asin(clamp(q.y, -1.0, 1.0));
  float lon = atan(q.x, q.z) + uYaw;
  vec2 uv = vec2(fract(lon / (2.0 * PI) + 0.5), 0.5 - lat / PI);

  float relief = textureLod(uRelief, uv, 0.0).r;
  float land = smoothstep(0.36, 0.42, relief);
  float m = floor(uMonth);
  float et = mix(month(uv, m), month(uv, m + 1.0), smoothstep(0.0, 1.0, fract(uMonth)));

  vec3 sea = mix(vec3(0.930, 0.960, 0.988), vec3(0.860, 0.918, 0.970), clamp(relief / 0.30, 0.0, 1.0));
  vec3 ground = ramp(clamp(et, 0.0, 1.0));
  // The ice sheets and deserts have little or no ET; a touch of relief keeps them readable.
  ground *= 0.94 + 0.06 * clamp((relief - 0.46) / 0.54, 0.0, 1.0);
  vec3 colour = mix(sea, ground, land) * light;
  // A fine rim, the way a printed globe is outlined.
  colour = mix(colour, vec3(0.55, 0.70, 0.85), smoothstep(1.0 - uPixel * 4.0, 1.0 - uPixel, r) * 0.6);
  outColor = vec4(colour, 1.0) * edge;
}`,C=-.08,I=.75,s={month:6,yaw:2};function S(r,{reduceMotion:m}){let v=r.querySelector("canvas"),y=r.querySelector("[data-etg-month]"),R=JSON.parse(r.querySelector("#etg-months").textContent),X=()=>document.documentElement.dataset.lang==="zh",n=-1,f=e=>{n=e,y.textContent=R[e][X()?1:0]};addEventListener("lab:lang",()=>f(n<0?s.month:n)),E(r,async()=>{let e=g(v);if(!e)return;let d,h;try{[d,h]=await Promise.all([u(e,"/earth/et-months.webp"),u(e,"/earth/relief.webp",{repeat:!0})])}catch(o){console.warn("Globe not available:",o.message);return}let t=w(e,L,M);e.useProgram(t.handle),e.bindVertexArray(e.createVertexArray()),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,d.texture),e.uniform1i(t.u.uMonths,0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,h.texture),e.uniform1i(t.u.uRelief,1),e.uniform1f(t.u.uTilt,.36),e.clearColor(0,0,0,0);let c=0,i=!1,p=1,a=P(v,{resize(o,l){e.viewport(0,0,o,l),p=Math.min(o,l)},draw(o,l){!i&&a.running&&(c+=l/1e3);let x=s.month+c*I;e.uniform1f(t.u.uMonth,x%12),e.uniform1f(t.u.uYaw,s.yaw+c*C),e.uniform1f(t.u.uPixel,2/p),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLE_STRIP,0,4);let T=Math.floor(x+.5)%12;T!==n&&f(T)}});if(r.classList.add("is-live"),m){a.once();return}a.start(),b(r,{pause(o){i=o,i?a.stop():a.start()}},m)})}export{S as default};
