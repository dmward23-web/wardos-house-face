#!/usr/bin/env python3
"""Photoreal December living room for the WardOS cinema plate.

CC0 sources are listed in scripts/cinema/LICENSES.md. The window opening is
placed so its glass lands on the pinned pane mask (x 482..765, y 0..696).
Camera drift and the tree-light breath are one exact sine period.

  blender -b -P scripts/cinema/december-room.py -- --check
  blender -b -P scripts/cinema/december-room.py -- --still 128 /tmp/out.png 1
  blender -b -P scripts/cinema/december-room.py -- --render /tmp/dec-room/raw
"""
import math
import os
import sys

import bpy
from mathutils import Matrix, Vector

LENS = 35.0
SENSOR = 36.0
RES_X, RES_Y = 1920, 1080
TAN_HX = (SENSOR * 0.5) / LENS
TAN_VY = TAN_HX * (RES_Y / RES_X)
DEPTH = 5.277
CX, CY, CZ = -0.199, -DEPTH, 1.161
FPS = 30
SECONDS = 25
FRAMES = FPS * SECONDS
CC0 = "/tmp/cc0"
SAMPLES = 128


def argv_after_dd():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1:]


def wx_of(px):
    return CX + (px / RES_X * 2.0 - 1.0) * TAN_HX * DEPTH


