# Fabric Visualizer

Interactive 3D fabric swatch previewer for Walker Brothers / Baumans. Upload a
2D swatch image, pick a garment, and see the swatch mapped onto a 3D mannequin
with realistic cloth weave and tiling that follows the garment's curves.

## Status

Phase 1 (this commit): working texture pipeline on a placeholder cloth
primitive. Swatch upload, tile control (horizontal / vertical repeats +
rotation), procedural cloth-weave normal map, orbit camera, lighting.

Phase 2: real glTF garment models (trouser, jacket, 2-piece suit), mannequin
from Mixamo, QR mobile→desktop upload bridge.

## Running locally

This is a pure static site — no build step. Just serve `public/` with any
web server. Examples:

```bash
# Python
python -m http.server 8000 --directory public

# Node (one-off)
npx http-server public -p 8000

# VSCode Live Server extension
# Right-click public/index.html → "Open with Live Server"
```

Then open <http://localhost:8000>.

## Deploying to Render

1. Push this repo to GitHub.
2. In Render, **New → Static Site**, connect the GitHub repo.
3. Build Command: *(leave empty)*. Publish Directory: `public`.
4. First deploy takes a few minutes; subsequent pushes auto-deploy.

A `render.yaml` is included so you can also create the service via Blueprint.

## Dropping in real garment models

Place glTF binaries in `public/assets/models/`:

| File name                  | Button   |
|----------------------------|----------|
| `trouser.glb`              | Trouser  |
| `jacket.glb`               | Jacket   |
| `suit.glb`                 | Suit     |

The app detects them on demand — no code change needed. Buttons enable
automatically when the file is present. Until then, "Placeholder" shows a
cylinder torso so you can still test the texture pipeline.

### Free model sources

Mannequin (rigged human base):
- Mixamo — free, Adobe account required, export as glTF

Garment models (free / CC0):
- [Sketchfab — filter by free + glTF](https://sketchfab.com/3d-models)
- [Poly Haven](https://polyhaven.com/) (mostly environments, some props)
- Blender community files (.blend) — open in Blender, export as glTF

**Important**: for the pattern to follow garment curves believably, the
model needs **clean UV unwrapping per panel** (separate UV islands for
sleeves, body front, body back, lapels). Amateur models often have stretched
or overlapping UVs that cause visible pattern distortion. Check UVs in
Blender before committing a model.

## File layout

```
public/
  index.html          — single-page app shell, styles, import map
  js/
    main.js           — entry: wires UI to scene + swatch pipeline
    scene.js          — scene, lighting, grid, shadow catcher
    garments.js       — placeholder primitive + glTF loader
    swatch.js         — swatch texture application + weave normal map
  assets/
    models/           — drop .glb garment models here
```

## Architecture notes

- **No build step.** ES modules + CDN. Fast iteration, easy deploy.
- **Shared material across garments.** A single `MeshStandardMaterial` is
  reused for every garment mount, so swapping jacket → trouser doesn't lose
  the swatch or tiling settings.
- **Procedural cloth weave.** Even a perfectly flat swatch photo reads as
  woven cloth because we add a weave normal map under it. Slider controls
  depth from 0 (smooth, painted-on) to 100 (coarse, burlap-grade).
- **Tiling in the UI, not at upload time.** User adjusts repeat X/Y and
  rotation live; changes apply to the texture in-place, no reload.

## Known limitations (Phase 1)

- Placeholder garment is a cylinder, not a real suit. Pattern tiles work but
  won't "drape" realistically until we drop in proper glTF models with real
  seams and UV layouts.
- No pattern-match at seams (real tailoring aligns stripes across a jacket
  front). Out of scope for v1; ambitious for any web-based tool.
- No saved presets or export to image. Phase 2+.
