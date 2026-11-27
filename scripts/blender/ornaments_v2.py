# 새해 스노우볼 전용 오너먼트 세 가지(복주머니 · 방패연 · 매듭 노리개)를 더 정성 들여 다시 만듭니다. (차명근)
# 열려 있는 design/blender/newyear.blend 안에서 돌립니다 (sheep_v2.py 와 같은 방법).
# 바꾸는 오브젝트: OrnamentTemplatesNewYear 컬렉션의 Orn_Pouch, Orn_Kite, Orn_Norigae. 다른 것은 건드리지 않습니다.
#
# 원형의 약속 (웹 코드와 자리 계산이 이 값에 맞춰져 있습니다)
#  - 가운데가 원점, 앞면이 -Y, 위가 +Z. 가로 · 세로 2 안팎.
#  - 양털에 브로치처럼 붙으므로 뒤쪽은 얕게(+Y 0.15 안팎), 볼륨은 앞으로 냅니다. 그래야 털에 묻히지 않습니다.
#  - 재질: Orn_Main(보내는 사람이 고른 색), Orn_Accent(무늬. 웹에서 크림 · 분홍으로), Orn_Metal(금속, 색 고정)

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

MAIN = bpy.data.materials["Orn_Main"]
ACCENT = bpy.data.materials["Orn_Accent"]
METAL = bpy.data.materials["Orn_Metal"]
TEMPLATES = bpy.data.collections["OrnamentTemplatesNewYear"]


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

    def ball(self, center, radii, mat, subdivisions=3, rotation=None):
        if isinstance(radii, (int, float)):
            radii = (radii, radii, radii)
        matrix = Matrix.Translation(center) @ (rotation or Matrix()) @ Matrix.Diagonal((*radii, 1))
        return self.paint(bmesh.ops.create_icosphere(self.bm, subdivisions=subdivisions, radius=1, matrix=matrix)["verts"], mat)

    def tube(self, points, radii, mat, segments=10, closed=False):
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
        for i in range(count if closed else count - 1):
            a, b = rings[i], rings[(i + 1) % count]
            for k in range(segments):
                self.bm.faces.new((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k]))
        if not closed:
            self.bm.faces.new(list(reversed(rings[0])))
            self.bm.faces.new(rings[-1])
        return self.paint([v for ring in rings for v in ring], mat)

    def revolve(self, profile, mat, segments=48, squash=1.0, shape=None, center=(0, 0, 0)):
        """(반지름, 높이) 점들을 Z 축 둘레로 돌린 회전체. squash: 앞뒤(Y)로 눌린 정도.
        shape(각도, 점 번호 비율) → 반지름에 곱할 값 (주름 · 물결)."""
        center = Vector(center)
        rings = []
        last = len(profile) - 1
        for index, (radius, height) in enumerate(profile):
            if radius <= 1e-6:
                rings.append([self.bm.verts.new(center + Vector((0, 0, height)))])
                continue
            ring = []
            for k in range(segments):
                a = 2 * math.pi * k / segments
                r = radius * (shape(a, index / last) if shape else 1.0)
                ring.append(self.bm.verts.new(center + Vector((r * math.cos(a), r * math.sin(a) * squash, height))))
            rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for k in range(segments):
                k2 = (k + 1) % segments
                corners = list(dict.fromkeys([a[k % len(a)], a[k2 % len(a)], b[k2 % len(b)], b[k % len(b)]]))
                if len(corners) >= 3:
                    self.bm.faces.new(corners)
        return self.paint([v for ring in rings for v in ring], mat)

    def build(self, name, location):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.mats:
            mesh.materials.append(mat)
        obj = bpy.data.objects.get(name)
        if obj is None:
            obj = bpy.data.objects.new(name, mesh)
            TEMPLATES.objects.link(obj)
        else:
            old = obj.data
            obj.data = mesh
            if old.users == 0:
                bpy.data.meshes.remove(old)
        obj.matrix_world = Matrix.Translation(location)
        return obj