def wz_of(py):
    return CZ + (1.0 - py / RES_Y * 2.0) * TAN_VY * DEPTH


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = FRAMES
    scene.render.film_transparent = False
    scene.render.use_persistent_data = True
    scene.render.use_motion_blur = True
    scene.render.motion_blur_shutter = 0.22
    scene.render.threads_mode = "FIXED"
    scene.render.threads = max(1, os.cpu_count() or 4)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.15
    scene.view_settings.gamma = 1.0
    cyc = scene.cycles
    cyc.device = "CPU"
    cyc.samples = SAMPLES
    cyc.use_denoising = True
    cyc.denoiser = "OPENIMAGEDENOISE"
    cyc.use_adaptive_sampling = True
    cyc.adaptive_threshold = 0.012
    cyc.adaptive_min_samples = 16
    cyc.max_bounces = 6
    cyc.diffuse_bounces = 3
    cyc.glossy_bounces = 2
    cyc.transmission_bounces = 2
    cyc.volume_bounces = 0
    cyc.transparent_max_bounces = 4
    cyc.sample_clamp_indirect = 8.0
    cyc.caustics_reflective = False
    cyc.caustics_refractive = False
    scene.world = bpy.data.worlds.new("sky")
    return scene


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def pbr(name, folder, stem, tint=(1, 1, 1), rough_mul=1.0, emit=0.0, emit_color=(1, 0.7, 0.4)):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.55
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(folder, stem + "_diff_2k.jpg"))
    tex.image.colorspace_settings.name = "sRGB"
    if tint != (1, 1, 1):
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs["B"].default_value = (tint[0], tint[1], tint[2], 1)
        nt.links.new(tex.outputs["Color"], mix.inputs["A"])
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nor_path = os.path.join(folder, stem + "_nor_gl_2k.jpg")
    if os.path.exists(nor_path):
        nimg = nt.nodes.new("ShaderNodeTexImage")
        nimg.image = bpy.data.images.load(nor_path)
        nimg.image.colorspace_settings.name = "Non-Color"
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = 0.7
        nt.links.new(nimg.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    rough_path = os.path.join(folder, stem + "_rough_2k.jpg")
    if os.path.exists(rough_path):
        rimg = nt.nodes.new("ShaderNodeTexImage")
        rimg.image = bpy.data.images.load(rough_path)
        rimg.image.colorspace_settings.name = "Non-Color"
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = rough_mul
        nt.links.new(rimg.outputs["Color"], mul.inputs[0])
        nt.links.new(mul.outputs["Value"], bsdf.inputs["Roughness"])
    if emit:
        bsdf.inputs["Emission Color"].default_value = (emit_color[0], emit_color[1], emit_color[2], 1)
        bsdf.inputs["Emission Strength"].default_value = emit
    try:
        mat.surface_render_method = "DITHERED"
    except Exception:
        pass
    return mat


def needle_material(name, snow=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(CC0, "needle.png"))
    tex.image.colorspace_settings.name = "sRGB"
    try:
        tex.image.alpha_mode = "STRAIGHT"
    except Exception:
        pass
    tex.interpolation = "Smart"
    color = tex.outputs["Color"]
    if snow:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.inputs["Factor"].default_value = snow
        mix.inputs["B"].default_value = (0.82, 0.86, 0.9, 1)
        nt.links.new(color, mix.inputs["A"])
        color = mix.outputs["Result"]
    # Mix with a transparent shader so the black of the needle photo is actually gone.
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix_s = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(color, bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], mix_s.inputs["Fac"])
    nt.links.new(trans.outputs["BSDF"], mix_s.inputs[1])
    nt.links.new(bsdf.outputs["BSDF"], mix_s.inputs[2])
    out = nt.nodes["Material Output"]
    nt.links.new(mix_s.outputs["Shader"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = 0.5
    return mat


def bark_material():
    mat = bpy.data.materials.new("bark")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    folder = os.path.join(CC0, "models/fir_tree_01/textures")
    diff = nt.nodes.new("ShaderNodeTexImage")
    diff.image = bpy.data.images.load(os.path.join(folder, "fir_tree_01_bark_diff_1k.jpg"))
    diff.image.colorspace_settings.name = "sRGB"
    nt.links.new(diff.outputs["Color"], bsdf.inputs["Base Color"])
    nor = nt.nodes.new("ShaderNodeTexImage")
    nor.image = bpy.data.images.load(os.path.join(folder, "fir_tree_01_bark_nor_gl_1k.jpg"))
    nor.image.colorspace_settings.name = "Non-Color"
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(nor.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.8
    return mat


def metal(name, color, rough=0.28):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = rough
    return mat


def emit_mat(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1)
    bsdf.inputs["Emission Color"].default_value = (color[0], color[1], color[2], 1)
    bsdf.inputs["Emission Strength"].default_value = strength
    try:
        mat.cycles.emission_sampling = "NONE"
    except Exception:
        pass
    return mat


def cube(name, loc, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    ob.data.materials.append(mat)
    return ob


def plane_card(name, loc, rot, size, mat):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], 1)
    ob.data.materials.append(mat)
    return ob


def import_meshes(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before and o.type == "MESH"]


def world_bounds(objs):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    return lo, hi


def place(meshes, name, loc, height, yaw=0.0):
    empty = bpy.data.objects.new(name, None)
    link(empty)
    for o in meshes:
        mw = o.matrix_world.copy()
        o.parent = empty
        o.matrix_world = mw
    bpy.context.view_layer.update()
    lo, hi = world_bounds(meshes)
    h = max(hi.z - lo.z, 1e-4)
    empty.scale = (height / h,) * 3
    bpy.context.view_layer.update()
    lo, hi = world_bounds(meshes)
    empty.location = Vector(loc) - Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    empty.rotation_euler.z = yaw
    return empty


def place_real_fir(origin, height):
    """Stack the scanned fir's crown into a conical Christmas tree of real needles.

    The glTF node carries a parent transform, so the crown is baked into a mesh
    whose origin sits at the centre of its base before any copies are made.
    """
    import bmesh
    meshes = import_meshes(os.path.join(CC0, "models/fir_tree_01/fir_tree_01_1k.gltf"))
    keep = None
    for o in meshes:
        if "fir_tree_01_b" in o.name:
            keep = o
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action="DESELECT")
    keep.select_set(True)
    bpy.context.view_layer.objects.active = keep
    bpy.context.view_layer.update()
    mw = keep.matrix_world.copy()
    keep.parent = None
    keep.matrix_world = mw
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mod = keep.modifiers.new("dec", "DECIMATE")
    mod.ratio = 0.055
    bpy.ops.object.modifier_apply(modifier="dec")
    bm = bmesh.new()
    bm.from_mesh(keep.data)
    zs = [v.co.z for v in bm.verts]
    z0, z1 = min(zs), max(zs)
    cut = z0 + 0.58 * (z1 - z0)
    doomed = [v for v in bm.verts if v.co.z < cut]
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    bm.to_mesh(keep.data)
    bm.free()
    me = keep.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    cx, cy = (min(xs) + max(xs)) * 0.5, (min(ys) + max(ys)) * 0.5
    zmin = min(zs)
    for v in me.vertices:
        v.co.x -= cx
        v.co.y -= cy
        v.co.z -= zmin
    me.update()
    crown_w = max(max(xs) - min(xs), max(ys) - min(ys), 1e-4)
    crown_h = max(max(zs) - zmin, 1e-4)
    for m in me.materials:
        if m is None:
            continue
        try:
            m.surface_render_method = "DITHERED"
        except Exception:
            pass
    ox, oy, oz = origin
    # Overlapping tiers. zh is the base of each crown; sc is the target width.
    tiers = (
        (0.00, 1.75),
        (0.42, 1.35),
        (0.84, 0.95),
        (1.22, 0.58),
        (1.55, 0.30),
    )
    placed = []
    for i, (zh, sc) in enumerate(tiers):
        for k in range(4):
            c = keep.copy()
            c.parent = None
            link(c)
            sxy = sc / crown_w
            sz = 1.05 / crown_h
            c.scale = (sxy, sxy, sz)
            c.rotation_euler = (0.0, 0.0, k * math.tau / 4.0 + i * 0.4)
            c.location = (ox, oy, oz + zh)
            placed.append(c)
    bpy.data.objects.remove(keep, do_unlink=True)
    bpy.context.view_layer.update()
    lo, hi = world_bounds(placed)
    print("fir stack", "verts", len(me.vertices), "crown", round(crown_w, 2), round(crown_h, 2),
          "world", tuple(round(v, 2) for v in (*lo, *hi)))


def dress_canopy(origin, height, bulbs, ornaments):
    ox, oy, oz = origin
    for n in range(90):
        u = n / 90.0
        z = oz + height * (0.18 + 0.74 * u)
        rad = 0.72 * (1.0 - u * 0.92) * (height / 2.3)
        ang = n * 2.399
        loc = (ox + math.cos(ang) * rad, oy + math.sin(ang) * rad, z)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.030, location=loc)
        bpy.context.active_object.data.materials.append(ornaments[n % len(ornaments)])
        if n % 2 == 0:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=6, ring_count=4, radius=0.012, location=(loc[0] * 0.8, loc[1] * 0.8, loc[2] + 0.05))
            bpy.context.active_object.data.materials.append(bulbs[n % len(bulbs)])


