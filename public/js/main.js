// Entry point — wires scene, post-processing, swatch pipeline, and UI.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { createScene } from "./scene.js";
import { buildPlaceholderGarment, buildGarmentByName, tryLoadModel } from "./garments.js";
import { applySwatchToMaterial, buildWeaveNormalMap, buildProceduralSwatch } from "./swatch.js";

// ---- Renderer -------------------------------------------------------------

const canvas = document.getElementById("scene-canvas");
const viewport = document.getElementById("viewport");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---- Camera ---------------------------------------------------------------

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0.6, 3.6);

// ---- Scene ----------------------------------------------------------------

const { scene, setGridVisible } = createScene(renderer);

// ---- Controls -------------------------------------------------------------

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.4, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.4;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI * 0.52;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.7;

// ---- Post-processing ------------------------------------------------------
// Bloom adds a subtle luminous sheen to highlights, which reads especially
// well on woven fabrics catching the rim light. Strength kept low so dark
// navy doesn't bloom into a haze.

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(viewport.clientWidth, viewport.clientHeight),
  0.35,  // strength
  0.6,   // radius
  0.85,  // threshold
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();

// ---- Fabric material ------------------------------------------------------
// MeshPhysicalMaterial is a superset of MeshStandardMaterial that adds the
// features fabric visualization actually needs: sheen (for satin, silk, and
// fine wool) and clearcoat (for coated wool / tech fabrics). Starts matte.

const sharedMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x888888,
  roughness: 0.82,
  metalness: 0.0,
  sheen: 0.3,
  sheenColor: new THREE.Color(0xffffff),
  sheenRoughness: 0.65,
  clearcoat: 0.0,
  normalMap: buildWeaveNormalMap(35),
  normalScale: new THREE.Vector2(1, 1),
});

// Apply a subtle procedural swatch by default so the mannequin doesn't
// look like flat gray paint on first load — a mid-grey twill reads as
// "ready for your fabric."
sharedMaterial.map = buildProceduralSwatch("twill", "#4a5366");
sharedMaterial.map.wrapS = sharedMaterial.map.wrapT = THREE.RepeatWrapping;
sharedMaterial.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
sharedMaterial.needsUpdate = true;

// ---- Garment mount --------------------------------------------------------

const GARMENT_ROOT = new THREE.Group();
scene.add(GARMENT_ROOT);

function mountGarment(name) {
  while (GARMENT_ROOT.children.length) {
    const c = GARMENT_ROOT.children.pop();
    c.traverse?.(o => { if (o.isMesh && o.geometry) o.geometry.dispose?.(); });
  }
  // Prefer a custom glTF if the user dropped one into /assets/models/ —
  // otherwise generate the garment procedurally. Procedural is always
  // available, so every button works immediately.
  tryLoadModel(name === "placeholder" ? "suit" : name, sharedMaterial).then(obj => {
    if (obj) { GARMENT_ROOT.add(obj); return; }
    GARMENT_ROOT.add(buildGarmentByName(name, sharedMaterial));
  });
}
mountGarment("suit");

// ---- UI wiring ------------------------------------------------------------

const ui = {
  swatchInput: document.getElementById("swatch-input"),
  uploadCta: document.getElementById("upload-cta"),
  uploadPlaceholder: document.getElementById("upload-placeholder"),
  swatchPreview: document.getElementById("swatch-preview-img"),
  presets: document.getElementById("preset-swatches"),
  repeatX: document.getElementById("repeat-x"),
  repeatXNum: document.getElementById("repeat-x-num"),
  repeatY: document.getElementById("repeat-y"),
  repeatYNum: document.getElementById("repeat-y-num"),
  rotate: document.getElementById("rotate"),
  rotateNum: document.getElementById("rotate-num"),
  weave: document.getElementById("weave"),
  weaveNum: document.getElementById("weave-num"),
  sheen: document.getElementById("sheen"),
  sheenNum: document.getElementById("sheen-num"),
  garmentPicker: document.getElementById("garment-picker"),
  resetCamera: document.getElementById("reset-camera"),
  toggleGrid: document.getElementById("toggle-grid"),
  autoRotate: document.getElementById("auto-rotate"),
  hint: document.getElementById("hint"),
};

function linkSlider(rangeEl, numEl, onChange) {
  function apply(v) { rangeEl.value = v; numEl.value = v; onChange(parseFloat(v)); }
  rangeEl.addEventListener("input", () => apply(rangeEl.value));
  numEl.addEventListener("input", () => apply(numEl.value));
}

