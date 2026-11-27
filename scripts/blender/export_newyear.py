# design/blender/newyear.blend 에서 웹에 쓰는 파일 세 개를 내보냅니다. (차명근)
#   public/models/newyear.glb            새해 스노우볼 (SnowGlobe 컬렉션의 메시)
#   public/models/ornaments-newyear.glb  새해 오너먼트 원형 (OrnamentTemplatesNewYear 컬렉션)
#   lib/newyear-slots.json               오너먼트 자리 (Slots 컬렉션의 Slot_00 ~ Slot_38 Empty)
#
# 쓰는 법 (저장소 맨 위 폴더에서). Blender 에서 모양이나 자리를 고친 뒤 저장하고 돌립니다:
#   blender -b design/blender/newyear.blend --python scripts/blender/export_newyear.py
# 그다음 평소처럼 `npm run build` 를 하면 모델이 압축됩니다.
#
# 이름 규칙: 내보낼 때 오브젝트에 w_, 재질에 W_ 를 붙입니다 (오너먼트 원형은 t_, 재질 이름 그대로).
# 웹 코드(components/snowglobe/SnowGlobeGlb.tsx)가 이 이름으로 켜고 끄기 · 재질 마감을 합니다.
# 자리: Empty 의 위치가 오너먼트 가운데, 로컬 -Y 가 겉면 바깥, 로컬 +Z 가 오너먼트의 위, 크기(scale)가 오너먼트 크기입니다.

import json
import os

import bpy

SLOT_COUNT = 39  # DB 의 ornament_limit, lib/snowglobe-slots.json 의 자리 수와 같아야 합니다


def _export(path, objects, object_prefix, material_prefix, at_origin=False):
    renamed = []
    moved = []
    materials = {slot.material for obj in objects for slot in obj.material_slots if slot.material}
    for item in [*objects, *(materials if material_prefix else [])]:
        prefix = object_prefix if isinstance(item, bpy.types.Object) else material_prefix
        renamed.append((item, item.name))
        item.name = prefix + item.name
    if at_origin:
        for obj in objects:
            moved.append((obj, obj.location.copy()))
            obj.location = (0, 0, 0)
    for obj in bpy.context.view_layer.objects:
        obj.select_set(obj in objects)
    try:
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_extras=False, export_animations=False)
    finally:
        for item, name in renamed:
            item.name = name
        for obj, location in moved:
            obj.location = location
    print(f"[내보내기] {os.path.relpath(path)}: 오브젝트 {len(objects)}개, {os.path.getsize(path) // 1024}KB")


def _slots(path):
    empties = sorted((obj for obj in bpy.data.collections["Slots"].objects if obj.name.startswith("Slot_")), key=lambda obj: obj.name)
    if len(empties) != SLOT_COUNT:
        raise SystemExit(f"[내보내기] 자리가 {len(empties)}개입니다. {SLOT_COUNT}개여야 합니다 (Slot_00 ~ Slot_{SLOT_COUNT - 1}).")
    slots = []
    for index, empty in enumerate(empties):
        location, rotation, scale = empty.matrix_world.decompose()
        # Blender(Z 위, 정면 -Y) → glTF(Y 위, 정면 +Z): (x, y, z) → (x, z, -y)
        slots.append(
            {
                "id": index,
                "kind": "slope",
                "tier": 0,
                "position": [round(location.x, 4), round(location.z, 4), round(-location.y, 4)],
                "quaternion": [round(rotation.x, 5), round(rotation.z, 5), round(-rotation.y, 5), round(rotation.w, 5)],
                "ballScale": None,
                "cookieScale": round(scale.x, 4),
            }
        )
    data = {"note": "Blender design/blender/newyear.blend 에서 내보낸 값 (scripts/blender/export_newyear.py). 단위 m, Y가 위.", "glass": {"center": [0, 0.55, 0], "radius": 1.0}, "slots": slots}
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=1)
        file.write("\n")
    print(f"[내보내기] {os.path.relpath(path)}: 자리 {len(slots)}개")


def export_all(root):
    globe = [obj for obj in bpy.data.collections["SnowGlobe"].objects if obj.type == "MESH"]
    _export(os.path.join(root, "public", "models", "newyear.glb"), globe, "w_", "W_")
    templates = [obj for obj in bpy.data.collections["OrnamentTemplatesNewYear"].objects if obj.type == "MESH"]
    _export(os.path.join(root, "public", "models", "ornaments-newyear.glb"), templates, "t_", "", at_origin=True)
    _slots(os.path.join(root, "lib", "newyear-slots.json"))


if __name__ == "__main__":
    export_all(os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")))