def add_tree(origin, height, mat, bark, bulbs, ornaments, dress=True):
    """A dense fir of real needle cards. origin is the trunk base."""
    ox, oy, oz = origin
    trunk_h = height * 0.92
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.055 * height / 2.3, depth=trunk_h, location=(ox, oy, oz + trunk_h * 0.45))
    trunk = bpy.context.active_object
    trunk.name = "trunk"
    trunk.data.materials.append(bark)
    levels = 14
    for level in range(levels):
        u = level / (levels - 1)
        z = oz + 0.18 * height / 2.3 + u * trunk_h * 0.94
        radius = (0.92 * (1.0 - u) ** 0.75) * (height / 2.3)
        arms = 10 if level < levels - 2 else 6
        card_h = (0.22 + 0.05 * (1 - u)) * (height / 2.3)
        card_w = radius * 0.55
        for i in range(arms):
            ang = i * math.tau / arms + level * 0.55
            px = ox + math.cos(ang) * radius * 0.55
            py = oy + math.sin(ang) * radius * 0.55
            for k, twist in enumerate((0.0, 0.7, 1.4)):
                # Lean the sprig out from the trunk. The photo's long axis is the card's Y.
                plane_card(
                    "sprig",
                    (px, py, z + k * 0.015),
                    (math.pi / 2 + 1.05, 0.0, ang + twist),
                    (card_w * 0.55, card_h * 0.7),
                    mat,
                )
            if dress and level % 2 == 0 and i % 2 == 0:
                bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.028, location=(px, py, z - 0.05))
                ball = bpy.context.active_object
                ball.data.materials.append(ornaments[(level + i) % len(ornaments)])
            if dress and i % 2 == 0:
                bpy.ops.mesh.primitive_uv_sphere_add(segments=6, ring_count=4, radius=0.018, location=(px * 0.7 + ox * 0.3, py * 0.7 + oy * 0.3, z + 0.08))
                bulb = bpy.context.active_object
                bulb.data.materials.append(bulbs[(level + i) % len(bulbs)])
        # a tighter inner layer so the crown is not see-through
        for j in range(5):
            ang = j * math.tau / 5 + level
            ir = radius * 0.38
            plane_card(
                "fill",
                (ox + math.cos(ang) * ir, oy + math.sin(ang) * ir, z),
                (math.pi / 2 + 0.6, 0.0, ang + 0.4),
                (card_w * 0.4, card_h * 0.55),
                mat,
            )
    # tip
    plane_card("tip", (ox, oy, oz + trunk_h), (0.2, 0, 0.4), (0.28, 0.42), mat)
    return trunk


