// 글자를 클립보드에 복사합니다. 성공하면 true.
// 1) 브라우저의 복사 기능(navigator.clipboard): https 주소에서만 됩니다.
// 2) 안 되면 예전 방식(보이지 않는 입력칸을 골라 복사): http 주소나 앱 안 브라우저에서도 대개 됩니다.
// 둘 다 버튼을 누른 바로 그 동작 안에서 불러야 합니다.

function copyByInput(text: string) {
  const input = document.createElement("textarea");
  input.value = text;
  input.readOnly = true; // 화면 키보드가 올라오지 않게
  input.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px";
  document.body.appendChild(input);
  try {
    input.focus({ preventScroll: true });
    input.setSelectionRange(0, text.length); // 아이폰은 select() 만으로는 골라지지 않을 때가 있습니다
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    input.remove();
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 권한이 없거나 막힌 경우 아래 방식으로 넘어갑니다
  }
  return copyByInput(text);
}

// 복사가 끝내 안 되면 링크를 직접 골라 복사할 수 있는 창을 띄웁니다.
// "링크를 길게 눌러 복사" 같은 안내는 링크가 화면에 안 보이는 곳에서는 뜻이 통하지 않아서 이렇게 합니다.
export function showLinkToCopy(text: string) {
  window.prompt("아래 링크를 복사해 주세요", text);
}
