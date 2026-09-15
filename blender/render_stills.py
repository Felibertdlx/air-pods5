"""Product stills for the page sections, rendered from the shipped GLBs.

    blender -b --python blender/render_stills.py -- public/stills

Transparent background on purpose: the page has two themes, and a still baked
onto a grey card would be wrong in one of them.
"""

import bpy
import math
import os
import sys
from mathutils import Vector

ARGV = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(ARGV[0] if ARGV else "public/stills")
MODELS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "models")
MODELS = os.path.abspath(MODELS)
os.makedirs(OUT, exist_ok=True)

SIZE = 900


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 160
    sc.cycles.use_denoising = True
    try:
        sc.cycles.device = "GPU"
        bpy.context.preferences.addons["cycles"].preferences.get_devices()
    except Exception:
        pass
    sc.render.resolution_x = sc.render.resolution_y = SIZE
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Base Contrast"
    # These sit on a light page: a white product has to read as white, and a
    # dark studio plus a filmic curve lands it around mid-grey without this.
    sc.view_settings.exposure = 1.45
    return sc


def studio(sc, scale):
    """Softboxes as emissive planes — the same idea as the live scene."""
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    bg = next(n for n in sc.world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.32, 0.32, 0.36, 1)
    bg.inputs[1].default_value = 0.55

    def panel(name, loc, rot, size, power, colour=(1, 1, 1)):
        bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
        ob = bpy.context.active_object
        ob.name = name
        ob.scale = (size[0], size[1], 1)
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(n)
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs[0].default_value = (*colour, 1)
        em.inputs[1].default_value = power
        out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
        nt.links.new(em.outputs[0], out.inputs[0])
        ob.data.materials.append(m)
        ob.visible_camera = False
        return ob

    s = scale
    panel("Key", (-1.6 * s, 1.1 * s, 1.5 * s), (math.radians(55), 0, math.radians(-50)),
          (2.4 * s, 1.6 * s), 6.0)
    panel("Strip", (1.7 * s, -1.2 * s, 0.7 * s), (math.radians(70), 0, math.radians(140)),
          (2.0 * s, 0.32 * s), 14.0, (0.92, 0.95, 1.0))
    panel("Fill", (1.5 * s, 1.4 * s, 0.6 * s), (math.radians(70), 0, math.radians(50)),
          (1.4 * s, 1.1 * s), 2.2)
    panel("Under", (0, 0, -1.9 * s), (0, 0, 0), (3.2 * s, 3.2 * s), 0.7)


def bounds(objs):
    pts = []
    for ob in objs:
        pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    mn = Vector([min(p[i] for p in pts) for i in range(3)])
    mx = Vector([max(p[i] for p in pts) for i in range(3)])
    return mn, mx


def frame(centre, radius, direction, lens=85, margin=1.12):
    """Place the camera so a sphere of `radius` fits the frame.

    The half-angle of a lens `f` on a 36 mm sensor is atan(18 / f), so the
    distance that just fits is radius * f / 18. Getting this wrong by the
    sensor ratio puts the lens inside the product.
    """
    sc = bpy.context.scene
    cd = bpy.data.cameras.new("C")
    cd.lens = lens
    cam = bpy.data.objects.new("C", cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    d = Vector(direction).normalized()
    cam.location = centre + d * (radius * margin * lens / 18.0)
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    return cam


def load(name):
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, name))
    return [o for o in bpy.data.objects if o.type == "MESH"]


def keep_only(prefix):
    for ob in list(bpy.data.objects):
        if ob.type == "MESH" and not ob.name.startswith(prefix):
            root = ob
            while root.parent:
                root = root.parent
            if root.name != prefix:
                bpy.data.objects.remove(ob, do_unlink=True)


def shoot(filename):
    bpy.context.scene.render.filepath = os.path.join(OUT, filename)
    bpy.ops.render.render(write_still=True)
    print("STILL", filename)


# ── 1. the case, closed, three-quarter ──────────────────────────────────────
sc = fresh()
meshes = load("case.glb")
lid = bpy.data.objects.get("Boitier_Couvercle")
mn, mx = bounds(meshes)
c, r = (mn + mx) / 2, max(mx - mn) / 2
studio(sc, r)
frame(c, r, (0.8, -1.0, 0.24))
shoot("case-closed.png")

# ── 2. the case, open ───────────────────────────────────────────────────────
sc = fresh()
meshes = load("case.glb")
lid = bpy.data.objects.get("Boitier_Couvercle")
if lid is None:
    raise SystemExit("no lid node in case.glb")
# The glTF importer leaves nodes in quaternion mode, where rotation_euler is
# simply ignored — the lid stayed shut and the still showed a closed case.
lid.rotation_mode = "XYZ"
lid.rotation_euler.x = math.radians(58)
bpy.context.view_layer.update()
print("LID opened to", round(math.degrees(lid.rotation_euler.x)), "deg")
mn, mx = bounds(meshes)
c, r = (mn + mx) / 2, max(mx - mn) / 2
studio(sc, r)
frame(c, r, (0.5, -1.0, 0.72))
shoot("case-open.png")

# ── 3. one earbud ───────────────────────────────────────────────────────────
sc = fresh()
load("pods.glb")
keep_only("Pod_L")
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
mn, mx = bounds(meshes)
c, r = (mn + mx) / 2, max(mx - mn) / 2
studio(sc, r)
frame(c, r, (1.0, -0.85, 0.22))
shoot("earbud.png")

print("DONE")
