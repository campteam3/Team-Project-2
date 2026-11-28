# 새해 스노우볼 받침대의 윗부분(유리와 맞닿는 테두리)에 한옥 기와 처마를 두릅니다. (차명근)
# 열려 있는 design/blender/newyear.blend 안에서 돌립니다 (sheep_v2.py · ornaments_v2.py 와 같은 방법). 여러 번 돌려도 같은 결과입니다.
# 만드는 오브젝트: SnowGlobe 컬렉션의 Base_Eave 하나. 다른 것은 건드리지 않습니다.
#
# 모양
#  - 지붕면: 유리 둘레에서 바깥 아래로 내려가다 끝이 살짝 들리는 처마 곡선. 받침대 몸통의 어깨를 덮고 조금 더 나옵니다.
#  - 수키와: 지붕면 위에 부챗살처럼 놓인 둥근 기왓등 줄. 줄 사이의 오목한 곳이 암키와 골입니다.
#  - 막새: 수키와 끝을 막는 둥근 금빛 마구리(수막새). 그 사이 처마 끝에는 아래로 늘어지는 반달 모양 판(암막새)을 답니다.
# 재질: Eave_Tile · Eave_TileEnd · Eave_Gold. 담장 기와(Wall_Tile · Wall_TileEnd) · Gold 를 복사해 처마 전용으로 둡니다.
#   웹에서 처마에만 무늬를 그리려고 이름을 따로 씁니다 (components/snowglobe/NewYearEaveLook.ts).
# UV 는 그림을 입히는 데 쓰지 않고, 웹의 무늬가 자리를 아는 데 씁니다.
#   Eave_Tile: u = 0 지붕면(암키와 골) / 1 수키와, v = 유리 쪽에서 처마 끝까지 기와 TILES 장으로 나눈 자리(0 ~ TILES)
#   Eave_Gold: 막새 얼굴은 가운데가 (0, 0), 둘레가 반지름 1 인 원. 옆면은 (2, 0)

import math

import bmesh
import bpy
from mathutils import Vector

NAME = "Base_Eave"


def own(name, source):
    """처마 전용 재질. 없으면 source 를 복사해 만듭니다."""
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials[source].copy()
        material.name = name
    return material


TILE = own("Eave_Tile", "Wall_Tile")
TILE_END = own("Eave_TileEnd", "Wall_TileEnd")
GOLD = own("Eave_Gold", "Gold")
MATS = [TILE, TILE_END, GOLD]
TILES = 3  # 처마 길이 방향으로 포갠 기와 장 수 (웹에서 이 자리에 겹친 턱을 그립니다)

COUNT = 56  # 수키와 줄 수
SEGMENTS = COUNT * 4  # 지붕면을 둘레로 나눈 칸 (수키와 한 줄에 4칸)
# 지붕면의 옆모습 (반지름, 높이): 유리 쪽 → 처마 끝. 유리는 높이 0.088 에서 반지름 0.885 입니다.
ROOF = [(0.888, 0.09), (0.93, 0.071), (0.975, 0.05), (1.02, 0.028), (1.06, 0.01), (1.095, -0.002), (1.122, -0.004)]
# 처마 끝의 두께와 처마 밑 (몸통 속으로 들어가 끝납니다)
UNDER = [(1.128, -0.014), (1.122, -0.036), (1.06, -0.05), (0.99, -0.075), (0.93, -0.1)]

bm = bmesh.new()
UV = bm.loops.layers.uv.new("UVMap")
# 지붕면을 따라 잰 길이로 기와 자리(v)를 정합니다
_lengths = [0.0]
for (r0, z0), (r1, z1) in zip(ROOF, ROOF[1:]):
    _lengths.append(_lengths[-1] + math.hypot(r1 - r0, z1 - z0))
ALONG = [TILES * length / _lengths[-1] for length in _lengths]


def set_uv(face, uvs):
    for loop, uv in zip(face.loops, uvs):
        loop[UV].uv = uv


def paint(faces, mat, smooth=True):
    for face in faces:
        face.material_index = MATS.index(mat)
        face.smooth = smooth


def trough(angle):
    """암키와 골: 수키와 줄 사이가 살짝 오목합니다. 0(수키와 아래) ~ 1(골 가운데)."""
    return 0.5 - 0.5 * math.cos(angle * COUNT)


# 지붕면과 처마 밑 (한 장으로 이어 돌립니다)
profile = ROOF + UNDER
rings = []
for index, (radius, height) in enumerate(profile):
    ring = []
    for k in range(SEGMENTS):
        a = 2 * math.pi * k / SEGMENTS
        dip = 0.012 * trough(a) if index < len(ROOF) else 0.0
        # 처마 끝은 골마다 아래로 조금 처집니다 (암막새의 둥근 턱)
        sag = 0.012 * trough(a) if index in (len(ROOF) - 1, len(ROOF), len(ROOF) + 1) else 0.0
        ring.append(bm.verts.new((radius * math.cos(a), radius * math.sin(a), height - dip - sag)))
    rings.append(ring)
