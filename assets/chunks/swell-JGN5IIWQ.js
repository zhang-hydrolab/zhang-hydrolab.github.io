import{a as u,b as g,h as w}from"./chunk-7HGTF7VO.js";var r=180,p=38,x=`#version 300 es
precision highp float;
uniform float uPhase;
uniform float uAspect;
out float vFade;
void main() {
  float column = mod(float(gl_VertexID), ${r}.0);
  float row = floor(float(gl_VertexID) / ${r}.0);
  float x = column / ${r-1}.0 * 2.0 - 1.0;
  float far = row / ${p-1}.0;
  float depth = 0.2 + far * far * 2.4;
  float eye = 1.0 + depth;
  float ground = x * eye * uAspect;
  float swell = sin(ground * 2.1 + depth * 5.0 + uPhase)
    + 0.55 * sin(ground * 4.3 - depth * 7.0 + uPhase * 1.4)
    + 0.28 * sin(ground * 9.0 + depth * 11.0 - uPhase * 0.8);
  gl_Position = vec4(x, (0.06 * swell - 0.62 + depth * 1.05) / eye - 0.02, 0.0, 1.0);
  vFade = (1.0 - far) * smoothstep(0.0, 0.16, far);
}`,P=`#version 300 es
precision highp float;
in float vFade;
out vec4 outColor;
void main() {
  outColor = vec4(vec3(0.70, 0.86, 1.0), 1.0) * vFade * 0.3;
}`;function R(a,{reduceMotion:m}){let t=a.querySelector("canvas");w(a,()=>{let e=u(t);if(!e)return;let i=g(e,x,P);e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),e.clearColor(0,0,0,0),e.useProgram(i.handle),e.bindVertexArray(e.createVertexArray());let h=window.scrollY*.0035,s=0,v=()=>{s=0;let o=t.getBoundingClientRect(),n=Math.min(window.devicePixelRatio||1,1.5),c=Math.round(o.width*n),d=Math.round(o.height*n);(t.width!==c||t.height!==d)&&(t.width=c,t.height=d,e.viewport(0,0,c,d)),e.uniform1f(i.u.uAspect,o.width/o.height/2),e.uniform1f(i.u.uPhase,h),e.clear(e.COLOR_BUFFER_BIT);for(let f=0;f<p;f+=1)e.drawArrays(e.LINE_STRIP,f*r,r)},l=()=>{s||(s=requestAnimationFrame(v))};m||addEventListener("scroll",()=>{h=window.scrollY*.0035;let{top:o,bottom:n}=a.getBoundingClientRect();n>0&&o<innerHeight&&l()},{passive:!0}),new ResizeObserver(l).observe(t),l()})}export{R as default};