def circle(center, radius_x, radius_z, count, turn=0.0, y=None):
    """XZ 평면(앞을 보는 면)에 놓인 타원 위의 점들."""
    cx, cy, cz = center
    points = []
    for k in range(count):
        a = 2 * math.pi * k / count
        x, z = radius_x * math.cos(a), radius_z * math.sin(a)
        points.append((cx + x * math.cos(turn) - z * math.sin(turn), cy if y is None else y, cz + x * math.sin(turn) + z * math.cos(turn)))
    return points


# ═════════════ 복주머니 ═════════════
# 아래가 통통한 주머니, 끈으로 조인 목 위로 주름진 입구가 꽃잎처럼 퍼지고, 앞에는 매듭과 금빛 장식.
pouch = Shape()
FORWARD = -0.14  # 몸을 앞으로 내어 털에 묻히지 않게


def pleats(angle, t):
    # 목으로 갈수록 깊어지는 세로 주름, 입구는 물결치는 가장자리
    depth = 0.012 + 0.075 * max(0.0, (t - 0.25) / 0.75) ** 1.4
    return 1 + depth * math.cos(angle * 11)


pouch.revolve(
    [(0, -0.98), (0.34, -0.96), (0.64, -0.86), (0.86, -0.66), (0.97, -0.38), (0.96, -0.1), (0.82, 0.16), (0.58, 0.34), (0.37, 0.43), (0.33, 0.49), (0.4, 0.57), (0.56, 0.72), (0.72, 0.9), (0.76, 0.99), (0.66, 0.98), (0.48, 0.8), (0.3, 0.66), (0.12, 0.6), (0, 0.6)],
    MAIN,
    56,
    0.5,
    pleats,
    (0, FORWARD, 0),
)
# 목을 조인 끈 (두 줄)
for z, r in ((0.46, 0.365), (0.52, 0.36)):
    pouch.tube([(r * math.cos(a), FORWARD + r * 0.5 * math.sin(a), z) for a in (2 * math.pi * k / 32 for k in range(32))], 0.04, ACCENT, 8, closed=True)
# 앞의 나비매듭: 고리 둘, 늘어진 끈 둘과 끝의 술, 가운데 매듭
KNOT = Vector((0, FORWARD - 0.2, 0.49))
for side in (-1, 1):
    pouch.tube(circle(KNOT + Vector((side * 0.2, -0.01, 0.04)), 0.19, 0.105, 20, side * math.radians(22)), 0.042, ACCENT, 8, closed=True)
    tail = [KNOT + Vector((side * x, y, z)) for x, y, z in ((0.03, -0.01, -0.03), (0.11, -0.07, -0.2), (0.17, -0.1, -0.4), (0.19, -0.1, -0.56))]
    pouch.tube(tail, 0.036, ACCENT, 8)
    pouch.revolve([(0, 0.05), (0.05, 0.04), (0.06, 0), (0.085, -0.14), (0.09, -0.19), (0, -0.19)], ACCENT, 12, 1.0, lambda a, t: 1 + 0.12 * math.cos(a * 6) * t, tail[-1])
pouch.ball(KNOT + Vector((0, -0.02, 0)), (0.085, 0.075, 0.075), ACCENT)
# 배에 단 둥근 금박 장식: 금테 안에 꽃잎 다섯 장
BADGE = Vector((0, FORWARD - 0.47, -0.3))
pouch.tube(circle(BADGE, 0.27, 0.27, 28), 0.04, METAL, 8, closed=True)
pouch.ball(BADGE + Vector((0, 0.03, 0)), (0.25, 0.05, 0.25), ACCENT)
for k in range(5):
    a = math.radians(90 + 72 * k)
    pouch.ball(BADGE + Vector((0.125 * math.cos(a), -0.02, 0.125 * math.sin(a))), (0.085, 0.03, 0.085), METAL, 2)
pouch.ball(BADGE + Vector((0, -0.03, 0)), (0.055, 0.035, 0.055), ACCENT, 2)
pouch.build("Orn_Pouch", (4, 0, 0))

