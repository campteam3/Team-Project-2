# 새해 스노우볼의 2027 · 한옥 담장 · 까치 · 받침대 문양을 더 정성 들여 다시 만듭니다. (차명근)
# 열려 있는 design/blender/newyear.blend 안에서 돌립니다 (sheep_v2.py 와 같은 방법).
# 바꾸는 오브젝트: Year2027, HanokWall, Magpie, Base_Relief_newyear, Yut(윷가락과 조각보, 새로 만듦). 다른 것은 건드리지 않습니다.
#  - 2027: 곡선을 잘게 나눠 매끈하게, 모서리를 둥글게 부풀린 글자 + 금색 테두리
#  - 담장: 돌을 하나하나 박은 토담, 수키와 · 막새 · 용마루가 있는 기와지붕, 기와를 덮고 흘러내린 눈(틈 없이)
#  - 까치: 몸 · 머리 · 부리 · 눈 · 겹친 날개깃 · 긴 꼬리 · 발가락
#  - 받침대 문양: 납작한 판 대신 둥근 띠 · 구슬 · 볼록한 돔으로 (명판 테두리처럼 도톰하게)
# 좌표: Z 가 위, 정면이 -Y.

import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

random.seed(27)
GLOBE = bpy.data.collections["SnowGlobe"]


def material(name, color, roughness, metallic=0.0, emission=0.0):
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


class Shape:
    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

    def paint(self, verts, mat, smooth=True):
        if mat not in self.mats:
            self.mats.append(mat)
        index = self.mats.index(mat)
        made = set(verts)
        for face in {f for v in verts for f in v.link_faces}:
            if all(v in made for v in face.verts):
                face.material_index = index
                face.smooth = smooth
        return verts

    def ball(self, center, radii, mat, subdivisions=2, rotation=None):
        if isinstance(radii, (int, float)):
            radii = (radii, radii, radii)
        matrix = Matrix.Translation(center) @ (rotation or Matrix()) @ Matrix.Diagonal((*radii, 1))
        return self.paint(bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=1, matrix=matrix)["verts"], mat)

    def tube(self, points, radii, mat, segments=10, closed=False, flat=1.0):
        """points 를 따라가는 관. flat: 관의 단면을 한쪽으로 누른 정도."""
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
                normal = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((1, 0, 0))
            normal = (normal - tangent * normal.dot(tangent)).normalized()
            binormal = tangent.cross(normal)
            rings.append([self.bm.verts.new(point + (normal * math.cos(a) + binormal * math.sin(a) * flat) * radii[i]) for a in (2 * math.pi * k / segments for k in range(segments))])
        verts = [v for ring in rings for v in ring]
        for i in range(count if closed else count - 1):
            a, b = rings[i], rings[(i + 1) % count]
            for k in range(segments):
                self.bm.faces.new((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k]))
        if not closed:
            self.bm.faces.new(list(reversed(rings[0])))
            self.bm.faces.new(rings[-1])
        return self.paint(verts, mat)

    def loops(self, rings, mat, smooth=True, caps=True):
        """같은 개수의 점으로 된 닫힌 고리들을 차례로 이어 붙입니다 (단면이 조금씩 달라지는 띠)."""
        made = [[self.bm.verts.new(p) for p in ring] for ring in rings]
        n = len(made[0])
        for a, b in zip(made, made[1:]):
            for k in range(n):
                self.bm.faces.new((a[k], b[k], b[(k + 1) % n], a[(k + 1) % n]))
        if caps:
            self.bm.faces.new(made[0])
            self.bm.faces.new(list(reversed(made[-1])))
        return self.paint([v for ring in made for v in ring], mat, smooth)

    def build(self, name, origin=None):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        mesh = bpy.data.meshes.new(name)
        if origin is not None:
            bmesh.ops.translate(self.bm, verts=self.bm.verts[:], vec=-Vector(origin))
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.mats:
            mesh.materials.append(mat)
        obj = bpy.data.objects.get(name)
        if obj is None:
            obj = bpy.data.objects.new(name, mesh)
            GLOBE.objects.link(obj)
        else:
            old = obj.data
            obj.data = mesh
            if old.users == 0:
                bpy.data.meshes.remove(old)
        obj.matrix_world = Matrix.Translation(origin) if origin is not None else Matrix()
        return obj


def wave(seed, *freqs):
    """각도에 따라 부드럽게 오르내리는 값 (0~1). 눈 두께처럼 고르지 않은 것에 씁니다."""
    rng = random.Random(seed)
    parts = [(f, rng.uniform(0, 6.283), rng.uniform(0.6, 1.0)) for f in freqs]
    total = sum(w for _, _, w in parts)
    return lambda a: 0.5 + 0.5 * sum(math.sin(a * f + p) * w for f, p, w in parts) / total


