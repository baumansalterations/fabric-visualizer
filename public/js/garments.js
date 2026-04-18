// Garment models — generated procedurally with proper tailored shapes, no
// mannequin underneath. Think of it as retail product photography: the
// trouser hangs in space with gravity-weighted silhouette; the jacket sits
// with shoulders broad, lapels open, a faint suggestion of the invisible
// wearer giving it shape.
//
// Each garment is a parametric BufferGeometry (or group of them) with
// anatomically-informed proportions and ELLIPTICAL cross-sections so the
// fabric wraps with the front-to-back vs side-to-side asymmetry that real
// tailored garments have.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// --- Shared helpers --------------------------------------------------------

// Smoothly interpolate [v, width, depth] profile keyframes so cross-sections
// flow organically between them. Used by every garment.
function profileAt(profile, v) {
  for (let i = 0; i < profile.length - 1; i++) {
    const [v0, w0, d0] = profile[i];
    const [v1, w1, d1] = profile[i + 1];
    if (v >= v0 && v <= v1) {
      const t = (v1 === v0) ? 0 : (v - v0) / (v1 - v0);
      const s = t * t * (3 - 2 * t);
      return [w0 + (w1 - w0) * s, d0 + (d1 - d0) * s];
    }
  }
  const last = profile[profile.length - 1];
  return [last[1], last[2]];
}

