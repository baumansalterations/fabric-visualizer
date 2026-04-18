// Swatch pipeline + procedural preset fabric generator.
//
// `applySwatchToMaterial` — updates the live fabric texture's tiling.
// `buildWeaveNormalMap` — cloth weave normal map for subtle cloth depth.
// `buildProceduralSwatch` — generates preset fabric swatches (twill,
//                           herringbone, glen plaid, windowpane, birdseye,
//                           solid) as CanvasTextures so the rep can try the
//                           pipeline without uploading anything.

import * as THREE from "three";

export function applySwatchToMaterial(material, opts) {
  if (!material.map) return;
  const tex = material.map;
  const rx = Math.max(0.1, opts.repeatX || 1);
  const ry = Math.max(0.1, opts.repeatY || 1);
  const rot = opts.rotation || 0;
  tex.repeat.set(rx, ry);
  tex.center.set(0.5, 0.5);
  tex.rotation = rot;
  tex.needsUpdate = true;
  material.needsUpdate = true;
}

// --- Weave normal map -------------------------------------------------------
// A plain-weave pattern baked into a normal map. Makes even a flat swatch
// photo read as woven cloth when the shader catches rim light.
export function buildWeaveNormalMap(depth = 35) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const strength = Math.max(0, Math.min(1, depth / 100));

  const warpFreq = 48, weftFreq = 48;

  function noise(x, y) {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  function height(x, y) {
    const u = x / size, v = y / size;
    const warp = Math.sin(v * Math.PI * 2 * warpFreq);
    const weft = Math.sin(u * Math.PI * 2 * weftFreq);
    const interleave = (warp + weft) * 0.5;
    const n = (noise(u * 128, v * 128) - 0.5) * 0.15;
    return interleave * 0.8 + n;
  }

  const eps = 1;
  let i = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hL = height((x - eps + size) % size, y);
      const hR = height((x + eps) % size, y);
      const hD = height(x, (y - eps + size) % size);
      const hU = height(x, (y + eps) % size);
      const nx = (hL - hR) * strength * 6;
      const ny = (hD - hU) * strength * 6;
      const nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1;
      img.data[i++] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      img.data[i++] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      img.data[i++] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      img.data[i++] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return tex;
}

// --- Procedural fabric swatches --------------------------------------------
// Each generator paints a tileable 256x256 canvas of a classic menswear
// weave. Returned as a THREE.CanvasTexture with the canvas accessible as
// tex.image so the UI gallery can show a thumbnail.
export function buildProceduralSwatch(kind, color = "#3a3a3a") {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  const base = parseColor(color);
  const light = shade(base, 16);
  const dark = shade(base, -24);

  switch (kind) {
    case "twill":        drawTwill(ctx, size, base, dark); break;
    case "herringbone":  drawHerringbone(ctx, size, base, dark); break;
    case "glenplaid":    drawGlenPlaid(ctx, size, base, dark, light); break;
    case "windowpane":   drawWindowpane(ctx, size, base, light); break;
    case "birdseye":     drawBirdseye(ctx, size, base, light); break;
    case "solid":
    default:             drawSolid(ctx, size, base); break;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

// --- helpers ---------------------------------------------------------------

function parseColor(hex) {
  const m = hex.replace("#", "");
  const v = parseInt(m, 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}
function shade(c, amt) {
  return {
    r: Math.max(0, Math.min(255, c.r + amt)),
    g: Math.max(0, Math.min(255, c.g + amt)),
    b: Math.max(0, Math.min(255, c.b + amt)),
  };
}
function rgb(c) { return `rgb(${c.r|0},${c.g|0},${c.b|0})`; }

function drawSolid(ctx, s, base) {
  ctx.fillStyle = rgb(base);
  ctx.fillRect(0, 0, s, s);
  // Subtle variation so solids don't look plastic-flat.
  const img = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() - 0.5) * 14;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + v));
    img.data[i+1] = Math.max(0, Math.min(255, img.data[i+1] + v));
    img.data[i+2] = Math.max(0, Math.min(255, img.data[i+2] + v));
  }
  ctx.putImageData(img, 0, 0);
}

function drawTwill(ctx, s, base, dark) {
  drawSolid(ctx, s, base);
  ctx.strokeStyle = rgb(dark);
  ctx.lineWidth = 1;
  ctx.lineCap = "square";
  // Diagonal twill lines — every 6px, slope 2:1
  for (let x = -s; x < s * 2; x += 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + s, s);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.4;
  for (let x = -s; x < s * 2; x += 3) {
    ctx.beginPath();
    ctx.moveTo(x + 1, 0);
    ctx.lineTo(x + s + 1, s);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawHerringbone(ctx, s, base, dark) {
  drawSolid(ctx, s, base);
  ctx.strokeStyle = rgb(dark);
  ctx.lineWidth = 1;
  const bandH = 16;
  for (let yBand = 0; yBand < s; yBand += bandH) {
    const dir = (yBand / bandH) % 2 === 0 ? 1 : -1;
    for (let x = -s; x < s * 2; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x, yBand);
      ctx.lineTo(x + dir * bandH, yBand + bandH);
      ctx.stroke();
    }
  }
}

function drawGlenPlaid(ctx, s, base, dark, light) {
  drawSolid(ctx, s, base);
  // Classic Prince-of-Wales glen plaid: alternating thin+thick checks
  ctx.fillStyle = rgb(dark);
  // Thick horizontal bands
  for (let y = 0; y < s; y += 32) {
    if (((y / 32) | 0) % 4 < 2) ctx.fillRect(0, y, s, 4);
  }
  // Thick vertical bands
  for (let x = 0; x < s; x += 32) {
    if (((x / 32) | 0) % 4 < 2) ctx.fillRect(x, 0, 4, s);
  }
  // Thin accent lines (second color)
  ctx.fillStyle = rgb(light);
  for (let y = 0; y < s; y += 32) {
    if (((y / 32) | 0) % 4 === 2) ctx.fillRect(0, y, s, 1);
  }
  for (let x = 0; x < s; x += 32) {
    if (((x / 32) | 0) % 4 === 2) ctx.fillRect(x, 0, 1, s);
  }
}

function drawWindowpane(ctx, s, base, light) {
  drawSolid(ctx, s, base);
  ctx.strokeStyle = rgb(light);
  ctx.lineWidth = 2;
  // Widely spaced vertical + horizontal lines — the classic windowpane look
  for (let x = 0; x < s; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s); ctx.stroke();
  }
  for (let y = 0; y < s; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
  }
}

function drawBirdseye(ctx, s, base, light) {
  drawSolid(ctx, s, base);
  ctx.fillStyle = rgb(light);
  // Tiny flecks on a grid — birdseye texture
  for (let y = 0; y < s; y += 6) {
    for (let x = 0; x < s; x += 6) {
      if (((x / 6) + (y / 6)) % 2 === 0) {
        ctx.fillRect(x + 2, y + 2, 2, 2);
      }
    }
  }
}