yard = bpy.data.objects["Yard"]


def ground_z(x, y):
    hit, location, _, _ = yard.ray_cast(yard.matrix_world.inverted() @ Vector((x, y, 2)), Vector((0, 0, -1)))
    return (yard.matrix_world @ location).z if hit else 0.2


# ═════════════ 1. 2027 ═════════════
YEAR_RED = material("Year_Red", "#D9263B", 0.35, 0.0, 0.6)
GOLD = bpy.data.materials["Gold"]
font = bpy.data.curves.new("Year2027_Text", "FONT")
font.body = "2027"
font.align_x = "CENTER"
font.align_y = "CENTER"
font.size = 0.27
font.resolution_u = 12  # 곡선을 잘게 나눠 다각형으로 보이지 않게
font.bevel_resolution = 3  # 모서리를 둥글게
text_obj = bpy.data.objects.new("Year2027_Text", font)
bpy.context.scene.collection.objects.link(text_obj)
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()
year = Shape()


def add_text(offset, depth, bevel, mat, back):
    font.offset = offset
    font.extrude = depth
    font.bevel_depth = bevel
    depsgraph.update()
    mesh = bpy.data.meshes.new_from_object(text_obj.evaluated_get(depsgraph))
    before = set(year.bm.verts)
    year.bm.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)
    made = [v for v in year.bm.verts if v not in before]
    for vert in made:
        vert.co.z -= back
    year.paint(made, mat)


add_text(0.0, 0.016, 0.014, YEAR_RED, 0.0)  # 통통하게 부푼 붉은 글자
add_text(0.014, 0.012, 0.01, GOLD, 0.014)  # 금색 테두리: 조금 더 굵은 글자를 뒤에 깝니다
bpy.data.objects.remove(text_obj, do_unlink=True)
bpy.data.curves.remove(font)
bmesh.ops.remove_doubles(year.bm, verts=year.bm.verts[:], dist=0.00005)
bmesh.ops.rotate(year.bm, verts=year.bm.verts[:], cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, "X"))
YEAR_AT = Vector((0, 0, 1.285))
bmesh.ops.translate(year.bm, verts=year.bm.verts[:], vec=YEAR_AT)
year_obj = year.build("Year2027", origin=YEAR_AT)
try:  # 둥근 면은 매끈하게, 앞면과 옆면이 만나는 각진 곳만 또렷하게
    year_obj.data.set_sharp_from_angle(angle=math.radians(50))
except AttributeError:
    pass

# ═════════════ 2. 한옥 담장 ═════════════
STONE_A = material("Wall_Stone", "#8E8073", 0.9)
STONE_B = material("Wall_StoneDark", "#6F665E", 0.9)
PLASTER = material("Wall_Plaster", "#E6D3AE", 0.9)
TILE = material("Wall_Tile", "#3A3C44", 0.5)
TILE_END = material("Wall_TileEnd", "#4A4D57", 0.45)
SNOW = material("Wall_Snow", "#F4F7FF", 0.6)

WALL_R = 0.775
A0, A1 = math.radians(142), math.radians(232)
ARC = WALL_R * (A1 - A0)
HALF = 0.04
EAVE = 0.088


def polar(angle, radius, z):
    return Vector((radius * math.cos(angle), radius * math.sin(angle), z))


def arc(steps):
    return [A0 + (A1 - A0) * i / steps for i in range(steps + 1)]


floor = min(ground_z(*polar(a, WALL_R, 0).xy) for a in arc(40)) - 0.03
BODY_TOP = floor + 0.172
EAVE_Z = floor + 0.166
RIDGE_Z = floor + 0.238

wall = Shape()
# 몸체: 흙과 회를 바른 벽
wall.loops([[polar(a, WALL_R - HALF, floor), polar(a, WALL_R + HALF, floor), polar(a, WALL_R + HALF, BODY_TOP), polar(a, WALL_R - HALF, BODY_TOP)] for a in arc(60)], PLASTER, smooth=False)
# 돌: 세 줄을 엇갈려 하나하나 박습니다. 크기 · 색 · 튀어나온 정도가 조금씩 다릅니다
ROW_H = 0.043
for row in range(3):
    z = floor + 0.034 + row * ROW_H
    along = random.uniform(0, 0.03) + (0.027 if row % 2 else 0)
    while along < ARC - 0.02:
        length = random.uniform(0.042, 0.064)
        a = A0 + (along + length / 2) / WALL_R
        if along + length <= ARC:
            for face in (-1, 1):
                turn = Matrix.Rotation(a + math.pi / 2, 4, "Z")
                size = (length / 2 * 0.93, random.uniform(0.011, 0.016), ROW_H / 2 * random.uniform(0.84, 0.95))
                wall.ball(polar(a, WALL_R + face * (HALF - 0.002), z + random.uniform(-0.002, 0.002)), size, random.choice((STONE_A, STONE_A, STONE_B)), 2, turn)
        along += length + 0.004
