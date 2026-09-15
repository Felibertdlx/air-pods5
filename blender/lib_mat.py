"""Shared material helpers. Blender's UI locale can be non-English, so node
lookups always go through node.type, never through node.name."""

import bpy


def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def make(name, base=(0.8, 0.8, 0.8), rough=0.4, metal=0.0, alpha=1.0,
         emit=None, emit_strength=0.0, coat=0.0, coat_rough=0.03, ior=1.45):
    """Create (or reset) a Principled material."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    b = principled(mat)
    if len(base) == 3:
        base = (*base, 1.0)
    b.inputs["Base Color"].default_value = base
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["IOR"].default_value = ior
    if "Alpha" in b.inputs:
        b.inputs["Alpha"].default_value = alpha
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = coat_rough
    if emit is not None:
        if len(emit) == 3:
            emit = (*emit, 1.0)
        b.inputs["Emission Color"].default_value = emit
        b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1.0:
        mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else mat.blend_method
    return mat


def assign(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)


# ---------------------------------------------------------------- palette ---
def palette():
    return {
        # product surfaces
        "shell":    make("M_ShellWhite",  (0.930, 0.930, 0.935), 0.11, 0.0, coat=1.0, coat_rough=0.045),
        "nozzle":   make("M_NozzleWhite", (0.900, 0.900, 0.908), 0.20, 0.0, coat=0.6, coat_rough=0.09),
        "mesh":     make("M_Mesh",        (0.115, 0.118, 0.125), 0.52, 0.25),
        "vent":     make("M_Vent",        (0.085, 0.088, 0.095), 0.60, 0.15),
        "micport":  make("M_MicPort",     (0.060, 0.062, 0.068), 0.45, 0.30),
        # metals
        "steel":    make("M_Steel",       (0.720, 0.725, 0.740), 0.22, 1.0),
        # Contacts are plated steel rather than gold: the warm band was the one
        # colour on an otherwise neutral product, and it pulled the eye every
        # time the stem tip came into frame.
        "gold":     make("M_Contact",     (0.780, 0.784, 0.800), 0.20, 1.0),
        "copper":   make("M_Copper",      (0.860, 0.450, 0.230), 0.30, 1.0),
        "nickel":   make("M_Nickel",      (0.660, 0.665, 0.680), 0.33, 1.0),
        # internals
        "pcb":      make("M_PCB",         (0.045, 0.105, 0.080), 0.55, 0.0),
        "chip":     make("M_Chip",        (0.035, 0.036, 0.040), 0.32, 0.0),
        "battery":  make("M_Battery",     (0.760, 0.765, 0.785), 0.28, 0.95),
        "diaphragm": make("M_Diaphragm",  (0.130, 0.132, 0.140), 0.68, 0.0),
        "basket":   make("M_Basket",      (0.180, 0.182, 0.190), 0.40, 0.55),
        "magnet":   make("M_Magnet",      (0.300, 0.302, 0.315), 0.38, 1.0),
        "mic":      make("M_Mic",         (0.240, 0.243, 0.255), 0.35, 0.85),
        "foam":     make("M_Foam",        (0.070, 0.072, 0.078), 0.90, 0.0),
        # case
        "caseout":  make("M_CaseWhite",   (0.935, 0.935, 0.940), 0.10, 0.0, coat=1.0, coat_rough=0.04),
        "casein":   make("M_CaseInner",   (0.870, 0.872, 0.880), 0.34, 0.0),
        "led":      make("M_LED",         (0.180, 0.900, 0.420), 0.25, 0.0,
                         emit=(0.220, 1.000, 0.480), emit_strength=6.0),
    }
