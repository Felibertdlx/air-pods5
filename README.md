# AirPods 5 — Sound, revealed

A scroll-driven three-dimensional study of the AirPods 5 and their charging
case. Both models are the real geometry from `Desktop/model 3d air pods`,
prepared in Blender and exported to glTF; nothing in the scene is a stand-in.

```bash
npm install
npm run dev
```

---

## What the scroll does

The whole piece is one continuous camera move through 29 keyframes. There are
no sections, no cards and no page breaks — the scrollbar is a transport, and
every value in the scene is sampled from a single score at the current
position.

| | |
|---|---|
| 1 — Reveal | the case, dead on, as the studio rig turns and the light finds the surface |
| 2 — Approach | the case turns through a half revolution, presenting the hinge |
| 3 — Open | the lid rotates on its real hinge axis; the wells come into view |
| 4 — Pair | both buds rise out; the case drops away below the frame |
| 5 — Orbit | the camera circles the floating pair |
| 6 — Study | the second bud withdraws; the remaining one can be turned by hand |
| 7 — Aperture | a long lens on the acoustic mesh |
| 8 — Through | the lens crosses the shell, which is cut away at the camera plane |
| 9 — Driver | the shell turns to glass; the transducer stack reads through it |
| 10 — Assembly | eleven parts separate along their own axes, in sequence |
| 11 — Output | a wavefront leaves the mesh |
| 12 — Intake | particles converge on the two microphone ports |
| 13 — Silicon | pulses travel the board traces |
| 14 — Charge | current runs from the cell down the stem to the contacts |
| 15 — Reserve | the case turns to glass; its cell, coil and board are shown |
| 16 — Return | everything reassembles, the buds go back, the lid closes |

---

## The models

The source files are a 44 MB Blender scene for the buds and a procedural,
real-scale case (1 unit = 1 mm, built to Apple's published 50.1 × 21.2 ×
46.2 mm). Neither had materials, and the bud file had no interior at all.

`blender/prepare_pods.py` and `blender/prepare_case.py` do the preparation.
They are re-runnable and print what they measured, so the result is auditable
rather than hand-placed:

```bash
blender -b "…/AirPods (1).blend"          --python blender/prepare_pods.py -- public/models
blender -b "…/AirPods_5_Boitier.blend"    --python blender/prepare_case.py -- public/models
blender -b --python blender/verify_glb.py -- public/models/pods.glb out/ xray only=Pod_L
```

**What they had to fix.** Three things in the source geometry would have shown
on screen:

- The grille, vent and microphone port are separate patches, and the vent and
  port floated 1.7–2.5 mm proud of the surfaces they belong to. From any angle
  off axis they read as detached dark shapes hanging beside the bud. Each is
  now slid down its own normal until its nearest vertex meets its host — and
  the host matters: the port sits on the spout, and measuring it against the
  shell buried it instead.
- Distance is measured to the nearest point on the host mesh, not by casting a
  ray from the patch centre. A ray fired inward from a curved patch leaves
  through the neck and reports a gap several times the real one.
- The head and the stem are centred on neither x = 0 nor y = 0, and the stem
  leans. Every internal component is therefore sized and placed from measured
  cross-sections of the actual shell, not from a bounding box.

**What they add.** The bud file contains a shell, a spout and three perforation
patches — no interior. The driver stack, cell, board, chip, passives, antenna,
microphones, skin sensor and charging contacts are built to fit the cavity that
was measured, so the exploded view and the x-ray are showing parts that
genuinely fit inside the object. Same for the case: its cell, coil, board and
magnets occupy the column that the two moulded wells leave free — the script
measures that column and reports whether each part stays inside it.

Output is ~226 k triangles across both buds and ~72 k for the case, Draco
compressed to 971 KB and 234 KB — an eighth of the raw size. Normals are kept
at 14 bits rather than the default 10: 1024 directions band visibly across a
mirror-polished white shell, which is the surface this piece spends the most
time on. The decoder is served from `public/draco/`, not a CDN, so the page
works offline.

---

## How the rendering holds up

- **Lighting** is a five-light rig plus an environment built from emissive
  panels rather than an HDRI file. The panels are what give a glossy white
  shell its gradient — dark where it reflects the room, bright where it
  reflects a softbox — and nothing has to be downloaded.
- **The grade is built on a dark room.** Fill and ambient are kept deliberately
  low so the shadow side of a white product goes genuinely dark; the contrast
  comes from that gap rather than from a post filter. Bloom is reserved for the
  status light: set low enough to catch a white shell's speculars, it wraps the
  whole product in a halo that reads as an on-camera flash rather than a studio.
- **The backdrop** is a graded cyclorama, a good step darker than the product.
  A white shell on a white ground has no edge.
- **X-ray** is a fresnel alpha patched into the shell shader: surfaces facing
  you go almost clear so the parts behind show, while grazing edges stay solid
  so the object keeps its silhouette. Plain opacity loses the shape; real
  transmission on a near-white shell mostly reads as milk.
- **Passing through the shell** uses a clipping plane pinned to the camera, so
  the surface is genuinely cut as the lens crosses it.
- **The perforations** in the mesh, vent and ports are generated as a matched
  normal / roughness / occlusion set at runtime. The holes are far too small to
  carry as geometry, and a macro shot needs them to catch light.
- **The sound** is synthesised, not downloaded: a filtered noise bed, a
  resonant click for the lid, and a four-voice sine pad whose gain is driven
  straight off the timeline. A few kilobytes of code instead of a few megabytes
  of audio, and every voice can follow the score instead of chasing it. Muted
  until asked for — audio can only start inside a user gesture anyway.
- **The section figures** are live canvases, not renders. They mount only while
  near the viewport, so the page never holds more than one extra WebGL context,
  and they can be turned by hand.

## Performance

Quality is detected from the device and then adapted by frame rate:
`high` / `medium` / `low` change DPR, shadows, bloom, depth of field, particle
budgets and environment resolution. Shaders whose variants only appear
mid-timeline — the clipped, transparent shell — are compiled during the first
frames, behind the loader, because compiling them on demand cost a 240 ms stall
exactly on the shot where the camera enters the bud.

Measured on this machine: a full scroll through all 29 shots holds 144 fps with
no dropped frames.

Phones get their own composition rather than a squeezed desktop one — a longer
lens pulled further back, calmer damping, smaller particle counts.

## Layout

```
blender/      model preparation, re-runnable, prints its measurements
public/models/ pods.glb, case.glb and the manifests the app reads landmarks from
src/timeline/ the score: every camera move and scene state, and the sampler
src/three/    scene, rig, materials, anatomy, effects
src/ui/       captions, cursor, loader, scroll transport
```

`src/three/anatomy.ts` is the bridge: the landmarks Blender measured, converted
from its Z-up basis into scene space and into centimetres, so a macro shot is
aimed at the real speaker mesh rather than a guessed coordinate.