def build_world(scene):
    world = scene.world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(CC0, "hdri/snowy_forest_2k.hdr"))
    env.image.colorspace_settings.name = "Linear Rec.709"
    mapping = nt.nodes.new("ShaderNodeMapping")
    # 180 degrees puts the snowy stand of pines in the window.
    mapping.inputs["Rotation"].default_value = (0.0, 0.0, math.radians(180))
    coord = nt.nodes.new("ShaderNodeTexCoord")
    warm = nt.nodes.new("ShaderNodeMix")
    warm.data_type = "RGBA"
    warm.blend_type = "MULTIPLY"
    warm.inputs["Factor"].default_value = 0.55
    warm.inputs["B"].default_value = (1.0, 0.48, 0.22, 1.0)
    nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], warm.inputs["A"])
    nt.links.new(warm.outputs["Result"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.85


def add_glare(scene):
    scene.use_nodes = True
    nt = scene.node_tree
    rl = nt.nodes.get("Render Layers") or nt.nodes.new("CompositorNodeRLayers")
    comp = nt.nodes.get("Composite") or nt.nodes.new("CompositorNodeComposite")
    try:
        glare = nt.nodes.new("CompositorNodeGlare")
        glare.glare_type = "FOG_GLOW"
        glare.quality = "HIGH"
        glare.threshold = 0.72
        glare.size = 6
        nt.links.new(rl.outputs["Image"], glare.inputs["Image"])
        nt.links.new(glare.outputs["Image"], comp.inputs["Image"])
    except Exception as exc:
        print("glare skipped", exc)


def build():
    scene = clear_scene()
    build_world(scene)
    add_glare(scene)
    floor = pbr("floor", os.path.join(CC0, "tex/wood_floor"), "wood_floor", rough_mul=0.85)
    plaster = pbr("plaster", os.path.join(CC0, "tex/beige_wall_001"), "beige_wall_001", tint=(0.28, 0.20, 0.16))
    plaster_dark = pbr("plaster_dark", os.path.join(CC0, "tex/beige_wall_001"), "beige_wall_001", tint=(0.16, 0.12, 0.11))
    wood = pbr("wood", os.path.join(CC0, "tex/brown_planks_03"), "brown_planks_03", rough_mul=0.9)
    linen = pbr("linen", os.path.join(CC0, "tex/rough_linen"), "rough_linen")
    wool = pbr("wool", os.path.join(CC0, "tex/wool_boucle"), "wool_boucle", tint=(0.35, 0.28, 0.32))
    shade = pbr("shade", os.path.join(CC0, "tex/velour_velvet"), "velour_velvet", tint=(0.95, 0.75, 0.48), emit=0.6, emit_color=(1.0, 0.7, 0.35))
    stocking = pbr("stocking", os.path.join(CC0, "tex/velour_velvet"), "velour_velvet", tint=(0.55, 0.08, 0.08))
    needles = needle_material("needles")
    snow_needles = needle_material("snow_needles", snow=0.22)
    bark = bark_material()
    gold = metal("gold", (0.72, 0.52, 0.18), 0.32)
    red = pbr("wrap_red", os.path.join(CC0, "tex/velour_velvet"), "velour_velvet", tint=(0.62, 0.08, 0.07))
    green = pbr("wrap_green", os.path.join(CC0, "tex/velour_velvet"), "velour_velvet", tint=(0.08, 0.22, 0.12))
    cream = pbr("wrap_cream", os.path.join(CC0, "tex/rough_linen"), "rough_linen", tint=(0.85, 0.72, 0.5))
    bulbs = [
        emit_mat("bulb_a", (1.0, 0.82, 0.45), 18.0),
        emit_mat("bulb_b", (1.0, 0.55, 0.22), 16.0),
        emit_mat("bulb_c", (1.0, 0.9, 0.7), 14.0),
        emit_mat("bulb_d", (0.95, 0.7, 0.35), 17.0),
    ]
    ornaments = [red, gold, cream, green]
    snow = bpy.data.materials.new("snow")
    snow.use_nodes = True
    sb = snow.node_tree.nodes["Principled BSDF"]
    sb.inputs["Base Color"].default_value = (0.78, 0.82, 0.86, 1)
    sb.inputs["Roughness"].default_value = 0.82

    # Shell. Interior face of the back wall is Y=0, which is the projection plane.
    cube("floor", (0.15, -3.05, -0.03), (6.8, 6.6, 0.06), floor)
    x_l, x_r = wx_of(482), wx_of(765)
    z_sill, z_top = wz_of(696), wz_of(-70)
    cube("wall_left", ((-3.15 + x_l) / 2, 0.08, 1.6), (x_l + 3.15, 0.16, 3.3), plaster_dark)
    cube("wall_right", ((x_r + 3.2) / 2, 0.08, 1.6), (3.2 - x_r, 0.16, 3.3), plaster)
    cube("wall_under", ((x_l + x_r) / 2, 0.08, z_sill * 0.5), (x_r - x_l, 0.16, z_sill), plaster)
    cube("wall_over", ((x_l + x_r) / 2, 0.08, (z_top + 3.25) / 2), (x_r - x_l, 0.16, max(0.2, 3.25 - z_top)), plaster_dark)
    cube("side_l", (-3.15, -3.0, 1.6), (0.12, 6.3, 3.3), plaster_dark)
    cube("side_r", (3.2, -3.0, 1.6), (0.12, 6.3, 3.3), plaster)
    cube("ceiling", (0.0, -3.0, 3.22), (6.5, 6.3, 0.08), plaster_dark)
    # wainscot on the right and under the window
    cube("wainscot_r", (2.15, -0.02, 0.48), (1.9, 0.04, 0.96), wood)
    cube("rail_r", (2.15, -0.04, 0.98), (1.9, 0.06, 0.06), wood)
    cube("wainscot_l", (-2.35, -0.02, 0.42), (1.4, 0.04, 0.84), wood)

    def mullion(name, px0, px1, py0, py1, depth=0.07):
        a, b = wx_of(px0), wx_of(px1)
        z0, z1 = wz_of(py1), wz_of(py0)
        cube(name, ((a + b) / 2, -0.03, (z0 + z1) / 2), (abs(b - a), depth, abs(z1 - z0)), wood)

    mullion("jamb_l", 464, 482, -50, 712)
    mullion("jamb_r", 765, 788, -50, 712)
    mullion("mullion_a", 546, 554, -40, 696)
    mullion("mullion_b", 626, 648, -40, 696)
    mullion("mullion_c", 705, 711, -40, 696)
    mullion("sill", 460, 792, 696, 728, depth=0.16)

    # The window stays open onto the snowy-forest HDRI. Garland stays on the stair.

    # Hero tree: the scanned fir crown, stacked into a cone of real needles.
    place_real_fir((-0.02, -1.05, 0.0), 2.3)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.045, depth=0.55, location=(-0.02, -1.05, 0.28))
    bpy.context.active_object.data.materials.append(bark)
    dress_canopy((-0.02, -1.05, 0.0), 2.3, bulbs, ornaments)
    # point lights carry the illumination; the bulbs are camera-only
    lamp_names = []
    for i, (zz, energy) in enumerate(((0.7, 30.0), (1.15, 36.0), (1.55, 28.0), (1.95, 18.0))):
        data = bpy.data.lights.new("tree_lamp%d" % i, "POINT")
        data.energy = energy
        data.color = (1.0, 0.68, 0.38)
        data.shadow_soft_size = 0.12
        ob = bpy.data.objects.new(data.name, data)
        ob.location = (-0.02, -1.05, zz)
        link(ob)
        lamp_names.append(data.name)
    scene["tree_lamps"] = lamp_names

    # Presents
    gifts = [
        ((-0.55, -1.55, 0.11), (0.28, 0.22, 0.22), red),
        ((-0.28, -1.35, 0.08), (0.22, 0.18, 0.16), cream),
        ((0.48, -1.5, 0.12), (0.26, 0.22, 0.24), green),
        ((0.22, -1.28, 0.07), (0.18, 0.16, 0.14), red),
    ]
    for i, (loc, size, mat) in enumerate(gifts):
        cube("gift%d" % i, loc, size, mat)
        cube("rib%d" % i, loc, (size[0] * 1.02, size[1] * 0.08, size[2] * 1.02), gold)

    cube("rug", (0.15, -0.9, 0.005), (1.35, 1.05, 0.012), wool)

    # Stairs sit on the back wall, to the right of the tree, clear of the lamp.
    for i in range(8):
        cube("step%d" % i, (0.95 + i * 0.2, -0.42, 0.08 + i * 0.15), (0.42, 0.36, 0.06), wood)
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.015, depth=0.48, location=(1.1 + i * 0.2, -0.58, 0.38 + i * 0.15))
        bpy.context.active_object.data.materials.append(wood)
    for i in range(18):
        u = i / 17
        x = 0.9 + u * 1.6
        z = 0.55 + u * 1.15
        cube("handrail", (x, -0.58, z), (0.1, 0.035, 0.03), wood)
        plane_card("rail_garland", (x, -0.64, z - 0.06), (1.15, 0.2, 0.4), (0.16, 0.22), needles)
        if i in (2, 8, 14):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=8, radius=0.045, location=(x, -0.7, z - 0.2))
            sock = bpy.context.active_object
            sock.scale = (1.0, 0.7, 1.6)
            sock.data.materials.append(stocking)

    # Sofa, side table, picture, candles. Real CC0 meshes.
    sofa = import_meshes(os.path.join(CC0, "models/sofa_02/sofa_02_2k.gltf"))
    place(sofa, "sofa", (1.72, -1.55, 0.0), 0.78, yaw=math.radians(8))
    table = import_meshes(os.path.join(CC0, "models/side_table_01/side_table_01_2k.gltf"))
    place(table, "side_table", (1.15, -1.85, 0.0), 0.52, yaw=0.3)
    frame = import_meshes(os.path.join(CC0, "models/fancy_picture_frame_01/fancy_picture_frame_01_2k.gltf"))
    # The frame is a thin object in XZ. Yaw it so it hangs on the right wall, facing the camera.
    place(frame, "frame", (2.35, -0.08, 1.55), 0.72, yaw=math.radians(-90))
    candles = import_meshes(os.path.join(CC0, "models/brass_candleholders/brass_candleholders_2k.gltf"))
    place(candles, "candles", (1.15, -1.85, 0.55), 0.22, yaw=0.4)
    flame = emit_mat("flame", (1.0, 0.62, 0.25), 8.0)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.015, location=(1.15, -1.85, 0.72))
    bpy.context.active_object.data.materials.append(flame)

    # Lamp: turned base and a velvet shade, not a box.
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.09, depth=0.03, location=(1.48, -1.35, 0.56))
    bpy.context.active_object.data.materials.append(wood)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.018, depth=0.32, location=(1.48, -1.35, 0.74))
    bpy.context.active_object.data.materials.append(gold)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.15, radius2=0.09, depth=0.2, location=(1.48, -1.35, 0.98))
    shade_ob = bpy.context.active_object
    shade_ob.data.materials.append(shade)
    lamp = bpy.data.lights.new("lamp", "AREA")
    lamp.shape = "DISK"
    lamp.size = 0.12
    lamp.energy = 70.0
    lamp.color = (1.0, 0.68, 0.4)
    lamp_ob = bpy.data.objects.new("lamp", lamp)
    lamp_ob.location = (1.48, -1.35, 0.9)
    link(lamp_ob)

    # No geometry outside the window. The snowy-forest HDRI is the view.

    # Sun through the window, low, warm. Volume catches it.
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 55.0
    sun.color = (1.0, 0.5, 0.22)
    sun.angle = math.radians(0.55)
    sun_ob = bpy.data.objects.new("sun", sun)
    target = Vector(((x_l + x_r) / 2, -1.2, 0.35))
    src = Vector(((x_l + x_r) / 2, 1.4, z_sill + 1.1))
    sun_ob.location = src
    sun_ob.rotation_euler = (target - src).to_track_quat("-Z", "Y").to_euler()
    link(sun_ob)
    fill = bpy.data.lights.new("window_fill", "AREA")
    fill.shape = "RECTANGLE"
    fill.size = abs(x_r - x_l)
    fill.size_y = 1.4
    fill.energy = 40.0
    fill.color = (1.0, 0.62, 0.32)
    fill_ob = bpy.data.objects.new("window_fill", fill)
    fill_ob.location = ((x_l + x_r) / 2, 0.45, (z_sill + wz_of(280)) / 2)
    fill_ob.rotation_euler = (math.radians(-90), 0.0, 0.0)
    link(fill_ob)
    # Soft fill so the sofa, stair, and picture stay readable in the grade.
    room = bpy.data.lights.new("room_fill", "AREA")
    room.shape = "DISK"
    room.size = 1.6
    room.energy = 12.0
    room.color = (1.0, 0.78, 0.55)
    room_ob = bpy.data.objects.new("room_fill", room)
    room_ob.location = (0.6, -2.6, 1.7)
    room_ob.rotation_euler = (math.radians(70), 0.0, math.radians(18))
    link(room_ob)
    # dust in the shaft only
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x_l + x_r) / 2, -1.15, 1.15))
    vol = bpy.context.active_object
    vol.name = "shaft"
    vol.scale = (0.55, 2.4, 1.5)
    vmat = bpy.data.materials.new("dust")
    vmat.use_nodes = True
    nt = vmat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    pv = nt.nodes.new("ShaderNodeVolumePrincipled")
    pv.inputs["Density"].default_value = 0.018
    pv.inputs["Anisotropy"].default_value = 0.55
    pv.inputs["Color"].default_value = (1.0, 0.85, 0.65, 1)
    nt.links.new(pv.outputs["Volume"], out.inputs["Volume"])
    vol.data.materials.append(vmat)
    vol.display_type = "WIRE"

    # Camera, looking +Y.
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = LENS
    cam_data.sensor_width = SENSOR
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.clip_start = 0.05
    cam_data.clip_end = 80
    cam_data.dof.use_dof = True
    cam_data.dof.focus_distance = 4.55
    cam_data.dof.aperture_fstop = 4.0
    cam = bpy.data.objects.new("cam", cam_data)
    cam.matrix_world = Matrix(((1, 0, 0, CX), (0, 0, -1, CY), (0, 1, 0, CZ), (0, 0, 0, 1)))
    link(cam)
    scene.camera = cam
    scene["cam_name"] = cam.name
    scene["bulb_names"] = [m.name for m in bulbs]
    return scene