# ═════════════ 방패연 ═════════════
# 가운데 방구멍이 뚫린 네모 연. 살짝 휜 종이, 대나무 살(머릿살 · 허릿살 · 귀살), 이마의 꼭지, 아래로 날리는 꼬리 셋.
kite = Shape()
W, H, TOP = 0.72, 0.8, 0.98  # 반너비, 반높이, 연의 맨 위
MID = TOP - H  # 연 가운데 높이
HOLE = 0.27


def paper(x, z, lift=0.0):
    """연 종이 위의 점: 바람을 받은 듯 가운데가 앞으로 살짝 부풀어 있습니다."""
    bow = 0.1 * (1 - (x / W) ** 2) * (0.6 + 0.4 * (1 - ((z - MID) / H) ** 2))
    return Vector((x, -0.08 - bow - lift, z))


COLS, ROWS = 28, 30
grid = [[(-W + 2 * W * i / COLS, MID - H + 2 * H * j / ROWS) for j in range(ROWS + 1)] for i in range(COLS + 1)]
for layer, lift in enumerate((0.0, -0.05)):  # 앞면과 뒷면
    verts = [[kite.bm.verts.new(paper(x, z, lift)) for x, z in column] for column in grid]
    made = []
    for i in range(COLS):
        for j in range(ROWS):
            cx = (grid[i][j][0] + grid[i + 1][j][0]) / 2
            cz = (grid[i][j][1] + grid[i][j + 1][1]) / 2
            if math.hypot(cx, cz - MID) < HOLE:  # 방구멍
                continue
            quad = [verts[i][j], verts[i + 1][j], verts[i + 1][j + 1], verts[i][j + 1]]
            kite.bm.faces.new(quad if layer == 0 else list(reversed(quad)))
            made += quad
    kite.paint(list(dict.fromkeys(made)), MAIN)
# 종이 가장자리를 두른 테와 방구멍 테
edge = [paper(-W + 2 * W * k / 14, MID + H, 0.025) for k in range(15)] + [paper(W, MID + H - 2 * H * k / 14, 0.025) for k in range(1, 15)]
edge += [paper(W - 2 * W * k / 14, MID - H, 0.025) for k in range(1, 15)] + [paper(-W, MID - H + 2 * H * k / 14, 0.025) for k in range(1, 14)]
kite.tube(edge, 0.034, ACCENT, 8, closed=True)
kite.tube([paper(HOLE * 1.06 * math.cos(a), MID + HOLE * 1.06 * math.sin(a), 0.025) for a in (2 * math.pi * k / 32 for k in range(32))], 0.045, ACCENT, 8, closed=True)
# 대나무 살: 머릿살(맨 위 가로), 허릿살(가운데 가로), 중살(가운데 세로), 귀살(대각선 둘). 방구멍은 가로지르지 않습니다
STICK = 0.026


def stick(start, end):
    (x0, z0), (x1, z1) = start, end
    kite.tube([paper(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, 0.03) for t in (k / 6 for k in range(7))], STICK, ACCENT, 6)


stick((-W, MID + H * 0.78), (W, MID + H * 0.78))
for side in (-1, 1):
    stick((side * W, MID), (side * HOLE * 1.1, MID))
    for up in (-1, 1):
        corner = (side * W * 0.96, MID + up * H * 0.96)
        reach = HOLE * 1.12 / math.hypot(corner[0], corner[1] - MID)
        stick(corner, (corner[0] * reach, MID + (corner[1] - MID) * reach))
for up in (-1, 1):
    stick((0, MID + up * H), (0, MID + up * HOLE * 1.1))
# 이마의 꼭지(둥근 무늬)와 금빛 점
kite.ball(paper(0, MID + H * 0.52, 0.02), (0.15, 0.03, 0.15), ACCENT)
kite.ball(paper(0, MID + H * 0.52, 0.045), (0.07, 0.025, 0.07), METAL, 2)
# 꼬리: 아래로 물결치며 날리는 띠 셋 (가운데가 가장 깁니다)
for x, length, phase in ((-0.46, 0.34, 0.0), (0, 0.42, 1.6), (0.46, 0.34, 3.0)):
    steps = 12
    left, right = [], []
    for k in range(steps + 1):
        t = k / steps
        z = MID - H - length * t
        sway = 0.07 * math.sin(t * 5.2 + phase) * t
        y = -0.1 + 0.06 * math.sin(t * 6.5 + phase) * t
        half = 0.085 * (1 - 0.35 * t)
        left.append(kite.bm.verts.new((x + sway - half, y, z)))
        right.append(kite.bm.verts.new((x + sway + half, y, z)))
    for k in range(steps):
        kite.bm.faces.new((left[k], right[k], right[k + 1], left[k + 1]))
    kite.paint(left + right, MAIN if x else ACCENT)