// Build a tapered elliptical tube with a profile of [v, w, d] keyframes,
// revolved around the Y axis. Radial and vertical segment counts are kept
// high enough for smooth silhouettes on shadow edges. Returns a
// BufferGeometry oriented with +Y up and the tube's bottom at origin.
function buildProfileGeometry(profile, totalHeight, radialSegments = 80, heightSegments = 120, open = false) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= heightSegments; iy++) {
    const v = iy / heightSegments;
    const [width, depth] = profileAt(profile, v);
    const y = v * totalHeight;
    for (let ix = 0; ix <= radialSegments; ix++) {
      const u = ix / radialSegments;
      const theta = u * Math.PI * 2;
      const x = width * Math.cos(theta);
      const z = depth * Math.sin(theta);
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let iy = 0; iy < heightSegments; iy++) {
    for (let ix = 0; ix < radialSegments; ix++) {
      const a = iy * (radialSegments + 1) + ix;
      const b = a + 1;
      const c = a + (radialSegments + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ==========================================================================
//  TROUSER
// ==========================================================================
// Two tapered legs + a waist/hip yoke. Legs have a slight hang — widest at
// the thigh, tapering through the knee, with a small cuff flare at the
// bottom. Menswear cut (narrower at waist than hips, gentle through knee).

const TROUSER_LEG_PROFILE = [
  [0.00, 0.10, 0.10],  // cuff (ankle)
  [0.05, 0.105, 0.10], // hem
  [0.20, 0.105, 0.095],// calf
  [0.40, 0.11, 0.10],  // knee
  [0.55, 0.115, 0.105],// thigh (widest below)
  [0.75, 0.13, 0.115], // upper thigh (widest)
  [0.90, 0.14, 0.125], // hip
  [1.00, 0.145, 0.13], // hip attachment
];

const TROUSER_YOKE_PROFILE = [
  [0.00, 0.00, 0.00],  // closed bottom (crotch — legs start below)
  [0.02, 0.10, 0.08],
  [0.15, 0.23, 0.17],  // hip
  [0.35, 0.26, 0.18],  // seat (widest hip)
  [0.60, 0.24, 0.17],  // upper hip
  [0.82, 0.22, 0.16],  // waist
  [0.92, 0.22, 0.16],  // waistband bottom
  [0.98, 0.225, 0.165],// waistband top
  [1.00, 0.00, 0.00],  // closed top
];

function buildTrouser(material) {
  const group = new THREE.Group();

  const LEG_LENGTH = 1.1;
  const YOKE_HEIGHT = 0.45;

  // --- Yoke (waist + hips) ---
  const yokeGeo = buildProfileGeometry(TROUSER_YOKE_PROFILE, YOKE_HEIGHT, 72, 60);
  const yoke = new THREE.Mesh(yokeGeo, material);
  yoke.position.y = LEG_LENGTH - 0.05;
  yoke.castShadow = true;
  yoke.receiveShadow = true;
  group.add(yoke);

  // --- Legs ---
  // Each leg a tapered elliptical tube. Slight outward angle so they
  // don't look parallel-stiff — gives a hanging-from-belt-loop feel.
  for (const side of [-1, 1]) {
    const legGeo = buildProfileGeometry(TROUSER_LEG_PROFILE, LEG_LENGTH, 56, 80);
    const leg = new THREE.Mesh(legGeo, material);
    leg.position.set(side * 0.115, 0, 0);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  }

  // --- Waistband detail (subtle ridge at top) ---
  const beltBandGeo = new THREE.TorusGeometry(0.225, 0.012, 12, 64);
  beltBandGeo.scale(1.0, 0.72, 1.0); // flatten into an ellipse
  const beltBandMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a2030, roughness: 0.35, metalness: 0.1, clearcoat: 0.5,
  });
  const beltBand = new THREE.Mesh(beltBandGeo, beltBandMat);
  beltBand.rotation.x = Math.PI / 2;
  beltBand.position.y = LEG_LENGTH - 0.05 + YOKE_HEIGHT - 0.01;
  beltBand.castShadow = true;
  group.add(beltBand);

  return group;
}

// ==========================================================================
//  JACKET
// ==========================================================================
// A torso shell with broad shoulders, narrower waist, sleeves angled down.
// Lapels are two flat panels extending from the collar area down to mid-
// chest. Open front (two mirrored halves with a vertical gap) so it reads
// as "worn with visible shirt behind it" — hints at the invisible wearer.

const JACKET_BODY_PROFILE = [
  [0.00, 0.00, 0.00],  // closed bottom pole
  [0.02, 0.22, 0.16],  // hem
  [0.10, 0.28, 0.20],  // lower body
  [0.25, 0.30, 0.21],  // hip (flares out slightly for fit)
  [0.45, 0.27, 0.19],  // waist suppression
  [0.65, 0.34, 0.22],  // chest
  [0.78, 0.42, 0.24],  // upper chest
  [0.88, 0.48, 0.24],  // shoulder width
  [0.93, 0.44, 0.22],  // shoulder taper
  [0.98, 0.30, 0.18],  // collar approach
  [1.00, 0.00, 0.00],  // closed top
];

const JACKET_SLEEVE_PROFILE = [
  [0.00, 0.065, 0.06], // cuff
  [0.05, 0.07, 0.065], // cuff top
  [0.30, 0.075, 0.07], // forearm
  [0.55, 0.085, 0.078],// elbow
  [0.78, 0.10, 0.094], // bicep
  [0.95, 0.12, 0.11],  // shoulder attachment
  [1.00, 0.12, 0.11],
];

function buildJacket(material) {
  const group = new THREE.Group();

  const BODY_HEIGHT = 0.90;
  const SLEEVE_LENGTH = 0.70;

  // --- Body shell ---
  const bodyGeo = buildProfileGeometry(JACKET_BODY_PROFILE, BODY_HEIGHT, 96, 120);
  const body = new THREE.Mesh(bodyGeo, material);
  body.position.y = 0;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // --- Sleeves ---
  // Mounted at the shoulder broadest band, angled down and slightly forward.
  const shoulderY = 0.88 * BODY_HEIGHT;
  for (const side of [-1, 1]) {
    const sleeveGeo = buildProfileGeometry(JACKET_SLEEVE_PROFILE, SLEEVE_LENGTH, 56, 80);
    const sleeve = new THREE.Mesh(sleeveGeo, material);
    // Orient the sleeve so its "bottom" (cuff, v=0) points down-out and its
    // "top" (shoulder attachment, v=1) mounts to the body.
    sleeve.rotation.order = "YZX";
    sleeve.rotation.z = side * (Math.PI * 0.52); // almost horizontal, slight droop
    sleeve.rotation.y = side * 0.05;
    sleeve.position.set(side * 0.46, shoulderY - 0.25, 0.02);
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    group.add(sleeve);
  }

  // --- Lapels ---
  // Two flat angled panels at the front chest, extending from collar down
  // to the top button. Built as thin extruded shapes so they have visible
  // depth catching light.
  const lapelShape = new THREE.Shape();
  lapelShape.moveTo(0, 0);
  lapelShape.lineTo(0.09, -0.02);
  lapelShape.lineTo(0.11, -0.28); // notch / gorge
  lapelShape.lineTo(0.04, -0.42); // lapel bottom point
  lapelShape.lineTo(0.0, -0.42);
  lapelShape.lineTo(0.0, 0);
  const lapelGeo = new THREE.ExtrudeGeometry(lapelShape, { depth: 0.01, bevelEnabled: false });
  for (const side of [-1, 1]) {
    const lapel = new THREE.Mesh(lapelGeo, material);
    lapel.scale.x = side;
    lapel.position.set(0, 0.70 * BODY_HEIGHT, JACKET_BODY_PROFILE.find(p => p[0] === 0.78)[2] + 0.005);
    lapel.rotation.y = side * -0.12;
    lapel.castShadow = true;
    lapel.receiveShadow = true;
    group.add(lapel);
  }

  // --- Collar ---
  // Small horseshoe band behind the neck, slightly raised. Fabric-covered.
  const collarShape = new THREE.Shape();
  collarShape.absarc(0, 0, 0.16, Math.PI * 0.15, Math.PI * 0.85, false);
  collarShape.absarc(0, 0, 0.13, Math.PI * 0.85, Math.PI * 0.15, true);
  const collarGeo = new THREE.ExtrudeGeometry(collarShape, { depth: 0.06, bevelEnabled: false });
  const collar = new THREE.Mesh(collarGeo, material);
  collar.rotation.x = -Math.PI / 2;
  collar.position.set(0, 0.92 * BODY_HEIGHT, -0.02);
  collar.castShadow = true;
  group.add(collar);

  // --- Buttons ---
  // Two-button stance (classic American cut). Small metallic discs on the
  // right front. Subtle but adds detail.
  const buttonMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a2420, roughness: 0.35, metalness: 0.3, clearcoat: 0.6,
  });
  for (let i = 0; i < 2; i++) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 20), buttonMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(0.02, 0.42 * BODY_HEIGHT - i * 0.11, 0.22);
    group.add(btn);
  }

  return group;
}