def apply_frame(scene):
    n = FRAMES
    t = (scene.frame_current - 1) / float(n)
    a = 2.0 * math.pi * t
    cam = bpy.data.objects[scene["cam_name"]]
    cam.location = (
        CX + math.sin(a) * 0.012,
        CY + math.sin(a) * 0.010,
        CZ + math.sin(2.0 * a) * 0.0035,
    )
    for i, name in enumerate(scene["bulb_names"]):
        mat = bpy.data.materials[name]
        phase = i * (math.pi / 2.0)
        k = 0.72 + 0.28 * math.sin(2.0 * a + phase)
        mat.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = (18.0, 16.0, 14.0, 17.0)[i] * k
    bases = (30.0, 36.0, 28.0, 18.0)
    for i, name in enumerate(scene.get("tree_lamps") or []):
        light = bpy.data.lights[name]
        phase = i * (math.pi / 2.0)
        k = 0.78 + 0.22 * math.sin(2.0 * a + phase)
        light.energy = bases[i] * k


def check_projection(scene):
    from bpy_extras.object_utils import world_to_camera_view
    cam = scene.camera
    bpy.context.view_layer.update()

    def pix(pt):
        co = world_to_camera_view(scene, cam, Vector(pt))
        return co.x * RES_X, (1.0 - co.y) * RES_Y

    worst = 0.0
    for name, pt, want in (
        ("left_top", (wx_of(482), 0.0, wz_of(0)), (482, 0)),
        ("right_top", (wx_of(765), 0.0, wz_of(0)), (765, 0)),
        ("left_sill", (wx_of(482), 0.0, wz_of(696)), (482, 696)),
        ("right_sill", (wx_of(765), 0.0, wz_of(696)), (765, 696)),
    ):
        got = pix(pt)
        err = max(abs(got[0] - want[0]), abs(got[1] - want[1]))
        worst = max(worst, err)
        print("project", name, tuple(round(v, 2) for v in got), "err", round(err, 3))
    print("project worst", round(worst, 3))
    return worst


