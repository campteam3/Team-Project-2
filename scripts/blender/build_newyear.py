# 새해 스노우볼(2027 정미년) 장면을 만드는 Blender 스크립트입니다. (차명근)
# 설계: docs/superpowers/specs/2026-11-27-newyear-globe-design.md
#
# 쓰는 법 (저장소 맨 위 폴더에서):
#   blender -b design/blender/snowglobe.blend --python scripts/blender/build_newyear.py
# 하는 일:
#   1. 크리스마스 원본에서 유리 · 받침대 · 명판만 남기고 트리 · 별 · 선물 · 눈사람 · 바닥 눈 · 호랑가시나무 · 눈송이 장식을 지웁니다.
#   2. 양, 2027, 한옥 담장(기와 눈 · 까치), 소반 위 떡국, 황토 마당, 받침대 전통 문양을 만듭니다.
#   3. 오너먼트 자리(Slot_00 ~ Slot_38)와 새해 오너먼트 원형 세 가지를 만듭니다.
#   4. design/blender/newyear.blend 로 저장하고, public/models/newyear.glb · ornaments-newyear.glb, lib/newyear-slots.json 을 내보냅니다.
# 모양을 손으로 고친 뒤에는 이 스크립트를 다시 돌리지 말고(덮어씁니다) export_newyear.py 만 돌립니다.
#
# 좌표: Blender 는 Z 가 위, 정면(명판 쪽)이 -Y 입니다. 유리 구의 가운데는 (0, 0, 0.55), 반지름 1.

import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import export_newyear  # noqa: E402

random.seed(2027)
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
GLOBE = bpy.data.collections["SnowGlobe"]


