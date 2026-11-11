"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  bindFullscreenTriangle,
  createPingPong,
  createProgram,
  createTarget,
  disposeTarget,
  hexToRgb,
  isInteractiveTarget,
  runWhileVisible,
  useDarkMode,
  useHydratedReduce,
  type PingPong,
  type Program,
  type Target,
} from "@/components/prestigeui/background-ui";

/*
 * Ink: a watercolor simulation. Drops of pigment land on paper, bloom
 * outward and feather along its fibers. As the water dries the pigment
 * settles into dark rims, and where two washes meet they leave the pale
 * seams real watercolor makes. A pointer moving through wet ink drags it
 * like a loaded brush; dried ink stays where it is.
 *
 * Fields (all half-float):
 *   velocity  RG   the water's flow, on a coarse grid
 *   wet       RGB  pigment still floating in water (one channel per pigment), A water
 *   stain     RGB  pigment settled into the paper
 *   paper     R tooth height, G fibers, B a slow mottle, baked once
 */

/* ------------------------------------------------------------------ */
/*  Palettes                                                           */
/* ------------------------------------------------------------------ */

export type InkVariant = "sumi" | "indigo" | "sienna" | "night";

type Pigment = { light: string; dark: string };

type Palette = {
  label: string;
  paper: { light: string; dark: string };
  pigments: Pigment[];
  /** Always on dark paper, whatever the page theme. */
  alwaysDark?: boolean;
};

export const inkPalettes: Record<InkVariant, Palette> = {
  sumi: {
    label: "Sumi",
    paper: { light: "#f2ece0", dark: "#16140f" },
    pigments: [{ light: "#1c1c22", dark: "#ece2cc" }],
  },
  indigo: {
    label: "Indigo",
    paper: { light: "#f7f6f2", dark: "#0c0f16" },
    pigments: [{ light: "#1d3672", dark: "#a3b8ea" }],
  },
  sienna: {
    label: "Sienna & Ultramarine",
    paper: { light: "#f1eadc", dark: "#15120e" },
    pigments: [
      { light: "#b4532b", dark: "#e39a6c" },
      { light: "#2b3d9a", dark: "#9aaaf0" },
    ],
  },
  night: {
    label: "Night",
    paper: { light: "#0f0f11", dark: "#0f0f11" },
    pigments: [{ light: "#e6dac2", dark: "#e6dac2" }],
    alwaysDark: true,
  },
};

// Literal classes (so Tailwind generates them) for the paper and ink-safe
// text color of each variant, in both themes. Children inherit the color.
const surface: Record<InkVariant, string> = {
  sumi: "[--ink-paper:#f2ece0] [--ink-fg:#17150f] dark:[--ink-paper:#16140f] dark:[--ink-fg:#f1ece2]",
  indigo:
    "[--ink-paper:#f7f6f2] [--ink-fg:#0f1525] dark:[--ink-paper:#0c0f16] dark:[--ink-fg:#e8edf7]",
  sienna:
    "[--ink-paper:#f1eadc] [--ink-fg:#1a140e] dark:[--ink-paper:#15120e] dark:[--ink-fg:#f3ebdf]",
  night: "[--ink-paper:#0f0f11] [--ink-fg:#f1ece2]",
};

/* ------------------------------------------------------------------ */
/*  Shaders                                                            */
/* ------------------------------------------------------------------ */

const HEAD = `#version 300 es
precision highp float; precision highp sampler2D;
in vec2 vUv; out vec4 o;
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+17.1; a*=.5; } return s; }
`;

