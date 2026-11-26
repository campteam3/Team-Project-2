// 3D 모델(public/models/*.glb)을 압축합니다. (FEEDBACK A8: 첫 화면이 뜨는 데 오래 걸림)
//
// - Blender 에서 내보낸 모델은 점 · 면 정보가 압축 없이 들어 있어 큽니다 (스노우볼 약 4MB).
//   meshopt 방식으로 압축하면 모양과 이름은 그대로이고 크기만 1/4 ~ 1/5 로 줄어듭니다.
// - `npm run build` 앞에 자동으로 돕니다 (package.json 의 prebuild). 직접 돌릴 때: `npm run compress:models`
// - 이미 압축된 파일은 건너뜁니다. 그래서 Blender 에서 모델을 다시 내보낸 뒤 평소처럼 build 만 하면 됩니다.
// - 압축을 푸는 코드는 화면 쪽(drei 의 useGLTF)에 이미 들어 있어서 화면 코드는 바꿀 것이 없습니다.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "models");
const MESHOPT = "EXT_meshopt_compression";
const kb = (bytes) => `${Math.round(bytes / 1024)}KB`;

let tools;
try {
  const [core, extensions, functions, meshoptimizer] = await Promise.all([
    import("@gltf-transform/core"),
    import("@gltf-transform/extensions"),
    import("@gltf-transform/functions"),
    import("meshoptimizer"),
  ]);
  tools = { core, extensions, functions, meshoptimizer };
} catch {
  // 패키지를 아직 설치하지 않은 PC 에서도 build 가 멈추지 않게 합니다
  console.warn("[모델 압축] 필요한 패키지가 없어 건너뜁니다. `npm install` 을 한 번 실행해 주세요.");
  process.exit(0);
}

const { NodeIO } = tools.core;
const { ALL_EXTENSIONS } = tools.extensions;
const { meshopt } = tools.functions;
const { MeshoptDecoder, MeshoptEncoder } = tools.meshoptimizer;

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const files = (await readdir(DIR)).filter((name) => name.endsWith(".glb"));
for (const name of files) {
  const file = path.join(DIR, name);
  const before = (await stat(file)).size;
  const document = await io.read(file);
  const compressed = document.getRoot().listExtensionsUsed().some((extension) => extension.extensionName === MESHOPT);
  if (compressed) {
    console.log(`[모델 압축] ${name}: 이미 압축됨 (${kb(before)})`);
    continue;
  }
  document.setLogger(new tools.core.Logger(tools.core.Logger.Verbosity.ERROR));
  await document.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));
  await io.write(file, document);
  const after = (await stat(file)).size;
  console.log(`[모델 압축] ${name}: ${kb(before)} → ${kb(after)}`);
}
