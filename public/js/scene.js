// Scene, lighting, and environment setup. Returns the scene + helper hooks
// so main.js can mount garments and toggle the grid without knowing the
// internals.

import * as THREE from "three";

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1628);

  // Three-point lighting: a warm key, a cool fill, a soft hemisphere top-down.
  // Keeps fabric colors readable and gives the weave normal map something
  // interesting to pick up at any viewing angle.
  const hemi = new THREE.HemisphereLight(0xeaf2ff, 0x1a1a1a, 0.55);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.5);
  keyLight.position.set(2.5, 3.2, 2.2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 10;
  const s = 2.5;
  keyLight.shadow.camera.left = -s;
  keyLight.shadow.camera.right = s;
  keyLight.shadow.camera.top = s;
  keyLight.shadow.camera.bottom = -s;
  keyLight.shadow.bias = -0.0003;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x9ab8ff, 0.6);
  fillLight.position.set(-2.2, 1.6, 1.5);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
  rimLight.position.set(0, 2.0, -3);
  scene.add(rimLight);

  // Ground — soft shadow catcher plus a dark plane so the mannequin has
  // somewhere to land visually.
  const groundGeo = new THREE.CircleGeometry(6, 64);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0d1a30, roughness: 1.0, metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid helper — subtle, toggleable for alignment reference
  const gridHelper = new THREE.GridHelper(6, 12, 0x1e3a5f, 0x162a47);
  gridHelper.position.y = 0.001;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.35;
  scene.add(gridHelper);

  return {
    scene,
    gridHelper,
    setGridVisible(v) { gridHelper.visible = v; },
  };
}
