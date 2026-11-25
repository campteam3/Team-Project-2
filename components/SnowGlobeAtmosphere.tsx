"use client";

// 스노우볼 뒤의 겨울밤 풍경입니다. 흐릿한 눈 덮인 나무와 뭉개진 불빛을 스노우볼 둘레에 세워서,
// 스노우볼을 돌리면 배경도 함께 흘러갑니다. 그림 파일 없이 장면 안에서 만듭니다.

import { Environment, Lightformer } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// 겨울밤 조명: 푸른 달빛 + 따뜻한 불빛, 그리고 금색과 유약에 비치는 주변 빛.
// 주변 빛은 외부 이미지를 받지 않고 장면 안에서 만듭니다.
export function NightLights() {
  return (
    <>
      <ambientLight intensity={0.55} color="#5a6aa8" />
      <directionalLight position={[3, 5, -2]} intensity={1.1} color="#a9c2ff" />
      <directionalLight position={[-2.5, 2.5, 4]} intensity={1.5} color="#ffd98f" />
      {/* 옆에서 스며드는 은은한 색 조명: 왼쪽 분홍, 오른쪽 하늘색 */}
      <directionalLight position={[-5, 1.2, 1.5]} intensity={1.6} color="#ff72b8" />
      <directionalLight position={[5, 1.4, 1]} intensity={1.6} color="#62b4ff" />
      <Environment resolution={256} environmentIntensity={0.7}>
        <mesh scale={30}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color="#1b2444" side={THREE.BackSide} />
        </mesh>
        <Lightformer form="rect" intensity={1.4} color="#b8ccff" position={[0, 7, 0]} scale={[7, 7, 1]} />
        <Lightformer form="rect" intensity={3.4} color="#ff9fd0" position={[-6, 2, 3]} scale={[1.4, 7, 1]} />
        <Lightformer form="rect" intensity={3.2} color="#86c6ff" position={[6, 1.5, 2]} scale={[1, 4, 1]} />
        <Lightformer form="ring" intensity={1.6} color="#ffe9a8" position={[0, 2, 7]} scale={2.5} />
      </Environment>
    </>
  );
}

// 빛 번짐: 밝은 불빛만 번지게 하고, 마지막에 화면 색으로 맞춥니다. <Canvas> 의 맨 끝에 둡니다.
export function NightBloom() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.8} luminanceSmoothing={0.25} intensity={0.75} radius={0.85} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

