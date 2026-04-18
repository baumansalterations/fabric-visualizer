# Garment models

Drop glTF binary files (`.glb`) here. The app will detect them on demand and
enable the matching button in the UI.

Expected file names:

| File              | Slot                                     |
|-------------------|------------------------------------------|
| `mannequin.glb`   | Default base form (replaces dress form)  |
| `trouser.glb`     | Trouser button                           |
| `jacket.glb`      | Jacket button                            |
| `suit.glb`        | Suit button                              |

**`mannequin.glb` auto-loads on page open** if present, replacing the
procedural dress-form placeholder. Multi-mesh humanoid models are handled —
the loader applies the fabric material only to body / clothing meshes and
leaves head, face, eyes, hair, hands, and feet in a neutral matte material.
Mesh names are checked against keywords (`head`, `face`, `eye`, `brow`,
`lash`, `hair`, `tooth`, `tongue`, `hand`, `finger`, `foot`, `toe`, `skin`,
`nail`) so most off-the-shelf characters work without configuration.

## Recommended free, commercial-use mannequin sources

| Source | License | Notes |
|---|---|---|
| **Quaternius — Ultimate Modular Characters** | CC0 | https://quaternius.com/packs/ultimatemodularcharacters.html — direct glTF download, no account, fully free for commercial use. Pick a male character in T-pose, rename to `mannequin.glb`, drop in. |
| **Sketchfab CC0 mannequins** | CC0 | https://sketchfab.com/3d-models/categories/people?features=downloadable&licenses=322a749bcfa841b29dff1e8a1bb74b0b — many tailor's dress forms and male mannequins. |
| **Mixamo (Adobe)** | Free, account required | https://mixamo.com — pick X Bot, Y Bot, or Vincent. Downloads as FBX; convert to glTF at https://products.aspose.app/3d/conversion/fbx-to-gltf or in Blender. |

## Requirements

- **Format**: glTF 2.0 binary (`.glb`). Not `.gltf` + bin folder — the loader
  expects a single-file bundle.
- **Scale**: roughly human-sized so the default camera framing works.
  Mannequin torso ≈ 1.3 units tall is ideal. Scale in Blender via
  `Object → Apply → Scale` before export.
- **Position**: center at origin X/Z, feet on Y = 0.
- **UV mapping**: each panel (sleeve, front, back, collar, lapel) should have
  its own UV island with no overlap and no stretching. This is the single
  biggest quality factor. Bad UVs = pattern that warps visibly on curves.
- **Materials**: whatever the model ships with will be overwritten at load
  time with the shared fabric material. Textures baked into the model are
  ignored.

## Quick UV quality check

Before committing a model, preview it in Blender:

1. Open the `.blend` or import the `.glb`.
2. Add a checkerboard material (Material Preview mode → add a base color
   image texture, load a checker).
3. Rotate around the model. If the checkerboard stretches on sleeves,
   collars, or anywhere else, the UVs are bad — don't use it.

Clean UVs look like evenly-sized squares everywhere.

## Not committed to git

Model files tend to be a few MB each and aren't under our control (CC0 /
free download). Keep them in the repo for production (Render needs them in
the deploy) but if you're trying out candidates, use
`public/assets/models/_scratch/` — that directory is gitignored.
