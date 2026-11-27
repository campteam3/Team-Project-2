# 새해 스노우볼의 양을 레퍼런스(양모 펠트 인형: 옆 · 위 · 앞 그림)대로 만듭니다. (차명근)
# 열려 있는 design/blender/newyear.blend 안에서 돌립니다 (Blender > Scripting, 또는 MCP 의 execute_blender_code 로
#   exec(open(r"<저장소>/scripts/blender/sheep_v2.py", encoding="utf-8").read()) ).
# 하는 일: `Sheep` 오브젝트의 메시를 새로 만들고, 오너먼트 자리(Slot_00 ~ Slot_38)를 새 털 겉면에 다시 붙입니다.
# 다른 오브젝트는 건드리지 않습니다. 돌린 뒤에는 저장하고 export_newyear.py 로 내보냅니다.
#
# 생김새 (레퍼런스 그림에서 잰 비율):
#  - 달걀처럼 둥근 몸에 큰 머리가 앞 위쪽에 얹힌 2등신. 목은 없고 머리 털과 몸 털이 이어집니다.
#  - 털은 작은 방울(지름 0.1 안팎)이 촘촘히 붙은 모양. 골은 얕게. 잔 곱슬과 보풀은 웹 셰이더(털 겹)가 그립니다.
#  - 얼굴은 마시멜로 같은 둥근 네모(옆으로 넓고 볼이 통통). 이마는 앞으로 나온 털이 덮고, 둘레도 잔 털 방울이 덮어
#    얼굴이 털 속에 폭 들어가 보입니다.
#  - 귀는 안쪽이 오목한 잎 모양, 다리는 짧고 굵으며 발굽 모서리가 둥급니다. 뿔은 없습니다.
# 좌표: Z 가 위, 정면이 -Y.

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

random.seed(2027)

BODY = Vector((0, 0.115, 0.525))
BODY_R = Vector((0.335, 0.435, 0.265))  # 몸은 앞뒤로 길게
HOOD = Vector((0, -0.065, 0.795))  # 머리 털의 가운데
HOOD_R = Vector((0.222, 0.218, 0.182))
FACE = Vector((0, -0.188, 0.712))  # 얼굴 앞면이 머리 털 겉면보다 살짝 안쪽에 오는 깊이
FACE_R = Vector((0.176, 0.128, 0.128))
# 털 사이로 보이는 얼굴 창의 반지름: 옆, 위, 아래. 위를 짧게 잡아 이마가 털에 덮입니다
WINDOW = (0.156, 0.08, 0.106)
SLOT_SCALE = 0.05
FUR = 0.0105  # 웹에서 털 겹이 자라는 길이. 오너먼트는 이만큼 띄워 붙입니다 (SnowGlobeGlb.tsx 의 SHEEP_FUR 와 같게)