function refreshSwatch() {
  const rx = parseFloat(ui.repeatX.value);
  const ry = parseFloat(ui.repeatY.value);
  const rot = parseFloat(ui.rotate.value) * Math.PI / 180;
  applySwatchToMaterial(sharedMaterial, { repeatX: rx, repeatY: ry, rotation: rot });
}

linkSlider(ui.repeatX, ui.repeatXNum, refreshSwatch);
linkSlider(ui.repeatY, ui.repeatYNum, refreshSwatch);
linkSlider(ui.rotate, ui.rotateNum, refreshSwatch);
linkSlider(ui.weave, ui.weaveNum, v => {
  sharedMaterial.normalMap?.dispose?.();
  sharedMaterial.normalMap = buildWeaveNormalMap(v);
  sharedMaterial.needsUpdate = true;
});
linkSlider(ui.sheen, ui.sheenNum, v => {
  sharedMaterial.sheen = v / 100;
  sharedMaterial.sheenRoughness = 0.65 - (v / 100) * 0.4;
  sharedMaterial.needsUpdate = true;
});

// Upload handler
function loadSwatchFromImage(img, previewUrl) {
  const tex = new THREE.Texture(img);
  tex.needsUpdate = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  sharedMaterial.map?.dispose?.();
  sharedMaterial.map = tex;
  sharedMaterial.color.set(0xffffff);
  sharedMaterial.needsUpdate = true;
  refreshSwatch();
  if (previewUrl) {
    ui.swatchPreview.src = previewUrl;
    ui.swatchPreview.style.display = "block";
    ui.uploadPlaceholder.style.display = "none";
    ui.uploadCta.classList.add("has-swatch");
  }
  ui.hint.textContent = "Drag to rotate · scroll to zoom";
}

ui.swatchInput.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => { loadSwatchFromImage(img, reader.result); toast("Swatch applied"); };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// Preset swatches — procedurally generated thumbnails for common menswear
// fabrics so a rep can see the pipeline working before they have a swatch
// in hand.
const PRESETS = [
  { name: "Navy twill",     pattern: "twill",      color: "#1f2d4e", repeat: 10 },
  { name: "Charcoal herringbone", pattern: "herringbone", color: "#3a3e46", repeat: 6 },
  { name: "Glen plaid",     pattern: "glenplaid",  color: "#7a6e54", repeat: 4 },
  { name: "Windowpane",     pattern: "windowpane", color: "#a39270", repeat: 3 },
  { name: "Birdseye",       pattern: "birdseye",   color: "#2a3d5a", repeat: 20 },
  { name: "Solid wool",     pattern: "solid",      color: "#5b3a2e", repeat: 1 },
];

function renderPresetGallery() {
  ui.presets.innerHTML = "";
  for (const p of PRESETS) {
    const swatch = buildProceduralSwatch(p.pattern, p.color);
    const btn = document.createElement("button");
    btn.className = "preset-btn";
    btn.title = p.name;
    const img = document.createElement("img");
    img.src = swatch.image.toDataURL();
    img.alt = p.name;
    const label = document.createElement("span");
    label.className = "preset-label";
    label.textContent = p.name;
    btn.appendChild(img);
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      const src = swatch.image.toDataURL();
      const freshImg = new Image();
      freshImg.onload = () => {
        loadSwatchFromImage(freshImg, src);
        ui.repeatX.value = p.repeat; ui.repeatXNum.value = p.repeat;
        ui.repeatY.value = p.repeat; ui.repeatYNum.value = p.repeat;
        refreshSwatch();
      };
      freshImg.src = src;
    });
    ui.presets.appendChild(btn);
  }
}
renderPresetGallery();

// Garment picker
ui.garmentPicker.addEventListener("click", e => {
  const btn = e.target.closest(".garment-btn");
  if (!btn || btn.disabled) return;
  [...ui.garmentPicker.querySelectorAll(".garment-btn")].forEach(b => b.classList.toggle("active", b === btn));
  mountGarment(btn.dataset.garment);
});

ui.resetCamera.addEventListener("click", () => {
  camera.position.set(0, 1.5, 3.4);
  controls.target.set(0, 1.25, 0);
});
let gridVisible = false;
ui.toggleGrid.addEventListener("click", () => {
  gridVisible = !gridVisible;
  setGridVisible(gridVisible);
});

ui.autoRotate.addEventListener("change", e => {
  controls.autoRotate = e.target.checked;
});

// ---- Render loop ----------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  composer.render();
}
animate();

// ---- Toast ----------------------------------------------------------------
function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translate(-50%, 8px)"; }, 2000);
  setTimeout(() => el.remove(), 2400);
}
