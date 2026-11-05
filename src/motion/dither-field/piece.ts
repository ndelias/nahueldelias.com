// M03, the dither field. A fragment shader draws domain-warped noise (fbm
// fed through itself) and dithers it to two colors with an 8×8 Bayer
// matrix. The canvas has one pixel per 3px cell and is scaled up with
// pixelated rendering, so the GPU shades a ninth of the pixels and the cells
// stay crisp at any density. The colors are read from the stage (its ink
// and its surface) and re-read when the theme changes. The pointer pushes
// the field outward; where it is and how hard it pushes both ride springs,
// so the push eases in, follows, and lets go. Runs only while on screen.
// Reduced motion: one still frame, no push.

import { define } from '../runtime';
import { Spring, loop } from '../spring';

const CELL = 3; // CSS px per dither cell

const VERTEX = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FRAGMENT = `
precision highp float;
uniform vec2 uPtr;
uniform float uTime, uPush;
uniform vec3 uInk, uPaper;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1. + 2. * fract(sin(p) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(dot(hash(i), f), dot(hash(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash(i + vec2(1)), f - vec2(1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; }
  return v;
}
float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
float bayer4(vec2 a) { return bayer2(.5 * a) * .25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(.5 * a) * .25 + bayer2(a); }

void main() {
  vec2 cell = gl_FragCoord.xy;
  vec2 d = cell - uPtr;
  float fall = exp(-dot(d, d) / 1800.);
  vec2 p = cell / 130. + normalize(d + 1e-4) * fall * uPush * .5;
  float t = uTime * .05;
  vec2 q = vec2(fbm(p + vec2(0., t)), fbm(p + vec2(5.2, 1.3) - t));
  float v = smoothstep(-.1, .5, fbm(p + 1.8 * q + vec2(t * .5, -t * .3)));
  // At most 60% of cells inked, so the field reads as tone, not static; the
  // half-step offset leaves the lightest areas truly empty.
  gl_FragColor = vec4(mix(uPaper, uInk, step(bayer8(cell) + .5 / 64., v * .6)), 1.);
}`;

// Any CSS color → [r, g, b] in 0–1, through a 1×1 canvas.
const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
const rgb = (css: string) => {
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = css;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255] as const;
};

define('dither-field', (stage, { reduce }) => {
  const canvas = stage.querySelector<HTMLCanvasElement>('[data-field]')!;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return; // the halftone stays

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  // One triangle that covers the viewport.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl.getUniformLocation(program, name);
  const [uPtr, uTime, uPush, uInk, uPaper] = ['uPtr', 'uTime', 'uPush', 'uInk', 'uPaper'].map(u);

  const colors = () => {
    const cs = getComputedStyle(stage);
    gl.uniform3fv(uInk, rgb(cs.color));
    gl.uniform3fv(uPaper, rgb(cs.backgroundColor));
  };

  let time = 20; // a settled-looking moment to start from
  const px = new Spring(0, 60);
  const py = new Spring(0, 60);
  const push = new Spring(0, 40);
  const render = () => {
    gl.uniform1f(uTime, time);
    gl.uniform2f(uPtr, px.value, py.value);
    gl.uniform1f(uPush, push.value);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  new ResizeObserver(() => {
    canvas.width = Math.ceil(stage.clientWidth / CELL);
    canvas.height = Math.ceil(stage.clientHeight / CELL);
    gl.viewport(0, 0, canvas.width, canvas.height);
    render();
  }).observe(stage);
  new MutationObserver(() => {
    colors();
    render();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  colors();

  if (reduce) {
    render();
    return;
  }

  let running = false;
  const anim = loop((dt) => {
    time += dt;
    px.step(dt);
    py.step(dt);
    push.step(dt);
    render();
    return running;
  });

  // Pointer in cells, y up (gl_FragCoord's origin is bottom left).
  let rest = 0;
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / CELL;
    const y = (r.bottom - e.clientY) / CELL;
    if (push.value < 0.02) {
      // Arrive where the pointer is rather than sweeping in from the last spot.
      px.value = px.target = x;
      py.value = py.target = y;
    }
    px.target = x;
    py.target = y;
    push.target = 1;
    clearTimeout(rest);
    rest = window.setTimeout(() => (push.target = 0), 700);
  });
  stage.addEventListener('pointerleave', () => (push.target = 0));

  return {
    play() {
      running = true;
      anim.start();
    },
    pause() {
      running = false;
      anim.stop();
    },
  };
});
