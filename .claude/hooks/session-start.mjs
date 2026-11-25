#!/usr/bin/env node
// SessionStart 훅: 지금 작업자가 누구인지 에이전트에게 알려 준다.
// 이름이 없으면 먼저 이름을 묻게 한다.
import { git, loadMe, nameSetupMessage } from './team.mjs';

const me = loadMe();
let text;

if (!me) {
  text = `[팀 프로젝트] ${nameSetupMessage()}\n이름 설정이 끝나기 전에는 다른 작업을 시작하지 마세요.`;
} else {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const lines = [
    `[팀 프로젝트] 작업자: ${me.name} (${me.role})`,
    `- 담당: ${me.focus}`,
    `- 본인 브랜치: ${me.branch}`,
    `- 위임 로그: ${me.log}`,
  ];
  if (branch && branch !== me.branch) {
    lines.push(`- 주의: 지금 브랜치는 ${branch} 입니다. 작업 전에 ${me.branch} 로 전환하세요.`);
  }
  lines.push(
    `- 작업을 시작하기 전에: git pull origin main 으로 최신 내용을 받고, gh issue list --state open --search "${me.name}" 로 본인 이름이 들어간 이슈가 있는지 확인해 사용자에게 알려 주세요.`,
  );
  text = lines.join('\n');
}

console.log(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text },
  }),
);