// ==========================================================================
//  SUIT (jacket + trouser stacked)
// ==========================================================================
function buildSuit(material) {
  const group = new THREE.Group();

  const trouser = buildTrouser(material);
  trouser.position.y = -1.15;
  group.add(trouser);

  const jacket = buildJacket(material);
  jacket.position.y = 0.0;
  group.add(jacket);

  return group;
}

// ==========================================================================
//  ENTRY — what gets mounted depends on the picker
// ==========================================================================
export function buildPlaceholderGarment(material) {
  // Default landing shape — a suit shows off the most fabric surface with
  // the most variety of tailored curves. If the rep just wants to show a
  // swatch, the suit is the most impressive default.
  return buildSuit(material);
}

export function buildGarmentByName(name, material) {
  switch (name) {
    case "trouser": return buildTrouser(material);
    case "jacket":  return buildJacket(material);
    case "suit":    return buildSuit(material);
    case "placeholder":
    default:        return buildSuit(material);
  }
}

// --- glTF loader (still supported if user drops in a real model) ----------

const NON_FABRIC_HINTS = ["head", "face", "eye", "brow", "lash", "hair", "tooth", "tongue", "hand", "finger", "foot", "toe", "skin", "nail"];
function isNonFabricMesh(name) {
  const n = (name || "").toLowerCase();
  return NON_FABRIC_HINTS.some(h => n.includes(h));
}

const loader = new GLTFLoader();
function loadModel(url, fabricMaterial) {
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
              const neutralMat = new THREE.MeshPhysicalMaterial({
                color: 0x1a2638, roughness: 0.5, metalness: 0.0,
              });
              obj.material = useFabric ? fabricMaterial : neutralMat;
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

export function tryLoadModel(name, fabricMaterial) {
  return loadModel(`./assets/models/${name}.glb`, fabricMaterial);
}

export function tryLoadMannequin(fabricMaterial) {
  return loadModel("./assets/models/mannequin.glb", fabricMaterial);
}
