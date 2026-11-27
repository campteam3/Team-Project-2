# 생일 스노우볼(design/blender/birthdayglobe.blend)을 웹용 파일로 내보냅니다. (김미영)
# Blender 에서 birthdayglobe.blend 를 연 채로 실행합니다:  exec(open("scripts/blender/export_birthday.py", encoding="utf-8").read())
#
# 만드는 파일
#   public/models/birthday.glb            스노우볼 본체 (물체 이름 w_ · 재질 이름 W_, 크리스마스 · 새해 모델과 같은 규칙)
#   public/models/ornaments-birthday.glb  메시지 토핑 원형 (t_Orn_Kiss · t_Orn_Candy · t_Orn_Jelly)
#   lib/birthday-slots.json               토핑 자리 (케이크 윗면 = hang, 옆면 = slope)
#
# 받침대와 명판은 크리스마스 모델과 같은 크기 · 자리라서 크기를 바꾸지 않고 그대로 내보냅니다 (명판 입력칸 · 화면 맞춤을 함께 쓰려고).
# 유리 구만 더 큽니다: 반지름 1.28 · 가운데 높이 0.66 (크리스마스는 반지름 1 · 높이 0.55). 웹에서는 lib/theme 가 아니라 SnowGlobeModel.tsx 의 modelFor 가 이 크기를 압니다.
# 원본 파일은 바꾸지 않습니다: 임시 물체를 만들어 내보내고 지우며, 재질 이름도 내보낸 뒤 되돌립니다.

import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix

ROOT = os.path.normpath(os.path.join(os.path.dirname(bpy.data.filepath), "..", ".."))
scene = bpy.context.scene
glass = json.loads(scene["glass"])
K = 1.0
FIT = Matrix.Identity(4)

# 웹에 올리기에는 면이 너무 많은 물체는 줄여서 내보냅니다 (남기는 비율)
DECIMATE = {
    "Cake_BottomCream": 0.2,
    "Cake_Icing": 0.25,
    "Cake_Body": 0.25,
    "Cake_Ribbon": 0.4,
    "Balloons_L": 0.35,
    "Balloons_R": 0.35,
    "Stand_Beads": 0.5,
    "Gift": 0.5,
}
# 웹은 메시지 토핑을 자리 크기의 1.25배로 그립니다 (SnowGlobeGlb.tsx 의 MESSAGE_SCALE)
MESSAGE_SCALE = 1.25
TOPPINGS = {"Top_Kiss": "t_Orn_Kiss", "Top_Candy": "t_Orn_Candy", "Top_Star": "t_Orn_Jelly"}


