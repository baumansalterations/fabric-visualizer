// Garment meshes — a procedurally-generated anatomical dress form.
//
// Key insight over the earlier lathe version: real human torsos are NOT
// axisymmetric. Shoulders spread much wider than the chest is deep. A
// tailor's dress form reads wrong if chest/shoulders have the same front-
// to-back depth as side-to-side width. We fix that by building the torso
// as a parametric surface with ELLIPTICAL cross-sections — separate
// width and depth at every height, smoothly interpolated between keyframe
// profile points.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// --- Mannequin material (non-fabric parts: head, neck, pedestal) -----------
function makeMannequinMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x1a2638,
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.6,
  });
}

// --- Torso profile keyframes ------------------------------------------------
// [v, width, depth] where:
//   v     — normalized height, 0 at base to 1 at neck top
//   width — half-axis on the X axis (side to side)
//   depth — half-axis on the Z axis (front to back)
//
// Width > depth everywhere for a menswear chest. Shoulders spread wider
// without spreading deeper. Waist pinches on both axes but more on width.
// First and last entries close the lathe to solid caps at the poles.
const TORSO_PROFILE = [
  [0.00, 0.00, 0.00],  // closed bottom pole (solid cap)
  [0.02, 0.20, 0.14],  // bottom disc edge
  [0.08, 0.30, 0.20],  // lower hips
  [0.16, 0.32, 0.21],  // hip widest
  [0.24, 0.30, 0.20],  // upper hips
  [0.32, 0.26, 0.19],  // lower waist taper
  [0.40, 0.23, 0.17],  // waist (narrowest)
  [0.48, 0.26, 0.19],  // upper waist
  [0.56, 0.31, 0.22],  // lower chest
  [0.66, 0.37, 0.24],  // mid chest
  [0.74, 0.42, 0.25],  // upper chest
  [0.80, 0.46, 0.24],  // shoulder width peak (widest point overall)
  [0.84, 0.44, 0.22],  // shoulder top
  [0.88, 0.34, 0.19],  // shoulder slope toward neck
  [0.92, 0.20, 0.15],  // upper shoulder taper
  [0.95, 0.12, 0.11],  // neck base
  [0.98, 0.095, 0.095],// neck
  [1.00, 0.00, 0.00],  // closed top pole (solid cap, neck top)
];

// Interpolate profile with a cosine-smoothed ease so vertical transitions
// read as organic curves, not piecewise-linear kinks. Returns [width, depth]
// at a given normalized height `v` in 0..1.
function profileAt(v) {
  const p = TORSO_PROFILE;
  for (let i = 0; i < p.length - 1; i++) {
    const [v0, w0, d0] = p[i];
    const [v1, w1, d1] = p[i + 1];
    if (v >= v0 && v <= v1) {
      const t = (v1 === v0) ? 0 : (v - v0) / (v1 - v0);
      const s = t * t * (3 - 2 * t); // smoothstep
      return [w0 + (w1 - w0) * s, d0 + (d1 - d0) * s];
    }
  }
  const last = p[p.length - 1];
  return [last[1], last[2]];
}

// Build the torso as a parametric BufferGeometry. Elliptical cross-sections
// at every height, smooth interpolation between keyframes, clean UV mapping
// (u around the body, v up the body) so vertical-warp fabric patterns
// behave correctly out of the box.
function buildTorsoGeometry(totalHeight) {
  const radialSegments = 96;
  const heightSegments = 140;

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iy = 0; iy <= heightSegments; iy++) {
    const v = iy / heightSegments;
    const [width, depth] = profileAt(v);
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
      // Two triangles per quad, wound CCW facing outward
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// --- Build the whole placeholder mannequin ---------------------------------
export function buildPlaceholderGarment(material) {
  const group = new THREE.Group();

  const TORSO_HEIGHT = 1.0;
  const TORSO_Y = 0.55;
  const mannequinMat = makeMannequinMaterial();

  // --- Pedestal ---
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
  const torsoGeo = buildTorsoGeometry(TORSO_HEIGHT);
  const torso = new THREE.Mesh(torsoGeo, material);
  torso.position.y = TORSO_Y;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // --- Arms (fabric) ---
  // Capsule sleeves at the shoulder broadest band. Angled down + slightly
  // forward so they read as arms-at-rest, not T-pose.
  const shoulderY = TORSO_Y + 0.82 * TORSO_HEIGHT;
  const [shoulderW] = profileAt(0.80); // matches the widest-point width
  for (const side of [-1, 1]) {
    const sleeveGeo = new THREE.CapsuleGeometry(0.085, 0.34, 10, 32);
    const sleeve = new THREE.Mesh(sleeveGeo, material);
    // Capsule is Y-axis by default. Rotate 90° around Z so length runs
    // left-right, then rotate slightly around X to angle down+forward.
    sleeve.rotation.order = "ZXY";
    sleeve.rotation.z = side * (Math.PI / 2.2);
    sleeve.rotation.x = -0.18;
    // Attach just inside the shoulder surface so the arm blends into the
    // outline rather than floating apart from it.
    sleeve.position.set(side * (shoulderW * 0.8), shoulderY, 0.02);
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    group.add(sleeve);
  }

  // --- Neck (matte) ---
  const neckY = TORSO_Y + TORSO_HEIGHT;
  const neckGeo = new THREE.CylinderGeometry(0.082, 0.095, 0.07, 24);
  const neck = new THREE.Mesh(neckGeo, mannequinMat);
  neck.position.y = neckY + 0.035;
  neck.castShadow = true;
  group.add(neck);

  // --- Head (matte) ---
  // Featureless egg-shape. Slightly elongated vertically for a more realistic
  // mannequin feel.
  const headGeo = new THREE.SphereGeometry(0.135, 64, 64);
  headGeo.scale(0.95, 1.2, 0.98);
  const head = new THREE.Mesh(headGeo, mannequinMat);
  head.position.y = neckY + 0.07 + 0.15;
  head.castShadow = true;
  group.add(head);

  return group;
}

// --- glTF loader -------------------------------------------------------------

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

export function tryLoadModel(name, fabricMaterial) {
  return loadModel(`./assets/models/${name}.glb`, fabricMaterial, null);
}

export function tryLoadMannequin(fabricMaterial) {
  return loadModel("./assets/models/mannequin.glb", fabricMaterial, makeMannequinMaterial());
}