# 양쪽 끝도 돌로 마감
for a in (A0, A1):
    for row in range(3):
        wall.ball(polar(a, WALL_R, floor + 0.034 + row * ROW_H), (0.014, HALF * 0.9, ROW_H / 2 * 0.9), STONE_B if row == 1 else STONE_A, 2, Matrix.Rotation(a + math.pi / 2, 4, "Z"))
# 지붕 바탕 (암키와): 가운데가 높은 맞배
roof_arc = arc(72)
roof_arc[0] -= 0.014
roof_arc[-1] += 0.014
wall.loops([[polar(a, WALL_R - EAVE, EAVE_Z), polar(a, WALL_R + EAVE, EAVE_Z), polar(a, WALL_R + EAVE, EAVE_Z + 0.011), polar(a, WALL_R, RIDGE_Z), polar(a, WALL_R - EAVE, EAVE_Z + 0.011)] for a in roof_arc], TILE, smooth=False)
# 수키와(둥근 등줄기)와 막새(처마 끝 둥근 마구리)
RIBS = 34
for i in range(RIBS + 1):
    a = roof_arc[0] + (roof_arc[-1] - roof_arc[0]) * i / RIBS
    for face in (-1, 1):
        top = polar(a, WALL_R + face * 0.012, RIDGE_Z - 0.006)
        mid = polar(a, WALL_R + face * EAVE * 0.55, (RIDGE_Z + EAVE_Z) / 2 + 0.003)
        end = polar(a, WALL_R + face * (EAVE + 0.004), EAVE_Z + 0.014)
        wall.tube([top, mid, end], 0.0085, TILE, 8)
        wall.ball(end + polar(a, face * 0.003, 0), (0.0045, 0.0112, 0.0112), TILE_END, 2, Matrix.Rotation(a, 4, "Z"))
# 용마루: 굵은 마루 위에 가는 마루를 한 줄 더, 양 끝은 둥글게 올립니다
wall.tube([polar(a, WALL_R, RIDGE_Z + 0.006) for a in roof_arc], 0.018, TILE, 10)
wall.tube([polar(a, WALL_R, RIDGE_Z + 0.024) for a in roof_arc], 0.0095, TILE, 8)
for a in (roof_arc[0], roof_arc[-1]):
    wall.ball(polar(a, WALL_R, RIDGE_Z + 0.014), (0.021, 0.021, 0.026), TILE_END, 2)

# 눈: 기와를 덮고 처마 쪽으로 흘러내린 눈. 기와에 살짝 파묻혀 틈이 없고, 두께와 덮인 폭이 자리마다 다릅니다
thick = wave(1, 5, 11, 23)
reach_in = wave(2, 4, 9, 19)
reach_out = wave(3, 3, 8, 17)
PROFILE = 9  # 한쪽 경사의 점 수


def roof_z(d):
    return RIDGE_Z - (RIDGE_Z - EAVE_Z - 0.011) * abs(d) / EAVE


def snow_top(a, d, edge, ends=1.0):
    """그 자리의 눈 윗면 높이. edge: 그쪽 눈이 덮인 폭, ends: 담장 끝으로 갈수록 0 에 가까워집니다."""
    lumps = 1 + 0.3 * math.sin(a * 41 + d * 55) + 0.2 * math.sin(a * 23 - d * 80 + 1.7)  # 고르지 않게 쌓인 결
    t = (0.02 + 0.011 * thick(a)) * lumps * ends
    mound = 0.034 * math.exp(-((d / 0.036) ** 2)) * ends  # 용마루 위는 불룩
    fade = max(0.0, 1 - (abs(d) / edge) ** 2) ** 0.35  # 처마 끝에서 도톰하게 말려 떨어집니다
    return roof_z(d) + mound + t * fade + 0.003


