// M03, the dither field. A fragment shader draws domain-warped noise (fbm
// fed through itself) and dithers it to two colors with an 8×8 Bayer
// matrix. The canvas has one pixel per 3px cell and is scaled up with
// pixelated rendering, so the GPU shades a ninth of the pixels and the cells
// stay crisp at any density. The colors are read from the stage (its ink
// and its surface) and re-read when the theme changes. The pointer drags
// the field the way a finger drags through water: around it, with a wide
// soft edge, the field is pulled along the direction it's moving, further
// the faster it goes. Where it is and how fast it moves both ride springs,
// so the drag builds, trails a little behind, and eases back when it stops.
// Runs only while on screen. Reduced motion: one still frame, no drag.

import { define } from '../runtime';
import { Spring, loop } from '../spring';

const CELL = 3; // CSS px per dither cell

const VERTEX = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;
const FRAGMENT = `
precision highp float;
uniform vec2 uPtr, uDrag;
uniform float uTime;
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
  // The drag: one direction for the whole neighbourhood, fading out over
  // ~270px, so the field bends rather than bulging around a point.
  vec2 d = cell - uPtr;
  vec2 p = (cell - uDrag * exp(-dot(d, d) / 8100.)) / 130.;
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
  const [uPtr, uDrag, uTime, uInk, uPaper] = ['uPtr', 'uDrag', 'uTime', 'uInk', 'uPaper'].map(u);

  const colors = () => {
    const cs = getComputedStyle(stage);
    gl.uniform3fv(uInk, rgb(cs.color));
    gl.uniform3fv(uPaper, rgb(cs.backgroundColor));
  };

  let time = 20; // a settled-looking moment to start from
  // Where the drag is centred (trailing the pointer a little) and how far
  // it pulls, in cells.
  const px = new Spring(0, 25);
  const py = new Spring(0, 25);
  const dx = new Spring(0, 40);
  const dy = new Spring(0, 40);
  const render = () => {
    gl.uniform1f(uTime, time);
    gl.uniform2f(uPtr, px.value, py.value);
    gl.uniform2f(uDrag, dx.value, dy.value);
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

  // The pointer, in cells, y up (gl_FragCoord's origin is bottom left);
  // null while it's off the stage.
  let pointer: { x: number; y: number } | null = null;
  let last: { x: number; y: number } | null = null;
  const DRAG = 0.22; // cells of pull per cell/s of pointer speed
  const MAX = 60; // cells: past this the field tears rather than bends

  let running = false;
  const anim = loop((dt) => {
    time += dt;
    // The pull follows the pointer's speed this frame, capped, and goes
    // back to nothing when it stops or leaves.
    let tx = 0;
    let ty = 0;
    if (pointer && last) {
      tx = ((pointer.x - last.x) / dt) * DRAG;
      ty = ((pointer.y - last.y) / dt) * DRAG;
      const len = Math.hypot(tx, ty);
      if (len > MAX) {
        tx *= MAX / len;
        ty *= MAX / len;
      }
    }
    last = pointer && { ...pointer };
    dx.target = tx;
    dy.target = ty;
    if (pointer) {
      px.target = pointer.x;
      py.target = pointer.y;
    }
    for (const s of [px, py, dx, dy]) s.step(dt);
    render();
    return running;
  });

  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect();
    const at = { x: (e.clientX - r.left) / CELL, y: (r.bottom - e.clientY) / CELL };
    if (!pointer && Math.hypot(dx.value, dy.value) < 0.5) {
      // Arriving: start the drag where the pointer is, not sweeping in from
      // where it last left.
      px.value = px.target = at.x;
      py.value = py.target = at.y;
    }
    pointer = at;
  });
  stage.addEventListener('pointerleave', () => {
    pointer = null;
    last = null;
  });

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
