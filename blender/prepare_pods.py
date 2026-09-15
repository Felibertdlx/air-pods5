"""AirPods 5 earbuds: semantic naming, procedural internals, PBR, GLB export.

    blender -b "<earbuds>.blend" --python blender/prepare_pods.py -- <outdir>

The source file ships five meshes per side and no materials. This script
renames them, re-centres each bud on its own pivot, measures the real shell
cross-sections and builds the internal components so they actually fit inside
that shell, then exports one GLB holding `Pod_L` and `Pod_R` root nodes.
"""

import bpy
import bmesh
import json
import math
import os
import sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import lib_mat  # noqa: E402

ARGV = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUTDIR = ARGV[0] if ARGV else os.path.join(os.path.dirname(__file__), "..", "public", "models")
OUTDIR = os.path.abspath(OUTDIR)
os.makedirs(OUTDIR, exist_ok=True)

# The source bud is 2.652 units tall and a real AirPod is 30.2 mm, so one
# source unit is 11.388 mm. Geometry is exported at source scale; the web app
# applies the cm conversion in one place.
UNIT_MM = 30.2 / 2.652
MM = 1.0 / UNIT_MM          # one millimetre, expressed in source units
WALL = 0.9 * MM             # shell wall allowance kept clear of internals

# source name -> semantic name
RENAME = {
    "Body_L": "Shell", "Body_R": "Shell",
    "Part_L": "Spout", "Part_R": "Spout",
    "Perforation_L": "GrilleSpeaker", "Perforation_R": "GrilleSpeaker",
    "Perforation_L2": "MicPortTop", "Perforation_R2": "MicPortTop",
    "Perforation_R4": "VentBack", "Perforation_R3": "VentBack",
}
SIDE_OF = {
    "Body_L": "L", "Part_L": "L", "Perforation_L": "L",
    "Perforation_L2": "L", "Perforation_R4": "L",
    "Body_R": "R", "Part_R": "R", "Perforation_R": "R",
    "Perforation_R2": "R", "Perforation_R3": "R",
}


# ------------------------------------------------------------------ utils ---
def purge_orphans():
    for _ in range(4):
        bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True,
                                       do_recursive=True)


def world_bbox(objs):
    pts = []
    for ob in objs:
        pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return mn, mx


def slice_profile(ob, n=96):
    """Return per-Z-slice X/Y extents of a mesh, in the object's parent space."""
    mw = ob.matrix_world
    vs = [mw @ v.co for v in ob.data.vertices]
    zs = [v.z for v in vs]
    z0, z1 = min(zs), max(zs)
    step = (z1 - z0) / n
    buckets = [[] for _ in range(n)]
    for v in vs:
        i = min(n - 1, max(0, int((v.z - z0) / step)))
        buckets[i].append(v)
    out = []
    for i, b in enumerate(buckets):
        z = z0 + (i + 0.5) * step
        if not b:
            out.append(None)
            continue
        out.append({
            "z": z,
            "xmin": min(v.x for v in b), "xmax": max(v.x for v in b),
            "ymin": min(v.y for v in b), "ymax": max(v.y for v in b),
        })
    return out, z0, z1


def profile_at(profile, z):
    best, bd = None, 1e9
    for s in profile:
        if s is None:
            continue
        d = abs(s["z"] - z)
        if d < bd:
            best, bd = s, d
    return best


