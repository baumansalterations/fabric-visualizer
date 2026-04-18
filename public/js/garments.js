// Garment meshes — a tailored dress-form placeholder with menswear
// proportions plus a glTF loader for when real garments land in
// /assets/models/.
//
// The placeholder is three primitives composed to read as "classic menswear
// tailor's dress form on a pedestal stand":
//   1. Torso — closed LatheGeometry with a proper human silhouette (hip →
//      pinched waist → wide chest → shoulder dropoff → neck).
//   2. Arms — CapsuleGeometry (capped cylinders) angled out from the
//      shoulders like short sleeve stubs.
//   3. Head + neck — matte, non-fabric so the swatch doesn't sit on the
//      head awkwardly. Mounted on a thin pedestal pole + disc base.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// --- Neutral mannequin material (not fabric) --------------------------------
function makeMannequinMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x1a2638,
    roughness: 0.55,
    metalness: 0.0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.7,
  });
}

// --- Torso profile -----------------------------------------------------------
// Pairs of (radius, height). Heights normalized 0..1 within the torso. The
// profile starts at (0, 0) and ends at (0, 1.0) so the LatheGeometry closes
// cleanly at both poles (flat bottom, capped neck top).
//
// Proportions: widest band at ~75% (chest + shoulder line), waist pinch at
// ~35% height, hips slightly narrower than chest. This matches a classic
// menswear tailor's form — chest dominates, hips sit tucked.
const TORSO_PROFILE = [
  [0.00, 0.00],   // bottom pole (closes base)
  [0.12, 0.00],   // flat bottom disc edge
  [0.28, 0.02],
  [0.30, 0.08],   // lower hip
  [0.28, 0.18],   // upper hip
  [0.25, 0.28],   // lower waist
  [0.23, 0.36],   // waist (narrowest middle)
  [0.25, 0.46],   // upper waist
  [0.30, 0.58],   // lower chest
  [0.34, 0.68],   // mid chest
  [0.36, 0.76],   // upper chest (widest)
  [0.36, 0.82],   // shoulder line
  [0.34, 0.86],   // shoulder crest
  [0.22, 0.91],   // shoulder dropoff
  [0.14, 0.95],
  [0.10, 0.99],   // neck base
  [0.095, 1.03],  // neck
  [0.095, 1.06],
  [0.00, 1.06],   // top pole (closes neck)
];