def baked(obj, matrix, ratio=None):
    """수정자를 적용하고 matrix 로 옮긴 임시 물체를 만듭니다."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    mesh.transform(matrix)
    temp = bpy.data.objects.new("tmp_" + obj.name, mesh)
    scene.collection.objects.link(temp)
    if ratio:
        modifier = temp.modifiers.new("d", "DECIMATE")
        modifier.ratio = ratio
        bpy.context.view_layer.update()
        depsgraph = bpy.context.evaluated_depsgraph_get()
        small = bpy.data.meshes.new_from_object(temp.evaluated_get(depsgraph))
        temp.modifiers.clear()
        old = temp.data
        temp.data = small
        bpy.data.meshes.remove(old)
    return temp


def joined(name, objects):
    """여러 물체를 재질을 지키며 하나로 합칩니다."""
    materials = []
    bm = bmesh.new()
    for obj in objects:
        offset = len(bm.faces)
        bm.from_mesh(obj.data)
        bm.faces.ensure_lookup_table()
        slots = []
        for material in obj.data.materials:
            if material not in materials:
                materials.append(material)
            slots.append(materials.index(material))
        for face in bm.faces[offset:]:
            face.material_index = slots[face.material_index]
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for material in materials:
        mesh.materials.append(material)
    result = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(result)
    for obj in objects:
        data = obj.data
        bpy.data.objects.remove(obj)
        bpy.data.meshes.remove(data)
    return result


def export(path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
    )


def triangles(objects):
    total = 0
    for obj in objects:
        obj.data.calc_loop_triangles()
        total += len(obj.data.loop_triangles)
    return total


temps = []
renamed = []
try:
    # ── 스노우볼 본체
    gifts = []
    for obj in bpy.data.collections["SnowGlobe"].objects:
        if obj.type != "MESH" or not obj.visible_get():
            continue
        is_gift = obj.name.startswith("Gift_")
        temp = baked(obj, FIT @ obj.matrix_world, DECIMATE.get("Gift" if is_gift else obj.name))
        if is_gift:
            gifts.append(temp)
        else:
            temp.name = "w_" + obj.name
            temps.append(temp)
    temps.append(joined("w_Gifts", gifts))

    used = {material for obj in temps for material in obj.data.materials if material}
    for material in used:
        renamed.append((material, material.name))
        material.name = "W_" + material.name
    globe_tris = triangles(temps)
    export(os.path.join(ROOT, "public", "models", "birthday.glb"), temps)
    for material, name in renamed:
        material.name = name
    renamed.clear()

    # ── 메시지 토핑 원형: 가운데로 옮기고, 세 가지가 같은 자리 크기로 놓이도록 크기를 맞춥니다
    scales = json.loads(scene["topping_scales"])
    unit = scales["Top_Kiss"]
    toppings = []
    for source, name in TOPPINGS.items():
        obj = bpy.data.objects[source]
        matrix = obj.matrix_world.to_3x3().normalized().to_4x4() @ Matrix.Scale(scales[source] / unit, 4)
        temp = baked(obj, matrix)
        temp.name = name
        toppings.append(temp)
        for material in temp.data.materials:
            renamed.append((material, material.name))
            material.name = "Orn_Main_" + name[6:]
    temps += toppings
    export(os.path.join(ROOT, "public", "models", "ornaments-birthday.glb"), toppings)

    # ── 토핑 자리. Blender (x, y, z) → 웹 (x, z, -y): 위가 +y, 정면(명판 쪽)이 +z
    data = json.loads(scene["birthday_slots"])
    size = unit * K / MESSAGE_SCALE
    slots = []
    for kind, source in (("hang", data["top"]), ("slope", data["side"])):
        for item in source:
            x, y, z = FIT @ Matrix.Translation(item["pos"]).to_translation()
            front = abs(math.atan2(x, -y))
            # 옆면 정면 한가운데는 리본 매듭이 가리므로 뺍니다
            if kind == "slope" and front < math.radians(16):
                continue
            yaw = item["yaw"]
            slots.append(
                {
                    "id": len(slots),
                    "kind": kind,
                    "tier": 0,
                    "position": [round(x, 4), round(z, 4), round(-y, 4)],
                    "quaternion": [0, round(math.sin(yaw / 2), 5), 0, round(math.cos(yaw / 2), 5)],
                    "ballScale": round(size, 5),
                    "cookieScale": round(size, 5),
                }
            )
    # 촛불 자리: 초마다 불꽃 메시의 맨 아래 가운데와 높이. 웹은 불꽃 메시를 숨기고 이 자리에 일렁이는 불꽃을 그립니다 (CandleFlames.tsx)
    candles = bpy.data.objects["Cake_Candles"]
    flame_index = [m.name for m in candles.data.materials].index("Candle_Flame")
    flame_points = set()
    for polygon in candles.data.polygons:
        if polygon.material_index == flame_index:
            flame_points.update(polygon.vertices)
    flame_points = [FIT @ candles.matrix_world @ candles.data.vertices[i].co for i in flame_points]
    flames = []
    for px, py, _ in json.loads(scene["flame_points"]):
        near = [v for v in flame_points if math.hypot(v.x - px, v.y - py) < 0.04]
        if not near:
            continue
        low = min(v.z for v in near)
        cx = sum(v.x for v in near) / len(near)
        cy = sum(v.y for v in near) / len(near)
        flames.append({"position": [round(cx, 4), round(low, 4), round(-cy, 4)], "height": round(max(v.z for v in near) - low, 4)})

    out = {
        "note": "생일 스노우볼의 토핑 자리. scripts/blender/export_birthday.py 가 design/blender/birthdayglobe.blend 에서 만듭니다. hang = 케이크 윗면(머랭 키스 · 사탕 구슬), slope = 케이크 옆면(젤리 별)",
        "glass": {"center": [0, round(glass["center"][2], 4), 0], "radius": glass["radius"]},
        "flames": flames,
        "slots": slots,
    }
    with open(os.path.join(ROOT, "lib", "birthday-slots.json"), "w", encoding="utf-8") as file:
        json.dump(out, file, ensure_ascii=False, indent=1)
    print("birthday export: globe tris", globe_tris, "slots", {k: sum(1 for s in slots if s["kind"] == k) for k in ("hang", "slope")})
finally:
    for material, name in renamed:
        material.name = name
    for temp in temps:
        data = temp.data
        bpy.data.objects.remove(temp)
        bpy.data.meshes.remove(data)