const SHADERS = {
  // Cold-press paper in CSS pixels, so its grain is the same at any size.
  paper: `${HEAD}
  uniform vec2 uSize; uniform float uSeed;
  void main(){
    vec2 p = vUv*uSize + uSeed*31.;
    float tooth = fbm(p*0.045)*0.5 + fbm(p*0.16)*0.32 + vn(p*0.55)*0.18;
    float f = 0.;
    for(int k=0;k<4;k++){ float a = float(k)*1.7+uSeed; mat2 r = mat2(cos(a),-sin(a),sin(a),cos(a));
      vec2 q = r*p; f += smoothstep(.6,.92, vn(vec2(q.x*0.04, q.y*0.3))); }
    o = vec4(tooth, f*0.25, vn(p*0.21+3.7)*0.6 + vn(p*0.6)*0.4, 1.);
  }`,
  copy: `${HEAD}
  uniform sampler2D uSrc;
  void main(){ o = texture(uSrc, vUv); }`,
  advect: `${HEAD}
  uniform sampler2D uVel, uSrc; uniform vec2 uTexel; uniform float uDt, uDiss;
  void main(){ vec2 v = texture(uVel,vUv).xy; o = uDiss*texture(uSrc, vUv - uDt*v*uTexel); }`,
  // A drop: water plus pigment with an irregular, soft-but-defined edge.
  drop: `${HEAD}
  uniform sampler2D uSrc; uniform vec2 uPoint; uniform float uAspect, uRadius, uSeed; uniform vec4 uValue;
  void main(){
    vec2 d = vUv-uPoint; d.x*=uAspect; float r = length(d);
    float ang = atan(d.y,d.x);
    float wob = 1. + 0.28*(vn(vec2(ang*1.6+uSeed, uSeed))-0.5) + 0.14*(vn(vec2(ang*5.+uSeed*3., 1.))-0.5)
              + 0.10*(fbm(vUv*40.+uSeed)-0.5);
    float R = uRadius*wob;
    float g = smoothstep(R, R*0.5, r);
    float core = mix(1., smoothstep(R, 0., r)*1.4, 0.5);
    vec4 base = texture(uSrc,vUv);
    o = vec4(base.rgb + uValue.rgb*g*core, min(base.a + uValue.a*g, 1.5));
  }`,
  // A push on the velocity field: an outward splash and/or a directed shove.
  push: `${HEAD}
  uniform sampler2D uSrc; uniform vec2 uPoint; uniform float uAspect, uRadius; uniform vec3 uValue;
  void main(){
    vec2 d = vUv-uPoint; d.x*=uAspect; float r = length(d);
    float g = exp(-r*r/(uRadius*uRadius));
    vec2 dir = r>0. ? d/r : vec2(0.); dir.x/=uAspect;
    o = texture(uSrc,vUv) + vec4(dir*uValue.x*g + uValue.yz*g, 0.,0.);
  }`,
  // A loaded brush dragged from A to B. It picks up what is behind it and
  // lays it down along the stroke, and its bristles comb the pigment into
  // streaks. It only moves water and pigment that are still wet; dry paper
  // and dried ink stay put.
  brush: `${HEAD}
  uniform sampler2D uSrc; uniform vec2 uA, uB; uniform float uAspect, uRadius, uStrength, uComb, uSeed;
  void main(){
    vec4 base = texture(uSrc, vUv);
    vec2 k = vec2(uAspect, 1.);
    vec2 p = vUv*k, a = uA*k, b = uB*k, ab = b-a;
    float L = length(ab);
    vec2 dir = L > 1e-5 ? ab/L : vec2(1.,0.);
    float t = clamp(dot(p-a, dir), 0., L);
    float dist = length(p - (a + dir*t));
    float f = smoothstep(uRadius, uRadius*0.35, dist);
    if (f <= 0.) { o = base; return; }
    // Bristles are fixed in the page, so a stroke combs the same lines.
    float across = dot(p, vec2(-dir.y, dir.x)) / uRadius;
    float hair = smoothstep(0.25, 0.75, vn(vec2(across*6. + uSeed, 0.5)));
    vec2 back = (uB-uA) * min(1., uRadius*0.9/max(L,1e-5));
    vec4 s = texture(uSrc, vUv - back);
    float wet = smoothstep(0.03, 0.3, base.a);
    float carry = f*uStrength*(0.5 + 0.5*hair)*smoothstep(0.03, 0.3, s.a);
    vec3 rgb = mix(base.rgb, s.rgb, carry);
    rgb *= 1. + (hair - 0.5)*uComb*f*wet;
    float water = mix(base.a, s.a, carry*0.85);
    o = vec4(rgb, min(water, 1.5));
  }`,
  forces: `${HEAD}
  uniform sampler2D uVel, uWet; uniform vec2 uTexel; uniform float uSpread, uTurb, uDt, uTime;
  void main(){
    vec2 v = texture(uVel,vUv).xy;
    vec2 e = uTexel*1.5;
    float wL = texture(uWet,vUv-vec2(e.x,0)).a, wR = texture(uWet,vUv+vec2(e.x,0)).a;
    float wB = texture(uWet,vUv-vec2(0,e.y)).a, wT = texture(uWet,vUv+vec2(0,e.y)).a;
    float w = texture(uWet,vUv).a;
    float wet = smoothstep(0.02,0.3,(wL+wR+wB+wT)*0.125 + w*0.5);
    // capillary: water pushes from wet toward drier paper, until it thins out
    v += -vec2(wR-wL, wT-wB)*uSpread*uDt*smoothstep(0.2,0.7,w);
    // a slow curl-noise drift inside wet areas
    vec2 q = vUv*vec2(uTexel.y/uTexel.x,1.)*3.2;
    float t = uTime*0.07;
    float n0 = fbm(q + vec2(0.,t)), nx = fbm(q + vec2(0.01,t)), ny = fbm(q + vec2(0.,t+0.01));
    v += vec2(ny-n0, -(nx-n0))/0.01*uTurb*uDt*wet;
    v *= mix(0.8, 0.982, wet);
    o = vec4(v,0.,1.);
  }`,
  curl: `${HEAD}
  uniform sampler2D uVel; uniform vec2 uTexel;
  void main(){ float L=texture(uVel,vUv-vec2(uTexel.x,0)).y, R=texture(uVel,vUv+vec2(uTexel.x,0)).y;
    float B=texture(uVel,vUv-vec2(0,uTexel.y)).x, T=texture(uVel,vUv+vec2(0,uTexel.y)).x;
    o = vec4(0.5*(R-L-T+B),0.,0.,1.); }`,
  vorticity: `${HEAD}
  uniform sampler2D uVel, uCurl; uniform vec2 uTexel; uniform float uCurlAmt, uDt;
  void main(){ float L=texture(uCurl,vUv-vec2(uTexel.x,0)).x, R=texture(uCurl,vUv+vec2(uTexel.x,0)).x;
    float B=texture(uCurl,vUv-vec2(0,uTexel.y)).x, T=texture(uCurl,vUv+vec2(0,uTexel.y)).x, C=texture(uCurl,vUv).x;
    vec2 f = 0.5*vec2(abs(T)-abs(B), abs(R)-abs(L)); f /= length(f)+1e-4; f *= uCurlAmt*C; f.y*=-1.;
    o = vec4(texture(uVel,vUv).xy + f*uDt, 0.,1.); }`,
  divergence: `${HEAD}
  uniform sampler2D uVel; uniform vec2 uTexel;
  void main(){ float L=texture(uVel,vUv-vec2(uTexel.x,0)).x, R=texture(uVel,vUv+vec2(uTexel.x,0)).x;
    float B=texture(uVel,vUv-vec2(0,uTexel.y)).y, T=texture(uVel,vUv+vec2(0,uTexel.y)).y;
    o = vec4(0.5*(R-L+T-B),0.,0.,1.); }`,
  pressure: `${HEAD}
  uniform sampler2D uP, uDiv; uniform vec2 uTexel;
  void main(){ float L=texture(uP,vUv-vec2(uTexel.x,0)).x, R=texture(uP,vUv+vec2(uTexel.x,0)).x;
    float B=texture(uP,vUv-vec2(0,uTexel.y)).x, T=texture(uP,vUv+vec2(0,uTexel.y)).x;
    o = vec4((L+R+B+T-texture(uDiv,vUv).x)*0.25,0.,0.,1.); }`,
  gradient: `${HEAD}
  uniform sampler2D uP, uVel; uniform vec2 uTexel;
  void main(){ float L=texture(uP,vUv-vec2(uTexel.x,0)).x, R=texture(uP,vUv+vec2(uTexel.x,0)).x;
    float B=texture(uP,vUv-vec2(0,uTexel.y)).x, T=texture(uP,vUv+vec2(0,uTexel.y)).x;
    o = vec4(texture(uVel,vUv).xy - 0.5*vec2(R-L,T-B),0.,1.); }`,
  scale: `${HEAD}
  uniform sampler2D uSrc; uniform float uK;
  void main(){ o = texture(uSrc,vUv)*uK; }`,
  // Pigment feathers through water along the easy fibers. Water itself
  // does not diffuse: crisp wet edges are what dry into rims and backruns.
  diffuse: `${HEAD}
  uniform sampler2D uWet, uPaper; uniform vec2 uTexel; uniform float uK;
  void main(){
    vec4 c = texture(uWet,vUv);
    vec3 dp = vec3(0.);
    vec2 off[8] = vec2[8](vec2(1,0),vec2(-1,0),vec2(0,1),vec2(0,-1),vec2(.7,.7),vec2(-.7,.7),vec2(.7,-.7),vec2(-.7,-.7));
    float cw = smoothstep(0.005, 0.06, c.a);
    for(int i=0;i<8;i++){
      vec2 uv = vUv + off[i]*uTexel;
      vec4 n = texture(uWet,uv);
      vec3 pp = texture(uPaper,uv).rgb;
      float nw = smoothstep(0.005, 0.06, n.a);
      float fiber = smoothstep(0.3, 0.7, pp.g + 0.5*pp.b);
      dp += (n.rgb - c.rgb) * cw*nw*(0.15 + fiber)*smoothstep(0.0, 0.4, min(c.a,n.a)) * uK;
    }
    o = vec4(max(c.rgb + dp, 0.), c.a);
  }`,
  // Drying: water evaporates (fastest where it is thin) and pigment settles,
  // fastest at the drying front, so washes dry with darker rims.
  dry: `${HEAD}
  uniform sampler2D uWet, uStain, uPaper; uniform vec2 uTexel; uniform float uDt, uEvap, uSettle, uRim, uGran, uFadeAfter, uFadeRate, uAgeStep;
  uniform int uOut;
  void main(){
    vec4 wet = texture(uWet,vUv);
    float w = wet.a;
    float wb = 0.;
    // a dense kernel: a sparse one aliases and draws grid steps into the rims
    for(int i=-2;i<=2;i++) for(int j=-2;j<=2;j++) wb += texture(uWet,vUv+vec2(i,j)*uTexel*2.5).a;
    wb /= 25.;
    float rim = clamp((w - wb)*uRim, 0., 1.) * smoothstep(0.0, 0.08, w);
    vec3 pp = texture(uPaper,vUv).rgb;
    float gran = mix(1., 0.3 + 1.5*smoothstep(0.25,0.75,1.-pp.r), uGran);
    float thin = smoothstep(0.25, 0.0, w);
    float settle = clamp(uSettle*uDt*(0.05 + rim*0.8 + thin*1.2)*gran, 0., 1.);
    settle = mix(1., settle, smoothstep(0.0, 0.01, w));
    vec3 moved = wet.rgb*settle;
    if(uOut==0){ o = vec4(wet.rgb - moved, max(w - uEvap*uDt*(0.6 + 1.6*thin), 0.)); }
    else {
      // Settled ink keeps its age (seconds since it dried) in alpha. Once it
      // is older than uFadeAfter it fades out; fresh paint resets the age.
      vec4 st = texture(uStain,vUv);
      float fresh = step(0.02, w) + step(0.003, moved.r + moved.g + moved.b);
      float age = fresh > 0. ? 0. : min(st.a + uAgeStep, 1000.);
      float keep = (uFadeAfter >= 0. && age > uFadeAfter) ? exp(-uDt*uFadeRate) : 1.;
      o = vec4(st.rgb*keep + moved, age);
    }
  }`,
  display: `${HEAD}
  uniform sampler2D uWet, uStain, uPaper; uniform vec2 uTexel, uRes;
  uniform vec3 uPaperCol, uAbs0, uAbs1, uAbs2, uCol0, uCol1, uCol2, uStr;
  uniform float uDark, uTime, uGrain;
  void main(){
    vec4 wet = texture(uWet,vUv);
    vec3 P = texture(uStain,vUv).rgb + wet.rgb*0.9;
    vec3 pp = texture(uPaper,vUv).rgb;
    float hL = texture(uPaper,vUv-vec2(uTexel.x,0)).r, hR = texture(uPaper,vUv+vec2(uTexel.x,0)).r;
    float hB = texture(uPaper,vUv-vec2(0,uTexel.y)).r, hT = texture(uPaper,vUv+vec2(0,uTexel.y)).r;
    vec3 n = normalize(vec3(hL-hR, hB-hT, 0.09));
    float light = dot(n, normalize(vec3(-0.45,0.55,0.7)));
    float gran = 0.85 + 0.3*(1.-pp.r);
    float w = smoothstep(0.04,0.5,wet.a);
    vec3 col;
    if(uDark < 0.5){
      vec3 A = uAbs0*P.x + uAbs1*P.y + uAbs2*P.z;
      A = A / (1. + A*0.22) * gran;
      col = uPaperCol * exp(-A);
      col *= 0.975 + 0.04*light - 0.02*pp.g;
      col *= 1. - 0.035*w;
      col += 0.03*w*pow(max(light,0.),8.);
    } else {
      vec3 amt = P*uStr;
      float m = amt.x + amt.y + amt.z;
      vec3 tint = (uCol0*amt.x + uCol1*amt.y + uCol2*amt.z) / max(m, 1e-4);
      m = m / (1. + m*0.22) * gran;
      float cov = 1. - exp(-m*0.8);
      col = uPaperCol * (0.94 + 0.09*light - 0.03*pp.g);
      col = mix(col, tint*(0.88+0.16*light), cov);
      col += 0.02*w*pow(max(light,0.),8.);
    }
    col += (h21(vUv*uRes + fract(uTime*7.)*91.) - 0.5)*uGrain;
    o = vec4(col,1.);
  }`,
};

