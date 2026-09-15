"""AirPods 5 charging case: materials, internals, hinge-pivot check, GLB export.

    blender -b "<case>.blend" --python blender/prepare_case.py -- <outdir>

The source file is already real-scale (1 unit = 1 mm) and already puts the
lid's origin on the hinge axis, so the lid stays a directly animatable node.
The moulded insert fills the whole interior, and its two earbud wells leave a
solid column down the middle — that column is where the cell, board and coil
go, fully enclosed, so they never poke through in solid renders.
"""

import bpy
import json
import math
import os
import sys
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import lib_mat  # noqa: E402

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUTDIR = os.path.abspath(ARGV[0] if ARGV else "public/models")
os.makedirs(OUTDIR, exist_ok=True)

LID = "Boitier_Couvercle"
OPEN_DEG = 58.0          # documented full-open angle, about the hinge X axis

MATS = {
    "Boitier_Corps": ("caseout", "Case body"),
    "Boitier_Couvercle": ("caseout", "Lid"),
    "Boitier_Logement": ("casein", "Moulded insert"),
    "Boitier_Charniere": ("steel", "Stainless hinge"),
    "Boitier_LED": ("led", "Status light"),
    "Boitier_Bouton": ("casein", "Pairing button"),
    "Boitier_USBC_Fond": ("chip", "USB-C port"),
    "Boitier_USBC_Languette": ("nickel", "USB-C tongue"),
    "Boitier_Contact_00": ("gold", "Charging contact"),
    "Boitier_Contact_01": ("gold", "Charging contact"),
    "Boitier_Contact_10": ("gold", "Charging contact"),
    "Boitier_Contact_11": ("gold", "Charging contact"),
}


def world_bbox(objs):
    pts = []
    for ob in objs:
        pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    return (Vector([min(p[i] for p in pts) for i in range(3)]),
            Vector([max(p[i] for p in pts) for i in range(3)]))


def prim(kind, name, **kw):
    getattr(bpy.ops.mesh, f"primitive_{kind}_add")(**kw)
    ob = bpy.context.active_object
    ob.name = ob.data.name = name
    return ob


def shade_smooth(ob, angle=45.0):
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.modifiers.new("Sharpen", "EDGE_SPLIT").split_angle = math.radians(angle)


def bevel(ob, width, segments=3):
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width, m.segments = width, segments
    m.limit_method, m.angle_limit = "ANGLE", math.radians(35)
    m.harden_normals = True


