import{b as f}from"./chunk-4PBLOLVM.js";import{b as s}from"./chunk-5S4CCUR3.js";var c=`#version 300 es
precision highp float;
layout(location = 0) in vec3 aSeed;
uniform mat4 uCamera;
uniform float uTime;
uniform float uRate;
uniform float uUp;
uniform float uSize;
out float vLife;
${f}
void main() {
  float t = fract(aSeed.z + uTime * uRate);
  vec3 ground = placeAt(aSeed.xy);
  float high = 0.52 + aSeed.z * 0.08;
  float y = uUp > 0.5 ? mix(ground.y + 0.01, high, t) : mix(high, ground.y + 0.005, t);
  vLife = sin(t * 3.14159) * uRise;
  gl_Position = uCamera * vec4(ground.x, y, ground.z, 1.0);
  gl_PointSize = uSize;
}`,m=`#version 300 es
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
}`;function v(e,i,n,p){let r=12345,a=()=>(r=r*48271%2147483647,r/2147483647),t=new Float32Array(i*3);for(let o=0;o<i;o+=1)t[o*3]=n+a()*(p-n),t[o*3+1]=.02+a()*.96,t[o*3+2]=a();let u=e.createVertexArray();return e.bindVertexArray(u),e.bindBuffer(e.ARRAY_BUFFER,e.createBuffer()),e.bufferData(e.ARRAY_BUFFER,t,e.STATIC_DRAW),e.enableVertexAttribArray(0),e.vertexAttribPointer(0,3,e.FLOAT,!1,0,0),e.bindVertexArray(null),u}var h=e=>s(e,c,m);export{v as a,h as b};