type ShaderName = keyof typeof SHADERS;

/* ------------------------------------------------------------------ */
/*  Engine                                                             */
/* ------------------------------------------------------------------ */

const SETTINGS = {
  simRes: 360,
  dyeRes: 540,
  spread: 300,
  turb: 1.2,
  curl: 10,
  burst: 1.6,
  jet: 9,
  evap: 0.05,
  settle: 0.5,
  rim: 22,
  gran: 0.65,
  diffuse: 0.12,
  grain: 0.016,
  brush: 0.9,
  brushRadius: 0.065,
  comb: 0.32,
  brushPush: 900,
};

type DropOptions = { r?: number; pigment?: number; water?: number; amount?: number };

type InkEngine = {
  drop: (x: number, y: number, options?: DropOptions) => void;
  wash: (x: number, y: number, r: number, water: number) => void;
  brush: (ax: number, ay: number, bx: number, by: number) => void;
  step: (dt: number) => void;
  render: () => void;
  setPalette: (palette: Palette, dark: boolean) => void;
  /** Seconds dried ink stays before fading out; false keeps it. */
  setFade: (after: number | false) => void;
  /** Reallocates for a new size; true when it did (the canvas was cleared). */
  resize: () => boolean;
  dispose: () => void;
};

const pigmentAbsorbance = (hex: string) =>
  hexToRgb(hex).map((c) => -Math.log(Math.max(c, 0.02))) as [number, number, number];

