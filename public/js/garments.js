// Garment meshes — both the placeholder primitive we use to prove out the
// texture pipeline, and a loader that swaps in real glTF models when the
// user drops them into public/assets/models/.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// A draped-cloth placeholder: the body of a torso with gently curved sides
// so we can see how the swatch behaves on curvature. Built from a rounded
// cylinder with UVs carefully ordered so pattern direction reads as
// "up = head, across = around the body" — matching how real garments are
// cut with the warp running vertically.
export function buildPlaceholderGarment(material) {
  const group = new THREE.Group();

  // Torso: rounded cylinder scaled to a vaguely-human silhouette. Vertical
  // pattern direction works out of the box because CylinderGeometry's UVs
  // already have V = along the cylinder axis.
  const torsoGeo = new THREE.CylinderGeometry(
    0.28,        // top radius (shoulder-ish)
    0.32,        // bottom radius (waist-ish)
    1.3,         // height
    48,          // radial segments — enough for smooth pattern wrap
    24,          // height segments
    false
  );
  const torso = new THREE.Mesh(torsoGeo, material);
  torso.position.y = 1.0;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  // Neck/head stub — kept materially neutral so the swatch doesn't look
  // weird on a head. Swaps for the mannequin model later.
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x2a3a55, roughness: 0.8, metalness: 0,
  });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 32), headMat);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);

  // Shoulders — two stubby cylinders coming off the torso top so sleeves
  // exist even before we load a real jacket. Get the swatch wrapping
  // curved surfaces at multiple angles.
  for (const side of [-1, 1]) {
    const sleeveGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.55, 24, 12, false);
    const sleeve = new THREE.Mesh(sleeveGeo, material);
    sleeve.position.set(side * 0.34, 1.45, 0);
    sleeve.rotation.z = side * 0.3;
    sleeve.castShadow = true;
    group.add(sleeve);
  }

  return group;
}

// Attempt to load a real glTF garment from /assets/models/<name>.glb.
// Returns null (without throwing) if the model doesn't exist yet so we can
// fall back to the placeholder.
const loader = new GLTFLoader();
export function tryLoadModel(name, material) {
  return new Promise((resolve) => {
    const url = `./assets/models/${name}.glb`;
    // Probe first with HEAD so a missing model fails fast without a noisy
    // decoder error in the console.
    fetch(url, { method: "HEAD" }).then(r => {
      if (!r.ok) return resolve(null);
      loader.load(
        url,
        gltf => {
          const root = gltf.scene;
          // Apply the shared material to every mesh so swatch changes reach
          // the whole garment. If a model has multiple meshes we want them
          // to share the same fabric.
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
