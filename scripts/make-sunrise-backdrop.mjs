// 새해 스노우볼의 일출 배경 그림(public/backgrounds/sunrise-web.svg · sunrise-mobile.svg)을 만듭니다. (차명근)
// 사진이나 받은 그림을 쓰지 않고 코드로 그린 그림입니다: 새벽 하늘, 산등성이 위로 떠오르는 해, 겹겹의 산, 기와지붕 실루엣.
// 색이나 모양을 바꾸려면 여기 값을 고치고 `node scripts/make-sunrise-backdrop.mjs` 를 다시 돌립니다.
// 글자(제목 · 버튼)가 놓이는 위쪽과 아래쪽은 어둡게 둡니다.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "backgrounds");

// 늘 같은 그림이 나오게 씨앗을 정한 난수
function random(seed) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

// 산등성이: 왼쪽 끝에서 오른쪽 끝까지 부드럽게 오르내리는 선 아래를 채웁니다
function ridge(width, height, baseline, rise, bumps, seed) {
  const next = random(seed);
  const points = Array.from({ length: bumps + 1 }, (_, i) => [(width * i) / bumps, baseline - rise * (0.25 + 0.75 * next())]);
  let d = `M0 ${height} L0 ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const mid = (x0 + x1) / 2;
    d += ` C${mid.toFixed(1)} ${y0.toFixed(1)} ${mid.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return `${d} L${width} ${height} Z`;
}

// 기와지붕 실루엣: 처마 끝이 살짝 들린 지붕과 그 아래 몸채
function roof(x, y, w, h) {
  const eave = w * 0.62;
  return (
    `M${x - eave} ${y} Q${x - eave * 0.55} ${y - h * 0.18} ${x - w * 0.3} ${y - h * 0.7} Q${x} ${y - h * 0.86} ${x + w * 0.3} ${y - h * 0.7} ` +
    `Q${x + eave * 0.55} ${y - h * 0.18} ${x + eave} ${y} L${x + w * 0.42} ${y + h * 0.1} L${x + w * 0.42} ${y + h * 1.2} L${x - w * 0.42} ${y + h * 1.2} L${x - w * 0.42} ${y + h * 0.1} Z`
  );
}

function sunrise(width, height) {
  const horizon = height * 0.6; // 해가 걸린 산등성이 높이
  const sun = { x: width * 0.5, y: horizon - height * 0.015, r: Math.min(width, height) * 0.085 };
  const unit = Math.min(width, height);
  const next = random(27);
  const stars = Array.from({ length: 46 }, () => {
    const x = next() * width;
    const y = next() * height * 0.3;
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(0.8 + next() * 1.4).toFixed(1)}" opacity="${(0.25 + next() * 0.5).toFixed(2)}"/>`;
  }).join("");
  const clouds = [
    [0.2, 0.36, 0.2],
    [0.78, 0.31, 0.24],
    [0.62, 0.45, 0.16],
    [0.1, 0.49, 0.13],
    [0.9, 0.5, 0.12],
  ]
    .map(([cx, cy, w]) => `<ellipse cx="${(cx * width).toFixed(0)}" cy="${(cy * height).toFixed(0)}" rx="${(w * width).toFixed(0)}" ry="${(unit * 0.012).toFixed(0)}"/>`)
    .join("");
  const roofs = [
    [0.1, 0.845, 0.22, 0.07],
    [0.3, 0.875, 0.15, 0.05],
    [0.88, 0.84, 0.24, 0.075],
    [0.7, 0.878, 0.14, 0.048],
  ]
    .map(([cx, cy, w, h]) => `<path d="${roof(cx * width, cy * height, w * unit * 1.6, h * unit * 1.5)}"/>`)
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#111433"/><stop offset="0.22" stop-color="#2a2152"/><stop offset="0.38" stop-color="#6b3564"/>
<stop offset="0.5" stop-color="#c2546a"/><stop offset="0.57" stop-color="#ee8552"/><stop offset="0.62" stop-color="#ffc56e"/><stop offset="1" stop-color="#ffc56e"/>
</linearGradient>
<radialGradient id="glow" cx="${sun.x}" cy="${sun.y}" r="${unit * 0.62}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#fff2c4" stop-opacity="0.95"/><stop offset="0.16" stop-color="#ffd27a" stop-opacity="0.6"/>
<stop offset="0.45" stop-color="#ff9a5c" stop-opacity="0.22"/><stop offset="1" stop-color="#ff9a5c" stop-opacity="0"/>
</radialGradient>
<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a2e"/><stop offset="1" stop-color="#150f1f"/></linearGradient>
<linearGradient id="haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb37a" stop-opacity="0.34"/><stop offset="1" stop-color="#ffb37a" stop-opacity="0"/></linearGradient>
<filter id="soft" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="${(unit * 0.012).toFixed(1)}"/></filter>
</defs>
<rect width="${width}" height="${height}" fill="url(#sky)"/>
<g fill="#fff6dc">${stars}</g>
<rect width="${width}" height="${height}" fill="url(#glow)"/>
<g fill="#ffd9a8" opacity="0.5" filter="url(#soft)">${clouds}</g>
<circle cx="${sun.x}" cy="${sun.y}" r="${sun.r}" fill="#fff4cf"/>
<path d="${ridge(width, height, horizon + unit * 0.03, unit * 0.11, 7, 11)}" fill="#a2566a"/>
<path d="${ridge(width, height, horizon + unit * 0.1, unit * 0.12, 6, 5)}" fill="#6d3d5c"/>
<rect y="${horizon}" width="${width}" height="${unit * 0.22}" fill="url(#haze)"/>
<path d="${ridge(width, height, horizon + unit * 0.2, unit * 0.11, 5, 42)}" fill="#432a4b"/>
<path d="${ridge(width, height, height * 0.86, unit * 0.05, 4, 8)}" fill="url(#ground)"/>
<g fill="#1c1426">${roofs}</g>
<rect y="${height * 0.9}" width="${width}" height="${height * 0.1}" fill="#150f1f"/>
</svg>
`;
}

await writeFile(path.join(OUT, "sunrise-web.svg"), sunrise(1672, 941));
await writeFile(path.join(OUT, "sunrise-mobile.svg"), sunrise(941, 1672));
console.log("[일출 배경] public/backgrounds/sunrise-web.svg · sunrise-mobile.svg 를 만들었습니다.");