snow_rings = []
snow_angles = arc(110)
for i, a in enumerate(snow_angles):
    ends = max(0.02, min(1.0, min(i, len(snow_angles) - 1 - i) / 7)) ** 0.5  # 담장 끝에서는 눈이 얇아집니다
    # 눈은 용마루와 경사 위쪽 절반쯤에만 소복이 쌓입니다. 처마 쪽은 기와가 그대로 보입니다
    edge_in = EAVE * (0.4 + 0.2 * reach_in(a)) * (0.75 + 0.25 * ends)
    edge_out = EAVE * (0.4 + 0.2 * reach_out(a)) * (0.75 + 0.25 * ends)
    top = [(-edge_in * (1 - k / PROFILE), None) for k in range(PROFILE)] + [(edge_out * k / PROFILE, None) for k in range(PROFILE + 1)]
    ring = []
    for d, _ in top:
        edge = edge_in if d < 0 else edge_out
        ring.append(polar(a, WALL_R + d, snow_top(a, d, edge, ends)))
    for d, _ in reversed(top[1:-1]):
        ring.append(polar(a, WALL_R + d, roof_z(d) + 0.034 * math.exp(-((d / 0.034) ** 2)) * 0.5 - 0.006))  # 아랫면은 기와 속으로
    snow_rings.append(ring)
wall.loops(snow_rings, SNOW)
# 담장 발치에 쓸려 쌓인 눈 몇 무더기
for _ in range(9):
    a = random.uniform(A0 + 0.05, A1 - 0.05)
    face = random.choice((-1, 1))
    spot = polar(a, WALL_R + face * (HALF + random.uniform(0.012, 0.03)), 0)
    spot.z = ground_z(spot.x, spot.y) + 0.002
    wall.ball(spot, (random.uniform(0.03, 0.055), random.uniform(0.018, 0.028), random.uniform(0.008, 0.014)), SNOW, 2, Matrix.Rotation(a + math.pi / 2, 4, "Z"))
wall.build("HanokWall")

# ═════════════ 3. 까치 ═════════════
BLACK = material("Magpie_Black", "#1B1D24", 0.35)
WHITE = material("Magpie_White", "#F5F3EE", 0.6)
BLUE = material("Magpie_Blue", "#2B4C9A", 0.25)
BEAK = material("Magpie_Beak", "#2A2A2E", 0.4)

perch = math.radians(213)
out = Vector((math.cos(perch), math.sin(perch), 0))
forward = Vector((math.sin(perch), -math.cos(perch), 0))  # 담장을 따라 앞쪽(-Y 쪽)
if forward.y > 0:
    forward = -forward
snow_here = snow_top(perch, 0, EAVE)
at = out * WALL_R + Vector((0, 0, snow_here + 0.047))
basis = Matrix((forward, out, Vector((0, 0, 1)))).transposed()  # 로컬 X = 부리 쪽, Z = 위
S = 1.25  # 전체 크기

magpie = Shape()


def bird(x, y, z):
    return at + basis @ (Vector((x, y, z)) * S)


def bird_turn(pitch=0.0, yaw=0.0, roll=0.0):
    return (basis @ Matrix.Rotation(yaw, 3, "Z") @ Matrix.Rotation(-pitch, 3, "Y") @ Matrix.Rotation(roll, 3, "X")).to_4x4()


def sized(*radii):
    return tuple(r * S for r in radii)


TILT = math.radians(18)  # 가슴을 든 자세
magpie.ball(bird(0, 0, 0), sized(0.05, 0.034, 0.035), BLACK, 3, bird_turn(TILT))  # 몸
magpie.ball(bird(0.004, 0, -0.013), sized(0.037, 0.031, 0.026), WHITE, 3, bird_turn(TILT * 0.6))  # 흰 배
magpie.ball(bird(0.03, 0, 0.012), sized(0.027, 0.03, 0.028), BLACK, 3)  # 가슴
magpie.ball(bird(0.046, 0, 0.036), sized(0.0255, 0.024, 0.024), BLACK, 3)  # 머리
magpie.tube([bird(0.064, 0, 0.037), bird(0.082, 0, 0.034), bird(0.099, 0, 0.029)], [0.0085 * S, 0.0055 * S, 0.0012 * S], BEAK, 10)  # 부리
for side in (-1, 1):
    magpie.ball(bird(0.057, side * 0.0195, 0.042), sized(0.0052, 0.004, 0.0052), BEAK, 2)  # 눈
    magpie.ball(bird(0.0585, side * 0.0222, 0.0435), sized(0.0016, 0.0016, 0.0016), WHITE, 1)  # 눈빛
    magpie.ball(bird(0.008, side * 0.031, 0.014), sized(0.02, 0.008, 0.013), WHITE, 3, bird_turn(TILT, side * 0.12))  # 어깨의 흰 깃
    # 접은 날개: 푸른 깃 세 장이 뒤로 갈수록 길게 겹칩니다
    for k, (back, drop, length, width) in enumerate(((-0.012, 0.004, 0.034, 0.016), (-0.026, -0.002, 0.036, 0.013), (-0.042, -0.006, 0.034, 0.0095))):
        magpie.ball(bird(back, side * (0.031 - 0.002 * k), drop), sized(length, 0.006, width), BLUE if k else BLACK, 3, bird_turn(TILT * 0.4 - 0.1 * k, side * (0.14 + 0.04 * k)))
    # 다리와 발가락
    knee, foot = bird(0.006, side * 0.013, -0.03), bird(0.012, side * 0.014, -0.046)
    magpie.tube([knee, foot], 0.0032 * S, BEAK, 6)
    for toe in ((0.016, 0.0), (0.013, 0.008), (0.013, -0.008), (-0.01, 0.0)):
        magpie.tube([foot, foot + basis @ Vector((toe[0], side * toe[1], -0.002)) * S], [0.0026 * S, 0.0012 * S], BEAK, 5)
