"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";

/*
 * Shared runtime for the Backgrounds family: theme and motion preferences,
 * a frame loop that only runs while the background is on screen, and the
 * small WebGL2 helpers every background builds on.
 */

const noop = () => () => {};

// The server cannot know the motion preference, so the first client render
// matches it (motion on) and the reduced state applies right after hydration.
export function useHydratedReduce() {
  const reduce = useReducedMotion() ?? false;
  const hydrated = React.useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return hydrated && reduce;
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

/** True while the page is in dark mode (a `dark` class on <html>). */
export function useDarkMode() {
  return React.useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

/** Clicks and hovers on real controls never paint the background. */
export function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "a,button,input,textarea,select,label,summary,[role=button],[contenteditable=true],[data-background-ignore]",
      ),
    )
  );
}

/**
 * Calls `frame` once per animation frame while `element` is on screen and
 * the tab is visible. `frame` receives the elapsed milliseconds since the
 * previous frame (capped, so a long pause never arrives as one big step).
 */
export function runWhileVisible(
  element: Element,
  frame: (elapsed: number, now: number) => void,
) {
  let raf = 0;
  let previous = 0;
  let onScreen = false;

  const tick = (now: number) => {
    const elapsed = previous ? Math.min(now - previous, 100) : 16.7;
    previous = now;
    frame(elapsed, now);
    raf = requestAnimationFrame(tick);
  };
  const start = () => {
    if (raf || !onScreen || document.hidden) return;
    previous = 0;
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const seen = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) start();
    else stop();
  });
  seen.observe(element);
  const visibility = () => (document.hidden ? stop() : start());
  document.addEventListener("visibilitychange", visibility);

  return () => {
    stop();
    seen.disconnect();
    document.removeEventListener("visibilitychange", visibility);
  };
}

/* ------------------------------------------------------------------ */
/*  WebGL2 helpers                                                     */
/* ------------------------------------------------------------------ */

export const FULLSCREEN_VERT = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;

export type Program = {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

export type Target = {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
};

export type PingPong = {
  readonly read: Target;
  readonly write: Target;
  swap: () => void;
  dispose: () => void;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log ?? "shader compile failed");
  }
  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  fragment: string,
  vertex = FULLSCREEN_VERT,
): Program {
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  const vs = compile(gl, gl.VERTEX_SHADER, vertex);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
  }
  const uniforms: Program["uniforms"] = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    // Arrays report as "name[0]"; store them under the bare name too.
    if (info) uniforms[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
}

/** One big triangle that covers the viewport, bound to attribute 0. */
export function bindFullscreenTriangle(gl: WebGL2RenderingContext) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return buffer;
}

export function createTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  precision: "half" | "byte" = "half",
): Target {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) throw new Error("target allocation failed");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (precision === "half") {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  return { texture, framebuffer, width, height };
}

export function disposeTarget(gl: WebGL2RenderingContext, target: Target) {
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.framebuffer);
}

export function createPingPong(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): PingPong {
  let a = createTarget(gl, width, height);
  let b = createTarget(gl, width, height);
  return {
    get read() {
      return a;
    },
    get write() {
      return b;
    },
    swap() {
      [a, b] = [b, a];
    },
    dispose() {
      disposeTarget(gl, a);
      disposeTarget(gl, b);
    },
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}