def new_mesh(name, verts_fn):
    """verts_fn(bm) fills a bmesh; returns the created object."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts_fn(bm)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def prim(kind, name, **kw):
    getattr(bpy.ops.mesh, f"primitive_{kind}_add")(**kw)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.name = name
    return ob


def shade_smooth(ob, angle=50.0):
    for p in ob.data.polygons:
        p.use_smooth = True
    mod = ob.modifiers.new("Sharpen", "EDGE_SPLIT")
    mod.split_angle = math.radians(angle)


def bevel(ob, width, segments=3):
    m = ob.modifiers.new("Bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(35)
    m.harden_normals = True


def decimate(ob, ratio):
    if ratio >= 1.0:
        return
    m = ob.modifiers.new("Decimate", "DECIMATE")
    m.decimate_type = "COLLAPSE"
    m.ratio = ratio
    m.use_collapse_triangulate = True


def tri_count(ob, evaluated=False):
    """Triangle count; `evaluated` measures the mesh after modifiers."""
    if evaluated:
        dg = bpy.context.evaluated_depsgraph_get()
        me = ob.evaluated_get(dg).to_mesh()
        n = sum(len(p.vertices) - 2 for p in me.polygons)
        ob.evaluated_get(dg).to_mesh_clear()
        return n
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


# ---------------------------------------------------------------- rename ----
print("\n=== renaming source meshes ===")
sides = {"L": [], "R": []}
for src, dst in RENAME.items():
    ob = bpy.data.objects.get(src)
    if ob is None:
        print(f"  !! missing {src}")
        continue
    side = SIDE_OF[src]
    ob.name = f"{dst}_{side}"
    ob.data.name = f"{dst}_{side}"
    sides[side].append(ob)
    print(f"  {src:16s} -> {ob.name}")

for c in list(bpy.data.collections):
    bpy.data.collections.remove(c)
for ob in bpy.data.objects:
    for col in list(ob.users_collection):
        col.objects.unlink(ob)
    bpy.context.scene.collection.objects.link(ob)


# --------------------------------------------------------------- recentre ---
print("\n=== re-centring buds on their own pivot ===")
centres = {}
for side, objs in sides.items():
    mn, mx = world_bbox(objs)
    c = (mn + mx) / 2
    centres[side] = c
    for ob in objs:
        ob.location = ob.location - c
    print(f"  {side}: centre {tuple(round(v, 4) for v in c)}  "
          f"size {tuple(round(v, 4) for v in (mx - mn))}")

bpy.context.view_layer.update()

shell_L = bpy.data.objects["Shell_L"]
PROFILE, Z0, Z1 = slice_profile(shell_L)
print(f"  shell_L z range {Z0:.3f} .. {Z1:.3f}")
for zt in (Z1 - 0.15, Z1 - 0.55, Z1 - 1.0, Z1 - 1.35, Z1 - 1.7, Z1 - 2.1, Z0 + 0.15):
    s = profile_at(PROFILE, zt)
    print(f"   z={s['z']:+.3f}  x[{s['xmin']:+.3f},{s['xmax']:+.3f}] "
          f"y[{s['ymin']:+.3f},{s['ymax']:+.3f}]")


# ------------------------------------------------------- landmark anchors ---
def obj_centre(name):
    ob = bpy.data.objects[name]
    mn, mx = world_bbox([ob])
    return (mn + mx) / 2, (mx - mn)


GRILLE_C, GRILLE_S = obj_centre("GrilleSpeaker_L")
SPOUT_C, SPOUT_S = obj_centre("Spout_L")
MIC_C, MIC_S = obj_centre("MicPortTop_L")
VENT_C, VENT_S = obj_centre("VentBack_L")
SHELL_MIN, SHELL_MAX = world_bbox([shell_L])

print("\n=== landmarks (bud-local) ===")
for n, c in (("grille", GRILLE_C), ("spout", SPOUT_C), ("mic", MIC_C), ("vent", VENT_C)):
    print(f"  {n:7s} {tuple(round(v, 3) for v in c)}")

# head / stem split: the head is the widest part, the stem the narrow tail
widths = [(s["z"], s["ymax"] - s["ymin"]) for s in PROFILE if s]
wmax = max(w for _, w in widths)
head_bottom = min(z for z, w in widths if w > wmax * 0.55)
STEM_TOP = head_bottom


def stem_box(z):
    return profile_at(PROFILE, z)


# ------------------------------------------------ measured interior space ---
_INV = shell_L.matrix_world.inverted()
_INV3 = _INV.to_3x3()


def clearance(origin, direction, limit=6.0):
    """Distance from `origin` to the shell along `direction`, or None.

    Used instead of bounding boxes: the head is an asymmetric blob and the
    stem leans, so every internal part is sized from a real surface hit.
    """
    d = Vector(direction).normalized()
    hit, loc, _, _ = shell_L.ray_cast(_INV @ origin, (_INV3 @ d).normalized(),
                                      distance=limit)
    return ((shell_L.matrix_world @ loc) - origin).length if hit else None


def frame(axis):
    """Orthonormal (u, v) perpendicular to `axis`."""
    a = Vector(axis).normalized()
    up = Vector((0, 0, 1)) if abs(a.z) < 0.9 else Vector((1, 0, 0))
    u = a.cross(up).normalized()
    return u, a.cross(u).normalized()


def radial_clearance(origin, axis, samples=24, pct=0.15):
    """Distance to the shell in the plane perpendicular to `axis`.

    A low percentile rather than the strict minimum: the shell has a handful
    of non-manifold edges and a spout opening, so single rays either escape
    to the far side or clip the neck. The percentile ignores both tails.
    """
    u, v = frame(axis)
    vals = []
    for i in range(samples):
        t = 2 * math.pi * i / samples
        d = clearance(origin, u * math.cos(t) + v * math.sin(t))
        if d is not None:
            vals.append(d)
    if not vals:
        return None
    vals.sort()
    return vals[min(len(vals) - 1, int(pct * len(vals)))]


def slice_centre(s):
    return Vector(((s["xmin"] + s["xmax"]) / 2, (s["ymin"] + s["ymax"]) / 2, s["z"]))


# head centre: mid-height of the head, on the head's own axis — neither the
# head nor the stem is centred on x=0 or y=0, so both come from the slices.
head_slices = [s for s in PROFILE if s and STEM_TOP + 0.12 < s["z"] < Z1 - 0.12]
hc = sum((slice_centre(s) for s in head_slices), Vector()) / len(head_slices)
HEAD_C = Vector((hc.x, hc.y, (STEM_TOP + Z1) / 2))
print(f"  head bottom z={STEM_TOP:.3f}  head centre "
      f"{tuple(round(v, 3) for v in HEAD_C)}")

# stem: sampled along its length so the board follows the lean
stem_lo, stem_hi = Z0 + 1.2 * MM, STEM_TOP - 0.06
stem_samples = [s for s in PROFILE if s and stem_lo < s["z"] < stem_hi]
STEM_AXIS = [slice_centre(s) for s in stem_samples]
STEM_C = sum(STEM_AXIS, Vector()) / len(STEM_AXIS)


def _half(axis_dir):
    return min(min(clearance(p, axis_dir) or 9, clearance(p, -Vector(axis_dir)) or 9)
               for p in STEM_AXIS)


stem_hx = _half(Vector((1, 0, 0)))
stem_hy = _half(Vector((0, 1, 0)))
print(f"  stem centre {tuple(round(v, 3) for v in STEM_C)} "
      f"half-space {stem_hx:.3f} x {stem_hy:.3f} over z {stem_lo:.3f}..{stem_hi:.3f}")


# ------------------------------------------------- seat the surface pieces ---
# The grille, vent and microphone port are separate patches in the source file
# and every one of them floats a millimetre or two proud of the shell — which
# shows up as a detached dark shape the moment the camera moves off axis.
# Each is slid back down its own normal until it is just inside the surface.
def mesh_normal(name):
    ob = bpy.data.objects[name]
    m3 = ob.matrix_world.to_3x3().inverted().transposed()
    n = Vector((0, 0, 0))
    for p in ob.data.polygons:
        n += (m3 @ p.normal) * p.area
    return n.normalized()


def seat_against(name, host_name, inset):
    """Slide a patch along its surface normal until it meets its host part.

    Distance is taken to the nearest point on the host for every vertex of the
    patch, rather than by casting a ray from its centre: a ray fired inward
    from a curved patch leaves through the neck and reports a gap several
    times the real one. The host matters too — the microphone port sits on the
    spout, and measuring it against the shell buries it.
    """
    ob = bpy.data.objects[name]
    host = bpy.data.objects[host_name]
    bvh = BVHTree.FromObject(host, bpy.context.evaluated_depsgraph_get())
    inv = host.matrix_world.inverted()

    def measure():
        mw = ob.matrix_world
        dists = []
        dirs = Vector((0, 0, 0))
        for v in ob.data.vertices:
            p = inv @ (mw @ v.co)
            loc, _, _, d = bvh.find_nearest(p)
            if loc is None:
                continue
            dists.append(d)
            if d > 1e-9:
                dirs += (loc - p) / d
        dists.sort()
        return dists, dirs

    d0, _ = measure()
    if not d0:
        print(f"  {name:18s} nothing near {host_name} — left alone")
        return
    before = (d0[0], d0[len(d0) // 2], d0[-1])

    # One step tends to undershoot on a curved strip, because the nearest-point
    # direction changes as it closes. Repeat until the nearest vertex is on the
    # surface, which is what "seated" actually means.
    moved = 0.0
    for _ in range(8):
        dists, dirs = measure()
        if not dists or dirs.length < 1e-9 or dists[0] <= inset:
            break
        step = (dists[len(dists) // 2] - inset) * 0.85
        if step <= 1e-5:
            break
        ob.location += dirs.normalized() * step
        bpy.context.view_layer.update()
        moved += step

    after, _ = measure()
    print(f"  {name:18s} on {host_name:16s} "
          f"min/med/max {before[0] * UNIT_MM:5.2f}/{before[1] * UNIT_MM:5.2f}/"
          f"{before[2] * UNIT_MM:5.2f} mm -> "
          f"{after[0] * UNIT_MM:5.2f}/{after[len(after) // 2] * UNIT_MM:5.2f}/"
          f"{after[-1] * UNIT_MM:5.2f} mm  (moved {moved * UNIT_MM:.2f} mm)")


print("\n=== seating surface pieces ===")
for _side in ("L", "R"):
    for _base, _host, _in in (
        ("GrilleSpeaker", "Shell", 0.15 * MM),
        ("VentBack", "Shell", 0.15 * MM),
        ("MicPortTop", "Spout", 0.10 * MM),
    ):
        seat_against(f"{_base}_{_side}", f"{_host}_{_side}", _in)

# landmarks move with them
GRILLE_C, GRILLE_S = obj_centre("GrilleSpeaker_L")
SPOUT_C, SPOUT_S = obj_centre("Spout_L")
MIC_C, MIC_S = obj_centre("MicPortTop_L")
VENT_C, VENT_S = obj_centre("VentBack_L")


# ---------------------------------------------------------- build internals -
print("\n=== building internals ===")
P = lib_mat.palette()
internals = []


def add(ob, mat, label):
    lib_mat.assign(ob, P[mat])
    ob["label"] = label
    internals.append(ob)
    return ob


# --- speaker driver, aimed at the grille -------------------------------------
# The grille is the ear-facing output, so its averaged surface normal is the
# driver axis. Measured, not guessed: the inner face is angled on every axis.
drv_axis = mesh_normal("GrilleSpeaker_L")
if drv_axis.dot(GRILLE_C - HEAD_C) < 0:   # must point out of the head
    drv_axis = -drv_axis
print(f"  grille normal -> driver axis {tuple(round(v, 3) for v in drv_axis)}")

# The whole driver + battery stack lives on that axis, inside the measured
# head cavity: front = towards the grille, back = the far shell wall.
# Measured from the head centre — the only point guaranteed to be inside the
# cavity — then pushed forward until the basket almost touches the inner face.
front = (clearance(HEAD_C, drv_axis) or 0.6) - WALL
depth = ((clearance(HEAD_C, -drv_axis) or 0.6) - WALL) + front
r_head = (radial_clearance(HEAD_C, drv_axis) or 0.5) - WALL
drv_r = min(r_head * 0.86, depth * 0.38)
rot = drv_axis.to_track_quat("Z", "Y").to_euler()
print(f"  head cavity: front {front:.3f} depth {depth:.3f} radius {r_head:.3f}"
      f" -> driver r {drv_r:.3f}")

DRV_FRONT = HEAD_C + drv_axis * front
drv_pos = DRV_FRONT - drv_axis * (drv_r * 0.55)

basket = prim("cylinder", "Driver_Basket", vertices=64, radius=drv_r,
              depth=drv_r * 0.62, location=drv_pos, rotation=rot)
bevel(basket, drv_r * 0.06)
shade_smooth(basket)
add(basket, "basket", "Speaker driver")

cone = prim("cone", "Driver_Diaphragm", vertices=64, radius1=drv_r * 0.88,
            radius2=drv_r * 0.30, depth=drv_r * 0.44,
            location=drv_pos + drv_axis * (drv_r * 0.16), rotation=rot)
shade_smooth(cone)
add(cone, "diaphragm", "Diaphragm")

dome = prim("uv_sphere", "Driver_Dome", segments=48, ring_count=24,
            radius=drv_r * 0.30,
            location=drv_pos + drv_axis * (drv_r * 0.36), rotation=rot)
dome.scale = (1, 1, 0.55)
shade_smooth(dome)
add(dome, "diaphragm", "Dust dome")

mag = prim("cylinder", "Driver_Magnet", vertices=48, radius=drv_r * 0.62,
           depth=drv_r * 0.40,
           location=drv_pos - drv_axis * (drv_r * 0.44), rotation=rot)
bevel(mag, drv_r * 0.05)
shade_smooth(mag)
add(mag, "magnet", "Neodymium magnet")

coil = prim("torus", "Driver_VoiceCoil", major_segments=56, minor_segments=14,
            major_radius=drv_r * 0.34, minor_radius=drv_r * 0.085,
            location=drv_pos + drv_axis * (drv_r * 0.02), rotation=rot)
shade_smooth(coil)
add(coil, "copper", "Voice coil")

# --- battery: coin cell in the head, filling what is left behind the magnet --
mag_back = drv_pos - drv_axis * (drv_r * 0.44 + drv_r * 0.20)
# how much axis remains between the magnet's back face and the rear shell wall
bat_space = depth - (DRV_FRONT - mag_back).length
bat_d = max(0.6 * MM, min(bat_space * 0.72, drv_r * 0.85))
bat_r = min(r_head * 0.88, drv_r * 1.05)
bat_pos = mag_back - drv_axis * (bat_d * 0.5 + 0.3 * MM)
print(f"  battery r {bat_r:.3f} depth {bat_d:.3f} (space {bat_space:.3f})")
bat = prim("cylinder", "Battery", vertices=64, radius=bat_r,
           depth=bat_d, location=bat_pos, rotation=rot)
bevel(bat, bat_d * 0.14, 4)
shade_smooth(bat)
add(bat, "battery", "Battery cell")

# --- stem board stack --------------------------------------------------------
bx, by, bh = STEM_C.x, STEM_C.y, stem_hi - stem_lo
board_t = min(0.55 * MM, stem_hx * 0.34)
board_w = stem_hy * 1.55
print(f"  stem board {board_t:.3f} x {board_w:.3f} x {bh:.3f} "
      f"at ({bx:+.3f}, {by:+.3f})")

board = prim("cube", "Logic_Board", size=1.0,
             location=(bx, by, (stem_lo + stem_hi) / 2))
board.scale = (board_t, board_w, bh)
bpy.ops.object.transform_apply(scale=True)
bevel(board, 0.12 * MM, 2)
add(board, "pcb", "Logic board")

chip_t = max(0.3 * MM, stem_hx - board_t / 2 - 0.35 * MM)
chip = prim("cube", "SoC", size=1.0,
            location=(bx + board_t / 2 + chip_t / 2, by, stem_hi - bh * 0.26))
chip.scale = (chip_t, board_w * 0.62, bh * 0.19)
bpy.ops.object.transform_apply(scale=True)
bevel(chip, 0.10 * MM, 2)
add(chip, "chip", "Wireless chip")

for i, (zz, sy) in enumerate(((stem_hi - bh * 0.56, 0.44), (stem_hi - bh * 0.72, 0.30))):
    cap = prim("cube", f"Component_{i:02d}", size=1.0,
               location=(bx - board_t / 2 - chip_t * 0.35, by, zz))
    cap.scale = (chip_t * 0.7, board_w * sy, bh * 0.09)
    bpy.ops.object.transform_apply(scale=True)
    bevel(cap, 0.08 * MM, 2)
    add(cap, "chip", "Passive components")

# --- microphones -------------------------------------------------------------
mic_n = mesh_normal("MicPortTop_L")
if mic_n.dot(MIC_C - HEAD_C) < 0:
    mic_n = -mic_n
mic_top = prim("cylinder", "Mic_Top", vertices=32, radius=0.72 * MM, depth=0.55 * MM,
               location=MIC_C - mic_n * 1.5 * MM,
               rotation=mic_n.to_track_quat("Z", "Y").to_euler())
bevel(mic_top, 0.08 * MM, 2)
shade_smooth(mic_top)
add(mic_top, "mic", "Beamforming microphone")

mic_bot_z = stem_lo + 0.14
mic_bot_r = min(0.70 * MM, stem_hx * 0.55)
mic_bot = prim("cylinder", "Mic_Bottom", vertices=32, radius=mic_bot_r,
               depth=min(0.52 * MM, stem_hy * 0.5),
               location=(bx, by - (stem_hy - 0.40 * MM), mic_bot_z),
               rotation=(math.radians(90), 0, 0))
bevel(mic_bot, 0.08 * MM, 2)
shade_smooth(mic_bot)
add(mic_bot, "mic", "Voice microphone")

# --- skin-detect sensor behind the grille ------------------------------------
sens_r = min(0.80 * MM, r_head * 0.30)
sens = prim("uv_sphere", "Sensor_Skin", segments=32, ring_count=16, radius=sens_r,
            location=DRV_FRONT + Vector((0, 0, drv_r * 1.25)),
            rotation=rot)
sens.scale = (1, 1, 0.55)
shade_smooth(sens)
add(sens, "chip", "Skin-detect sensor")

# --- antenna: thin strip hugging the back of the stem ------------------------
ant_z0, ant_z1 = stem_lo + 0.20, stem_hi
ant_t = 0.24 * MM
ant = prim("cube", "Antenna", size=1.0,
           location=(bx - stem_hx + ant_t * 0.9, by, (ant_z0 + ant_z1) / 2))
ant.scale = (ant_t, stem_hy * 1.05, ant_z1 - ant_z0)
bpy.ops.object.transform_apply(scale=True)
add(ant, "copper", "Bluetooth antenna")

# --- charging contacts: flush bands around the stem tip ----------------------
for i, zz in enumerate((Z0 + 1.0 * MM, Z0 + 2.8 * MM)):
    sc_ = stem_box(zz)
    rx, ry = (sc_["xmax"] - sc_["xmin"]) / 2, (sc_["ymax"] - sc_["ymin"]) / 2
    ring = prim("cylinder", f"Contact_{i}", vertices=64, radius=1.0, depth=0.85 * MM,
                location=slice_centre(sc_))
    # inscribed ellipse: touches the flats, stays under the rounded corners
    ring.scale = (rx * 0.985, ry * 0.985, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    bevel(ring, 0.07 * MM, 2)
    shade_smooth(ring)
    add(ring, "gold", "Charging contact")

print(f"  built {len(internals)} internal parts")


# ------------------------------------------------- materials for the shell ---
lib_mat.assign(bpy.data.objects["Shell_L"], P["shell"])
lib_mat.assign(bpy.data.objects["Spout_L"], P["nozzle"])
lib_mat.assign(bpy.data.objects["GrilleSpeaker_L"], P["mesh"])
lib_mat.assign(bpy.data.objects["MicPortTop_L"], P["micport"])
lib_mat.assign(bpy.data.objects["VentBack_L"], P["vent"])

LABELS = {
    "Shell": "Enclosure", "Spout": "Acoustic spout",
    "GrilleSpeaker": "Speaker mesh", "MicPortTop": "Microphone port",
    "VentBack": "Pressure vent",
}
for k, v in LABELS.items():
    for s in ("L", "R"):
        o = bpy.data.objects.get(f"{k}_{s}")
        if o:
            o["label"] = v


# ------------------------------------------------------ mirror L internals ---
print("\n=== mirroring internals to the right bud ===")
bpy.ops.object.select_all(action="DESELECT")
for ob in internals:
    ob.select_set(True)
bpy.context.view_layer.objects.active = internals[0]
bpy.ops.object.duplicate()
mirrored = [o for o in bpy.context.selected_objects]
for ob in mirrored:
    ob.name = ob.name.replace(".001", "") + "__R"
    ob.location.y *= -1
    ob.scale.y *= -1
    ob.rotation_euler.x *= -1
    ob.rotation_euler.z *= -1
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
for ob in mirrored:
    me = ob.data
    me.flip_normals()

for ob in internals:
    ob.name = ob.name + "_L"
for ob in mirrored:
    ob.name = ob.name.replace("__R", "") + "_R"


# ------------------------------------------------------------- decimation ---
print("\n=== decimating source meshes ===")
# Enough left on the shell and spout to hold a clean silhouette under a long
# lens — decimating harder shows as faceting exactly where the camera lingers.
# Raised from a quarter once the frame budget turned out to have room: the
# macro shots are the ones people look hardest at, and triangles there are
# worth more than triangles anywhere else in the piece.
BUDGET = {"Shell": 0.44, "Spout": 0.40, "GrilleSpeaker": 1.0,
          "MicPortTop": 1.0, "VentBack": 0.30}
for base, ratio in BUDGET.items():
    for s in ("L", "R"):
        ob = bpy.data.objects.get(f"{base}_{s}")
        if ob:
            before = tri_count(ob)
            decimate(ob, ratio)
            print(f"  {ob.name:20s} {before:7d} -> ~{int(before * ratio):6d} tris")


# ------------------------------------------------------------- parenting ----
print("\n=== parenting ===")
roots = {}
for s in ("L", "R"):
    e = bpy.data.objects.new(f"Pod_{s}", None)
    e.empty_display_size = 0.5
    bpy.context.scene.collection.objects.link(e)
    roots[s] = e

for ob in list(bpy.data.objects):
    if ob.type != "MESH":
        continue
    s = "R" if ob.name.endswith("_R") else "L"
    ob.parent = roots[s]
    ob.matrix_parent_inverse = roots[s].matrix_world.inverted()

bpy.context.view_layer.update()


# ---------------------------------------------------------------- export ----
print("\n=== export ===")
bpy.ops.object.select_all(action="SELECT")
path = os.path.join(OUTDIR, "pods.glb")
bpy.ops.export_scene.gltf(
    filepath=path,
    export_format="GLB",
    use_selection=False,
    export_apply=True,
    export_yup=True,
    export_normals=True,
    export_tangents=False,
    export_materials="EXPORT",
    export_extras=True,
    export_cameras=False,
    export_lights=False,
    # Draco, with normals kept at high precision. The default of 10 bits is
    # 1024 directions, which bands visibly across a mirror-polished white
    # shell — exactly the surface this piece spends the most time on. Position
    # precision is generous too: 14 bits over a 3 cm object is under two
    # microns, far below anything the camera can resolve.
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=14,
    export_draco_texcoord_quantization=14,
    export_draco_generic_quantization=12,
)
print(f"  wrote {path} ({os.path.getsize(path)/1024:.0f} KB)")

manifest = {
    "unit_mm": UNIT_MM,
    "pods": {
        s: {
            "parts": sorted(o.name for o in bpy.data.objects
                            if o.type == "MESH" and o.name.endswith("_" + s)),
        } for s in ("L", "R")
    },
    "landmarks": {
        "grille": [round(v, 4) for v in GRILLE_C],
        "spout": [round(v, 4) for v in SPOUT_C],
        "mic_top": [round(v, 4) for v in MIC_C],
        "vent": [round(v, 4) for v in VENT_C],
        "head_centre": [round(v, 4) for v in HEAD_C],
        "driver": [round(v, 4) for v in drv_pos],
        "driver_axis": [round(v, 4) for v in drv_axis],
        "battery": [round(v, 4) for v in bat_pos],
        "board": [round(bx, 4), round(by, 4), round((stem_lo + stem_hi) / 2, 4)],
        "stem_centre": [round(v, 4) for v in STEM_C],
        "stem_tip": [round(STEM_C.x, 4), round(STEM_C.y, 4), round(Z0, 4)],
        "bbox_min": [round(v, 4) for v in SHELL_MIN],
        "bbox_max": [round(v, 4) for v in SHELL_MAX],
    },
    "labels": {o.name: o.get("label", "") for o in bpy.data.objects if o.type == "MESH"},
    "tris": {o.name: tri_count(o, evaluated=True)
             for o in bpy.data.objects if o.type == "MESH"},
}
with open(os.path.join(OUTDIR, "pods.manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=1)
print(f"  exported tris (both buds): {sum(manifest['tris'].values())}")
print("DONE")
