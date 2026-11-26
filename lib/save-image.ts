// 스노우볼을 이미지로 저장합니다. (FEEDBACK E4)
//
// 3D 무대(canvas)에 지금 보이는 모습을 그대로 한 장으로 만듭니다. 배경 · 스노우볼 · 오너먼트 · 명판 이름이 담기고,
// 제목 · 버튼 같은 화면 글자는 담기지 않습니다. 아래쪽에 서비스 주소를 작게 적습니다.
//  - PC: 파일로 내려받습니다.
//  - 휴대폰: 기본 공유 창을 엽니다 (여기서 "이미지 저장"이나 카카오톡을 고를 수 있음).
//    공유 창을 열 수 없는 브라우저에서는 이미지를 화면에 띄워 길게 눌러 저장하게 합니다 (Stage 가 처리).

import { SITE_URL } from "@/lib/site";

export type SaveResult =
  | { status: "downloaded" } // 파일로 내려받음
  | { status: "shared" } // 공유 창을 열었고 사용자가 저장 · 공유를 마침
  | { status: "cancelled" } // 공유 창을 그냥 닫음
  | { status: "show"; url: string } // 공유 창을 열 수 없어 이미지를 화면에 띄워야 함 (url 은 다 쓰면 URL.revokeObjectURL 로 지웁니다)
  | { status: "failed" };

const BACKDROP = "#1b2a53"; // 3D 배경의 가장자리 색 (globals.css 의 --color-night-sky)
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

// 3D 화면은 한 장을 그린 직후에만 내용을 읽을 수 있습니다. 그리는 순서 바로 뒤에 끼어들어 2D 캔버스로 옮겨 그립니다.
// 빈 화면이 잡히면(아직 그리기 전) 다음 장에서 다시 시도합니다.
async function grab(source: HTMLCanvasElement): Promise<HTMLCanvasElement | null> {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  const context = copy.getContext("2d", { willReadFrequently: true });
  if (!context || !copy.width || !copy.height) return null;

  for (let attempt = 0; attempt < 4; attempt++) {
    await nextFrame();
    context.clearRect(0, 0, copy.width, copy.height);
    context.drawImage(source, 0, 0);
    let filled = false;
    for (let i = 1; i <= 3 && !filled; i++) {
      for (let j = 1; j <= 3 && !filled; j++) {
        const pixel = context.getImageData(Math.floor((copy.width * i) / 4), Math.floor((copy.height * j) / 4), 1, 1).data;
        filled = pixel[3] > 0;
      }
    }
    if (filled) return copy;
  }
  return null;
}

function toBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

// 파일 이름에 쓸 수 없는 글자를 뺍니다
function fileName(name: string) {
  const safe = name.replace(/[\\/:*?"<>|]/g, "").trim() || "스노우볼";
  return `${safe}.jpg`;
}

export async function saveGlobeImage(source: HTMLCanvasElement, name: string): Promise<SaveResult> {
  try {
    const canvas = await grab(source);
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return { status: "failed" };

    // 투명한 곳이 없도록 뒤에 배경색을 깔고, 아래쪽에 서비스 주소를 작게 적습니다
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = BACKDROP;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-over";
    const size = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) * 0.026));
    context.font = `600 ${size}px Pretendard, "Pretendard Variable", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.shadowColor = "rgba(0, 0, 0, 0.5)";
    context.shadowBlur = size * 0.4;
    context.fillStyle = "rgba(245, 241, 234, 0.8)";
    context.fillText(SITE_URL.replace(/^https?:\/\//, ""), canvas.width / 2, canvas.height - size * 1.4);

    const blob = await toBlob(canvas);
    if (!blob) return { status: "failed" };
    const file = new File([blob], fileName(name), { type: "image/jpeg" });

    // 휴대폰: 기본 공유 창 (여기서 "이미지 저장"을 고릅니다)
    const phone = window.matchMedia("(pointer: coarse)").matches;
    if (phone) {
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: name });
          return { status: "shared" };
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return { status: "cancelled" };
          // 공유 창이 막힌 경우(앱 안 브라우저 등)에는 아래에서 이미지를 화면에 띄웁니다
        }
      }
      return { status: "show", url: URL.createObjectURL(blob) };
    }

    // PC: 파일로 내려받기
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return { status: "downloaded" };
  } catch {
    return { status: "failed" };
  }
}