def main():
    args = argv_after_dd()
    scene = build()

    def handler(scene_):
        apply_frame(scene_)

    bpy.app.handlers.frame_change_pre.clear()
    bpy.app.handlers.frame_change_pre.append(handler)
    scene.frame_set(1)
    apply_frame(scene)
    worst = check_projection(scene)
    if worst > 1.5:
        print("WINDOW PROJECTION OFF", worst)
        sys.exit(2)
    if not args or args[0] == "--check":
        print("CHECK ok")
        return
    if args[0] == "--still":
        samples = int(args[1]) if len(args) > 1 else SAMPLES
        path = args[2] if len(args) > 2 else "/tmp/dec-room/still.png"
        frame = int(args[3]) if len(args) > 3 else 1
        scene.cycles.samples = samples
        scene.frame_set(frame)
        apply_frame(scene)
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print("STILL", path, "samples", samples, "frame", frame)
        return
    if args[0] == "--render":
        out = args[1] if len(args) > 1 else "/tmp/dec-room/raw"
        os.makedirs(out, exist_ok=True)
        scene.cycles.samples = int(args[2]) if len(args) > 2 else SAMPLES
        scene.render.filepath = os.path.join(out, "f_")
        bpy.ops.render.render(animation=True)
        print("RENDERED", FRAMES, "samples", scene.cycles.samples)
        return
    print("unknown", args)
    sys.exit(2)


if __name__ == "__main__":
    main()