def material(name, color, roughness, metallic=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    rgb = [int(color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    bsdf.inputs["Base Color"].default_value = (*linear, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    mat.diffuse_color = (*linear, 1)
    return mat


WOOL = material("Sheep_Wool", "#F6E6C6", 0.95)
FELT = material("Sheep_Face", "#F9ECD3", 0.9)
HOOF = material("Sheep_Hoof", "#E2C9A2", 0.85)
EYE = material("Sheep_Eye", "#16120F", 0.1)
NOSE = material("Sheep_Nose", "#F2A9AD", 0.8)
MOUTH = material("Sheep_Mouth", "#B07C62", 0.85)
EAR_IN = material("Sheep_EarInner", "#F2B9B0", 0.85)
LEG = material("Sheep_Leg", "#F9ECD3", 0.9)  # 다리: 얼굴과 같은 펠트색이지만 웹에서 짧은 보풀을 세웁니다 (얼굴은 매끈하게)
MATS = [WOOL, FELT, HOOF, EYE, NOSE, MOUTH, EAR_IN, LEG]


def fibonacci(count, offset=0.0):
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(count):
        z = 1 - 2 * (i + 0.5) / count
        r = math.sqrt(1 - z * z)
        yield Vector((math.cos(golden * i + offset) * r, math.sin(golden * i + offset) * r, z))


def jitter(direction, amount):
    return (direction + Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * amount).normalized()


def on_ellipsoid(center, radii, d, scale=1.0):
    return center + Vector((d.x * radii.x, d.y * radii.y, d.z * radii.z)) * scale


def ball(bm, center, radii, subdivisions=2, rotation=None):
    if isinstance(radii, (int, float)):
        radii = (radii, radii, radii)
    matrix = Matrix.Translation(center) @ (rotation or Matrix()) @ Matrix.Diagonal((*radii, 1))
    return bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=1, matrix=matrix)["verts"]


def paint(verts, index):
    made = set(verts)
    for face in {f for v in verts for f in v.link_faces}:
        if all(v in made for v in face.verts):
            face.material_index = index
            face.smooth = True


def tube(bm, points, radius, segments=8):
    points = [Vector(p) for p in points]
    rings = []
    normal = None
    for i, point in enumerate(points):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        if normal is None:
            normal = tangent.orthogonal().normalized()
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        binormal = tangent.cross(normal)
        rings.append([bm.verts.new(point + (normal * math.cos(a) + binormal * math.sin(a)) * radius) for a in (2 * math.pi * k / segments for k in range(segments))])
    for a, b in zip(rings, rings[1:]):
        for k in range(segments):
            bm.faces.new((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return [v for ring in rings for v in ring]


def lathe(bm, center, profile, segments=28, squash=1.0):
    """(반지름, 높이) 점들을 Z 축 둘레로 돌린 회전체. squash: 앞뒤(Y)로 눌린 정도."""
    center = Vector(center)
    rings = []
    for radius, height in profile:
        if radius <= 1e-6:
            rings.append([bm.verts.new(center + Vector((0, 0, height)))])
        else:
            rings.append([bm.verts.new(center + Vector((radius * math.cos(a), radius * math.sin(a) * squash, height))) for a in (2 * math.pi * k / segments for k in range(segments))])
    for a, b in zip(rings, rings[1:]):
        for k in range(segments):
            k2 = (k + 1) % segments
            corners = list(dict.fromkeys([a[k % len(a)], a[k2 % len(a)], b[k2 % len(b)], b[k % len(b)]]))
            if len(corners) >= 3:
                bm.faces.new(corners)
    return [v for ring in rings for v in ring]


def window_radius(z):
    """얼굴 창의 위아래 반지름 (위는 짧고 아래는 깁니다)."""
    return WINDOW[1] if z > FACE.z else WINDOW[2]


def in_window(point, grow=1.0):
    """얼굴 창(털을 비우는 곳) 안인지: 머리 앞쪽이고, 앞에서 봤을 때 얼굴 창 안."""
    if point.y > FACE.y + 0.02:
        return False
    return (point.x / (WINDOW[0] * grow)) ** 2 + ((point.z - FACE.z) / (window_radius(point.z) * grow)) ** 2 < 1


# ───────────── 1. 털: 작은 방울을 촘촘히 붙이고 한 덩어리로 녹입니다 ─────────────
wool = bmesh.new()


def fleece(center, radii, count, size, skip=None, offset=0.0):
    ball(wool, center, radii * 0.94, 3)
    # 큼직하고 완만한 굴곡을 먼저 깔아 전체가 밋밋한 공이 되지 않게
    for d in fibonacci(max(8, count // 9), offset + 1.3):
        point = on_ellipsoid(center, radii, jitter(d, 0.2), 0.84)
        if not (skip and skip(point, d)):
            ball(wool, point, min(radii) * random.uniform(0.3, 0.38), 2)
    for d in fibonacci(count, offset):
        d = jitter(d, 0.055)
        point = on_ellipsoid(center, radii, d, 0.975)
        if skip and skip(point, d):
            continue
        ball(wool, point, random.uniform(*size), 2)


# 몸통: 배 아래는 다리가 붙으므로 방울을 줄입니다
fleece(BODY, BODY_R, 262, (0.043, 0.058), lambda p, d: d.z < -0.9 or in_window(p, 1.18))  # 턱 밑 가슴 털이 얼굴을 가리지 않게
# 머리 털: 얼굴 창만 비웁니다
fleece(HOOD, HOOD_R, 112, (0.04, 0.052), lambda p, d: in_window(p, 1.04) or d.z < -0.75, 0.7)
# 얼굴 둘레에는 털을 따로 더하지 않습니다. 머리는 어디서 보아도 동그란 털 뭉치이고,
# 얼굴면을 그 안쪽으로 살짝 넣어서 창 둘레의 털이 얼굴 가장자리에 그늘을 드리웁니다.
# 이마: 얼굴 창의 위쪽 가장자리를 따라 동글동글한 방울을 한 줄 두릅니다 (털이 잘린 것처럼 보이지 않게).
# 방울은 머리 털의 둥근 겉면 위에 놓여 앞으로 튀어나오지 않고, 그 위에 한 줄을 더 얹어 정수리 털과 이어 줍니다.
def hood_front(x, z):
    depth = 1 - (x / HOOD_R.x) ** 2 - ((z - HOOD.z) / HOOD_R.z) ** 2
    return HOOD.y - HOOD_R.y * math.sqrt(max(depth, 0.05))


# 방울을 크게, 수를 적게 해서 방울 사이의 골이 뾰족한 톱니로 보이지 않게 합니다 (큼직한 솜방울 대여섯 개가 둥근 아치를 이룸).
# 맨 아랫줄은 얼굴보다 앞으로 도톰하게 내밀어 얼굴 위에 그늘이 지게 하고(얼굴에 딱 붙어 보이지 않게),
# 윗줄로 갈수록 덜 내밀어 정수리까지 둥글게 이어지게 합니다. (grow: 창에서 떨어진 정도, 개수, 크기, 앞으로 내민 정도)
for row, (grow, count, size, forward) in enumerate(((0.03, 5, 0.06, 0.034), (0.092, 4, 0.06, 0.02), (0.15, 5, 0.056, 0.008))):
    for k in range(count):
        a = math.radians(18 + 144 * (k + 0.5 * (row % 2)) / (count - 1 + row % 2))
        x = math.cos(a) * (WINDOW[0] + grow * 0.4)
        z = FACE.z + math.sin(a) * (WINDOW[1] + grow) + 0.012
        ball(wool, Vector((x, hood_front(x, z) - forward * (0.55 + 0.45 * math.sin(a)), z)), size * random.uniform(0.96, 1.04), 3)
# 꼬리 방울
TAIL = BODY + Vector((0, BODY_R.y + 0.03, 0.02))
ball(wool, TAIL, 0.05, 2)
for d in fibonacci(12):
    ball(wool, TAIL + d * 0.034, 0.03, 2)

raw = bpy.data.meshes.new("Sheep_Wool_raw")
wool.to_mesh(raw)
wool.free()
temp = bpy.data.objects.new("Sheep_Wool_temp", raw)
bpy.context.scene.collection.objects.link(temp)
remesh = temp.modifiers.new("Remesh", "REMESH")
remesh.mode = "VOXEL"
remesh.voxel_size = 0.008
remesh.use_smooth_shade = True
smooth = temp.modifiers.new("Smooth", "SMOOTH")
smooth.factor = 0.55
smooth.iterations = 5  # 골을 얕게: 방울 사이가 깊게 패이면 울퉁불퉁해 보입니다
decimate = temp.modifiers.new("Decimate", "DECIMATE")
decimate.ratio = 0.36
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
wool_mesh = bpy.data.meshes.new_from_object(temp.evaluated_get(depsgraph))
bpy.data.objects.remove(temp, do_unlink=True)
bpy.data.meshes.remove(raw)

# ───────────── 2. 펠트 부분 ─────────────
bm = bmesh.new()
bm.from_mesh(wool_mesh)  # 털이 재질 0번
bpy.data.meshes.remove(wool_mesh)
for face in bm.faces:
    face.material_index = 0
    face.smooth = True

# 얼굴: 마시멜로 같은 둥근 네모. 아래쪽(볼)이 조금 더 넓고, 앞면은 완만하게 볼록합니다
face_verts = ball(bm, (0, 0, 0), 1, 5)
face_points = []
for vert in face_verts:
    c = vert.co.copy()
    # 공 → 둥근 네모: 모서리 없이 매끈하게 부푼 모양(초타원체). 지수가 클수록 네모에 가깝습니다
    power = 2.7
    shaped = c * (abs(c.x) ** power + abs(c.y) ** power + abs(c.z) ** power) ** (-1 / power)
    cheek = 1 + 0.05 * max(0.0, -shaped.z)  # 볼
    vert.co = FACE + Vector((shaped.x * FACE_R.x * cheek, shaped.y * FACE_R.y, shaped.z * FACE_R.z))
    if vert.co.y < FACE.y:
        face_points.append(vert.co.copy())
paint(face_verts, 1)


def on_face(x, z, lift=0.0):
    """얼굴 앞면 위의 점 (x: 옆, z: 위, 얼굴 가운데 기준). 가까운 얼굴 점들의 깊이를 재서 lift 만큼 앞으로 띄웁니다."""
    near = sorted(face_points, key=lambda co: (co.x - x) ** 2 + (co.z - FACE.z - z) ** 2)[:3]
    return Vector((x, sum(co.y for co in near) / 3 - lift, FACE.z + z))


yard = bpy.data.objects.get("Yard")


def ground_z(x, y):
    if yard:
        hit, location, _, _ = yard.ray_cast(yard.matrix_world.inverted() @ Vector((x, y, 2)), Vector((0, 0, -1)))
        if hit:
            return (yard.matrix_world @ location).z
    return 0.2


EYE_Z, NOSE_Z = 0.016, -0.006  # 코가 보이는 얼굴의 가운데에 오게  # 얼굴 가운데 기준 높이
for side in (-1, 1):
    # 눈: 까만 유리구슬. 얼굴 너비의 절반쯤 벌어져 있습니다
    paint(ball(bm, on_face(side * 0.088, EYE_Z, -0.005), (0.015, 0.012, 0.016), 3), 3)
    # 귀: 가장자리가 안으로 살짝 말린 잎 모양. 뒤쪽만 몸과 같은 털이고, 앞면은 털 없이 매끈합니다 (테두리는 펠트, 오목한 안쪽은 분홍빛 살)
    turn = Matrix.Rotation(side * math.radians(-14), 4, "Y") @ Matrix.Rotation(side * math.radians(24), 4, "Z")
    spot = Vector((side * (HOOD_R.x + 0.05), HOOD.y - 0.02, FACE.z + 0.035))
    for inner in (False, True):
        ear = ball(bm, (0, 0, 0), 1, 4)
        front = []
        for vert in ear:
            c = vert.co.copy()
            if c.y < 0.12:
                front.append(vert)
            along = (c.x + 1) / 2  # 0 = 뿌리, 1 = 끝
            width = 0.55 + 0.45 * math.sin(math.pi * min(1.0, along * 1.15) ** 0.8)  # 뿌리는 좁고 가운데가 넓은 잎
            y = c.y * 0.046
            if c.y < 0:  # 앞면을 깊게 파서 가장자리가 말려 보이게
                y += 0.05 * (1 - c.x * c.x) ** 0.8 * (1 - c.z * c.z) ** 0.8
            shrink = 0.86 if inner else 1.0
            local = Vector((c.x * 0.084 * shrink * side + (0.004 * side if inner else 0), y * 0.9 - (0.0035 if inner else 0), c.z * 0.072 * width * shrink - 0.012 * along * along))
            vert.co = spot + (turn @ local)
        paint(ear, 6 if inner else 0)
        if not inner:
            paint(front, 1)  # 앞을 보는 쪽은 털 없는 펠트
    # 입: 코 아래에서 양쪽으로 말려 올라가는 ω 모양 (수놓은 실)
    arc = [on_face(side * (0.018 - 0.018 * math.cos(t)), NOSE_Z - 0.03 - 0.015 * math.sin(t), 0.004) for t in (math.pi * k / 12 for k in range(13))]
    paint(tube(bm, arc, 0.0038), 5)
    # 다리: 짧고 굵게. 아래로 갈수록 살짝 넓어지고, 발굽은 모서리가 둥급니다
    for y in (-0.165, 0.375):
        x = side * 0.125
        floor = ground_z(x, y) - 0.003
        paint(lathe(bm, (x, y, floor), [(0.0745, 0.04), (0.0745, 0.07), (0.071, 0.13), (0.069, 0.24), (0, 0.24)], 28, 0.93), 7)
        paint(lathe(bm, (x, y, floor), [(0, 0), (0.058, 0), (0.071, 0.004), (0.078, 0.013), (0.0795, 0.026), (0.078, 0.037), (0.073, 0.043), (0, 0.043)], 28, 0.93), 2)
# 코: 작은 분홍 세모 (위가 넓고 아래가 뾰족)
nose_at = on_face(0, NOSE_Z, 0.005)
nose = ball(bm, (0, 0, 0), 1, 3)
for vert in nose:
    c = vert.co.copy()
    narrow = 1 - 0.8 * max(0.0, min(1.0, (0.55 - c.z) / 1.55))
    vert.co = nose_at + Vector((c.x * 0.018 * narrow, c.y * 0.009, c.z * 0.011))
paint(nose, 4)
paint(tube(bm, [on_face(0, NOSE_Z - 0.01, 0.004), on_face(0, NOSE_Z - 0.03, 0.004)], 0.0038), 5)

bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
sheep = bpy.data.objects["Sheep"]
old = sheep.data
mesh = bpy.data.meshes.new("Sheep")
bm.to_mesh(mesh)
bm.free()
for mat in MATS:
    mesh.materials.append(mat)
sheep.data = mesh
sheep.matrix_world = Matrix()
bpy.data.meshes.remove(old)
bpy.context.view_layer.update()

# ───────────── 3. 오너먼트 자리 39개를 새 털 겉면에 다시 붙입니다 ─────────────
def cast(origin, direction):
    hit, location, _, index = sheep.ray_cast(origin, direction)
    return location if hit and sheep.data.polygons[index].material_index == 0 else None


def inside(point, center, radii, scale):
    p = point - center
    return (p.x / radii.x) ** 2 + (p.y / radii.y) ** 2 + (p.z / radii.z) ** 2 < scale * scale


candidates = []  # (겉면의 점, 바깥 방향)
for d in fibonacci(800):
    if d.z < -0.25:  # 배 아래와 다리 쪽은 비웁니다
        continue
    normal = Vector((d.x / BODY_R.x, d.y / BODY_R.y, d.z / BODY_R.z)).normalized()
    point = cast(on_ellipsoid(BODY, BODY_R, d) + normal * 0.4, -normal)
    if point is None or inside(point, HOOD, HOOD_R, 1.42) or (point - TAIL).length < 0.11:
        continue
    if point.y < FACE.y + 0.14 and abs(point.x) < 0.2:  # 턱 바로 아래 가슴은 비웁니다 (얼굴을 가리지 않게)
        continue
    candidates.append((point, normal))
for d in fibonacci(500):
    # 머리 털의 위 · 뒤 · 옆 (얼굴 둘레와 귀 자리는 비웁니다)
    normal = Vector((d.x / HOOD_R.x, d.y / HOOD_R.y, d.z / HOOD_R.z)).normalized()
    point = cast(on_ellipsoid(HOOD, HOOD_R, d) + normal * 0.4, -normal)
    if point is None or inside(point, BODY, BODY_R, 1.3):
        continue
    if point.y < HOOD.y - 0.1 and point.z < HOOD.z + 0.12:  # 얼굴 쪽
        continue
    if abs(point.x) > HOOD_R.x * 0.72 and abs(point.z - (FACE.z + 0.035)) < 0.13 and point.y < HOOD.y + 0.1:  # 귀
        continue
    candidates.append((point, normal))

# 서로 가장 멀리 떨어지게 39개 (정면에 가장 가까운 자리부터)
chosen = [min(candidates, key=lambda item: item[0].y)]
while len(chosen) < 39:
    chosen.append(max(candidates, key=lambda item: min((item[0] - other[0]).length for other in chosen)))
chosen.sort(key=lambda item: (round(-item[0].z, 1), math.atan2(item[0].x, -item[0].y)))
nearest = min((a[0] - b[0]).length for i, a in enumerate(chosen) for b in chosen[i + 1 :])

slots = bpy.data.collections["Slots"]
for index, (point, normal) in enumerate(chosen):
    name = f"Slot_{index:02d}"
    empty = bpy.data.objects.get(name)
    if empty is None:
        empty = bpy.data.objects.new(name, None)
        empty.empty_display_type = "SINGLE_ARROW"
        empty.empty_display_size = 2
        slots.objects.link(empty)
    # 오너먼트 원형의 축: 앞면이 -Y, 위가 +Z. 앞면이 털 바깥을, 위가 하늘(등 위에서는 뒤쪽)을 보게 합니다.
    up_ref = Vector((0, 0.5, 1)) if abs(normal.z) < 0.92 else Vector((0, 1, 0))
    up = (up_ref - normal * up_ref.dot(normal)).normalized()
    right = up.cross(normal)
    empty.matrix_world = Matrix.Translation(point + normal * FUR) @ Matrix((right, -normal, up)).transposed().to_4x4() @ Matrix.Scale(SLOT_SCALE, 4)

for unused in list(bpy.data.meshes):
    if unused.users == 0:
        bpy.data.meshes.remove(unused)
bpy.context.view_layer.update()
RESULT = f"양: 점 {len(mesh.vertices)}개 · 면 {len(mesh.polygons)}개, 자리 후보 {len(candidates)}개 중 39개 (가장 가까운 두 자리 사이 {nearest:.3f})"
print(RESULT)
