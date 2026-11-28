# 새해 스노우볼 받침대의 윗부분(유리와 맞닿는 테두리)에 한옥 기와 처마를 두릅니다. (차명근)
# 열려 있는 design/blender/newyear.blend 안에서 돌립니다 (sheep_v2.py · ornaments_v2.py 와 같은 방법). 여러 번 돌려도 같은 결과입니다.
# 만드는 오브젝트: SnowGlobe 컬렉션의 Base_Eave 하나. 다른 것은 건드리지 않습니다.
#
# 모양
#  - 지붕면: 유리 둘레에서 바깥 아래로 내려가다 끝이 살짝 들리는 처마 곡선. 받침대 몸통의 어깨를 덮고 조금 더 나옵니다.
#  - 수키와: 지붕면 위에 부챗살처럼 놓인 둥근 기왓등 줄. 줄 사이의 오목한 곳이 암키와 골입니다.
#  - 막새: 수키와 끝을 막는 둥근 금빛 마구리. 그 사이 처마 끝에는 암막새처럼 아래로 처진 낮은 턱을 둡니다.
# 재질: 담장 기와와 같은 Wall_Tile · Wall_TileEnd, 막새는 Gold (웹의 재질 마감이 이름으로 그대로 붙습니다).

import math

import bmesh
import bpy
from mathutils import Vector

NAME = "Base_Eave"
TILE = bpy.data.materials["Wall_Tile"]
TILE_END = bpy.data.materials["Wall_TileEnd"]
GOLD = bpy.data.materials["Gold"]
MATS = [TILE, TILE_END, GOLD]

COUNT = 56  # 수키와 줄 수
SEGMENTS = COUNT * 4  # 지붕면을 둘레로 나눈 칸 (수키와 한 줄에 4칸)
# 지붕면의 옆모습 (반지름, 높이): 유리 쪽 → 처마 끝. 유리는 높이 0.088 에서 반지름 0.885 입니다.
ROOF = [(0.888, 0.09), (0.93, 0.071), (0.975, 0.05), (1.02, 0.028), (1.06, 0.01), (1.095, -0.002), (1.122, -0.004)]
# 처마 끝의 두께와 처마 밑 (몸통 속으로 들어가 끝납니다)
UNDER = [(1.128, -0.014), (1.122, -0.036), (1.06, -0.05), (0.99, -0.075), (0.93, -0.1)]

bm = bmesh.new()


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


def tube(points, radii, mat, segments, cap_mat=None):
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
    for a, b in zip(made, made[1:]):
        faces += [bm.faces.new((a[k], a[(k + 1) % segments], b[(k + 1) % segments], b[k])) for k in range(segments)]
    paint(faces, mat)
    paint([bm.faces.new(list(reversed(made[0]))), bm.faces.new(made[-1])], cap_mat or mat, smooth=False)


# 수키와와 막새
for k in range(COUNT):
    a = 2 * math.pi * k / COUNT
    out = Vector((math.cos(a), math.sin(a), 0))
    spine = [out * radius + Vector((0, 0, height + 0.006)) for radius, height in ROOF]
    radii = [0.019 + 0.011 * i / (len(ROOF) - 1) for i in range(len(ROOF))]  # 바깥으로 갈수록 굵게 (줄 사이가 벌어지므로)
    tube(spine, radii, TILE, 6)
    # 막새: 수키와 끝에 조금 더 큰 둥근 마구리. 테는 기와색, 얼굴은 금빛
    tip = spine[-1]
    forward = (spine[-1] - spine[-2]).normalized()
    tube([tip - forward * 0.004, tip + forward * 0.016], [0.037, 0.037], TILE_END, 10)
    tube([tip + forward * 0.015, tip + forward * 0.021], [0.028, 0.026], GOLD, 10)

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