# 긴 꼬리: 납작한 깃 세 장이 뒤로 살짝 들려 뻗습니다
for spread, length, lift in ((0, 0.13, 0.03), (-1, 0.105, 0.022), (1, 0.105, 0.022)):
    root = bird(-0.04, spread * 0.006, 0.0)
    tip = bird(-0.04 - length, spread * 0.016, lift)
    middle = root.lerp(tip, 0.5)
    magpie.tube([root, middle, tip], [0.0036 * S, 0.004 * S, 0.002 * S], BLUE if spread == 0 else BLACK, 10, flat=3.2)
magpie.build("Magpie")

# ═════════════ 4. 받침대 문양: 둥글고 도톰하게 ═════════════
RELIEF = bpy.data.materials["Base_ReliefGold"]
base = bpy.data.objects["Base_Body"]
RELIEF_Z = -0.33


def base_point(angle, z, lift):
    direction = Vector((math.cos(angle), math.sin(angle), 0))
    inverse = base.matrix_world.inverted()
    hit, location, _, _ = base.ray_cast(inverse @ (direction * 3 + Vector((0, 0, z))), inverse.to_3x3() @ -direction)
    point = base.matrix_world @ location if hit else direction + Vector((0, 0, z))
    return point + direction * lift


BASE_R = base_point(0, RELIEF_Z, 0).xy.length
relief = Shape()
flat = Shape()  # 펼친 좌표(u: 둘레, v: 높이, h: 겉면에서 솟은 높이)로 먼저 만든 뒤 받침대에 감습니다
flat.bm = relief.bm
flat.mats = relief.mats


CENTER = [0.0]  # 지금 감고 있는 문양의 가운데 각도


def wrap(verts):
    center_angle = CENTER[0]
    for vert in verts:
        u, v, h = vert.co
        vert.co = base_point(center_angle + u / BASE_R, RELIEF_Z + v, h)


def ring(cu, cv, radius, thickness, height, count=40):
    """둥근 띠: 단면이 반달인 고리 (겉면에 반쯤 묻힙니다)."""
    wrap(flat.tube([(cu + radius * math.cos(t), cv + radius * math.sin(t), 0.0) for t in (2 * math.pi * k / count for k in range(count))], height, RELIEF, 6, closed=True, flat=thickness / height))


def bar(start, end, thickness, height):
    (u0, v0), (u1, v1) = start, end
    steps = max(2, int(math.hypot(u1 - u0, v1 - v0) / 0.035))
    wrap(flat.tube([(u0 + (u1 - u0) * i / steps, v0 + (v1 - v0) * i / steps, 0.0) for i in range(steps + 1)], height, RELIEF, 6, flat=thickness / height))
    for point in (start, end):  # 끝을 둥글게
        wrap(flat.ball((point[0], point[1], 0), (thickness, thickness, height), RELIEF, 2))


def dome(cu, cv, radius, height):
    wrap(flat.ball((cu, cv, 0), (radius, radius, height), RELIEF, 2))


def medallion(center_angle):
    """햇살 문양 원: 굵은 바깥 테, 가운데 볼록한 꽃술, 여덟 갈래 살과 살 끝의 구슬."""
    CENTER[0] = center_angle
    ring(0, 0, 0.108, 0.0115, 0.019, 36)
    ring(0, 0, 0.126, 0.0045, 0.008, 36)  # 바깥의 가는 테
    ring(0, 0, 0.034, 0.008, 0.015, 20)
    dome(0, 0, 0.019, 0.02)
    for k in range(8):
        a = 2 * math.pi * k / 8
        bar((0.044 * math.cos(a), 0.044 * math.sin(a)), (0.066 * math.cos(a), 0.066 * math.sin(a)), 0.006, 0.012)
        dome(0.081 * math.cos(a), 0.081 * math.sin(a), 0.0125, 0.016)


