#!/usr/bin/env python3
"""Headless Cycles living room for the December cinema plate.

Original geometry, materials, and lighting. No third-party meshes or textures.
The window opening is placed so its glass lands on the pinned pane mask
(x 482..765, y 0..696 in a 1920x1080 frame). Camera drift and the tree-light
breath are one exact sine period, so frame 1 matches the frame after the last.

  blender -b -P scripts/cinema/december-room.py -- --check
  blender -b -P scripts/cinema/december-room.py -- --still
  blender -b -P scripts/cinema/december-room.py -- --render /tmp/dec-room/raw
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

# 35 mm lens, 36 mm sensor, horizontal fit, 1920x1080. The window plane sits at
# world Y = 0. The camera looks +Y. These constants are the projection that
# puts the glass edges on the pinned mask.
LENS = 35.0
SENSOR = 36.0
RES_X, RES_Y = 1920, 1080
TAN_HX = (SENSOR * 0.5) / LENS
TAN_VY = TAN_HX * (RES_Y / RES_X)
DEPTH = 5.277
CX, CY, CZ = -0.199, -DEPTH, 1.161
FPS = 30
SECONDS = 25
FRAMES = FPS * SECONDS  # 750

OUT = "/tmp/dec-room/raw"


def argv_after_dd():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1:]


def wx_of(px):
    x_ndc = px / RES_X * 2.0 - 1.0
    return CX + x_ndc * TAN_HX * DEPTH


def wz_of(py):
    y_ndc = 1.0 - py / RES_Y * 2.0
    return CZ + y_ndc * TAN_VY * DEPTH


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.resolution_percentage = 100
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = FRAMES
    scene.render.film_transparent = False
    scene.render.use_persistent_data = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = max(1, os.cpu_count() or 4)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 15
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    try:
        scene.sequencer_colorspace_settings.name = "sRGB"
    except Exception:
        pass
    scene.cycles.device = "CPU"
    # 4 samples plus OpenImageDenoise. A 12-sample frame was ~37 s on this
    # 4-core CPU; 4 samples holds about 12 s and still denoises clean.
    scene.cycles.samples = 4
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.06
    scene.cycles.adaptive_min_samples = 2
    scene.cycles.max_bounces = 4
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 1
    scene.cycles.transmission_bounces = 0
    scene.cycles.volume_bounces = 0
    scene.cycles.transparent_max_bounces = 2
    scene.cycles.sample_clamp_indirect = 2.5
    scene.cycles.sample_clamp_direct = 0.0
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.cycles.use_fast_gi = False
    scene.render.engine = "CYCLES"
    world = bpy.data.worlds.new("night")
    scene.world = world
    return scene


def principled(name, color, rough=0.7, spec=0.3, emit=None, emit_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = spec
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = spec
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (emit[0], emit[1], emit[2], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
        # The bulbs are the look. A handful of point lights do the illumination,
        # or every sphere becomes a mesh light and the frame time blows up.
        try:
            mat.cycles.emission_sampling = "NONE"
        except Exception:
            pass
    return mat


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def cube(name, loc, size, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = size
    ob.data.materials.append(mat)
    return ob


def cone(name, loc, radius, depth, mat, verts=32):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=radius, radius2=0.0, depth=depth, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    for poly in ob.data.polygons:
        poly.use_smooth = True
    ob.data.materials.append(mat)
    return ob


def sphere(name, loc, radius, mat, segs=8, rings=5):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=radius, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def cyl(name, loc, radius, depth, mat, verts=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(mat)
    return ob


def wood_floor_material():
    mat = principled("floor", (0.16, 0.075, 0.035), rough=0.55, spec=0.25)
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (3.5, 0.35, 1.0)
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Y"
    wave.inputs["Scale"].default_value = 1.0
    wave.inputs["Distortion"].default_value = 1.4
    wave.inputs["Detail"].default_value = 2.0
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 8.0
    noise.inputs["Detail"].default_value = 4.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (0.045, 0.022, 0.012, 1)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (0.28, 0.13, 0.055, 1)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["A"])
    # noise as a slight darkening of the grain
    dark = nt.nodes.new("ShaderNodeMix")
    dark.data_type = "RGBA"
    dark.inputs["Factor"].default_value = 0.35
    dark.inputs["A"].default_value = (1, 1, 1, 1)
    dark.inputs["B"].default_value = (0.55, 0.48, 0.4, 1)
    nt.links.new(noise.outputs["Fac"], dark.inputs["Factor"])
    nt.links.new(ramp.outputs["Color"], mix.inputs["A"])
    nt.links.new(dark.outputs["Result"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.18
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def paint_world(world, sun_dir):
    """Sunset in the world shader. No sky sphere, so shadow rays do not hit a shell."""
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeMapRange")
    # Incoming on the world points back at the camera. Low in the window is -Z.
    ramp.inputs["From Min"].default_value = -0.25
    ramp.inputs["From Max"].default_value = 0.35
    ramp.inputs["To Min"].default_value = 0.0
    ramp.inputs["To Max"].default_value = 1.0
    ramp.clamp = True
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (1.0, 0.48, 0.20, 1)
    mix.inputs["B"].default_value = (0.07, 0.11, 0.24, 1)
    sun = nt.nodes.new("ShaderNodeVectorMath")
    sun.operation = "DOT_PRODUCT"
    sun.inputs[1].default_value = sun_dir
    soft = nt.nodes.new("ShaderNodeMapRange")
    soft.inputs["From Min"].default_value = 0.94
    soft.inputs["From Max"].default_value = 0.995
    soft.inputs["To Min"].default_value = 0.0
    soft.inputs["To Max"].default_value = 1.0
    soft.clamp = True
    add = nt.nodes.new("ShaderNodeMix")
    add.data_type = "RGBA"
    add.inputs["B"].default_value = (1.0, 0.82, 0.55, 1)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = 1.15
    nt.links.new(geo.outputs["Incoming"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Value"])
    nt.links.new(ramp.outputs["Result"], mix.inputs["Factor"])
    nt.links.new(geo.outputs["Incoming"], sun.inputs[0])
    nt.links.new(sun.outputs["Value"], soft.inputs["Value"])
    nt.links.new(mix.outputs["Result"], add.inputs["A"])
    nt.links.new(soft.outputs["Result"], add.inputs["Factor"])
    nt.links.new(add.outputs["Result"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def build():
    scene = clear_scene()
    # Materials. Left and upper walls stay dark so the clock and the W badge hold contrast.
    wall = principled("wall", (0.055, 0.040, 0.032), rough=0.92, spec=0.15)
    wall_dark = principled("wall_dark", (0.012, 0.010, 0.011), rough=0.95, spec=0.08)
    trim = principled("trim", (0.10, 0.055, 0.028), rough=0.45, spec=0.35)
    floor = wood_floor_material()
    foliage = principled("foliage", (0.015, 0.045, 0.022), rough=0.75, spec=0.2)
    snow = principled("snow", (0.72, 0.76, 0.80), rough=0.85, spec=0.15)
    trunk = principled("trunk", (0.08, 0.045, 0.025), rough=0.8)
    gift_a = principled("gift_a", (0.28, 0.08, 0.07), rough=0.65)
    gift_b = principled("gift_b", (0.18, 0.12, 0.07), rough=0.7)
    gift_c = principled("gift_c", (0.10, 0.16, 0.14), rough=0.65)
    ribbon = principled("ribbon", (0.45, 0.32, 0.12), rough=0.4, spec=0.5)
    sofa_mat = principled("sofa", (0.16, 0.15, 0.18), rough=0.85)
    pillow = principled("pillow", (0.18, 0.22, 0.32), rough=0.8)
    shade = principled("shade", (0.85, 0.68, 0.42), rough=0.7, emit=(1.0, 0.72, 0.38), emit_strength=1.6)
    lamp_base = principled("lamp_base", (0.12, 0.10, 0.08), rough=0.35, spec=0.5)
    garland = principled("garland", (0.02, 0.06, 0.028), rough=0.7)
    red = principled("red", (0.35, 0.03, 0.03), rough=0.4, spec=0.45)
    gold = principled("gold", (0.55, 0.38, 0.10), rough=0.28, spec=0.7)
    cream = principled("cream", (0.70, 0.62, 0.48), rough=0.45)
    pine = principled("pine", (0.02, 0.05, 0.03), rough=0.8)
    vase = principled("vase", (0.08, 0.09, 0.11), rough=0.4, spec=0.4)
    branch = principled("branch", (0.06, 0.045, 0.03), rough=0.8)

    # Four light groups so the breath is not a single blink. Each completes
    # two cycles over the loop, so the first frame and the frame after the last match.
    bulbs = []
    for i, col in enumerate(((1.0, 0.82, 0.45), (1.0, 0.62, 0.28), (0.85, 0.90, 0.70), (1.0, 0.74, 0.40))):
        bulbs.append(principled("bulb%d" % i, col, rough=0.4, emit=col, emit_strength=6.5))

    # ---- camera, looking +Y, +Z up ----
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = LENS
    cam_data.sensor_width = SENSOR
    cam_data.sensor_fit = "HORIZONTAL"
    cam_data.clip_start = 0.05
    cam_data.clip_end = 80.0
    cam = bpy.data.objects.new("cam", cam_data)
    # local X = world X, local Y = world Z, local -Z = world +Y
    cam.matrix_world = Matrix((
        (1, 0, 0, CX),
        (0, 0, -1, CY),
        (0, 1, 0, CZ),
        (0, 0, 0, 1),
    ))
    link(cam)
    scene.camera = cam

    # ---- shell ----
    # Floor
    cube("floor", (0.1, -3.1, -0.04), (6.6, 6.6, 0.08), floor)
    # Back wall in pieces around the window. Interior face at Y=0.
    # Window glass target: px 482..765, py 0..696, extended above the frame.
    x_l, x_r = wx_of(482), wx_of(765)
    z_sill = wz_of(696)
    z_top = wz_of(-80)  # header sits above the frame
    print("window world", round(x_l, 3), round(x_r, 3), round(z_sill, 3), round(z_top, 3))
    # left of window, dark (clock zone)
    cube("wall_left", ((-3.05 + x_l) / 2, 0.08, 1.55), (x_l + 3.05, 0.16, 3.2), wall_dark)
    # right of window
    cube("wall_right", ((x_r + 3.15) / 2, 0.08, 1.55), (3.15 - x_r, 0.16, 3.2), wall)
    # under the sill
    cube("wall_under", ((x_l + x_r) / 2, 0.08, z_sill / 2), (x_r - x_l, 0.16, z_sill), wall)
    # above the header
    cube("wall_over", ((x_l + x_r) / 2, 0.08, (z_top + 3.2) / 2), (x_r - x_l, 0.16, 3.2 - z_top), wall_dark)
    # side walls and ceiling, dark
    cube("wall_side_l", (-3.05, -3.0, 1.55), (0.12, 6.2, 3.2), wall_dark)
    cube("wall_side_r", (3.15, -3.0, 1.55), (0.12, 6.2, 3.2), wall_dark)
    cube("ceiling", (0.05, -3.0, 3.16), (6.3, 6.2, 0.08), wall_dark)

    # Window frame and the three vertical mullions, on the mask's black gaps.
    def mullion(name, px0, px1, z0, z1, depth=0.06):
        a, b = wx_of(px0), wx_of(px1)
        zz0, zz1 = wz_of(z1), wz_of(z0)  # py grows downward
        cube(name, ((a + b) / 2, -0.02, (zz0 + zz1) / 2), (abs(b - a), depth, abs(zz1 - zz0)), trim)

    mullion("jamb_l", 464, 482, -40, 708)
    mullion("jamb_r", 765, 786, -40, 708)
    mullion("mullion_a", 546, 554, -40, 696)
    mullion("mullion_b", 626, 648, -40, 696)
    mullion("mullion_c", 705, 711, -40, 696)
    mullion("sill", 464, 786, 696, 724, depth=0.14)
    # header, off the top of the frame
    mullion("header", 464, 786, -120, -40)

    # Garland swag across the lower window, where the mask goes dark.
    for i in range(28):
        u = i / 27
        px = 490 + u * 260
        py = 430 + math.sin(u * math.pi) * 150
        p = sphere("swag%d" % i, (wx_of(px), -0.05, wz_of(py)), 0.035 + 0.01 * math.sin(u * 6), garland, segs=7, rings=4)
        if i % 5 == 0:
            sphere("swag_b%d" % i, (wx_of(px), -0.06, wz_of(py) - 0.03), 0.018, bulbs[i % 4], segs=6, rings=4)
        if i % 7 == 3:
            sphere("swag_o%d" % i, (wx_of(px) + 0.02, -0.07, wz_of(py) - 0.02), 0.022, red if i % 2 == 0 else gold, segs=7, rings=4)

    # ---- exterior, seen through the glass ----
    cube("snow_ground", (-1.2, 6.5, 0.22), (8.0, 12.0, 0.08), snow)
    sun_target = Vector((wx_of(620), 0.4, wz_of(430)))
    cam_pos = Vector((CX, CY, CZ))
    sun_dir = (sun_target - cam_pos).normalized()
    # pines
    pines = [(-2.3, 4.2, 2.4, 0.55), (-1.5, 6.4, 3.3, 0.7), (-0.6, 5.0, 2.8, 0.6),
             (-2.0, 8.5, 4.0, 0.85), (-0.9, 9.2, 3.6, 0.75), (-1.8, 3.4, 1.8, 0.4)]
    for i, (px, py, h, r) in enumerate(pines):
        cone("pine%d" % i, (px, py, 0.26 + h * 0.5), r, h, pine, verts=10)
        cone("pine_snow%d" % i, (px, py, 0.26 + h * 0.78), r * 0.28, h * 0.22, snow, verts=8)
    paint_world(scene.world, tuple(sun_dir))

    # Window light. An area just outside the opening, aimed into the room, plus a low sun.
    area_data = bpy.data.lights.new("window_light", "AREA")
    area_data.shape = "RECTANGLE"
    area_data.size = x_r - x_l
    area_data.size_y = (z_top - z_sill) * 0.72
    area_data.energy = 70.0
    area_data.color = (1.0, 0.62, 0.32)
    area = bpy.data.objects.new("window_light", area_data)
    area.location = ((x_l + x_r) / 2, 0.35, (z_sill + wz_of(200)) / 2)
    # local -Z points along world -Y (into the room)
    area.rotation_euler = (math.radians(-90), 0.0, 0.0)
    link(area)

    sun_data = bpy.data.lights.new("sun", "SUN")
    sun_data.energy = 3.4
    sun_data.color = (1.0, 0.58, 0.28)
    sun_data.angle = math.radians(2.2)
    sun = bpy.data.objects.new("sun", sun_data)
    # point the sun's -Z along the direction from the sky disc into the room (opposite sun_dir)
    into = (-sun_dir[0], -sun_dir[1], -sun_dir[2] - 0.15)
    sun.rotation_euler = Vector(into).to_track_quat("-Z", "Y").to_euler()
    sun.location = (sun_target.x, 2.0, sun_target.z + 1.5)
    link(sun)

    # ---- tree, just right of the window, near the back wall so the base stays in frame ----
    tx, ty = -0.05, -0.72
    layers = [(0.62, 0.78, 0.55), (0.52, 0.70, 1.05), (0.40, 0.62, 1.50), (0.28, 0.50, 1.90), (0.16, 0.38, 2.22)]
    cyl("trunk", (tx, ty, 0.16), 0.06, 0.32, trunk, verts=8)
    for i, (r, h, zc) in enumerate(layers):
        cone("tier%d" % i, (tx, ty, zc), r, h, foliage, verts=16)
    # lights and ornaments on the tiers
    light_n = 0
    for r, h, zc in layers:
        for k in range(11):
            ang = k * 2.399963 + zc * 3.0
            rr = r * (0.72 + 0.22 * ((k * 17) % 5) / 5)
            zz = zc - h * 0.35 + (k % 5) * (h * 0.14)
            loc = (tx + math.cos(ang) * rr, ty + math.sin(ang) * rr * 0.85, zz)
            sphere("light%d" % light_n, loc, 0.022, bulbs[light_n % 4], segs=6, rings=4)
            light_n += 1
            if k % 3 == 0:
                mat = (red, gold, cream)[(k + int(zc * 4)) % 3]
                sphere("orn%d" % light_n, (loc[0], loc[1], loc[2] - 0.06), 0.04, mat, segs=8, rings=5)
    # a star-less topper: a small warm glow, no symbol
    sphere("topper", (tx, ty, 2.42), 0.045, bulbs[0], segs=8, rings=5)

    # presents
    gifts = [
        ((tx - 0.72, ty - 0.05, 0.12), (0.32, 0.26, 0.24), gift_a),
        ((tx - 0.42, ty + 0.28, 0.10), (0.26, 0.22, 0.20), gift_b),
        ((tx + 0.62, ty + 0.05, 0.14), (0.30, 0.26, 0.28), gift_c),
        ((tx + 0.32, ty + 0.32, 0.09), (0.22, 0.20, 0.18), gift_a),
        ((tx - 0.15, ty + 0.38, 0.08), (0.20, 0.18, 0.16), gift_b),
    ]
    # A few point lights carry the tree's glow. The spheres stay camera-only.
    tree_lamps = []
    for i, (zz, energy) in enumerate(((0.7, 12.0), (1.15, 14.0), (1.6, 12.0), (2.05, 8.0))):
        pdata = bpy.data.lights.new("tree_lamp%d" % i, "POINT")
        pdata.energy = energy
        pdata.color = (1.0, 0.72, 0.40)
        pdata.shadow_soft_size = 0.15
        pob = bpy.data.objects.new("tree_lamp%d" % i, pdata)
        pob.location = (tx, ty, zz)
        link(pob)
        tree_lamps.append(pdata.name)
    scene["tree_lamps"] = tree_lamps
    for i, (loc, size, mat) in enumerate(gifts):
        cube("gift%d" % i, loc, size, mat)
        cube("ribbon%d" % i, (loc[0], loc[1], loc[2]), (size[0] * 1.01, size[1] * 0.12, size[2] * 1.02), ribbon)
        cube("ribbon_b%d" % i, (loc[0], loc[1], loc[2] + size[2] * 0.5), (size[0] * 0.12, size[1] * 1.01, 0.02), ribbon)

    # ---- stairs, rising to the right behind the tree ----
    cube("stringer", (1.15, -0.28, 0.55), (1.5, 0.12, 0.08), trim).rotation_euler = (0.0, math.radians(-42), 0.0)
    for i in range(8):
        x = 0.55 + i * 0.18
        z = 0.10 + i * 0.16
        y = -0.35 + i * 0.02
        cube("step%d" % i, (x, y, z), (0.42, 0.85, 0.08), trim)
    # posts and a rail
    for i in range(6):
        x = 0.48 + i * 0.26
        z = 0.55 + i * 0.22
        y = -0.72
        cyl("post%d" % i, (x, y, z), 0.025, 0.55, trim, verts=6)
    # rail as a row of small boxes
    for i in range(14):
        u = i / 13
        x = 0.48 + u * 1.35
        z = 0.85 + u * 1.15
        cube("rail%d" % i, (x, -0.72, z), (0.12, 0.04, 0.04), trim)
        if i % 2 == 0:
            sphere("rail_g%d" % i, (x, -0.74, z + 0.03), 0.03, garland, segs=6, rings=4)
        if i % 3 == 0:
            sphere("rail_l%d" % i, (x, -0.76, z + 0.05), 0.016, bulbs[i % 4], segs=6, rings=3)

    # ---- sofa and lamp, right side, far enough back to stay in frame ----
    cube("sofa_base", (1.72, -1.45, 0.28), (0.95, 0.62, 0.32), sofa_mat)
    cube("sofa_back", (1.72, -1.18, 0.55), (0.95, 0.14, 0.40), sofa_mat)
    cube("sofa_arm_l", (1.28, -1.45, 0.40), (0.12, 0.62, 0.24), sofa_mat)
    cube("sofa_arm_r", (2.16, -1.45, 0.40), (0.12, 0.62, 0.24), sofa_mat)
    cube("pillow", (1.55, -1.32, 0.50), (0.32, 0.12, 0.24), pillow)
    cube("throw", (1.95, -1.55, 0.42), (0.40, 0.32, 0.06), gift_b)
    # side table and lamp, mid-right, shade below the badge zone
    cube("side_table", (1.35, -1.55, 0.28), (0.32, 0.32, 0.08), trim)
    cyl("table_leg", (1.35, -1.55, 0.14), 0.03, 0.28, trim, verts=6)
    cyl("lamp_stem", (1.35, -1.55, 0.62), 0.025, 0.55, lamp_base, verts=8)
    cyl("lamp_shade", (1.35, -1.55, 0.98), 0.16, 0.22, shade, verts=12)
    lamp_data = bpy.data.lights.new("lamp", "AREA")
    lamp_data.size = 0.18
    lamp_data.energy = 18.0
    lamp_data.color = (1.0, 0.70, 0.42)
    lamp = bpy.data.objects.new("lamp", lamp_data)
    lamp.location = (1.35, -1.55, 0.90)
    lamp.rotation_euler = (0.0, 0.0, 0.0)  # shines down, local -Z is world -Z after default
    link(lamp)
    # a dim fill so the sofa is not a hole, aimed from the room, very weak
    fill_data = bpy.data.lights.new("fill", "AREA")
    fill_data.size = 1.5
    fill_data.energy = 4.0
    fill_data.color = (0.65, 0.70, 0.85)
    fill = bpy.data.objects.new("fill", fill_data)
    fill.location = (0.2, -3.4, 1.6)
    fill.rotation_euler = (math.radians(80), 0.0, 0.0)
    link(fill)

    # bare branches in a vase, left of the window, in the dark
    cyl("vase", (-2.15, -1.6, 0.28), 0.10, 0.32, vase, verts=10)
    for i in range(7):
        ang = i * 0.9
        cyl("twig%d" % i, (-2.15 + math.sin(ang) * 0.05, -1.6, 0.55 + i * 0.02), 0.008, 0.55, branch, verts=5)
        bpy.context.active_object.rotation_euler = (0.3, ang, 0.4)

    # rug under the tree, dark, so the lower center is not a white sheet
    cube("rug", (tx + 0.05, ty + 0.05, 0.005), (1.15, 0.9, 0.01), sofa_mat)

    # record materials whose emission breathes
    scene["bulb_names"] = [m.name for m in bulbs]
    scene["cam_name"] = cam.name
    return scene


def apply_frame(scene):
    n = FRAMES
    t = (scene.frame_current - 1) / n
    a = 2.0 * math.pi * t
    cam = bpy.data.objects[scene["cam_name"]]
    # one lateral period, a smaller vertical breath at twice the rate, a tiny dolly
    cam.location = (
        CX + math.sin(a) * 0.012,
        CY + math.sin(a) * 0.010,
        CZ + math.sin(2.0 * a) * 0.0035,
    )
    for i, name in enumerate(scene["bulb_names"]):
        mat = bpy.data.materials[name]
        phase = i * (math.pi / 2.0)
        k = 0.78 + 0.22 * math.sin(2.0 * a + phase)
        mat.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 8.0 * k
    for i, name in enumerate(scene.get("tree_lamps", [])):
        light = bpy.data.lights[name]
        phase = i * (math.pi / 2.0)
        k = 0.82 + 0.18 * math.sin(2.0 * a + phase)
        base = (12.0, 14.0, 12.0, 8.0)[i]
        light.energy = base * k


def install_handler():
    def handler(scene):
        apply_frame(scene)
    bpy.app.handlers.frame_change_pre.clear()
    bpy.app.handlers.frame_change_pre.append(handler)


def check_projection(scene):
    from bpy_extras.object_utils import world_to_camera_view
    cam = scene.camera
    bpy.context.view_layer.update()

    def pix(pt):
        co = world_to_camera_view(scene, cam, Vector(pt))
        return co.x * RES_X, (1.0 - co.y) * RES_Y, co.z

    corners = {
        "left_top": ((wx_of(482), 0.0, wz_of(0)), (482, 0)),
        "right_top": ((wx_of(765), 0.0, wz_of(0)), (765, 0)),
        "left_sill": ((wx_of(482), 0.0, wz_of(696)), (482, 696)),
        "right_sill": ((wx_of(765), 0.0, wz_of(696)), (765, 696)),
    }
    worst = 0.0
    for name, (pt, want) in corners.items():
        got = pix(pt)
        err = max(abs(got[0] - want[0]), abs(got[1] - want[1]))
        worst = max(worst, err)
        print("project", name, "got", tuple(round(v, 2) for v in got), "want", want, "err", round(err, 3))
    print("project worst px", round(worst, 3))
    return worst


def main():
    args = argv_after_dd()
    scene = build()
    install_handler()
    scene.frame_set(1)
    apply_frame(scene)
    worst = check_projection(scene)
    if worst > 1.5:
        print("WINDOW PROJECTION OFF", worst)
        sys.exit(2)
    if not args or args[0] == "--check":
        print("CHECK ok frames", FRAMES, "seconds", SECONDS, "fps", FPS)
        return
    if args[0] == "--still":
        samples = int(args[1]) if len(args) > 1 else 16
        scene.cycles.samples = samples
        path = args[2] if len(args) > 2 else "/tmp/dec-room/still.png"
        scene.render.filepath = path
        scene.frame_set(1)
        apply_frame(scene)
        bpy.ops.render.render(write_still=True)
        print("STILL", path, "samples", samples)
        return
    if args[0] == "--bench":
        n = int(args[1]) if len(args) > 1 else 3
        scene.frame_end = n
        scene.cycles.samples = int(args[2]) if len(args) > 2 else 4
        out = "/tmp/dec-room/bench"
        os.makedirs(out, exist_ok=True)
        scene.render.filepath = os.path.join(out, "f_")
        bpy.ops.render.render(animation=True)
        print("BENCH", n, "samples", scene.cycles.samples)
        return
    if args[0] == "--render":
        out = args[1] if len(args) > 1 else OUT
        os.makedirs(out, exist_ok=True)
        scene.render.filepath = os.path.join(out, "f_")
        bpy.ops.render.render(animation=True)
        print("RENDERED", FRAMES, "to", out)
        return
    print("unknown", args)
    sys.exit(2)


if __name__ == "__main__":
    main()