// 같은 화면이 매번 똑같이 나오도록 정해진 순서의 난수를 씁니다.
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 가운데가 밝고 가장자리로 사라지는 동그란 빛
export function createDotTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.75)");
    gradient.addColorStop(0.8, "rgba(255,255,255,0.25)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 초점이 나간 눈 덮인 전나무. 그림자 번짐으로 흐릿하게 그립니다.
function createPineTexture() {
  const width = 256;
  const height = 384;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    const offset = 2000;
    const blurred = (color: string, blur: number, draw: () => void) => {
      context.save();
      context.shadowColor = color;
      context.shadowBlur = blur;
      context.shadowOffsetX = offset;
      context.fillStyle = color;
      context.translate(-offset, 0);
      draw();
      context.restore();
    };
    const tiers = [
      { top: 30, bottom: 130, half: 44 },
      { top: 90, bottom: 210, half: 68 },
      { top: 160, bottom: 290, half: 90 },
      { top: 235, bottom: 362, half: 108 },
    ];
    blurred("rgba(20, 44, 70, 0.95)", 18, () => {
      for (const tier of tiers) {
        context.beginPath();
        context.moveTo(width / 2, tier.top);
        context.lineTo(width / 2 + tier.half, tier.bottom);
        context.lineTo(width / 2 - tier.half, tier.bottom);
        context.closePath();
        context.fill();
      }
    });
    // 가지 위에 얹힌 눈
    blurred("rgba(150, 185, 215, 0.55)", 14, () => {
      for (const tier of tiers) {
        context.beginPath();
        context.moveTo(width / 2, tier.top + 4);
        context.lineTo(width / 2 + tier.half * 0.55, tier.top + (tier.bottom - tier.top) * 0.62);
        context.lineTo(width / 2 - tier.half * 0.75, tier.top + (tier.bottom - tier.top) * 0.78);
        context.closePath();
        context.fill();
      }
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 밤하늘: 위는 짙은 남색, 눈높이에는 푸르스름한 빛
function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      // 마지막에 화면 색 보정을 거치며 어두워지므로, 원하는 색보다 밝게 넣습니다.
      uTop: { value: new THREE.Color("#18213f") },
      uHorizon: { value: new THREE.Color("#2b4a78") },
      uBottom: { value: new THREE.Color("#1f2c4d") },
      // 화면 가장자리에서는 페이지 배경색에 가까워지게 해서 네모난 경계가 보이지 않게 합니다.
      uEdge: { value: new THREE.Color("#2b3859") },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      varying vec4 vClip;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vClip = gl_Position;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uEdge;
      varying vec3 vDirection;
      varying vec4 vClip;
      void main() {
        float h = normalize(vDirection).y;
        vec3 color = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
        color = mix(color, uBottom, smoothstep(0.0, -0.35, h));
        vec2 screen = abs(vClip.xy / vClip.w);
        float edge = smoothstep(0.45, 1.0, max(screen.x, screen.y));
        color = mix(color, uEdge, edge);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// 유리 안에 떠 있는 작은 빛. 트리 둘레를 천천히 돌며 떠다니고, 은은하게 밝아졌다 어두워집니다.
// 깊이감: 앞쪽 빛은 크고 흐릿하게, 가운데는 또렷하게, 뒤쪽은 작고 옅게 그리고, 트리 뒤로 지나가면 가려집니다.
// 가장자리가 완전히 사라지는 동그란 빛으로 그려서 네모난 테두리가 보이지 않습니다.
const DUST_COLORS = ["#fff1cf", "#fff1cf", "#fff1cf", "#ffc766", "#ffc766", "#ff9d6b", "#ff8fa3", "#9fe8c0", "#9cc8ff"];

export function GlowDust({ still = false }: { still?: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);

  const { geometry, parameters } = useMemo(() => {
    const random = seededRandom(1225);
    const count = 60;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const color = new THREE.Color();
    let placed = 0;
    while (placed < count) {
      const x = (random() * 2 - 1) * 0.85;
      const y = 0.32 + random() * 1.1;
      const z = (random() * 2 - 1) * 0.85;
      // 유리 안쪽, 트리 바깥
      if (Math.hypot(x, y - 0.55, z) > 0.86) continue;
      if (Math.hypot(x, z) < 0.62 * Math.max(0, 1.35 - y) + 0.06) continue;
      positions.set([x, y, z], placed * 3);
      color.set(DUST_COLORS[Math.floor(random() * DUST_COLORS.length)]);
      colors.set([color.r, color.g, color.b], placed * 3);
      sizes[placed] = 0.018 + random() * 0.03;
      phases[placed] = random();
      placed++;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    buffer.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    buffer.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    return {
      geometry: buffer,
      parameters: {
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uHeight: { value: 800 } },
        vertexShader: /* glsl */ `
          attribute vec3 aColor;
          attribute float aSize;
          attribute float aPhase;
          uniform float uTime;
          uniform float uHeight;
          varying vec3 vColor;
          varying float vGlow;
          varying float vNear;
          void main() {
            // 빛마다 다른 빠르기와 방향으로 트리 둘레를 아주 천천히 돕니다.
            float turn = uTime * (0.03 + fract(aPhase * 5.0) * 0.05) * (fract(aPhase * 3.0) > 0.5 ? 1.0 : -1.0);
            float turnC = cos(turn);
            float turnS = sin(turn);
            vec3 home = vec3(position.x * turnC - position.z * turnS, position.y, position.x * turnS + position.z * turnC);
            // 그러면서 제자리 근처를 천천히 떠다닙니다.
            float seed = aPhase * 6.2832;
            vec3 drift = vec3(
              sin(uTime * (0.21 + aPhase * 0.17) + seed * 3.0),
              sin(uTime * (0.16 + fract(aPhase * 7.0) * 0.15) + seed * 5.0),
              cos(uTime * (0.19 + fract(aPhase * 13.0) * 0.16) + seed * 2.0)
            ) * vec3(0.035, 0.05, 0.035);
            vec4 viewPosition = modelViewMatrix * vec4(home + drift, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            // 스노우볼이 커지거나 작아지면 빛도 같은 비율로
            float modelScale = length(modelViewMatrix[0].xyz);
            // 유리 구 안에서 얼마나 앞쪽인지: 0 = 맨 뒤, 1 = 맨 앞
            vec4 centerView = modelViewMatrix * vec4(0.0, 0.55, 0.0, 1.0);
            vNear = clamp(0.5 + 0.5 * (viewPosition.z - centerView.z) / (0.86 * modelScale), 0.0, 1.0);
            float depthSize = mix(0.5, 1.4, vNear * vNear);
            gl_PointSize = aSize * depthSize * modelScale * projectionMatrix[1][1] * uHeight / (-viewPosition.z);
            vColor = aColor;
            vGlow = 0.5 + 0.5 * sin(uTime * (0.5 + aPhase * 0.7) + aPhase * 6.2832);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec3 vColor;
          varying float vGlow;
          varying float vNear;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            // 앞쪽 빛은 초점이 나간 것처럼 넓고 고르게 퍼지고, 뒤쪽 빛은 가운데가 밝은 작은 점
            float blur = smoothstep(0.55, 1.0, vNear);
            float soft = smoothstep(1.0, mix(0.0, 0.55, blur), d);
            float shape = mix(soft * soft, soft, blur);
            float depthFade = mix(0.45, 1.0, smoothstep(0.0, 0.5, vNear)) * mix(1.0, 0.45, blur);
            float alpha = shape * (0.35 + 0.65 * vGlow) * depthFade;
            gl_FragColor = vec4(vColor * (0.9 + 0.7 * vGlow), alpha);
            #include <colorspace_fragment>
          }
        `,
      },
    };
  }, []);

  useFrame((state) => {
    const uniforms = material.current?.uniforms;
    if (!uniforms) return;
    uniforms.uHeight.value = state.gl.domElement.height;
    if (!still) uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <points geometry={geometry} renderOrder={5}>
      <shaderMaterial ref={material} args={[parameters]} />
    </points>
  );
}

const BOKEH_COLORS = ["#ffc56b", "#ffab4a", "#ffe2b0", "#ff9247", "#9fc6ff", "#ff7a70", "#8fe0ad", "#ffa3c8"];

type Bokeh = { position: [number, number, number]; scale: number; material: number };
type Pine = { position: [number, number, number]; scale: [number, number, number] };

export default function SnowGlobeAtmosphere() {
  const assets = useMemo(() => {
    const dot = createDotTexture();
    const pine = createPineTexture();
    const sky = createSkyMaterial();
    // 색마다 진한 것과 옅은 것 두 가지
    const bokehMaterials = BOKEH_COLORS.flatMap((color) =>
      [0.34, 0.16].map(
        (opacity) =>
          new THREE.SpriteMaterial({
            map: dot,
            color,
            opacity,
            transparent: true,
            depthWrite: false,
            fog: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    );
    const pineMaterial = new THREE.SpriteMaterial({ map: pine, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    return { sky, bokehMaterials, pineMaterial };
  }, []);

  const layout = useMemo(() => {
    const random = seededRandom(20261125);
    const pines: Pine[] = [];
    const pineCount = 14;
    for (let i = 0; i < pineCount; i++) {
      const angle = ((i + random() * 0.6) / pineCount) * Math.PI * 2;
      const radius = 8 + random() * 3;
      const height = 5.5 + random() * 3;
      pines.push({
        position: [Math.cos(angle) * radius, -1.1 + height / 2, Math.sin(angle) * radius],
        scale: [height * 0.68, height, 1],
      });
    }
    const bokeh: Bokeh[] = [];
    for (let i = 0; i < 84; i++) {
      const angle = random() * Math.PI * 2;
      const radius = 7.5 + random() * 5.5;
      // 따뜻한 색이 많고, 푸른빛 · 붉은빛 · 초록빛 · 분홍빛이 사이사이 섞임
      const color = random() < 0.68 ? Math.floor(random() * 4) : 4 + Math.floor(random() * 4);
      bokeh.push({
        position: [Math.cos(angle) * radius, -0.9 + random() ** 1.4 * 6.5, Math.sin(angle) * radius],
        scale: 0.45 + random() ** 2 * 1.5,
        material: color * 2 + (random() < 0.5 ? 0 : 1),
      });
    }
    return { pines, bokeh };
  }, []);

  return (
    <group>
      <mesh material={assets.sky} renderOrder={-3}>
        <sphereGeometry args={[40, 32, 16]} />
      </mesh>
      {layout.pines.map((pine, index) => (
        <sprite key={`pine-${index}`} position={pine.position} scale={pine.scale} material={assets.pineMaterial} renderOrder={-2} />
      ))}
      {layout.bokeh.map((light, index) => (
        <sprite
          key={`bokeh-${index}`}
          position={light.position}
          scale={light.scale}
          material={assets.bokehMaterials[light.material]}
          renderOrder={-1}
        />
      ))}
    </group>
  );
}