def knot_band(angle_from, angle_to):
    """매듭 띠: 가운데 네 잎 매듭에서 양쪽으로 뻗는 두 가닥 끈과 구슬."""
    center = (angle_from + angle_to) / 2
    half = abs(angle_to - angle_from) / 2 * BASE_R - 0.145
    CENTER[0] = center
    for v in (-0.015, 0.015):
        bar((-half, v), (-0.078, v), 0.0052, 0.01)
        bar((0.078, v), (half, v), 0.0052, 0.01)
    for cu, cv in ((0.035, 0), (-0.035, 0), (0, 0.035), (0, -0.035)):
        ring(cu, cv, 0.0235, 0.0068, 0.013, 16)
    dome(0, 0, 0.017, 0.019)
    for sign in (-1, 1):
        dome(sign * 0.078, 0, 0.0145, 0.017)
        dome(sign * half, 0, 0.0105, 0.013)


FRONT = math.radians(270)
spots = [FRONT + math.radians(d) for d in (-128, -52, 52, 128)]
for angle in spots:
    medallion(angle)
knot_band(spots[0], spots[1])
knot_band(spots[2], spots[3])
knot_band(spots[3], spots[0] + 2 * math.pi)
relief.build("Base_Relief_newyear")

# ═════════════ 5. 윷가락: 조각보 위에 아무렇게나 던져 놓은 네 가락 ═════════════
CLOTH = {
    "red": material("Cloth_Red", "#C23B45", 0.85),
    "blue": material("Cloth_Blue", "#2F5FA8", 0.85),
    "yellow": material("Cloth_Yellow", "#E9B949", 0.85),
    "green": material("Cloth_Green", "#3E8E6A", 0.85),
    "pink": material("Cloth_Pink", "#E79AB0", 0.85),
}
YUT_BACK = material("Yut_Back", "#6E4129", 0.6)
YUT_BELLY = material("Yut_Belly", "#EBD5A8", 0.65)
YUT_MARK = material("Yut_Mark", "#3A2318", 0.7)

YUT_AT = Vector((0.61, 0.03, 0))  # 양의 오른쪽 옆
CLOTH_HALF = 0.152
cloth_turn = Matrix.Rotation(math.radians(24), 3, "Z")

yut = Shape()
# 조각보: 가운데 네 조각과 붉은 테두리. 바닥을 따라 깔리고, 잔주름이 있고 귀퉁이가 살짝 들립니다
GRID = 22


def cloth_point(u, v):
    flat_xy = cloth_turn @ Vector((u * CLOTH_HALF, v * CLOTH_HALF, 0))
    x, y = YUT_AT.x + flat_xy.x, YUT_AT.y + flat_xy.y
    wrinkle = 0.0028 * math.sin(u * 7.3 + v * 2.1) * math.sin(v * 6.1 - u * 1.3) + 0.0018 * math.sin(u * 13 + 1.0) * math.cos(v * 11)
    corner = 0.016 * (max(abs(u), abs(v)) ** 6) * (0.5 + 0.5 * math.sin((u * 1.7 + v * 2.3) * 2))
    return Vector((x, y, ground_z(x, y) + 0.005 + wrinkle + corner))


cloth_verts = [[yut.bm.verts.new(cloth_point(-1 + 2 * i / GRID, -1 + 2 * j / GRID)) for j in range(GRID + 1)] for i in range(GRID + 1)]
for i in range(GRID):
    for j in range(GRID):
        u, v = -1 + 2 * (i + 0.5) / GRID, -1 + 2 * (j + 0.5) / GRID
        if max(abs(u), abs(v)) > 0.8:
            color = "red"
        else:
            color = ("blue" if v > 0 else "yellow") if u < 0 else ("pink" if v > 0 else "green")
        quad = [cloth_verts[i][j], cloth_verts[i + 1][j], cloth_verts[i + 1][j + 1], cloth_verts[i][j + 1]]
        yut.bm.faces.new(quad)
        yut.paint(quad, CLOTH[color])
for face in yut.bm.faces:
    face.smooth = True

YUT_LEN, YUT_R = 0.2, 0.021