for index, (a, b) in enumerate(zip(rings, rings[1:])):
    faces = [bm.faces.new((a[k], a[(k + 1) % SEGMENTS], b[(k + 1) % SEGMENTS], b[k])) for k in range(SEGMENTS)]
    edge = len(ROOF) - 1 <= index <= len(ROOF)  # 처마 끝의 두께 면
    paint(faces, TILE_END if edge else TILE)
    v0 = ALONG[min(index, len(ROOF) - 1)]
    v1 = ALONG[min(index + 1, len(ROOF) - 1)]
    for face in faces:
        set_uv(face, [(0, v0), (0, v0), (0, v1), (0, v1)])


def tube(points, radii, mat, segments, along=None, face=False):
    """along: 점마다의 기와 자리(v). face: 앞쪽 마구리에 막새 얼굴 UV(원)를 줍니다."""
    points = [Vector(p) for p in points]
    made = []
    normal = None
    for i, point in enumerate(points):
        ahead = points[min(i + 1, len(points) - 1)]
        behind = points[max(i - 1, 0)]
        tangent = (ahead - behind).normalized()
        if normal is None:
            normal = Vector((0, 0, 1))
        normal = (normal - tangent * normal.dot(tangent)).normalized()
        binormal = tangent.cross(normal)
        made.append([bm.verts.new(point + (normal * math.cos(t) + binormal * math.sin(t)) * radii[i]) for t in (2 * math.pi * k / segments for k in range(segments))])
    faces = []
    for i, (a, b) in enumerate(zip(made, made[1:])):
        ring = [bm.faces.new((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k])) for k in range(segments)]
        for quad in ring:
            set_uv(quad, [(1, along[i]), (1, along[i]), (1, along[i + 1]), (1, along[i + 1])] if along else [(2, 0)] * 4)
        faces += ring
    paint(faces, mat)
    back, front = bm.faces.new(list(reversed(made[0]))), bm.faces.new(made[-1])
    paint([back, front], mat, smooth=False)
    set_uv(back, [(2, 0)] * segments)
    circle = [(math.sin(t), math.cos(t)) for t in (2 * math.pi * k / segments for k in range(segments))]  # 위쪽이 (0, 1)
    set_uv(front, circle if face else [(2, 0)] * segments)


# 수키와와 막새
for k in range(COUNT):
    a = 2 * math.pi * k / COUNT
    out = Vector((math.cos(a), math.sin(a), 0))
    spine = [out * radius + Vector((0, 0, height + 0.006)) for radius, height in ROOF]
    radii = [0.019 + 0.011 * i / (len(ROOF) - 1) for i in range(len(ROOF))]  # 바깥으로 갈수록 굵게 (줄 사이가 벌어지므로)
    tube(spine, radii, TILE, 6, along=ALONG)
    # 막새: 수키와 끝에 조금 더 큰 둥근 마구리. 테는 기와색, 얼굴은 금빛
    tip = spine[-1]
    forward = (spine[-1] - spine[-2]).normalized()
    tube([tip - forward * 0.004, tip + forward * 0.016], [0.041, 0.041], TILE_END, 10)
    tube([tip + forward * 0.015, tip + forward * 0.021], [0.033, 0.032], GOLD, 12, face=True)

# 암막새: 수키와 사이마다 처마 끝에서 아래로 늘어지는 반달 모양 판. 수막새보다 조금 뒤에 있습니다
PLATE_HALF, PLATE_TOP, PLATE_MID, PLATE_DROP = 0.047, -0.012, -0.03, 0.038
outline = [(-PLATE_HALF, PLATE_TOP), (PLATE_HALF, PLATE_TOP)] + [(PLATE_HALF * math.cos(t), PLATE_MID + PLATE_DROP * math.sin(t)) for t in (-math.pi * i / 7 for i in range(8))]
for k in range(COUNT):
    a = 2 * math.pi * (k + 0.5) / COUNT
    out = Vector((math.cos(a), math.sin(a), 0))
    side = Vector((-math.sin(a), math.cos(a), 0))
    layers = [[bm.verts.new(out * radius + side * x + Vector((0, 0, z))) for x, z in outline] for radius in (1.132, 1.112)]
    faces = [bm.faces.new(layers[0]), bm.faces.new(list(reversed(layers[1])))]
    count = len(outline)
    faces += [bm.faces.new((layers[0][i], layers[1][i], layers[1][(i + 1) % count], layers[0][(i + 1) % count])) for i in range(count)]
    paint(faces, TILE_END, smooth=False)

bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
mesh = bpy.data.meshes.new(NAME)
bm.to_mesh(mesh)
bm.free()
for mat in MATS:
    mesh.materials.append(mat)
obj = bpy.data.objects.get(NAME)
if obj is None:
    obj = bpy.data.objects.new(NAME, mesh)
    bpy.data.collections["SnowGlobe"].objects.link(obj)
else:
    old = obj.data
    obj.data = mesh
    if old.users == 0:
        bpy.data.meshes.remove(old)
bpy.context.view_layer.update()
RESULT = f"처마: {NAME} 점 {len(mesh.vertices)}"
print(RESULT)
