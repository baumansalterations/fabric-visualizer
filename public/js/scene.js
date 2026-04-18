// Scene, lighting, environment, and floor. We build a small photo studio:
// a HDRI-lit environment for realistic fabric response, a few accented
// spotlights for drama, a reflective floor that fades into fog, and a
// vignette-friendly background gradient so the mannequin pops center-stage.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Reflector } from "three/addons/objects/Reflector.js";

export function createScene(renderer) {
  const scene = new THREE.Scene();

  // --- Background gradient ---------------------------------------------------
  // Vertical dark-navy → slightly-lighter vignette so the mannequin reads as
  // lit from above in a dark studio rather than floating in flat color.
  scene.background = buildGradientBackground();
  scene.fog = new THREE.FogExp2(0x07101f, 0.12);

  // --- Image-based lighting --------------------------------------------------
  // RoomEnvironment is a built-in synthetic HDRI that gives fabric surfaces
  // clean, broadcast-quality indirect lighting. No external .hdr to host.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTexture;

  // --- Accent lighting -------------------------------------------------------
  // Key + fill + rim. Kept restrained so the HDRI does most of the heavy
  // lifting — accent lights just shape contrast and give specular glints a
  // direction to come from.
  const key = new THREE.DirectionalLight(0xfff1d6, 1.4);
  key.position.set(2.5, 3.5, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 12;
  const s = 2.5;
  key.shadow.camera.left = -s; key.shadow.camera.right = s;
  key.shadow.camera.top = s;   key.shadow.camera.bottom = -s;
  key.shadow.bias = -0.0003;
  key.shadow.radius = 4;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8bb0ff, 0.35);
  fill.position.set(-2.5, 2.0, 1.5);
  scene.add(fill);

  // Rim light from behind-above, gives fabric edges a soft highlight.
  const rim = new THREE.SpotLight(0xffe8b0, 14.0, 8, Math.PI * 0.22, 0.65, 1.2);
  rim.position.set(-1.2, 3.4, -2.5);
  rim.target.position.set(0, 1.0, 0);
  scene.add(rim);
  scene.add(rim.target);

  // --- Floor -----------------------------------------------------------------
  // Reflector gives subtle mannequin reflection. Wrapped in a radial mask so
  // it fades to the fog color near the edges — no hard disc seam.
  const reflectorGeo = new THREE.CircleGeometry(5, 96);
  const reflector = new Reflector(reflectorGeo, {
    textureWidth: Math.min(1024, window.innerWidth),
    textureHeight: Math.min(1024, window.innerHeight),
    color: 0x0a1626,
    clipBias: 0.003,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = 0.0;
  scene.add(reflector);

  // Soft dark disc on top to attenuate the reflection — otherwise mirror
  // reads as polished glass, not studio marble.
  const floorTintGeo = new THREE.CircleGeometry(5, 96);
  const floorTintMat = new THREE.MeshBasicMaterial({
    color: 0x0b1828,
    transparent: true,
    opacity: 0.78,
  });
  const floorTint = new THREE.Mesh(floorTintGeo, floorTintMat);
  floorTint.rotation.x = -Math.PI / 2;
  floorTint.position.y = 0.001;
  scene.add(floorTint);

  // Radial vignette under the mannequin — slightly brighter directly below
  // so there's a "stage light" pooled at the feet.
  const vignetteGeo = new THREE.CircleGeometry(1.8, 96);
  const vignetteTex = buildRadialGradient(512, "rgba(255,220,160,0.12)", "rgba(255,220,160,0)");
  const vignetteMat = new THREE.MeshBasicMaterial({
    map: vignetteTex, transparent: true, depthWrite: false,
  });
  const vignette = new THREE.Mesh(vignetteGeo, vignetteMat);
  vignette.rotation.x = -Math.PI / 2;
  vignette.position.y = 0.002;
  scene.add(vignette);

  // --- Grid (hidden by default, toggleable) ----------------------------------
  const gridHelper = new THREE.GridHelper(6, 12, 0x1e3a5f, 0x162a47);
  gridHelper.position.y = 0.003;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.3;
  gridHelper.visible = false;
  scene.add(gridHelper);

  return {
    scene,
    gridHelper,
    setGridVisible(v) { gridHelper.visible = v; },
  };
}

// Build a vertical gradient background as a CanvasTexture. Cheaper and more
// reliable than a shader background for a nearly-static scene.
function buildGradientBackground() {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 512;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#0f2140");
  grad.addColorStop(0.55, "#0a1832");
  grad.addColorStop(1, "#050c1a");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Radial falloff — used for the floor "stage light" pool under the mannequin.
function buildRadialGradient(size, inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