def yut_stick(position, angle, tilt=0.0, belly_up=False, marks=3):
    """윷가락 하나: 등이 둥글고 배가 평평한 반원 막대. 배에는 X 표시를 새깁니다."""
    matrix = Matrix.Translation(position) @ Matrix.Rotation(angle, 4, "Z") @ Matrix.Rotation(tilt, 4, "Y") @ Matrix.Rotation(math.pi if belly_up else 0, 4, "X")
    ARC = 9
    rings = []
    count = 14
    for k in range(count + 1):
        t = -1 + 2 * k / count
        taper = (1 - abs(t) ** 5) ** 0.5 * 0.96 + 0.04  # 양 끝을 둥글게
        x = t * YUT_LEN / 2
        ring = [Vector((x, YUT_R * taper * math.cos(math.pi * a / (ARC - 1)), YUT_R * taper * math.sin(math.pi * a / (ARC - 1)) * 0.92)) for a in range(ARC)]
        rings.append([yut.bm.verts.new(matrix @ p) for p in ring])
    back, belly = [], []
    for a, b in zip(rings, rings[1:]):
        for k in range(ARC - 1):
            yut.bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
        yut.bm.faces.new((a[ARC - 1], b[ARC - 1], b[0], a[0]))  # 평평한 배
        back += [*a, *b]
    yut.bm.faces.new(rings[0])
    yut.bm.faces.new(list(reversed(rings[-1])))
    yut.paint(list(dict.fromkeys(back)), YUT_BACK)
    belly_index = yut.mats.index(YUT_BELLY) if YUT_BELLY in yut.mats else len(yut.mats)
    if YUT_BELLY not in yut.mats:
        yut.mats.append(YUT_BELLY)
    for a, b in zip(rings, rings[1:]):
        for face in a[0].link_faces:
            if set(face.verts) == {a[ARC - 1], b[ARC - 1], b[0], a[0]}:
                face.material_index = belly_index
                face.smooth = False
    # 배의 X 표시 (살짝 도드라지게 얹습니다)
    for m in range(marks):
        x = (m - (marks - 1) / 2) * YUT_LEN * 0.27
        for sign in (-1, 1):
            a = matrix @ Vector((x - 0.011, -0.011 * sign, -0.0006))
            b = matrix @ Vector((x + 0.011, 0.011 * sign, -0.0006))
            yut.tube([a, b], 0.0022, YUT_MARK, 5)


cloth_z = ground_z(YUT_AT.x, YUT_AT.y) + 0.008


def on_cloth(dx, dy, lift):
    offset = cloth_turn @ Vector((dx, dy, 0))
    return Vector((YUT_AT.x + offset.x, YUT_AT.y + offset.y, cloth_z + lift))


# 배가 위로 온 것 둘(밝은 나무 + X 표시), 등이 위로 온 것 둘. 서로 걸치고 비스듬히 놓입니다
yut_stick(on_cloth(-0.03, -0.035, YUT_R * 0.92), math.radians(18), 0.0, belly_up=True)
yut_stick(on_cloth(0.015, 0.0, YUT_R * 1.5), math.radians(-34), math.radians(-7), belly_up=False)
yut_stick(on_cloth(0.055, 0.075, YUT_R * 0.92), math.radians(74), 0.0, belly_up=True, marks=3)
yut_stick(on_cloth(-0.05, 0.062, YUT_R * 1.3), math.radians(104), math.radians(8), belly_up=False)
yut.build("Yut")

# ═════════════ 6. 복조리 한 쌍: 대나무를 엮은 조리 둘을 손잡이가 엇갈리게 세워 묶은 것 ═════════════
BAMBOO = material("Bokjori_Bamboo", "#EAD3A0", 0.7)
BAMBOO_DARK = material("Bokjori_BambooDark", "#CFAE74", 0.7)
THREAD = {
    "red": material("Bokjori_Red", "#C8363D", 0.75),
    "green": material("Bokjori_Green", "#3E8E6A", 0.75),
    "purple": material("Bokjori_Purple", "#7A4FA3", 0.75),
    "yellow": material("Bokjori_Yellow", "#EDC23F", 0.75),
    "pink": material("Bokjori_Pink", "#E0709A", 0.75),
}
BOK_AT = Vector((0.5, 0.5, 0))  # 양의 오른쪽 뒤 (떡국 · 윷과 겹치지 않는 자리)
BOK_AT.z = ground_z(BOK_AT.x, BOK_AT.y)
bok_turn = Matrix.Rotation(math.radians(135), 3, "Z")  # 스노우볼 가운데를 등지고 바깥을 보게

bok = Shape()
# 색실로 엮은 줄: 조리 바닥을 가로지르는 줄 번호 → 색
WEAVE_COLORS = {1: "red", 3: "green", 5: "pink", 8: "purple", 10: "red", 12: "green"}