function createInk(canvas: HTMLCanvasElement, seed: number): InkEngine | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;
  if (!gl.getExtension("EXT_color_buffer_float") && !gl.getExtension("EXT_color_buffer_half_float")) {
    return null;
  }

  let programs: Record<ShaderName, Program>;
  try {
    programs = Object.fromEntries(
      (Object.keys(SHADERS) as ShaderName[]).map((name) => [name, createProgram(gl, SHADERS[name])]),
    ) as Record<ShaderName, Program>;
  } catch {
    return null;
  }
  const quad = bindFullscreenTriangle(gl);

  // Sizes. The simulation runs on fixed grids measured on the short side,
  // so the ink behaves the same at any size; never finer than 1 texel/px.
  let cw = 1, ch = 1, W = 1, H = 1, aspect = 1, unit = 1;
  let sim = { w: 1, h: 1 }, dye = { w: 1, h: 1 };


  function measure() {
    cw = Math.max(1, canvas.clientWidth);
    ch = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.round(cw * dpr);
    H = Math.round(ch * dpr);
    canvas.width = W;
    canvas.height = H;
    const short = Math.min(cw, ch);
    const grid = (res: number) => {
      const k = Math.min(res / short, 1);
      return { w: Math.max(2, Math.round(cw * k)), h: Math.max(2, Math.round(ch * k)) };
    };
    sim = grid(SETTINGS.simRes);
    dye = grid(SETTINGS.dyeRes);
    aspect = cw / ch;
    unit = short / ch;
  }

  function draw(
    target: Target | null,
    name: ShaderName,
    set: (u: Program["uniforms"], tex: (uniform: string, texture: WebGLTexture) => void) => void,
  ) {
    const { program, uniforms } = programs[name];
    gl!.useProgram(program);
    let slot = 0;
    set(uniforms, (uniform, texture) => {
      gl!.activeTexture(gl!.TEXTURE0 + slot);
      gl!.bindTexture(gl!.TEXTURE_2D, texture);
      gl!.uniform1i(uniforms[uniform], slot++);
    });
    gl!.bindFramebuffer(gl!.FRAMEBUFFER, target ? target.framebuffer : null);
    gl!.viewport(0, 0, target ? target.width : W, target ? target.height : H);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  type Fields = {
    vel: PingPong;
    prs: PingPong;
    wet: PingPong;
    stain: PingPong;
    div: Target;
    curl: Target;
    paper: Target;
    paperHi: Target;
  };

  // (Re)allocates every field at the current size. Ink already on the page
  // is carried over, stretched to fit.
  function allocate(old?: Fields): Fields {
    measure();
    const next: Fields = {
      vel: createPingPong(gl!, sim.w, sim.h),
      prs: createPingPong(gl!, sim.w, sim.h),
      wet: createPingPong(gl!, dye.w, dye.h),
      stain: createPingPong(gl!, dye.w, dye.h),
      div: createTarget(gl!, sim.w, sim.h),
      curl: createTarget(gl!, sim.w, sim.h),
      paper: createTarget(gl!, dye.w, dye.h),
      paperHi: createTarget(gl!, Math.round(cw), Math.round(ch), "byte"),
    };
    if (old) {
      for (const key of ["vel", "wet", "stain"] as const) {
        draw(next[key].read, "copy", (_, tex) => tex("uSrc", old[key].read.texture));
      }
      release(old);
    }
    for (const target of [next.paper, next.paperHi]) {
      draw(target, "paper", (u) => {
        gl!.uniform2f(u.uSize, cw, ch);
        gl!.uniform1f(u.uSeed, seed);
      });
    }
    return next;
  }

  function release(old: Fields) {
    old.vel.dispose();
    old.prs.dispose();
    old.wet.dispose();
    old.stain.dispose();
    for (const target of [old.div, old.curl, old.paper, old.paperHi]) disposeTarget(gl!, target);
  }

  let f = allocate();

  let rngState = Math.floor(seed * 1000) || 1;
  const rand = () => (rngState = (rngState * 16807) % 2147483647) / 2147483647;
  let splatSeed = seed;
  const pending: [number, number, number, number, number, number][] = [];

  function push(x: number, y: number, r: number, burst: number, dx: number, dy: number) {
    draw(f.vel.write, "push", (u, tex) => {
      tex("uSrc", f.vel.read.texture);
      gl!.uniform2f(u.uPoint, x, y);
      gl!.uniform1f(u.uAspect, aspect);
      gl!.uniform1f(u.uRadius, r * unit);
      gl!.uniform3f(u.uValue, burst, dx, dy);
    });
    f.vel.swap();
  }

  function splat(x: number, y: number, r: number, amounts: [number, number, number], water: number) {
    draw(f.wet.write, "drop", (u, tex) => {
      tex("uSrc", f.wet.read.texture);
      gl!.uniform2f(u.uPoint, x, y);
      gl!.uniform1f(u.uAspect, aspect);
      gl!.uniform1f(u.uRadius, r * unit);
      gl!.uniform1f(u.uSeed, (splatSeed += 7.31));
      gl!.uniform4f(u.uValue, amounts[0], amounts[1], amounts[2], water);
    });
    f.wet.swap();
  }

  let pigmentCount = 1;
  const fade = { after: 45, rate: 3 / 6 };
  let time = 0;
  const paletteUniforms = {
    paper: [1, 1, 1] as number[],
    abs: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] as number[][],
    col: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] as number[][],
    str: [1, 1, 1] as number[],
    dark: false,
  };

  return {
    drop(x, y, { r = 0.06, pigment = 0, water = 0.9, amount = 1 } = {}) {
      const amounts: [number, number, number] = [0, 0, 0];
      amounts[pigment % pigmentCount] = amount;
      splat(x, y, r, amounts, water);
      // An outward splash (applied after projection so it survives), and a
      // few off-centre jets whose vortex pairs curl the pigment.
      pending.push([x, y, r * 1.3, SETTINGS.burst, 0, 0]);
      const jets = 3 + Math.floor(rand() * 3);
      for (let i = 0; i < jets; i++) {
        const a = rand() * Math.PI * 2;
        const d = r * (0.5 + rand() * 0.6);
        const s = SETTINGS.jet * (0.5 + rand());
        pending.push([
          x + (Math.cos(a) * d * unit) / aspect,
          y + Math.sin(a) * d * unit,
          r * 0.45,
          0,
          Math.cos(a + 0.6) * s,
          Math.sin(a + 0.6) * s,
        ]);
      }
    },
    wash(x, y, r, water) {
      splat(x, y, r, [0, 0, 0], water);
    },
    brush(ax, ay, bx, by) {
      const dx = bx - ax, dy = by - ay;
      if (dx * dx + dy * dy < 1e-8) return;
      const radius = SETTINGS.brushRadius * unit;
      draw(f.wet.write, "brush", (u, tex) => {
        tex("uSrc", f.wet.read.texture);
        gl!.uniform2f(u.uA, ax, ay);
        gl!.uniform2f(u.uB, bx, by);
        gl!.uniform1f(u.uAspect, aspect);
        gl!.uniform1f(u.uRadius, radius);
        gl!.uniform1f(u.uStrength, SETTINGS.brush);
        gl!.uniform1f(u.uComb, SETTINGS.comb);
        gl!.uniform1f(u.uSeed, seed);
      });
      f.wet.swap();
      // The stroke also drags the water itself, so f.wet ink keeps moving
      // after the brush has passed.
      pending.push([(ax + bx) / 2, (ay + by) / 2, SETTINGS.brushRadius, 0, dx * SETTINGS.brushPush, dy * SETTINGS.brushPush]);
    },
    step(dt) {
      dt = Math.min(dt, 1 / 30);
      time += dt;
      // Ages advance in half-second ticks: tiny per-frame increments would
      // round away in a half-float texture.
      const tick = Math.floor(time * 2) !== Math.floor((time - dt) * 2) ? 0.5 : 0;
      const st = [1 / sim.w, 1 / sim.h] as const;
      const dt2 = [1 / dye.w, 1 / dye.h] as const;
      draw(f.curl, "curl", (u, tex) => {
        tex("uVel", f.vel.read.texture);
        gl!.uniform2f(u.uTexel, ...st);
      });
      draw(f.vel.write, "vorticity", (u, tex) => {
        tex("uVel", f.vel.read.texture);
        tex("uCurl", f.curl.texture);
        gl!.uniform2f(u.uTexel, ...st);
        gl!.uniform1f(u.uCurlAmt, SETTINGS.curl);
        gl!.uniform1f(u.uDt, dt);
      });
      f.vel.swap();
      draw(f.div, "divergence", (u, tex) => {
        tex("uVel", f.vel.read.texture);
        gl!.uniform2f(u.uTexel, ...st);
      });
      draw(f.prs.write, "scale", (u, tex) => {
        tex("uSrc", f.prs.read.texture);
        gl!.uniform1f(u.uK, 0.8);
      });
      f.prs.swap();
      for (let i = 0; i < 16; i++) {
        draw(f.prs.write, "pressure", (u, tex) => {
          tex("uP", f.prs.read.texture);
          tex("uDiv", f.div.texture);
          gl!.uniform2f(u.uTexel, ...st);
        });
        f.prs.swap();
      }
      draw(f.vel.write, "gradient", (u, tex) => {
        tex("uP", f.prs.read.texture);
        tex("uVel", f.vel.read.texture);
        gl!.uniform2f(u.uTexel, ...st);
      });
      f.vel.swap();
      draw(f.vel.write, "forces", (u, tex) => {
        tex("uVel", f.vel.read.texture);
        tex("uWet", f.wet.read.texture);
        gl!.uniform2f(u.uTexel, ...st);
        gl!.uniform1f(u.uSpread, SETTINGS.spread);
        gl!.uniform1f(u.uTurb, SETTINGS.turb);
        gl!.uniform1f(u.uDt, dt);
        gl!.uniform1f(u.uTime, time + seed);
      });
      f.vel.swap();
      for (const p of pending) push(...p);
      pending.length = 0;
      draw(f.vel.write, "advect", (u, tex) => {
        tex("uVel", f.vel.read.texture);
        tex("uSrc", f.vel.read.texture);
        gl!.uniform2f(u.uTexel, ...st);
        gl!.uniform1f(u.uDt, dt);
        gl!.uniform1f(u.uDiss, 0.996);
      });
      f.vel.swap();
      draw(f.wet.write, "advect", (u, tex) => {
        tex("uVel", f.vel.read.texture);
        tex("uSrc", f.wet.read.texture);
        gl!.uniform2f(u.uTexel, ...st);
        gl!.uniform1f(u.uDt, dt);
        gl!.uniform1f(u.uDiss, 1);
      });
      f.wet.swap();
      for (let i = 0; i < 2; i++) {
        draw(f.wet.write, "diffuse", (u, tex) => {
          tex("uWet", f.wet.read.texture);
          tex("uPaper", f.paper.texture);
          gl!.uniform2f(u.uTexel, ...dt2);
          gl!.uniform1f(u.uK, SETTINGS.diffuse);
        });
        f.wet.swap();
      }
      for (const out of [1, 0]) {
        draw(out ? f.stain.write : f.wet.write, "dry", (u, tex) => {
          tex("uWet", f.wet.read.texture);
          tex("uStain", f.stain.read.texture);
          tex("uPaper", f.paper.texture);
          gl!.uniform2f(u.uTexel, ...dt2);
          gl!.uniform1f(u.uDt, dt);
          gl!.uniform1f(u.uEvap, SETTINGS.evap);
          gl!.uniform1f(u.uSettle, SETTINGS.settle);
          gl!.uniform1f(u.uFadeAfter, fade.after);
          gl!.uniform1f(u.uFadeRate, fade.rate);
          gl!.uniform1f(u.uAgeStep, tick);
          gl!.uniform1f(u.uRim, SETTINGS.rim);
          gl!.uniform1f(u.uGran, SETTINGS.gran);
          gl!.uniform1i(u.uOut, out);
        });
      }
      f.stain.swap();
      f.wet.swap();
    },
    render() {
      const p = paletteUniforms;
      draw(null, "display", (u, tex) => {
        tex("uWet", f.wet.read.texture);
        tex("uStain", f.stain.read.texture);
        tex("uPaper", f.paperHi.texture);
        gl!.uniform2f(u.uTexel, 1 / f.paperHi.width, 1 / f.paperHi.height);
        gl!.uniform2f(u.uRes, W, H);
        gl!.uniform3fv(u.uPaperCol, p.paper);
        gl!.uniform3fv(u.uAbs0, p.abs[0]);
        gl!.uniform3fv(u.uAbs1, p.abs[1]);
        gl!.uniform3fv(u.uAbs2, p.abs[2]);
        gl!.uniform3fv(u.uCol0, p.col[0]);
        gl!.uniform3fv(u.uCol1, p.col[1]);
        gl!.uniform3fv(u.uCol2, p.col[2]);
        gl!.uniform3fv(u.uStr, p.str);
        gl!.uniform1f(u.uDark, p.dark ? 1 : 0);
        gl!.uniform1f(u.uTime, time);
        gl!.uniform1f(u.uGrain, SETTINGS.grain);
      });
    },
    setFade(after) {
      fade.after = after === false ? -1 : Math.max(0, after);
      // The fade itself takes a quarter of the wait (1.5–6 s) to reach ~5%.
      fade.rate = 3 / Math.min(6, Math.max(1.5, (after || 0) * 0.25));
    },
    setPalette(palette, darkTheme) {
      const dark = Boolean(palette.alwaysDark || darkTheme);
      pigmentCount = palette.pigments.length;
      paletteUniforms.dark = dark;
      paletteUniforms.paper = hexToRgb(dark ? palette.paper.dark : palette.paper.light);
      for (let i = 0; i < 3; i++) {
        const pigment = palette.pigments[i % palette.pigments.length];
        const abs = pigmentAbsorbance(pigment.light);
        // Ink painted with a pigment this palette lacks takes one it has, so
        // switching variants recolors the page instead of hiding drops.
        paletteUniforms.abs[i] = abs;
        paletteUniforms.col[i] = hexToRgb(pigment.dark);
        // Light ink on dark paper reads by coverage alone: one density for all.
        paletteUniforms.str[i] = 2.6;
      }
    },
    resize() {
      // Ignore tiny changes (a scrollbar appearing, a 1px rounding): the
      // canvas simply scales, and resizing would clear it for a frame.
      const dw = Math.abs(canvas.clientWidth - cw) / cw;
      const dh = Math.abs(canvas.clientHeight - ch) / ch;
      if (dw < 0.02 && dh < 0.02) return false;
      f = allocate(f);
      return true;
    },
    dispose() {
      release(f);
      for (const { program } of Object.values(programs)) gl!.deleteProgram(program);
      gl!.deleteBuffer(quad);
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Composition                                                        */
/* ------------------------------------------------------------------ */

export type InkSide = "left" | "right" | "center";

type Drop = { x: number; y: number; r: number; pigment: number; amount: number };

// The opening: one large wash, then three smaller drops, landing in turn.
const OPENING: Drop[] = [
  { x: 0.72, y: 0.62, r: 0.17, pigment: 0, amount: 1.1 },
  { x: 0.88, y: 0.36, r: 0.12, pigment: 1, amount: 1.3 },
  { x: 0.6, y: 0.3, r: 0.08, pigment: 0, amount: 1.6 },
  { x: 0.82, y: 0.8, r: 0.07, pigment: 1, amount: 1.4 },
];

/** Places a drop (designed for the right side) on the requested side. */
function place(drop: Pick<Drop, "x" | "y">, side: InkSide, narrow: boolean) {
  if (narrow) {
    // On a phone the copy usually sits low, so the ink gathers up top.
    return { x: 0.15 + (drop.x - 0.55) * 1.9, y: 0.55 + drop.y * 0.4 };
  }
  if (side === "left") return { x: 1 - drop.x, y: drop.y };
  if (side === "center") return { x: 0.5 + (drop.x - 0.74) * 1.1, y: drop.y };
  return drop;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export type InkBackgroundProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Pigment and paper. Each variant has a light and a dark version. */
  variant?: InkVariant;
  /** Where the opening drops land, away from your copy. */
  side?: InkSide;
  /** Click to drop ink, and drag through wet ink with the pointer. */
  interactive?: boolean;
  /** Paint the opening drops on mount and an occasional drop when idle. */
  autoplay?: boolean;
  /**
   * Seconds painted ink stays once it has dried, before it fades out over a
   * few seconds. Repainting an area restarts its clock. `false` keeps ink.
   */
  fadeAfter?: number | false;
};

export function InkBackground({
  variant = "sumi",
  side = "right",
  interactive = true,
  autoplay = true,
  fadeAfter = 45,
  className,
  children,
  ...props
}: InkBackgroundProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const engineRef = React.useRef<InkEngine | null>(null);
  const reduce = useHydratedReduce();
  const dark = useDarkMode();
  const palette = inkPalettes[variant];
  const paletteRef = React.useRef({ palette, dark });
  const fadeRef = React.useRef(fadeAfter);

  React.useEffect(() => {
    fadeRef.current = fadeAfter;
    engineRef.current?.setFade(fadeAfter);
  }, [fadeAfter]);

  React.useEffect(() => {
    paletteRef.current = { palette, dark };
    const engine = engineRef.current;
    if (!engine) return;
    engine.setPalette(palette, dark);
    engine.render();
  }, [palette, dark]);

  React.useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const engine = createInk(canvas, Math.random() * 50);
    if (!engine) return; // no WebGL2: the paper color alone stays
    engineRef.current = engine;
    engine.setPalette(paletteRef.current.palette, paletteRef.current.dark);
    engine.setFade(fadeRef.current);

    const narrow = () => canvas.clientWidth < 640;
    let pigmentTurn = 0;
    const timers: number[] = [];

    const paintOpening = (instant: boolean) => {
      const n = narrow();
      const center = place({ x: 0.76, y: 0.56 }, side, n);
      engine.wash(center.x, center.y, 0.36, 0.55);
      OPENING.forEach((drop, i) => {
        const at = place(drop, side, n);
        const land = () =>
          engine.drop(at.x, at.y, { r: drop.r, pigment: drop.pigment, amount: drop.amount });
        if (instant) land();
        else timers.push(window.setTimeout(land, 250 + i * 700));
      });
    };

    const reveal = () => canvas.setAttribute("data-ready", "");

    // Reduced motion: paint the opening, let it dry offline, show one frame.
    if (reduce) {
      if (autoplay) {
        paintOpening(true);
        // Fine steps: coarse ones degrade the edges into grid steps.
        for (let i = 0; i < 600; i++) engine.step(1 / 60);
      }
      engine.render();
      reveal();
      const sizes = new ResizeObserver(() => {
        if (engine.resize()) engine.render();
      });
      sizes.observe(canvas);
      return () => {
        sizes.disconnect();
        engine.dispose();
        engineRef.current = null;
      };
    }

    if (autoplay) paintOpening(false);

    // Pointer: a click drops ink; a mouse moving through wet ink drags it.
    const toUv = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return [
        (event.clientX - rect.left) / rect.width,
        1 - (event.clientY - rect.top) / rect.height,
      ] as const;
    };
    let lastInput = performance.now();
    let brushFrom: readonly [number, number] | null = null;
    let brushTo: readonly [number, number] | null = null;

    const down = (event: PointerEvent) => {
      if (event.button !== 0 || isInteractiveTarget(event.target)) return;
      const [x, y] = toUv(event);
      engine.drop(x, y, {
        r: 0.05 + Math.random() * 0.06,
        pigment: pigmentTurn++,
        amount: 1.1 + Math.random() * 0.5,
      });
      lastInput = performance.now();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return; // touch drags scroll the page
      const point = toUv(event);
      if (!brushFrom) brushFrom = point;
      brushTo = point;
      lastInput = performance.now();
    };
    const leave = () => {
      brushFrom = null;
      brushTo = null;
    };
    if (interactive) {
      root.addEventListener("pointerdown", down);
      root.addEventListener("pointermove", move);
      root.addEventListener("pointerleave", leave);
    }

    // Fixed 60 Hz simulation steps, at most two per frame.
    let pending = 0;
    let lastDrop = performance.now();
    const stop = runWhileVisible(canvas, (elapsed, now) => {
      if (brushFrom && brushTo) {
        engine.brush(brushFrom[0], brushFrom[1], brushTo[0], brushTo[1]);
        brushFrom = brushTo;
      }
      if (autoplay && now - lastDrop > 10000 && now - lastInput > 6000) {
        const at = place({ x: 0.6 + Math.random() * 0.32, y: 0.2 + Math.random() * 0.65 }, side, narrow());
        engine.drop(at.x, at.y, { r: 0.04 + Math.random() * 0.04, pigment: pigmentTurn++, amount: 1.2 });
        lastDrop = now;
      }
      pending += elapsed;
      let steps = 0;
      while (pending >= 1000 / 60 && steps < 2) {
        engine.step(1 / 60);
        pending -= 1000 / 60;
        steps++;
      }
      if (steps === 2) pending = 0;
      engine.render();
      reveal();
    });

    // A resize clears the canvas; draw again before the browser paints.
    const sizes = new ResizeObserver(() => {
      if (engine.resize()) engine.render();
    });
    sizes.observe(canvas);

    const lost = (event: Event) => {
      event.preventDefault();
      stop();
    };
    canvas.addEventListener("webglcontextlost", lost);

    return () => {
      timers.forEach(clearTimeout);
      stop();
      sizes.disconnect();
      canvas.removeEventListener("webglcontextlost", lost);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", leave);
      engine.dispose();
      engineRef.current = null;
    };
  }, [reduce, side, interactive, autoplay]);

  return (
    <div
      ref={rootRef}
      className={cn(
        // select-none: clicking the paper (a double click too) paints, never selects.
        "relative isolate overflow-hidden bg-[var(--ink-paper)] text-[var(--ink-fg)] select-none",
        surface[variant],
        className,
      )}
      {...props}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 size-full opacity-0 transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] data-[ready]:opacity-100"
      />
      {children}
    </div>
  );
}
