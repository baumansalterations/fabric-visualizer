// The swatch pipeline: take an uploaded image, apply it as a tileable texture
// on the garment material, and generate a procedural fabric-weave normal map
// so the cloth reads as woven rather than painted-on.

import * as THREE from "three";

// Apply a swatch texture to a material. Handles repeat counts and rotation,
// which together give the rep control over how coarse/fine the pattern reads
// against the garment's real-world scale.
export function applySwatchToMaterial(material, opts) {
  if (!material.map) return;
  const tex = material.map;
  const rx = Math.max(0.1, opts.repeatX || 1);
  const ry = Math.max(0.1, opts.repeatY || 1);
  const rot = opts.rotation || 0;
  tex.repeat.set(rx, ry);
  // Rotate around the center of the tile so a glen plaid stays centered
  // rather than sliding off when the angle changes.
  tex.center.set(0.5, 0.5);
  tex.rotation = rot;
  tex.needsUpdate = true;
  material.needsUpdate = true;
}

// Procedural fabric-weave normal map. Real woven cloth has a sub-millimeter
// high-frequency pattern (warp + weft threads) that picks up light slightly
// differently than a flat surface. Baking that into a normal map lets the
// shader add it on top of whatever flat swatch image the user uploaded —
// which means even a boring photograph of a swatch reads as three-dimensional
// cloth once applied.
//
// `depth` is 0–100 from the UI slider. 0 = smooth (painted-on), 100 = coarse
// burlap-grade weave. Default 35 reads as fine wool.
export function buildWeaveNormalMap(depth = 35) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(size, size);
  const strength = Math.max(0, Math.min(1, depth / 100));

  // Build a plain-weave pattern: alternating over/under threads. Warp runs
  // vertically (pattern axis V), weft runs horizontally (pattern axis U).
  // We synthesize a grayscale height field and then convert to a normal map
  // via finite differences.
  const warpFreq = 48; // threads per tile — tight enough to read as fabric
  const weftFreq = 48;

  function height(x, y) {
    const u = x / size;
    const v = y / size;
    const warp = Math.sin(v * Math.PI * 2 * warpFreq);
    const weft = Math.sin(u * Math.PI * 2 * weftFreq);
    // Plain weave: warp dominates where weft is above zero, and vice versa.
    // Add a small high-frequency noise so threads aren't perfectly regular.
    const interleave = (warp + weft) * 0.5;
    const noise = (pseudoNoise(u * 128, v * 128) - 0.5) * 0.15;
    return interleave * 0.8 + noise;
  }

  function pseudoNoise(x, y) {
    // Cheap deterministic hash — no lib dependency.
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  // Build normal map via central differences on the height field.
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
  tex.repeat.set(2, 2); // tight — weave should feel small-scale on the garment
  tex.needsUpdate = true;
  return tex;
}