kite.build("Orn_Kite", (6.6, 0, 0))

# ═════════════ 매듭 노리개 ═════════════
# 위부터: 금고리 → 끈 → 꽃 모양 매듭 → 옥 가락지 → 금 띠로 묶은 술 머리 → 올올이 늘어진 술
norigae = Shape()
Y = -0.12
norigae.tube(circle((0, Y, 0.86), 0.14, 0.14, 24), 0.04, METAL, 8, closed=True)  # 위쪽 고리
norigae.tube([(0, Y, 0.72), (0, Y, 0.6)], 0.035, ACCENT, 8)
# 매듭: 가운데 마름모를 네 고리가 감싼 꽃 모양 (국화매듭을 단순하게)
KNOT_Z = 0.38
for k in range(4):
    a = math.radians(45 + 90 * k)
    center = (0.17 * math.cos(a), Y, KNOT_Z + 0.17 * math.sin(a))
    norigae.tube(circle(center, 0.125, 0.125, 18), 0.058, MAIN, 8, closed=True)
for k in range(4):
    a = math.radians(90 * k)
    norigae.ball((0.2 * math.cos(a), Y - 0.02, KNOT_Z + 0.2 * math.sin(a)), (0.075, 0.07, 0.075), MAIN, 2)
norigae.ball((0, Y - 0.05, KNOT_Z), (0.115, 0.09, 0.115), ACCENT)
norigae.tube([(0, Y, 0.14), (0, Y, 0.04)], 0.035, ACCENT, 8)
# 옥 가락지: 도톰한 고리
norigae.tube(circle((0, Y, -0.1), 0.15, 0.15, 24), 0.075, ACCENT, 10, closed=True)
norigae.tube([(0, Y, -0.26), (0, Y, -0.33)], 0.035, ACCENT, 8)
# 술 머리: 둥근 머리를 금 띠 두 줄로 묶습니다
norigae.ball((0, Y, -0.4), (0.15, 0.14, 0.11), MAIN)
for z, r in ((-0.47, 0.135), (-0.52, 0.13)):
    norigae.tube([(r * math.cos(a), Y + r * 0.92 * math.sin(a), z) for a in (2 * math.pi * k / 20 for k in range(20))], 0.024, METAL, 6, closed=True)
# 술: 속을 채운 원뿔 둘레로 실 가닥이 살짝 퍼지며 늘어집니다
norigae.revolve([(0, -0.5), (0.11, -0.52), (0.17, -0.78), (0.2, -1.0), (0, -1.0)], MAIN, 16, 0.92, None, (0, Y, 0))
for k in range(16):
    a = 2 * math.pi * k / 16
    strand = []
    for t in (0.0, 0.35, 0.7, 1.0):
        r = 0.115 + 0.115 * t
        wobble = 0.012 * math.sin(k * 2.3 + t * 4)
        strand.append((r * math.cos(a) + wobble, Y + r * 0.92 * math.sin(a), -0.5 - 0.52 * t - 0.02 * math.cos(k * 1.7)))
    norigae.tube(strand, [0.03, 0.031, 0.03, 0.022], MAIN, 5)
norigae.build("Orn_Norigae", (9.2, 0, 0))

for unused in list(bpy.data.meshes):
    if unused.users == 0:
        bpy.data.meshes.remove(unused)
bpy.context.view_layer.update()
RESULT = "오너먼트: " + ", ".join(f"{name} 점 {len(bpy.data.objects[name].data.vertices)}" for name in ("Orn_Pouch", "Orn_Kite", "Orn_Norigae"))
print(RESULT)
