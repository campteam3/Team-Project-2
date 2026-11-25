// 훅 공용 도우미: 팀 정보, 현재 작업자, git 실행
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ME_FILE = '.claude/me.json';

export function loadTeam() {
  try {
    return JSON.parse(readFileSync(join(ROOT, '.claude', 'team.json'), 'utf8')).members ?? [];
  } catch {
    return [];
  }
}

// .claude/me.json 의 이름으로 팀원을 찾는다. 없거나 팀에 없는 이름이면 null.
export function loadMe() {
  const file = join(ROOT, ME_FILE);
  if (!existsSync(file)) return null;
  try {
    const name = String(JSON.parse(readFileSync(file, 'utf8')).name ?? '').trim();
    return loadTeam().find((m) => m.name === name) ?? null;
  } catch {
    return null;
  }
}

// 실패하면 null 을 돌려준다 (훅이 git 오류 때문에 작업을 막지 않도록).
export function git(args, timeout = 10000) {
  try {
    return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export const nfc = (s) => s.normalize('NFC');

// 공개 저장소라서 커밋에 개인 이메일이 남지 않게 한다.
export const NOREPLY_SUFFIX = '@users.noreply.github.com';
export const emailIsPrivate = () => (git(['config', 'user.email']) ?? '').endsWith(NOREPLY_SUFFIX);
export const EMAIL_SETUP_MESSAGE = [
  '이 저장소는 공개 저장소라서 커밋에 개인 이메일이 남지 않게 해야 합니다.',
  '- gh api user 로 본인의 id 와 login 을 확인하세요.',
  `- git config user.email "<id>+<login>${NOREPLY_SUFFIX}" 를 실행하세요. (--global 없이, 이 저장소에만 적용)`,
].join('\n');

export function readHookInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

export function nameSetupMessage() {
  const list = loadTeam()
    .map((m) => `${m.name}(브랜치 ${m.branch})`)
    .join(' / ');
  return [
    '작업자 이름이 아직 설정되지 않았습니다.',
    `1) 사용자에게 이름을 물어보세요: ${list}`,
    `2) ${ME_FILE} 파일에 {"name": "이름"} 을 저장하세요. (이 파일은 git에 올라가지 않습니다)`,
    '3) 본인 브랜치로 전환하세요: git fetch origin 후, 원격에 브랜치가 있으면 git switch <브랜치>, 없으면 git switch -c <브랜치> origin/main',
  ].join('\n');
}