def bokjori(mirror, shift):
    def world(local):
        return BOK_AT + bok_turn @ Vector((local.x * mirror, local.y + shift, local.z))

    joint = Vector((-0.05, 0.0, 0.098))  # 조리와 손잡이가 만나는 곳
    axis = Vector((-0.78, -0.2, -0.6)).normalized()  # 조리가 뻗는 쪽 (아래 · 바깥)
    opening = (Vector((0.15, -0.55, 1)) - axis * Vector((0.15, -0.55, 1)).dot(axis)).normalized()  # 조리가 벌어진 쪽 (위 · 앞)
    side = axis.cross(opening)
    LENGTH, WIDTH = 0.15, 0.078
    U, V = 12, 14
    # 조리: 손잡이 쪽이 뾰족하고 끝으로 갈수록 넓어지는 얕은 삼각 주머니
    grid = []
    for i in range(U + 1):
        u = i / U
        radius = WIDTH * (math.sin(math.pi * min(1.0, u * 1.08) ** 0.8) ** 0.7) * (0.35 + 0.65 * u)
        row = []
        for j in range(V + 1):
            theta = math.radians(-96 + 192 * j / V)
            radial = -opening * math.cos(theta) * 0.8 + side * math.sin(theta)
            row.append(bok.bm.verts.new(world(joint + axis * (u * LENGTH) + radial * radius)))
        grid.append(row)
    for i in range(U):
        for j in range(V):
            quad = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
            bok.bm.faces.new(quad)
            # 엮은 무늬: 밝은 대와 짙은 대가 바둑판처럼 엇갈리고, 몇 줄은 색실
            if (i + j) % 2 == 0 and j in WEAVE_COLORS and i > 1:
                mat = THREAD[WEAVE_COLORS[j]]
            else:
                mat = BAMBOO if (i + j) % 2 else BAMBOO_DARK
            bok.paint(quad, mat)
    # 테두리: 굵은 대를 둘러 마감
    rim = [grid[i][0].co.copy() for i in range(U + 1)] + [grid[U][j].co.copy() for j in range(1, V + 1)] + [grid[i][V].co.copy() for i in range(U - 1, -1, -1)]
    bok.tube(rim, 0.0042, BAMBOO, 6)
    # 손잡이: 가는 대오리 다발. 위로 갈수록 살짝 가늘다가 끝에서 퍼집니다
    up = Vector((0.36, 0.0, 1)).normalized()
    HANDLE = 0.215
    points = [joint - up * 0.012] + [joint + up * (HANDLE * t) for t in (0.0, 0.3, 0.6, 0.86, 1.0)]
    bok.tube([world(p) for p in points], [0.0095, 0.0092, 0.0078, 0.007, 0.0072, 0.0098], BAMBOO, 10)
    for k in range(7):  # 손잡이의 대오리 결
        a = 2 * math.pi * k / 7
        offset = (Vector((1, 0, 0)) * math.cos(a) + Vector((0, 1, 0)) * math.sin(a)) * 0.0066
        bok.tube([world(joint + up * (HANDLE * t) + offset * (1.25 if t > 0.95 else 1.0)) for t in (0.02, 0.5, 1.0)], 0.0022, BAMBOO_DARK, 4)
    # 색실로 감은 자리 (아래부터 빨강 · 보라 · 노랑)
    for start, length, color in ((0.05, 0.12, "red"), (0.42, 0.1, "purple"), (0.7, 0.16, "yellow")):
        bok.tube([world(joint + up * (HANDLE * start)), world(joint + up * (HANDLE * (start + length)))], 0.0108 - 0.002 * start, THREAD[color], 10)


bokjori(1, -0.008)
bokjori(-1, 0.008)
bok.build("Bokjori")

# ═════════════ 7. 떡국 상: 가장자리에 걸쳐 다리가 뜨지 않게 안쪽으로 옮깁니다 ═════════════
# 소반 · 떡국은 첫 판(build_newyear.py)의 메시를 그대로 쓰고 자리만 옮깁니다. 메시는 (0.555, -0.475) 에 만들어져 있습니다.
SOBAN_FROM, SOBAN_TO = Vector((0.555, -0.475)), Vector((0.455, -0.39))
soban_shift = Vector((SOBAN_TO.x - SOBAN_FROM.x, SOBAN_TO.y - SOBAN_FROM.y, ground_z(*SOBAN_TO) - ground_z(*SOBAN_FROM)))
for name in ("Soban", "Tteokguk"):
    bpy.data.objects[name].location = soban_shift

for unused in list(bpy.data.meshes):
    if unused.users == 0:
        bpy.data.meshes.remove(unused)
bpy.context.view_layer.update()
RESULT = "소품: " + ", ".join(f"{name} 점 {len(bpy.data.objects[name].data.vertices)}" for name in ("Year2027", "HanokWall", "Magpie", "Base_Relief_newyear", "Yut", "Bokjori"))
print(RESULT)
