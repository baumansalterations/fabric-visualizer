// Entry point — wires together the scene, the swatch pipeline, and the UI.
// No build step: runs as a native ES module in the browser.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { createScene } from "./scene.js";
import { buildPlaceholderGarment, tryLoadModel } from "./garments.js";
import { applySwatchToMaterial, buildWeaveNormalMap } from "./swatch.js";

// ---- Scene setup ----------------------------------------------------------

const canvas = document.getElementById("scene-canvas");
const viewport = document.getElementById("viewport");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 1.4, 3.2);

const { scene, gridHelper, setGridVisible } = createScene();

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.1, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI * 0.52;

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();

// ---- Garment state --------------------------------------------------------
// Keep a single "current garment root" in the scene. Swapping garments just
// replaces this subtree. The shared material lives on the outer scope so
// swatch updates reach whichever garment is mounted.

const GARMENT_ROOT = new THREE.Group();
scene.add(GARMENT_ROOT);

const sharedMaterial = new THREE.MeshStandardMaterial({
  color: 0x777777,
  roughness: 0.75,
  metalness: 0.04,
  // Fabric weave is added in via a procedural normal map. Regenerated when
  // the weave-depth slider moves.
  normalMap: buildWeaveNormalMap(35),
  normalScale: new THREE.Vector2(1, 1),
});

let currentGarment = "placeholder";
function mountGarment(name) {
  currentGarment = name;
  // Remove existing children
  while (GARMENT_ROOT.children.length) {
    const c = GARMENT_ROOT.children.pop();
    c.traverse?.(o => { if (o.isMesh && o.geometry) o.geometry.dispose?.(); });
  }
  if (name === "placeholder") {
    GARMENT_ROOT.add(buildPlaceholderGarment(sharedMaterial));
  } else {
    // Real glTF — will bail out silently and fall back if the file isn't there yet.
    tryLoadModel(name, sharedMaterial).then(obj => {
      if (obj) GARMENT_ROOT.add(obj);
      else {
        GARMENT_ROOT.add(buildPlaceholderGarment(sharedMaterial));
        toast(`No model for "${name}" yet — drop ${name}.glb into public/assets/models/`);
      }
    });
  }
}
mountGarment("placeholder");

// ---- UI wiring ------------------------------------------------------------

const ui = {
  swatchInput: document.getElementById("swatch-input"),
  uploadCta: document.getElementById("upload-cta"),
  uploadPlaceholder: document.getElementById("upload-placeholder"),
  swatchPreview: document.getElementById("swatch-preview-img"),
  repeatX: document.getElementById("repeat-x"),
  repeatXNum: document.getElementById("repeat-x-num"),
  repeatY: document.getElementById("repeat-y"),
  repeatYNum: document.getElementById("repeat-y-num"),
  rotate: document.getElementById("rotate"),
  rotateNum: document.getElementById("rotate-num"),
  weave: document.getElementById("weave"),
  weaveNum: document.getElementById("weave-num"),
  garmentPicker: document.getElementById("garment-picker"),
  resetCamera: document.getElementById("reset-camera"),
  toggleGrid: document.getElementById("toggle-grid"),
  hint: document.getElementById("hint"),
};

// Link sliders + number inputs both directions
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

// Swatch upload
ui.swatchInput.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      sharedMaterial.map = tex;
      sharedMaterial.color.set(0xffffff); // neutralize base tint so swatch shows true
      sharedMaterial.needsUpdate = true;
      refreshSwatch();
      // Preview in panel
      ui.swatchPreview.src = reader.result;
      ui.swatchPreview.style.display = "block";
      ui.uploadPlaceholder.style.display = "none";
      ui.uploadCta.classList.add("has-swatch");
      ui.hint.textContent = "Drag to rotate · scroll to zoom";
      toast("Swatch applied");
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// Garment picker
ui.garmentPicker.addEventListener("click", e => {
  const btn = e.target.closest(".garment-btn");
  if (!btn || btn.disabled) return;
  [...ui.garmentPicker.querySelectorAll(".garment-btn")].forEach(b => b.classList.toggle("active", b === btn));
  mountGarment(btn.dataset.garment);
});

// Reset + grid
ui.resetCamera.addEventListener("click", () => {
  camera.position.set(0, 1.4, 3.2);
  controls.target.set(0, 1.1, 0);
});
let gridVisible = true;
ui.toggleGrid.addEventListener("click", () => {
  gridVisible = !gridVisible;
  setGridVisible(gridVisible);
});

// ---- Render loop ----------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ---- Tiny toast (bottom-center) ------------------------------------------
function toast(msg) {
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed", bottom: "40px", left: "50%", transform: "translateX(-50%)",
    background: "var(--surface)", border: "1px solid var(--gold)", color: "var(--gold)",
    padding: "10px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "500",
    zIndex: 9999, pointerEvents: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
    animation: "fadeIn 0.25s ease",
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}
