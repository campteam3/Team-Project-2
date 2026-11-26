// 배경 음악. 캐롤 두 곡(public/audio)을 무작위로 골라 틀고, 한 곡이 끝나면 다른 곡으로 넘어갑니다.
//
// - 브라우저는 사용자가 화면을 한 번 누르기 전에는 소리를 틀지 못하게 막습니다.
//   그래서 "들어오자마자"가 아니라 "처음 화면을 눌렀을 때" 시작합니다 (components/BgmAutoStart.tsx).
// - 소리를 끄면 그 선택을 이 브라우저에 기억해, 다음에 들어와도 꺼진 채로 둡니다.
// - 다른 탭 · 다른 앱으로 넘어가면 멈추고, 돌아오면 이어서 틉니다.
// - 음량: 파일 자체를 조용하게 맞춰 두었습니다(두 곡 모두 약 -24 LUFS). 아이폰은 코드로 음량을 줄일 수 없어서
//   파일에서 줄였고, 그 밖의 기기에서는 아래 VOLUME 만큼 한 번 더 줄입니다.
// - 곡을 바꾸거나 더할 때는 public/audio 에 파일을 넣고 TRACKS 에 주소를 적으면 됩니다.

const TRACKS = ["/audio/carol-1.mp3", "/audio/carol-2.mp3"];
const VOLUME = 0.6;
const KEY = "snowglobe:bgm";

let audio: HTMLAudioElement | null = null;
let index = -1;
let on = true; // 소리를 켜 둔 상태인지 (실제로 나오는 것은 처음 화면을 누른 뒤)
let loaded = false;
const listeners = new Set<() => void>();

function loadPreference() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    on = window.localStorage.getItem(KEY) !== "off";
  } catch {
    // 저장소를 쓸 수 없으면 켠 상태로 둡니다
  }
}

function savePreference() {
  try {
    if (on) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, "off");
  } catch {
    // 저장하지 못하면 이번 방문에서만 적용됩니다
  }
}

// 지금 곡과 다른 곡을 무작위로 고릅니다
function pickNext() {
  if (TRACKS.length < 2) return 0;
  let next = Math.floor(Math.random() * TRACKS.length);
  if (next === index) next = (next + 1) % TRACKS.length;
  return next;
}

function play() {
  if (typeof window === "undefined") return;
  if (!audio) {
    audio = new Audio();
    audio.preload = "none"; // 틀기 전에는 파일을 받지 않습니다 (첫 화면 로딩에 영향 없음)
    audio.volume = VOLUME;
    audio.addEventListener("ended", () => {
      index = pickNext();
      if (!audio) return;
      audio.src = TRACKS[index];
      void audio.play().catch(() => {});
    });
  }
  if (index < 0) {
    index = pickNext();
    audio.src = TRACKS[index];
  }
  // 브라우저가 막으면(아직 화면을 누르지 않음) 조용히 넘어가고, 다음에 누를 때 다시 시도합니다
  void audio.play().catch(() => {});
}

// 처음 화면을 눌렀을 때 부릅니다. 소리를 꺼 둔 사람에게는 틀지 않습니다.
export function startBgm() {
  loadPreference();
  if (on && document.visibilityState === "visible") play();
}

// 소리 버튼: 켜고 끕니다
export function toggleBgm() {
  loadPreference();
  on = !on;
  savePreference();
  if (on) play();
  else audio?.pause();
  listeners.forEach((listener) => listener());
}

// 다른 탭 · 앱으로 넘어가면 멈추고, 돌아오면 이어서 틉니다
export function syncBgmWithVisibility() {
  if (!audio) return;
  if (document.visibilityState === "hidden") audio.pause();
  else if (on) void audio.play().catch(() => {});
}

// 아래 세 개는 화면에서 켜짐 · 꺼짐 상태를 읽을 때 씁니다 (React 의 useSyncExternalStore)
export function subscribeBgm(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isBgmOn() {
  loadPreference();
  return on;
}

export const isBgmOnServer = () => true;
