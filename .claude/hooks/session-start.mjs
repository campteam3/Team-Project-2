#!/usr/bin/env node
// SessionStart 훅: 지금 작업자가 누구인지, 작업 준비가 되었는지 에이전트에게 알려 준다.
// 이름이 없으면 먼저 이름을 묻게 한다.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, git, loadMe, nameSetupMessage } from './team.mjs';

const runs = (cmd, args) => {
  try {
    execFileSync(cmd, args, { stdio: 'ignore', timeout: 8000 });
    return true;
  } catch {
    return false;
  }
};

// 작업 준비 상태 확인 (문제가 있는 것만 알린다)
const setup = [];
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) {
  setup.push(`Node.js 버전이 낮습니다 (지금 ${process.versions.node}, 20 이상 필요). 사용자에게 알리고 LTS 버전으로 올리세요.`);
}
if (!runs('gh', ['--version'])) {
  setup.push('GitHub CLI(gh)가 설치되어 있지 않습니다. 사용자에게 알리고 설치한 뒤 gh auth login 을 안내하세요. (Windows: winget install GitHub.cli / Mac: brew install gh)');
} else if (!runs('gh', ['auth', 'status'])) {
  setup.push('GitHub CLI 로그인이 되어 있지 않습니다. 작업 전에 사용자에게 터미널에서 gh auth login 을 실행하도록 안내하세요. (로그인은 사용자가 직접 합니다)');
}
if (existsSync(join(ROOT, 'package.json')) && !existsSync(join(ROOT, 'node_modules', 'next'))) {
  setup.push('패키지가 설치되어 있지 않습니다. npm install 을 실행하세요.');
}

const me = loadMe();
const lines = [];

if (!me) {
  lines.push(`[팀 프로젝트] ${nameSetupMessage()}`, '이름 설정이 끝나기 전에는 다른 작업을 시작하지 마세요.');
} else {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  lines.push(
    `[팀 프로젝트] 작업자: ${me.name} (${me.role})`,
    `- 담당: ${me.focus}`,
    `- 본인 브랜치: ${me.branch}`,
    `- 위임 로그: ${me.log}`,
  );
  if (branch && branch !== me.branch) {
    lines.push(`- 주의: 지금 브랜치는 ${branch} 입니다. 작업 전에 ${me.branch} 로 전환하세요.`);
  }
  lines.push(
    `- 작업을 시작하기 전에: git pull origin main 으로 최신 내용을 받고, gh issue list --state open --search "${me.name}" 로 본인 이름이 들어간 이슈가 있는지 확인해 사용자에게 알려 주세요.`,
    '- 이번에 무슨 작업을 할지는 작업자가 직접 알려 줍니다. 아직 듣지 못했다면 먼저 물어보세요.',
  );
}

if (setup.length > 0) {
  lines.push('[작업 준비 확인] 아래 문제를 먼저 해결하세요.', ...setup.map((s) => `- ${s}`));
}

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') },
  }),
);
