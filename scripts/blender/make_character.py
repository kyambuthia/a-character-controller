"""Builds public/assets/character.glb: a rigged boxman with the physics ragdoll's proportions.

One box per ragdoll body, one bone per body (bone heads at the ragdoll's joint anchors in the spawn
pose), a single grey material. Because it is generated from the ragdoll's own definitions, the
skinned model and the physics bodies cannot drift apart.

Usage (from the repo root):
  npx vite-node scripts/dump-humanoid.mts /tmp/humanoid.json
  blender -b -P scripts/blender/make_character.py -- /tmp/humanoid.json public/assets/character.glb \
      [out.blend] [preview.png]

Coordinates: the ragdoll is Y-up facing +Z (three.js); Blender is Z-up, so (x, y, z) -> (x, -z, y).
The model stands on the ground (z = 0) with the pelvis STAND_PELVIS_HEIGHT above it.
"""
import json
import math
import sys

import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
json_path, glb_path = argv[0], argv[1]
blend_path = argv[2] if len(argv) > 2 else None
preview_path = argv[3] if len(argv) > 3 else None

STAND_PELVIS_HEIGHT = 1.98  # keep in sync with STAND_PELVIS_HEIGHT in active-ragdoll/config.ts
HEAD_NECK_PAD = 0.05  # extends the head box down to meet the torso (see padBottom in ragdollSkin.ts)

data = json.load(open(json_path))
bodies = {b["key"]: b for b in data["bodies"]}

# Body key -> bone name. The model's ".L" is +X, which is the ragdoll's "Right" side.
BONES = {
    "pelvis": "butt_bone", "chest": "body_upper", "head": "head",
    "upperArmRight": "arm_upper.L", "lowerArmRight": "arm_lower.L", "handRight": "hand.L",
    "upperArmLeft": "arm_upper.R", "lowerArmLeft": "arm_lower.R", "handLeft": "hand.R",
    "upperLegRight": "leg_upper.L", "lowerLegRight": "leg_lower.L", "footRight": "foot.L",
    "upperLegLeft": "leg_upper.R", "lowerLegLeft": "leg_lower.R", "footLeft": "foot.R",
}


def to_blender(v):
    return Vector((v[0], -v[2], v[1]))


def world(key):
    p = bodies[key]["position"]
    return to_blender((p[0], p[1] + STAND_PELVIS_HEIGHT, p[2]))


# Parent body for every body, and the joint position (in world space) where it attaches.
parent = {}
joint_at = {}
for joint in data["joints"]:
    a, b = joint["bodyA"], joint["bodyB"]
    parent[b] = a
    joint_at[b] = world(a) + to_blender(joint["anchorA"])
joint_at["pelvis"] = world("pelvis")

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# --- armature ---
arm_data = bpy.data.armatures.new("Armature")
arm = bpy.data.objects.new("Armature", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
edit_bones = arm_data.edit_bones

root = edit_bones.new("root")
root.head, root.tail = (0, 0, 0), (0, 0, 0.3)
order = ["pelvis", "chest", "head", "upperArmRight", "lowerArmRight", "handRight",
         "upperArmLeft", "lowerArmLeft", "handLeft", "upperLegRight", "lowerLegRight", "footRight",
         "upperLegLeft", "lowerLegLeft", "footLeft"]
for key in order:
    bone = edit_bones.new(BONES[key])
    head = joint_at[key]
    down = "Leg" in key or "Arm" in key or "hand" in key.lower() or "foot" in key.lower()
    bone.head = head
    bone.tail = head + Vector((0, 0, -0.2 if down else 0.2))
    bone.parent = edit_bones[BONES[parent[key]]] if key in parent else root
bpy.ops.object.mode_set(mode="OBJECT")

# --- material ---
material = bpy.data.materials.new("body")
material.use_nodes = True
material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.85, 0.85, 0.85, 1)
material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.8
material.diffuse_color = (0.85, 0.85, 0.85, 1)

# --- one box per body, weighted 1.0 to its bone ---
bm = bmesh.new()
groups = {}
for key in order:
    body = bodies[key]
    shape = body["shape"]
    size = Vector((2 * shape["radius"],) * 3) if shape["kind"] == "sphere" else Vector(
        (shape["size"][0], shape["size"][2], shape["size"][1]))  # blender (x, y=depth, z=height)
    center = world(key)
    if body.get("meshOffset"):
        center += to_blender(body["meshOffset"])
    if key == "head":
        size.z += HEAD_NECK_PAD
        center.z -= HEAD_NECK_PAD / 2
    result = bmesh.ops.create_cube(bm, size=1.0)
    verts = result["verts"]
    bmesh.ops.scale(bm, vec=size, verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    groups[BONES[key]] = [v.index for v in verts]

bm.verts.ensure_lookup_table()
mesh = bpy.data.meshes.new("character")
bm.to_mesh(mesh)
bm.free()
mesh.materials.append(material)
obj = bpy.data.objects.new("character", mesh)
scene.collection.objects.link(obj)
for bone_name, indices in groups.items():
    obj.vertex_groups.new(name=bone_name).add(indices, 1.0, "REPLACE")
obj.parent = arm
modifier = obj.modifiers.new("Armature", "ARMATURE")
modifier.object = arm
for polygon in mesh.polygons:
    polygon.use_smooth = False

# --- preview + saves ---
if preview_path or blend_path:
    sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
    sun.rotation_euler = (0.8, 0.2, 0.6)
    scene.collection.objects.link(sun)
    camera = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(camera)
    camera.location = (6.5, -9.5, 3.4)
    camera.rotation_euler = (math.radians(84), 0, math.radians(35))
    scene.camera = camera
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x, scene.render.resolution_y = 700, 900
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.05, 0.07, 0.12)
    if preview_path:
        scene.render.filepath = preview_path
        bpy.ops.render.render(write_still=True)
    if blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    bpy.data.objects.remove(sun)
    bpy.data.objects.remove(camera)

bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB", export_animations=False, export_apply=False)