def tri_count(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    n = sum(len(p.vertices) - 2 for p in me.polygons)
    ob.evaluated_get(dg).to_mesh_clear()
    return n


# ------------------------------------------------------------- materials ---
print("\n=== materials ===")
P = lib_mat.palette()
for name, (key, label) in MATS.items():
    ob = bpy.data.objects.get(name)
    if ob is None:
        print(f"  !! missing {name}")
        continue
    lib_mat.assign(ob, P[key])
    ob["label"] = label
    print(f"  {name:26s} -> {P[key].name}")


# -------------------------------------------------------- hinge sanity -----
lid = bpy.data.objects[LID]
print(f"\n=== hinge ===\n  {LID} origin {tuple(round(v, 3) for v in lid.location)}")
before_min, before_max = world_bbox([lid])
lid.rotation_euler.x = math.radians(OPEN_DEG)
bpy.context.view_layer.update()
after_min, after_max = world_bbox([lid])
print(f"  closed z {before_min.z:7.2f}..{before_max.z:6.2f}"
      f"   open z {after_min.z:7.2f}..{after_max.z:6.2f}")
if after_max.z <= before_max.z:
    print("  !! rotating +X does not lift the lid — check the pivot")
lid.rotation_euler.x = 0.0
bpy.context.view_layer.update()


# -------------------------------------------------------- interior space ---
body = bpy.data.objects["Boitier_Corps"]
insert = bpy.data.objects["Boitier_Logement"]
b_min, b_max = world_bbox([body])
i_min, i_max = world_bbox([insert])
print(f"\n=== interior ===\n  body   {tuple(round(v, 1) for v in b_min)}"
      f" .. {tuple(round(v, 1) for v in b_max)}")
print(f"  insert {tuple(round(v, 1) for v in i_min)} .. {tuple(round(v, 1) for v in i_max)}")

# Width of the solid column between the two wells, measured on the insert by
# casting across the middle at a few heights.
inv = insert.matrix_world.inverted()


def across(z, x_from=12.0):
    """Distance from x=x_from inwards to the first insert surface, at height z."""
    hit, loc, _, _ = insert.ray_cast(inv @ Vector((x_from, 0.0, z)),
                                     Vector((-1, 0, 0)), distance=40)
    return (insert.matrix_world @ loc).x if hit else None


low, high = [], []
for z in range(-20, 6):
    x = across(z)
    if x is None:
        continue
    (low if z <= -9 else high).append(abs(x))
    if z % 4 == 0 or z == -20:
        print(f"  z={z:+4d}  well wall at x={x:+.2f}")
# Two zones: the wells are narrow stem slots low down and wide head pockets
# higher up, so the column that is free of them changes with height.
COL_LOW = (min(low) if low else 4.5) - 0.8
COL_HIGH = (min(high) if high else 2.0) - 0.6
print(f"  free column half-width: {COL_LOW:.2f} mm below z=-9, "
      f"{COL_HIGH:.2f} mm above")


# ---------------------------------------------------------- internals ------
print("\n=== internals ===")
internals = []


def add(ob, key, label):
    lib_mat.assign(ob, P[key])
    ob["label"] = label
    internals.append(ob)
    return ob


# Everything below lives in the wide low zone; z = -9.6 is where the head
# pockets start pinching the column shut.
FLOOR = i_min.z + 0.4
BAY_LO, BAY_HI = FLOOR + 1.8, -9.6
cell_r = min(COL_LOW * 0.80, (BAY_HI - BAY_LO) / 2 - 0.4)
CELL_Z = (BAY_LO + BAY_HI) / 2
print(f"  bay z {BAY_LO:.1f}..{BAY_HI:.1f}  cell r {cell_r:.2f} at z {CELL_Z:.1f}")
cell = prim("cylinder", "Case_Battery", vertices=64, radius=cell_r, depth=12.0,
            location=(0, -1.6, CELL_Z), rotation=(math.radians(90), 0, 0))
bevel(cell, cell_r * 0.12, 4)
shade_smooth(cell)
add(cell, "battery", "Case battery")

board = prim("cube", "Case_Board", size=1.0, location=(0, -0.5, FLOOR + 0.9))
board.scale = (COL_LOW * 1.8, 13.0, 1.0)
bpy.ops.object.transform_apply(scale=True)
bevel(board, 0.22, 2)
add(board, "pcb", "Case logic board")

soc = prim("cube", "Case_SoC", size=1.0, location=(2.6, 3.2, FLOOR + 2.0))
soc.scale = (4.0, 4.2, 1.2)
bpy.ops.object.transform_apply(scale=True)
bevel(soc, 0.18, 2)
add(soc, "chip", "Pairing chip")

coil = prim("torus", "Case_Coil", major_segments=72, minor_segments=16,
            major_radius=min(COL_LOW * 0.72, cell_r), minor_radius=0.42,
            location=(0, 7.2, CELL_Z), rotation=(math.radians(90), 0, 0))
shade_smooth(coil)
add(coil, "copper", "Wireless charging coil")

mag_r = max(0.7, COL_HIGH * 0.75)
for i, zz in enumerate((1.0, 4.0)):
    mg = prim("cylinder", f"Case_Magnet_{i}", vertices=32, radius=mag_r, depth=3.2,
              location=(0, 0, zz), rotation=(math.radians(90), 0, 0))
    bevel(mg, mag_r * 0.15, 2)
    shade_smooth(mg)
    add(mg, "magnet", "Alignment magnet")

ok = True
for ob in internals:
    mn, mx = world_bbox([ob])
    half = COL_LOW if mx.z < -9 else COL_HIGH
    inside = (mn.x > -half - 0.05 and mx.x < half + 0.05
              and mn.z > i_min.z and mx.z < i_max.z
              and mn.y > i_min.y and mx.y < i_max.y)
    ok &= inside
    print(f"  {ob.name:18s} x[{mn.x:+6.1f},{mx.x:+6.1f}] y[{mn.y:+6.1f},{mx.y:+6.1f}]"
          f" z[{mn.z:+6.1f},{mx.z:+6.1f}]  {'ok' if inside else 'POKES OUT'}")
if not ok:
    print("  !! some internals leave the free column")


# ----------------------------------------------------------- parenting -----
print("\n=== parenting ===")
all_min, all_max = world_bbox([o for o in bpy.data.objects if o.type == "MESH"])
centre = (all_min + all_max) / 2
root = bpy.data.objects.new("Case", None)
root.empty_display_size = 10
bpy.context.scene.collection.objects.link(root)
root.location = centre
bpy.context.view_layer.update()

for ob in list(bpy.data.objects):
    if ob.type != "MESH" or ob.parent:
        continue
    ob.parent = root
    ob.matrix_parent_inverse = root.matrix_world.inverted()
bpy.context.view_layer.update()
print(f"  root 'Case' at {tuple(round(v, 2) for v in centre)}")


# -------------------------------------------------------------- export -----
print("\n=== export ===")
path = os.path.join(OUTDIR, "case.glb")
bpy.ops.export_scene.gltf(
    filepath=path, export_format="GLB", use_selection=False,
    export_apply=True, export_yup=True, export_normals=True,
    export_materials="EXPORT", export_extras=True,
    export_cameras=False, export_lights=False,
    # See prepare_pods.py: normals stay at 14 bits so the gloss does not band.
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=14,
    export_draco_texcoord_quantization=14,
    export_draco_generic_quantization=12,
)
print(f"  wrote {path} ({os.path.getsize(path)/1024:.0f} KB)")

manifest = {
    "unit_mm": 1.0,
    "open_deg": OPEN_DEG,
    "lid_node": LID,
    "lid_pivot_local": [round(v, 4) for v in (lid.matrix_world.translation - centre)],
    "size_mm": [round(v, 2) for v in (all_max - all_min)],
    "centre_offset_mm": [round(v, 4) for v in centre],
    "column_half_mm": [round(COL_LOW, 3), round(COL_HIGH, 3)],
    "labels": {o.name: o.get("label", "") for o in bpy.data.objects if o.type == "MESH"},
    "tris": {o.name: tri_count(o) for o in bpy.data.objects if o.type == "MESH"},
}
with open(os.path.join(OUTDIR, "case.manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=1)
print(f"  exported tris: {sum(manifest['tris'].values())}")
print("DONE")