# ───────────────────────── 재질 ─────────────────────────
def material(name, color, roughness=0.5, metallic=0.0, emission=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    rgb = [int(color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    bsdf.inputs["Base Color"].default_value = (*linear, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*linear, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = (*linear, 1)
    return mat


M = {
    "wool": material("Sheep_Wool", "#FBF7EF", 0.9),
    "face": material("Sheep_Face", "#F2D5BD", 0.6),
    "eye": material("Sheep_Eye", "#2B2320", 0.25),
    "blush": material("Sheep_Blush", "#F3A0A6", 0.7),
    "horn": material("Sheep_Horn", "#D8A548", 0.4, 0.25),
    "hoof": material("Sheep_Hoof", "#6B4A3A", 0.5),
    "yard": material("Yard", "#C9905A", 0.92),
    "year": material("Year_Red", "#D9263B", 0.35, 0.0, 0.6),
    "stone": material("Wall_Stone", "#8E7F70", 0.85),
    "plaster": material("Wall_Plaster", "#E8D6B4", 0.85),
    "tile": material("Wall_Tile", "#3A3C44", 0.55),
    "black": material("Magpie_Black", "#1E2026", 0.4),
    "white": material("Magpie_White", "#F4F2EC", 0.6),
    "blue": material("Magpie_Blue", "#2F4F93", 0.3),
    "soban": material("Soban_Wood", "#5E2F24", 0.35),
    "bowl": material("Bowl_White", "#F4F1EA", 0.22),
    "soup": material("Tteokguk_Soup", "#F1E3C8", 0.3),
    "tteok": material("Tteokguk_Tteok", "#FFFDF6", 0.5),
    "egg": material("Tteokguk_Egg", "#F2C64A", 0.6),
    "gim": material("Tteokguk_Gim", "#23262B", 0.6),
    "green": material("Tteokguk_Green", "#6FB36A", 0.6),
    # 기존 재질: 웹 코드가 이 이름으로 마감을 입힙니다
    "snow": bpy.data.materials["Snow_Sparkle"],
    "gold": bpy.data.materials["Gold"],
    "relief": bpy.data.materials["Base_ReliefGold"],
    "orn_main": bpy.data.materials["Orn_Main"],
    "orn_accent": bpy.data.materials["Orn_Accent"],
    "orn_metal": bpy.data.materials["Orn_Metal"],
}


# ───────────────────────── 도형 도우미 ─────────────────────────
class Shape:
    """여러 도형을 한 메시에 모읍니다. 도형마다 재질과 매끈함(smooth)을 정합니다."""

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def _slot(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def _finish(self, verts, mat, smooth):
        index = self._slot(mat)
        made = set(verts)
        for face in {f for v in verts for f in v.link_faces}:
            if all(v in made for v in face.verts):
                face.material_index = index
                face.smooth = smooth

    def sphere(self, center, radii, mat, subdivisions=2, rotation=None, smooth=True):
        if isinstance(radii, (int, float)):
            radii = (radii, radii, radii)
        matrix = Matrix.Translation(center) @ (rotation or Matrix()) @ Matrix.Diagonal((*radii, 1))
        made = bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=1, matrix=matrix)
        self._finish(made["verts"], mat, smooth)

    def cone(self, start, end, r0, r1, mat, segments=16, smooth=True):
        start, end = Vector(start), Vector(end)
        axis = end - start
        matrix = Matrix.Translation((start + end) / 2) @ axis.to_track_quat("Z", "Y").to_matrix().to_4x4()
        made = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=segments, radius1=max(r0, 1e-4), radius2=max(r1, 1e-4), depth=axis.length, matrix=matrix)
        self._finish(made["verts"], mat, smooth)

    def box(self, center, size, mat, rotation=None):
        matrix = Matrix.Translation(center) @ (rotation or Matrix()) @ Matrix.Diagonal((*size, 1))
        made = bmesh.ops.create_cube(self.bm, size=1, matrix=matrix)
        self._finish(made["verts"], mat, False)

    def tube(self, points, radii, mat, segments=10, smooth=True, closed=False):
        """points 를 따라가는 관. radii 는 숫자 하나 또는 점마다의 반지름."""
        points = [Vector(p) for p in points]
        if isinstance(radii, (int, float)):
            radii = [radii] * len(points)
        count = len(points)
        rings = []
        normal = None
        for i, point in enumerate(points):
            ahead = points[(i + 1) % count] if (closed or i < count - 1) else point
            behind = points[i - 1] if (closed or i > 0) else point
            tangent = (ahead - behind).normalized()
            if normal is None:
                normal = tangent.orthogonal().normalized()
            normal = (normal - tangent * normal.dot(tangent)).normalized()
            binormal = tangent.cross(normal)
            rings.append([self.bm.verts.new(point + (normal * math.cos(a) + binormal * math.sin(a)) * radii[i]) for a in (2 * math.pi * k / segments for k in range(segments))])
        verts = [v for ring in rings for v in ring]
        pairs = count if closed else count - 1
        for i in range(pairs):
            a, b = rings[i], rings[(i + 1) % count]
            for k in range(segments):
                self.bm.faces.new((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k]))
        if not closed:
            self.bm.faces.new(list(reversed(rings[0])))
            self.bm.faces.new(rings[-1])
        self._finish(verts, mat, smooth)

    def lathe(self, center, profile, mat, segments=24, smooth=True):
        """(반지름, 높이) 점들을 Z 축 둘레로 돌린 회전체. 반지름 0 인 끝은 한 점으로 모읍니다."""
        center = Vector(center)
        rings = []
        for radius, height in profile:
            if radius <= 1e-6:
                rings.append([self.bm.verts.new(center + Vector((0, 0, height)))])
            else:
                rings.append([self.bm.verts.new(center + Vector((radius * math.cos(a), radius * math.sin(a), height))) for a in (2 * math.pi * k / segments for k in range(segments))])
        for a, b in zip(rings, rings[1:]):
            for k in range(segments):
                k2 = (k + 1) % segments
                corners = [a[k % len(a)], a[k2 % len(a)], b[k2 % len(b)], b[k % len(b)]]
                unique = list(dict.fromkeys(corners))
                if len(unique) >= 3:
                    self.bm.faces.new(unique)
        self._finish([v for ring in rings for v in ring], mat, smooth)

    def sweep(self, profile, angles, mat, radius, smooth=False):
        """(바깥쪽으로 떨어진 거리, 높이) 단면을 Z 축 둘레의 호(angles, 라디안)를 따라 밀어 만든 띠."""
        rings = []
        for angle in angles:
            out = Vector((math.cos(angle), math.sin(angle), 0))
            rings.append([self.bm.verts.new(out * (radius + d) + Vector((0, 0, z))) for d, z in profile])
        n = len(profile)
        for a, b in zip(rings, rings[1:]):
            for k in range(n):
                self.bm.faces.new((a[k], b[k], b[(k + 1) % n], a[(k + 1) % n]))
        self.bm.faces.new(rings[0])
        self.bm.faces.new(list(reversed(rings[-1])))
        self._finish([v for ring in rings for v in ring], mat, smooth)

    def build(self, name, collection=GLOBE, origin=None):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        mesh = bpy.data.meshes.new(name)
        if origin is not None:
            bmesh.ops.translate(self.bm, verts=self.bm.verts[:], vec=-Vector(origin))
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.mats:
            mesh.materials.append(mat)
        old = bpy.data.objects.get(name)
        if old:
            bpy.data.objects.remove(old, do_unlink=True)
        obj = bpy.data.objects.new(name, mesh)
        if origin is not None:
            obj.location = origin
        collection.objects.link(obj)
        return obj


def collection(name):
    found = bpy.data.collections.get(name)
    if found:
        for obj in list(found.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        return found
    found = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(found)
    return found


def cast(obj, origin, direction):
    """obj 겉면에 광선을 쏘아 닿은 점을 돌려줍니다 (obj 는 원점에 그대로 놓인 메시)."""
    inverse = obj.matrix_world.inverted()
    hit, location, normal, _ = obj.ray_cast(inverse @ Vector(origin), inverse.to_3x3() @ Vector(direction))
    return (obj.matrix_world @ location, (obj.matrix_world.to_3x3() @ normal).normalized()) if hit else (None, None)


# ───────────────────────── 1. 크리스마스 소품 지우기 ─────────────────────────
ground_source = bpy.data.objects["Snow_Ground"]
yard = bpy.data.objects.new("Yard", ground_source.data.copy())
yard.matrix_world = ground_source.matrix_world.copy()
yard.data.materials.clear()
yard.data.materials.append(M["yard"])
GLOBE.objects.link(yard)

REMOVE = ("Tree_", "Gift_", "Snowman", "Reindeer", "GingerHouse", "Default_Orn", "Glitter_", "Snow_Ground", "Base_Relief_")
for obj in list(bpy.data.objects):
    if obj.name.startswith(REMOVE):
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.view_layer.update()


def ground_z(x, y):
    point, _ = cast(yard, (x, y, 2), (0, 0, -1))
    return point.z if point else 0.2


# ───────────────────────── 2. 양 ─────────────────────────
BODY = Vector((0, 0.07, 0.56))
BODY_R = Vector((0.46, 0.5, 0.375))
HEAD = Vector((0, -0.46, 0.86))


def on_body(direction, scale=1.0):
    d = Vector(direction).normalized()
    return BODY + Vector((d.x * BODY_R.x, d.y * BODY_R.y, d.z * BODY_R.z)) * scale


def fibonacci(count):
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(count):
        z = 1 - 2 * (i + 0.5) / count
        r = math.sqrt(1 - z * z)
        yield Vector((math.cos(golden * i) * r, math.sin(golden * i) * r, z))


sheep = Shape()
sheep.sphere(BODY, BODY_R * 0.95, M["wool"], 3)
# 털: 몸통 겉에 크고 작은 공을 붙여 몽글몽글하게 (hair 파티클은 glTF 로 넘어가지 않습니다)
for d in fibonacci(230):
    if d.z < -0.8:
        continue
    r = random.uniform(0.06, 0.1)
    sheep.sphere(on_body(d, 0.95), r, M["wool"], 2)
# 꼬리
sheep.sphere(on_body((0, 1, -0.15), 1.05), 0.075, M["wool"], 2)

# 얼굴
FACE_R = Vector((0.18, 0.15, 0.195))
sheep.sphere(HEAD, FACE_R, M["face"], 3)


def on_face(x, z, lift=0.0):
    """얼굴 앞면 위의 점. x, z 는 얼굴 가운데에서 떨어진 거리."""
    u, w = x / FACE_R.x, z / FACE_R.z
    v = -math.sqrt(max(0.0, 1 - u * u - w * w))
    return HEAD + Vector((x, v * FACE_R.y - lift, z))


for side in (-1, 1):
    sheep.sphere(on_face(side * 0.068, 0.025, 0.004), (0.02, 0.014, 0.024), M["eye"], 2)
    sheep.sphere(on_face(side * 0.105, -0.045, 0.0), (0.03, 0.008, 0.02), M["blush"], 2)
    # 귀: 옆으로 살짝 처지게
    ear = Matrix.Rotation(side * math.radians(-28), 4, "Y")
    sheep.sphere(HEAD + Vector((side * 0.2, 0.01, 0.03)), (0.075, 0.028, 0.042), M["face"], 2, ear)
    # 뿔: 귀 위에서 뒤로 말려 내려오는 작은 뿔
    spiral = []
    widths = []
    for i in range(15):
        t = i / 14
        angle = math.radians(100 - 290 * t)
        radius = 0.075 * (1 - 0.45 * t)
        spiral.append(HEAD + Vector((side * (0.125 + 0.07 * t), 0.045 + math.cos(angle) * radius, 0.115 + math.sin(angle) * radius)))
        widths.append(0.034 * (1 - 0.72 * t))
    sheep.tube(spiral, widths, M["horn"], 10)
    # 앞다리: 몸 아래로 접어 앞에 살짝 내민 발
    foot = Vector((side * 0.18, -0.4, ground_z(side * 0.18, -0.4) + 0.05))
    sheep.sphere(foot, (0.062, 0.1, 0.055), M["face"], 2)
    sheep.sphere(foot + Vector((0, -0.075, -0.005)), (0.05, 0.04, 0.046), M["hoof"], 2)
# 코와 입
sheep.sphere(on_face(0, -0.03, 0.004), (0.016, 0.01, 0.011), M["blush"], 2)
# 머리 위 털
for dx, dy, dz, r in ((0, 0.0, 0.17, 0.09), (-0.085, 0.02, 0.14, 0.07), (0.085, 0.02, 0.14, 0.07), (0, -0.07, 0.165, 0.06), (0, 0.1, 0.1, 0.1)):
    sheep.sphere(HEAD + Vector((dx, dy, dz)), r, M["wool"], 2)
sheep_obj = sheep.build("Sheep")

# ───────────────────────── 3. 2027 ─────────────────────────
font = bpy.data.curves.new("Year2027_Text", "FONT")
font.body = "2027"
font.align_x = "CENTER"
font.align_y = "CENTER"
font.size = 0.27
font.extrude = 0.022
font.bevel_depth = 0.006
font.offset = 0.004  # 글자를 조금 굵게
font.resolution_u = 3
text_obj = bpy.data.objects.new("Year2027_Text", font)
bpy.context.scene.collection.objects.link(text_obj)
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()

year = Shape()


def add_text(offset, depth, mat):
    font.offset = offset
    font.extrude = depth
    depsgraph.update()
    mesh = bpy.data.meshes.new_from_object(text_obj.evaluated_get(depsgraph))
    before = set(year.bm.verts)
    year.bm.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)
    year._finish([v for v in year.bm.verts if v not in before], mat, False)


add_text(0.004, 0.022, M["year"])
add_text(0.016, 0.012, M["gold"])  # 금색 테두리: 조금 더 굵은 글자를 뒤에 깔아 일출 배경에서도 묻히지 않게
bpy.data.objects.remove(text_obj, do_unlink=True)
# 글자는 XY 평면에 누워 있으므로 정면(-Y)을 보게 세웁니다
bmesh.ops.rotate(year.bm, verts=year.bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))
YEAR_AT = Vector((0, 0, 1.27))
bmesh.ops.translate(year.bm, verts=year.bm.verts[:], vec=YEAR_AT)
year.build("Year2027", origin=YEAR_AT)

# ───────────────────────── 4. 한옥 담장 · 기와 눈 · 까치 ─────────────────────────
WALL_R = 0.775
WALL_FROM, WALL_TO = math.radians(142), math.radians(232)
STEPS = 44
angles = [WALL_FROM + (WALL_TO - WALL_FROM) * i / STEPS for i in range(STEPS + 1)]
mid = (WALL_FROM + WALL_TO) / 2
floor = min(ground_z(WALL_R * math.cos(a), WALL_R * math.sin(a)) for a in angles) - 0.03
HALF = 0.042
stone_top, plaster_top, eave, ridge = floor + 0.09, floor + 0.175, floor + 0.16, floor + 0.24

wall = Shape()
wall.sweep([(-HALF, floor), (HALF, floor), (HALF, stone_top), (-HALF, stone_top)], angles, M["stone"], WALL_R)
wall.sweep([(-HALF + 0.006, stone_top), (HALF - 0.006, stone_top), (HALF - 0.006, plaster_top), (-HALF + 0.006, plaster_top)], angles, M["plaster"], WALL_R)
EAVE = HALF + 0.04
wall.sweep([(-EAVE, eave), (EAVE, eave), (EAVE, eave + 0.014), (0, ridge), (-EAVE, eave + 0.014)], [angles[0] - 0.012, *angles[1:-1], angles[-1] + 0.012], M["tile"], WALL_R)
# 용마루와 수키와(기와 등줄기)
wall.tube([(WALL_R * math.cos(a), WALL_R * math.sin(a), ridge + 0.004) for a in angles], 0.015, M["tile"], 8)
for i in range(1, STEPS, 2):
    out = Vector((math.cos(angles[i]), math.sin(angles[i]), 0))
    top = out * WALL_R + Vector((0, 0, ridge))
    for sign in (-1, 1):
        wall.tube([top, out * (WALL_R + sign * EAVE) + Vector((0, 0, eave + 0.012))], 0.011, M["tile"], 6)
# 기와 위의 눈: 울퉁불퉁하게 쌓인 눈더미
for i in range(0, STEPS + 1):
    a = angles[i] + random.uniform(-0.01, 0.01)
    out = Vector((math.cos(a), math.sin(a), 0))
    shift = random.uniform(-0.02, 0.02)
    wall.sphere(out * (WALL_R + shift) + Vector((0, 0, ridge + 0.004)), (random.uniform(0.034, 0.05), random.uniform(0.034, 0.05), random.uniform(0.017, 0.026)), M["snow"], 2, Matrix.Rotation(a, 4, "Z"))
wall.build("HanokWall")

# 까치: 담장 위, 앞쪽에서 보이는 자리
perch = math.radians(212)
out = Vector((math.cos(perch), math.sin(perch), 0))
forward = Vector((-math.sin(perch), math.cos(perch), 0)) * -1  # 담장을 따라 앞쪽(-Y 쪽)으로
at = out * WALL_R + Vector((0, 0, ridge + 0.058))
frame = Matrix((forward, out, Vector((0, 0, 1)))).transposed().to_4x4()  # 로컬 X = 부리 쪽

magpie = Shape()


def bird(local):
    return at + frame.to_3x3() @ Vector(local)


magpie.sphere(bird((0, 0, 0)), (0.05, 0.036, 0.036), M["black"], 2, frame)
magpie.sphere(bird((0.004, 0, -0.012)), (0.04, 0.033, 0.028), M["white"], 2, frame)  # 흰 배
magpie.sphere(bird((0.042, 0, 0.03)), 0.028, M["black"], 2)  # 머리
magpie.cone(bird((0.062, 0, 0.03)), bird((0.095, 0, 0.024)), 0.009, 0.001, M["black"], 8)  # 부리
for side in (-1, 1):
    magpie.sphere(bird((0.054, side * 0.02, 0.037)), 0.0055, M["white"], 1)  # 눈
    magpie.sphere(bird((-0.012, side * 0.031, 0.006)), (0.036, 0.008, 0.02), M["blue"], 2, frame)  # 날개
    magpie.sphere(bird((0.004, side * 0.034, 0.012)), (0.016, 0.006, 0.011), M["white"], 2, frame)  # 어깨의 흰 무늬
    magpie.tube([bird((0.006, side * 0.012, -0.03)), bird((0.01, side * 0.012, -0.056))], 0.004, M["black"], 6)  # 다리
magpie.tube([bird((-0.04, 0, 0.004)), bird((-0.1, 0, 0.022)), bird((-0.15, 0, 0.034))], [0.014, 0.011, 0.006], M["blue"], 8)  # 긴 꼬리
magpie.build("Magpie")

# ───────────────────────── 5. 소반 위 떡국 ─────────────────────────
SOBAN = Vector((0.555, -0.475, 0))
SOBAN.z = ground_z(SOBAN.x, SOBAN.y) - 0.005
TOP = 0.105
table = Shape()
table.lathe(SOBAN, [(0, TOP - 0.016), (0.15, TOP - 0.016), (0.162, TOP - 0.006), (0.162, TOP + 0.01), (0.15, TOP + 0.01), (0.146, TOP), (0, TOP)], M["soban"], 12, smooth=False)
table.lathe(SOBAN, [(0, TOP - 0.04), (0.118, TOP - 0.04), (0.128, TOP - 0.016), (0, TOP - 0.016)], M["soban"], 12, smooth=False)
for k in range(4):
    a = math.radians(45 + 90 * k)
    out = Vector((math.cos(a), math.sin(a), 0))
    # 호족반처럼 바깥으로 휘었다가 발끝이 다시 나오는 다리
    table.tube([SOBAN + out * r + Vector((0, 0, z)) for r, z in ((0.105, TOP - 0.03), (0.125, TOP - 0.055), (0.118, 0.035), (0.126, 0.012), (0.142, 0.004))], [0.02, 0.019, 0.014, 0.014, 0.017], M["soban"], 8)
table.build("Soban")

BOWL = SOBAN + Vector((0, 0, TOP))
soup_z = 0.058
food = Shape()
food.lathe(BOWL, [(0, 0.004), (0.04, 0.004), (0.044, 0), (0.05, 0), (0.052, 0.012), (0.085, 0.05), (0.095, 0.074), (0.089, 0.074), (0.078, soup_z), (0, soup_z)], M["bowl"], 24)
food.lathe(BOWL, [(0.0785, soup_z + 0.001), (0.05, soup_z + 0.004), (0, soup_z + 0.005)], M["soup"], 24)
for k in range(7):
    a = math.radians(51 * k + 10)
    r = 0.046 if k else 0.0
    spin = Matrix.Rotation(a + 0.7, 4, "Z") @ Matrix.Rotation(math.radians(random.uniform(-10, 10)), 4, "X")
    food.sphere(BOWL + Vector((math.cos(a) * r, math.sin(a) * r, soup_z + 0.008)), (0.022, 0.014, 0.005), M["tteok"], 2, spin)
for k in range(5):  # 달걀지단
    spin = Matrix.Rotation(math.radians(20 + 31 * k), 4, "Z")
    food.box(BOWL + Vector((0.004 * (k - 2), -0.004 + 0.003 * k, soup_z + 0.015 + 0.0015 * k)), (0.036, 0.006, 0.003), M["egg"], spin)
for k in range(4):  # 김가루
    spin = Matrix.Rotation(math.radians(75 + 40 * k), 4, "Z")
    food.box(BOWL + Vector((0.012 - 0.008 * k, 0.014 - 0.004 * k, soup_z + 0.014 + 0.001 * k)), (0.026, 0.005, 0.002), M["gim"], spin)
for x, y in ((0.03, -0.03), (-0.035, 0.02), (-0.02, -0.04), (0.04, 0.025)):  # 파
    food.lathe(BOWL + Vector((x, y, soup_z + 0.009)), [(0.004, 0), (0.007, 0), (0.007, 0.004), (0.004, 0.004), (0.004, 0)], M["green"], 8)
food.build("Tteokguk")

# ───────────────────────── 6. 받침대 전통 문양 (햇살 문양 원 + 매듭 띠) ─────────────────────────
base = bpy.data.objects["Base_Body"]
RELIEF_Z = -0.33  # 받침대 옆면 띠의 가운데 높이
DEPTH = 0.016
relief = Shape()


def base_point(angle, z, lift):
    out = Vector((math.cos(angle), math.sin(angle), 0))
    point, _ = cast(base, out * 3 + Vector((0, 0, z)), -out)
    return (point if point else out * 1.0 + Vector((0, 0, z))) + out * lift


BASE_R = (base_point(0, RELIEF_Z, 0)).xy.length


def wrap(center_angle, flat, lift):
    """받침대 옆면에 펼친 좌표(u: 둘레 방향, v: 높이)를 실제 자리로 옮깁니다."""
    u, v = flat
    return base_point(center_angle + u / BASE_R, RELIEF_Z + v, lift)


def relief_loop(center_angle, loop):
    """닫힌 2D 외곽선(구멍 없음)을 받침대 옆면에 도드라지게 붙입니다."""
    low = [relief.bm.verts.new(wrap(center_angle, p, -0.004)) for p in loop]
    high = [relief.bm.verts.new(wrap(center_angle, p, DEPTH)) for p in loop]
    n = len(loop)
    for k in range(n):
        relief.bm.faces.new((low[k], low[(k + 1) % n], high[(k + 1) % n], high[k]))
    relief.bm.faces.new(high)
    relief._finish(low + high, M["relief"], False)


def ring_loops(center, r_in, r_out, parts=20):
    """고리를 사다리꼴 조각으로 나눈 외곽선들 (구멍 있는 면을 피하려고 조각으로 만듭니다)."""
    cx, cy = center
    for k in range(parts):
        a0, a1 = 2 * math.pi * k / parts, 2 * math.pi * (k + 1) / parts
        yield [(cx + r_in * math.cos(a0), cy + r_in * math.sin(a0)), (cx + r_out * math.cos(a0), cy + r_out * math.sin(a0)), (cx + r_out * math.cos(a1), cy + r_out * math.sin(a1)), (cx + r_in * math.cos(a1), cy + r_in * math.sin(a1))]


def disc_loop(center, radius, parts=14):
    cx, cy = center
    return [(cx + radius * math.cos(2 * math.pi * k / parts), cy + radius * math.sin(2 * math.pi * k / parts)) for k in range(parts)]


def bar_loop(start, end, width):
    (x0, y0), (x1, y1) = start, end
    length = math.hypot(x1 - x0, y1 - y0)
    nx, ny = -(y1 - y0) / length * width / 2, (x1 - x0) / length * width / 2
    steps = max(1, int(length / 0.04))
    top = [(x0 + (x1 - x0) * i / steps + nx, y0 + (y1 - y0) * i / steps + ny) for i in range(steps + 1)]
    bottom = [(x0 + (x1 - x0) * i / steps - nx, y0 + (y1 - y0) * i / steps - ny) for i in range(steps, -1, -1)]
    return top + bottom


def medallion(center_angle):
    """햇살 문양 원: 가운데 겹동그라미에서 바퀴살이 뻗고, 살 끝마다 작은 고리. 작게 보이므로 선을 굵게."""
    for loop in ring_loops((0, 0), 0.098, 0.118, 24):
        relief_loop(center_angle, loop)
    for loop in ring_loops((0, 0), 0.026, 0.042, 12):
        relief_loop(center_angle, loop)
    relief_loop(center_angle, disc_loop((0, 0), 0.014, 10))
    for k in range(8):
        a = 2 * math.pi * k / 8
        relief_loop(center_angle, bar_loop((0.042 * math.cos(a), 0.042 * math.sin(a)), (0.066 * math.cos(a), 0.066 * math.sin(a)), 0.012))
        relief_loop(center_angle, disc_loop((0.079 * math.cos(a), 0.079 * math.sin(a)), 0.0135, 10))


def knot_band(angle_from, angle_to):
    """매듭 띠: 가운데 매듭(네 잎 고리 + 마름모)에서 양쪽으로 뻗는 두 줄."""
    center = (angle_from + angle_to) / 2
    half = abs(angle_to - angle_from) / 2 * BASE_R - 0.135  # 원형 문양 가장자리까지
    for v in (-0.016, 0.016):
        relief_loop(center, bar_loop((-half, v), (-0.07, v), 0.01))
        relief_loop(center, bar_loop((0.07, v), (half, v), 0.01))
    for cx, cy in ((0.036, 0), (-0.036, 0), (0, 0.036), (0, -0.036)):
        for loop in ring_loops((cx, cy), 0.02, 0.032, 12):
            relief_loop(center, loop)
    relief_loop(center, [(0.022, 0), (0, 0.022), (-0.022, 0), (0, -0.022)])
    for sign in (-1, 1):
        relief_loop(center, disc_loop((sign * 0.082, 0), 0.016, 10))


# 정면(-Y, 270도)의 명판 양옆부터 네 개. 명판 뒤에는 두지 않습니다.
FRONT = math.radians(270)
spots = [FRONT + math.radians(d) for d in (-128, -52, 52, 128)]
for angle in spots:
    medallion(angle)
knot_band(spots[0], spots[1])
knot_band(spots[2], spots[3])
knot_band(spots[3], spots[0] + 2 * math.pi)
relief.build("Base_Relief_newyear")

# ───────────────────────── 7. 오너먼트 자리 39개 ─────────────────────────
slots = collection("Slots")
bpy.context.view_layer.update()
head_dir = (HEAD - BODY).normalized()
candidates = []
for d in fibonacci(400):
    if d.z < -0.28:  # 바닥 쪽은 비웁니다
        continue
    if d.angle(head_dir) < math.radians(52):  # 얼굴 둘레는 비웁니다
        continue
    if d.y > 0.8 and d.z < 0.1:  # 꼬리
        continue
    candidates.append(d)
# 서로 가장 멀리 떨어지게 39개를 고릅니다. 정면(-Y)에 가까운 자리부터 시작합니다.
chosen = [min(candidates, key=lambda d: d.y)]
while len(chosen) < 39:
    chosen.append(max(candidates, key=lambda d: min((on_body(d) - on_body(c)).length for c in chosen)))
chosen.sort(key=lambda d: (round(-d.z, 1), math.atan2(d.x, -d.y)))
for index, d in enumerate(chosen):
    surface = on_body(d)
    normal = Vector((d.x / BODY_R.x, d.y / BODY_R.y, d.z / BODY_R.z)).normalized()
    hit, _ = cast(sheep_obj, surface + normal * 0.5, -normal)
    point = hit if hit else surface
    # 오너먼트 원형의 축: 앞면이 -Y, 위가 +Z. 자리에서는 앞면이 겉면 바깥을, 위가 하늘(등 위에서는 뒤쪽)을 보게 합니다.
    up_ref = Vector((0, 0.5, 1)) if abs(normal.z) < 0.92 else Vector((0, 1, 0))
    up = (up_ref - normal * up_ref.dot(normal)).normalized()
    right = up.cross(normal)
    empty = bpy.data.objects.new(f"Slot_{index:02d}", None)
    empty.empty_display_type = "SINGLE_ARROW"
    empty.empty_display_size = 2
    empty.matrix_world = Matrix.Translation(point) @ Matrix((right, -normal, up)).transposed().to_4x4() @ Matrix.Scale(0.058, 4)
    slots.objects.link(empty)

# ───────────────────────── 8. 새해 오너먼트 원형 ─────────────────────────
# 크기 규칙은 기존 원형(Orn_Star 등)과 같습니다: 가로 · 세로 2 안팎, 앞면이 -Y, 얇은 쪽이 Y.
# 양털에 브로치처럼 붙이므로 거는 고리 없이 가운데가 원점이고, 뒤쪽이 털에 살짝 박힙니다.
templates = collection("OrnamentTemplatesNewYear")

# 복주머니
pouch = Shape()
pouch.sphere((0, 0, -0.22), (0.92, 0.36, 0.78), M["orn_main"], 3)
pouch.lathe((0, 0, 0), [(0.3, 0.38), (0.36, 0.5), (0.62, 0.92), (0.5, 0.95), (0.22, 0.6), (0, 0.6)], M["orn_main"], 16)
for vert in pouch.bm.verts:  # 앞뒤로 납작하게
    if vert.co.z > 0.3:
        vert.co.y *= 0.5
pouch.tube([(0.36 * math.cos(a), 0.2 * math.sin(a), 0.46) for a in (2 * math.pi * k / 20 for k in range(20))], 0.055, M["orn_accent"], 8, closed=True)
for side in (-1, 1):  # 매듭 고리와 늘어진 끈
    pouch.tube([(side * (0.02 + 0.2 * math.sin(t)), -0.24, 0.44 + 0.13 * math.sin(2 * t) * 0.9 + 0.1 * math.sin(t)) for t in (math.pi * k / 10 for k in range(11))], 0.045, M["orn_accent"], 8)
    pouch.tube([(side * 0.04, -0.25, 0.42), (side * 0.13, -0.33, 0.12), (side * 0.17, -0.36, -0.14)], [0.04, 0.04, 0.035], M["orn_accent"], 8)
    pouch.sphere((side * 0.17, -0.36, -0.2), (0.07, 0.06, 0.1), M["orn_accent"], 2)
pouch.sphere((0, -0.25, 0.44), 0.085, M["orn_accent"], 2)
pouch.build("Orn_Pouch", templates)

# 방패연
kite = Shape()
kite.box((0, 0, 0), (1.56, 0.1, 1.9), M["orn_main"])
kite.cone((0, 0.07, 0), (0, -0.07, 0), 0.3, 0.3, M["orn_accent"], 20)  # 가운데 방구멍
kite.tube([(0.44 * math.cos(a), -0.06, 0.44 * math.sin(a)) for a in (2 * math.pi * k / 24 for k in range(24))], 0.05, M["orn_accent"], 8, closed=True)
kite.box((0, -0.06, 0.8), (1.56, 0.05, 0.16), M["orn_accent"])  # 머릿살 띠
for side in (-1, 1):
    kite.box((side * 0.5, -0.06, -0.72), (0.2, 0.05, 0.32), M["orn_accent"])  # 아래쪽 꼬리 무늬
    kite.tube([(side * 0.72, -0.055, 0.9), (side * 0.36, -0.055, 0.38)], 0.03, M["orn_accent"], 6)
    kite.tube([(side * 0.36, -0.055, -0.38), (side * 0.72, -0.055, -0.9)], 0.03, M["orn_accent"], 6)
kite.build("Orn_Kite", templates)

# 매듭 노리개
norigae = Shape()
norigae.tube([(0.17 * math.cos(a), -0.02, 0.86 + 0.17 * math.sin(a)) for a in (2 * math.pi * k / 20 for k in range(20))], 0.05, M["orn_metal"], 8, closed=True)  # 위쪽 고리
norigae.sphere((0, -0.02, 0.63), (0.13, 0.11, 0.08), M["orn_accent"], 2)  # 고리 아래 장식
for cx, cz in ((0.27, 0.3), (-0.27, 0.3), (0, 0.5), (0, 0.1)):  # 네 잎 매듭
    norigae.tube([(cx + 0.19 * math.cos(a), -0.03, cz + 0.16 * math.sin(a)) for a in (2 * math.pi * k / 18 for k in range(18))], 0.075, M["orn_main"], 8, closed=True)
norigae.sphere((0, -0.06, 0.3), (0.16, 0.12, 0.16), M["orn_accent"], 2)  # 매듭 가운데
norigae.sphere((0, -0.02, -0.14), (0.17, 0.15, 0.12), M["orn_accent"], 2)  # 술 머리
norigae.lathe((0, -0.02, 0), [(0, -0.18), (0.17, -0.2), (0.3, -0.7), (0.36, -1.0), (0, -0.98)], M["orn_main"], 16)  # 술
for vert in norigae.bm.verts:
    if vert.co.z < -0.17:
        vert.co.y = -0.02 + (vert.co.y + 0.02) * 0.6
norigae.build("Orn_Norigae", templates)

# 원형을 나란히 놓습니다 (Blender 화면에서 보기 편하게. 내보낼 때는 원점으로 옮깁니다)
for index, name in enumerate(("Orn_Pouch", "Orn_Kite", "Orn_Norigae")):
    bpy.data.objects[name].location = (4 + index * 2.6, 0, 0)

# ───────────────────────── 9. 저장하고 내보내기 ─────────────────────────
for mesh in bpy.data.meshes:
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, "design", "blender", "newyear.blend"))
export_newyear.export_all(ROOT)
