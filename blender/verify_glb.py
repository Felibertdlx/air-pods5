"""Re-import an exported GLB and render check views, so the asset that ships
is the asset that got looked at.

    blender -b --python blender/verify_glb.py -- <file.glb> <outdir> [xray]
"""

import bpy
import math
import os
import sys
from mathutils import Vector

ARGV = sys.argv[sys.argv.index("--") + 1:]
GLB, OUT = ARGV[0], ARGV[1]
FLAGS = ARGV[2:]
XRAY = "xray" in FLAGS
ONLY = next((f.split("=", 1)[1] for f in FLAGS if f.startswith("only=")), None)
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)

if ONLY:
    keep = set()

    def mark(ob):
        keep.add(ob.name)
        for c in ob.children:
            mark(c)

    root = bpy.data.objects.get(ONLY)
    if root is None:
        raise SystemExit(f"no node named {ONLY}: "
                         f"{[o.name for o in bpy.data.objects if not o.parent]}")
    mark(root)
    for ob in list(bpy.data.objects):
        if ob.name not in keep:
            bpy.data.objects.remove(ob, do_unlink=True)

sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE"
sc.render.resolution_x = 1000
sc.render.resolution_y = 1000
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Base Contrast"

sc.world = bpy.data.worlds.new("W")
sc.world.use_nodes = True
bg = next(n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.62, 0.63, 0.66, 1)
bg.inputs[1].default_value = 1.9

if XRAY:
    for m in bpy.data.materials:
        if m.name in ("M_ShellWhite", "M_NozzleWhite"):
            b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            b.inputs["Alpha"].default_value = 0.13
            m.blend_method = "BLEND"
            m.show_transparent_back = False

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
pts = []
for ob in meshes:
    pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
mn = Vector([min(p[i] for p in pts) for i in range(3)])
mx = Vector([max(p[i] for p in pts) for i in range(3)])
ctr, rad = (mn + mx) / 2, max(mx - mn) / 2
print(f"IMPORTED bounds min={tuple(round(v,3) for v in mn)} "
      f"max={tuple(round(v,3) for v in mx)}")
print("NODES:", ", ".join(sorted(o.name for o in bpy.data.objects if o.parent is None)))

cd = bpy.data.cameras.new("C")
cd.lens = 85
cam = bpy.data.objects.new("C", cd)
sc.collection.objects.link(cam)
sc.camera = cam

for i, (name, d, e) in enumerate((
    ("a_three_quarter", Vector((1.0, -1.1, 0.55)), 5.0),
    ("b_front", Vector((0.0, -1.0, 0.10)), 5.0),
    ("c_inner_face", Vector((0.25, 1.0, 0.15)), 5.0),
    ("d_top", Vector((0.15, -0.35, 1.0)), 5.0),
)):
    ld = bpy.data.lights.new(f"L{i}", "AREA")
    ld.energy = e * rad * rad * 40
    ld.size = rad * 2.5
    lo = bpy.data.objects.new(f"L{i}", ld)
    sc.collection.objects.link(lo)
    lo.location = ctr + Vector((1, -1, 1.4)).normalized() * rad * 5
    lo.rotation_euler = (ctr - lo.location).to_track_quat("-Z", "Y").to_euler()
    break

for nm, d in (("a_three_quarter", Vector((1.0, -1.1, 0.55))),
              ("b_front", Vector((0.0, -1.0, 0.10))),
              ("c_inner_face", Vector((0.25, 1.0, 0.15))),
              ("d_top", Vector((0.15, -0.35, 1.0)))):
    cam.location = ctr + d.normalized() * rad * 4.6
    cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    tag = ("x_" if XRAY else "") + (ONLY.lower() + "_" if ONLY else "")
    sc.render.filepath = os.path.join(OUT, f"{tag}{nm}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", sc.render.filepath)
