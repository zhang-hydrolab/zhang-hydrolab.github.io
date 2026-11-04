import{a as d,b as m,d as x,h as w,i as p,l as g}from"./chunk-5S4CCUR3.js";var y=`#version 300 es
out vec2 vUv;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`,E=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uRelief;
uniform vec2 uTexel;
uniform vec4 uView;   // centre longitude, centre latitude, width and height in degrees
uniform float uPhase;
out vec4 outColor;

float at(vec2 uv) {
  return textureLod(uRelief, uv, 1.6).r;
}

float relief(vec2 uv) {
  // A coarse level and a cross of samples: the lines generalise the relief, as a small-scale
  // map does, instead of tracing every ridge behind the figures.
  vec2 dx = vec2(uTexel.x * 2.5, 0.0);
  vec2 dy = vec2(0.0, uTexel.y * 2.5);
  return (at(uv) * 2.0 + at(uv + dx) + at(uv - dx) + at(uv + dy) + at(uv - dy)) / 6.0;
}

float line(float value, float width) {
  float f = fract(value);
  float d = min(f, 1.0 - f) / max(fwidth(value), 1e-4);
  return 1.0 - smoothstep(width * 0.5, width * 0.5 + 1.0, d);
}

void main() {
  float lon = uView.x + (vUv.x - 0.5) * uView.z;
  float lat = uView.y + (vUv.y - 0.5) * uView.w;
  float h = relief(vec2(fract((lon + 180.0) / 360.0), (90.0 - lat) / 180.0));

  float land = smoothstep(0.37, 0.40, h);
  float rise = clamp((h - 0.46) / 0.54, 0.0, 1.0);
  float shore = clamp(h / 0.30, 0.0, 1.0);

  float a = 0.0;
  a += land * line(rise * 7.0, 0.9) * (0.24 + 0.22 * rise);               // elevation
  a += (1.0 - land) * line(shore * 9.0 + uPhase, 0.8) * shore * 0.30;     // offshore, moving out
  a = max(a, line(h - 0.38, 1.4) * 0.55); // the coast, the only whole number in reach

  // Rest the lines towards the sides, and keep them quiet behind the figures.
  a *= smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  a *= 0.55 + 0.45 * smoothstep(0.15, 0.85, vUv.y);
  vec3 ink = mix(vec3(0.44, 0.66, 0.87), vec3(0.20, 0.47, 0.76), rise);
  outColor = vec4(ink * a, a);
}`,T=[105,37],U=.5,b=.07;function P(a,{reduceMotion:v}){let f=new IntersectionObserver(([e])=>{e.isIntersecting&&(f.disconnect(),a.classList.add("is-shown"))});f.observe(a);let h=a.querySelector("canvas");p(a,async()=>{let e=d(h);if(!e)return;let o;try{o=await x(e,"/earth/relief.webp",{repeat:!0})}catch(t){console.warn("Contours not available:",t.message);return}let r=m(e,y,E);e.useProgram(r.handle),e.bindVertexArray(e.createVertexArray()),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,o.texture),e.uniform1i(r.u.uRelief,0),e.uniform2f(r.u.uTexel,1/o.width,1/o.height),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE_MINUS_SRC_ALPHA),e.clearColor(0,0,0,0);let s=1,l=0,c=!1,n=g(h,{maxScale:1.5,resize(t,u,i,R){e.viewport(0,0,t,u),s=i/Math.max(R,1)},draw(t,u){c||(l+=u/1e3);let i=Math.min(300,44*s);e.uniform4f(r.u.uView,T[0]+l*U,T[1],i,i/s),e.uniform1f(r.u.uPhase,l*b),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLE_STRIP,0,4)}});if(v){n.once();return}n.start(),w(a,{pause(t){c=t,c?n.stop():n.start()}},v)})}export{P as default};