export function buildPlaceholderGarment(material) {
  const group = new THREE.Group();

  const TORSO_HEIGHT = 1.0;      // world units from bottom of form to top of neck
  const TORSO_Y = 0.55;           // where the bottom of the torso sits in the world
  const mannequinMat = makeMannequinMaterial();

  // --- Pedestal stand ---
  // Classic menswear dress-form base: thin pole rising to a disc, disc under
  // the torso. Matte black so it recedes visually.
  const baseGeo = new THREE.CylinderGeometry(0.26, 0.30, 0.025, 48);
  const base = new THREE.Mesh(baseGeo, new THREE.MeshPhysicalMaterial({
    color: 0x08101e, roughness: 0.15, metalness: 0.2,
    clearcoat: 0.8, clearcoatRoughness: 0.2,
  }));
  base.position.y = 0.013;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const poleGeo = new THREE.CylinderGeometry(0.022, 0.028, TORSO_Y - 0.02, 20);
  const pole = new THREE.Mesh(poleGeo, new THREE.MeshPhysicalMaterial({
    color: 0x1a2330, roughness: 0.25, metalness: 0.55, clearcoat: 0.4,
  }));
  pole.position.y = (TORSO_Y - 0.02) / 2 + 0.025;
  pole.castShadow = true;
  group.add(pole);

  // --- Torso (fabric) ---
  const torsoPts = TORSO_PROFILE.map(([r, h]) => new THREE.Vector2(r, h * TORSO_HEIGHT));
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 96);
  const torso = new THREE.Mesh(torsoGeo, material);
  torso.position.y = TORSO_Y;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // --- Arms (fabric) ---
  // CapsuleGeometry creates a proper rounded-end cylinder — no open ends to
  // peek inside. Mounted at the shoulder level, angled out and slightly
  // forward/down to suggest a natural rest pose.
  const shoulderY = TORSO_Y + (0.84 * TORSO_HEIGHT); // upper chest band
  for (const side of [-1, 1]) {
    const sleeveGeo = new THREE.CapsuleGeometry(0.09, 0.32, 8, 32);
    const sleeve = new THREE.Mesh(sleeveGeo, material);
    // Capsule is Y-axis aligned by default. Rotate 90° around Z so it points
    // sideways, then add a slight forward tilt.
    sleeve.rotation.z = side * (Math.PI / 2);
    sleeve.rotation.x = -0.12;
    // Push out to the shoulder, slightly down from the shoulder crest
    sleeve.position.set(side * 0.35, shoulderY - 0.02, 0.02);
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    group.add(sleeve);
  }

  // --- Neck stub (matte) ---
  // Short cylinder between the torso's capped top and the head. Non-fabric
  // so the swatch doesn't wrap an awkward neck region.
  const neckY = TORSO_Y + TORSO_HEIGHT;
  const neckGeo = new THREE.CylinderGeometry(0.085, 0.095, 0.06, 24);
  const neck = new THREE.Mesh(neckGeo, mannequinMat);
  neck.position.y = neckY + 0.03;
  neck.castShadow = true;
  group.add(neck);

  // --- Head (matte) ---
  // Slightly vertically elongated sphere — classic featureless mannequin head.
  const headGeo = new THREE.SphereGeometry(0.135, 48, 48);
  headGeo.scale(1, 1.2, 1);
  const head = new THREE.Mesh(headGeo, mannequinMat);
  head.position.y = neckY + 0.06 + 0.15;
  head.castShadow = true;
  group.add(head);

  return group;
}

// --- glTF loader -------------------------------------------------------------
// Drop-in for real garments AND for the base mannequin. Falls back silently
// to null if the file is missing so main.js can swap to the procedural
// placeholder.
//
// Heuristic for multi-mesh humanoid models (e.g. a Mixamo / Quaternius
// character that has separate head + body + eyes + hands meshes): we only
// apply the fabric material to meshes whose name suggests "body" or
// "clothing." Anything that looks like a head, face, eye, hair, hand, or
// foot keeps a neutral matte material so the swatch doesn't wrap a face.
const NON_FABRIC_HINTS = ["head", "face", "eye", "brow", "lash", "hair", "tooth", "tongue", "hand", "finger", "foot", "toe", "skin", "nail"];

function isNonFabricMesh(name) {
  const n = (name || "").toLowerCase();
  return NON_FABRIC_HINTS.some(h => n.includes(h));
}

const loader = new GLTFLoader();
function loadModel(url, fabricMaterial, mannequinMaterial) {
  return new Promise((resolve) => {
    fetch(url, { method: "HEAD" }).then(r => {
      if (!r.ok) return resolve(null);
      loader.load(
        url,
        gltf => {
          const root = gltf.scene;
          root.traverse(obj => {
            if (obj.isMesh) {
              const useFabric = !isNonFabricMesh(obj.name);
              obj.material = useFabric ? fabricMaterial : (mannequinMaterial || makeMannequinMaterial());
              obj.castShadow = true;
              obj.receiveShadow = true;
            }
          });
          resolve(root);
        },
        undefined,
        err => { console.warn("[garments] failed to load", url, err); resolve(null); }
      );
    }).catch(() => resolve(null));
  });
}

// Try to load a named garment glb (trouser / jacket / suit / etc.)
export function tryLoadModel(name, fabricMaterial) {
  return loadModel(`./assets/models/${name}.glb`, fabricMaterial, null);
}

// Try to load a base mannequin model. Used as the default form when present —
// replaces the procedural dress-form placeholder. Drop a glTF into
// public/assets/models/mannequin.glb and reload to enable.
export function tryLoadMannequin(fabricMaterial) {
  return loadModel("./assets/models/mannequin.glb", fabricMaterial, makeMannequinMaterial());
}
