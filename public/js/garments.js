// Garment meshes — a dress-form-style placeholder built from a lathed
// profile curve plus carefully shaped arms, plus a glTF loader for when
// real models land in /assets/models/.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// A lathed dress-form silhouette. Uses a profile of 2D points revolved
// around the Y axis — gives a sculptural mannequin form that reads as
// "menswear display" rather than "cylinder." UVs wrap naturally with
// V along the vertical axis, so vertical-warp fabric patterns behave
// correctly out of the box.
export function buildPlaceholderGarment(material) {
  const group = new THREE.Group();

  // Profile in (radius, height) pairs. Dense near shoulders + chest so the
  // lathe reads as a real torso taper, not a lumpy cylinder.
  const profile = [
    [0.26, 0.00],   // base (hips)
    [0.29, 0.10],
    [0.31, 0.22],
    [0.32, 0.35],   // widest (chest)
    [0.315, 0.48],
    [0.29, 0.62],
    [0.26, 0.75],   // upper chest
    [0.22, 0.85],   // shoulders narrow in
    [0.14, 0.92],   // neck base
    [0.10, 0.98],   // collar
    [0.095, 1.02],
    [0.095, 1.08],  // neck
  ];
  const profilePoints = profile.map(p => new THREE.Vector2(p[0], p[1]));
  const torsoGeo = new THREE.LatheGeometry(profilePoints, 96);
  const torso = new THREE.Mesh(torsoGeo, material);
  torso.position.y = 0.7;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // Head — neutral matte, not fabric. Slightly elongated for menswear
  // mannequin proportions (head models used in retail display are typically
  // featureless and a bit tall).
  const headMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a2638,
    roughness: 0.45,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.7,
  });
  const headGeo = new THREE.SphereGeometry(0.13, 48, 48);
  headGeo.scale(1, 1.25, 1);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 0.7 + 1.08 + 0.12;
  head.castShadow = true;
  group.add(head);

  // Neck stub — matte finish between head and collar, sells the "dress form
  // capped with head" look.
  const neckStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.095, 0.06, 24),
    headMat,
  );
  neckStub.position.y = 0.7 + 1.08 + 0.03;
  neckStub.castShadow = true;
  group.add(neckStub);

  // Arms — short sleeve stubs extending from the shoulder area. Curved out
  // with a slight droop so they don't look robotic. Separate geometries so
  // we can rotate/pose them later without disturbing the torso.
  for (const side of [-1, 1]) {
    const sleeveProfile = [
      [0.095, 0.00],
      [0.095, 0.08],
      [0.09, 0.22],
      [0.085, 0.38],
      [0.078, 0.52],
    ];
    const sleevePts = sleeveProfile.map(p => new THREE.Vector2(p[0], p[1]));
    const sleeveGeo = new THREE.LatheGeometry(sleevePts, 40);
    const sleeve = new THREE.Mesh(sleeveGeo, material);
    // Position at the shoulder seam and angle out + slightly forward/down.
    sleeve.position.set(side * 0.22, 0.7 + 0.82, 0);
    sleeve.rotation.z = side * (Math.PI / 2.6);
    sleeve.rotation.x = 0.15;
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    group.add(sleeve);
  }

  // Pedestal — matte black disc under the form so it doesn't look like it's
  // floating. Only visible against the reflector floor, very small.
  const pedestalGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.04, 48);
  const pedestalMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0f1a, roughness: 0.25, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.2,
  });
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = 0.72;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  return group;
}

// Load a real glTF garment from /assets/models/<name>.glb. Returns null if
// the file isn't present yet so the caller can fall back to placeholder.
const loader = new GLTFLoader();
export function tryLoadModel(name, material) {
  return new Promise((resolve) => {
    const url = `./assets/models/${name}.glb`;
    fetch(url, { method: "HEAD" }).then(r => {
      if (!r.ok) return resolve(null);
      loader.load(
        url,
        gltf => {
          const root = gltf.scene;
          root.traverse(obj => {
            if (obj.isMesh) {
              obj.material = material;
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
