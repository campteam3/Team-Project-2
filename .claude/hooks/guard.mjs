#!/usr/bin/env node
// PreToolUse 훅 (Bash · PowerShell): 팀의 고정 규율을 확인한다.
//  - git commit : main 에서의 커밋을 막고, 위임 로그가 비어 있으면 알려 준다 (막지는 않음)
//  - git push   : 본인 브랜치인지, main 최신 내용을 받았는지, 위임 로그를 남겼는지 확인 (어기면 막음)
//  - gh issue create : 받는 팀원 이름이 있는지 확인하고, 사용자 승인을 받게 한다
import { git, loadMe, loadTeam, nameSetupMessage, nfc, readHookInput } from './team.mjs';

const input = readHookInput();
const command = input?.tool_input?.command ?? '';

const isCommit = /\bgit\b[^\n;&|]*\bcommit\b/.test(command);
const isPush = /\bgit\b[^\n;&|]*\bpush\b/.test(command);
const isIssueCreate = /\bgh\s+issue\s+create\b/.test(command);
if (!isCommit && !isPush && !isIssueCreate) process.exit(0);

const block = (lines) => {
  console.error([].concat(lines).join('\n'));
  process.exit(2);
};
const respond = (hookSpecificOutput) => {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...hookSpecificOutput } }));
  process.exit(0);
};

// ── 이슈 만들기 ─────────────────────────────────────────────
if (isIssueCreate) {
  const names = loadTeam().map((m) => m.name);
  if (!names.some((n) => nfc(command).includes(n))) {
    block([
      '이슈가 보류되었습니다: 받는 팀원 이름이 없습니다.',
      `- 제목을 "[To 이름] 내용" 형식으로 쓰세요. 팀원: ${names.join(', ')}`,
    ]);
  }
  respond({
    permissionDecision: 'ask',
    permissionDecisionReason: '팀 규율: 이슈를 올리기 전에 사용자 승인이 필요합니다. 제목과 내용을 확인해 주세요.',
  });
}

// ── 커밋 · push 공통 ────────────────────────────────────────
const me = loadMe();
if (!me) block(['보류되었습니다.', nameSetupMessage()]);

const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const changedInTree = () =>
  (git(['status', '--porcelain', '--untracked-files=all']) ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => nfc(line.slice(3).split(' -> ').pop().replace(/^"|"$/g, '')));
const changedSinceMain = () =>
  (git(['diff', '--name-only', 'origin/main...HEAD']) ?? '').split('\n').filter(Boolean).map(nfc);

if (isCommit) {
  if (branch === 'main' || branch === 'master') {
    block([
      `커밋이 보류되었습니다: main 에서는 커밋하지 않습니다.`,
      `- 본인 브랜치로 옮기세요: git switch ${me.branch} (없으면 git switch -c ${me.branch})`,
    ]);
  }
  const logTouched = changedInTree().includes(me.log) || changedSinceMain().includes(me.log);
  if (!logTouched && !isPush) {
    respond({
      additionalContext: `알림: 아직 ${me.log} 에 이번 작업 기록이 없습니다. push 하기 전에 위임 로그 항목을 추가해야 합니다 (없으면 push 가 막힙니다).`,
    });
  }
  if (!isPush) process.exit(0);
}

// ── push ────────────────────────────────────────────────────
if (/\bgit\b[^\n;&|]*\bpush\b[^\n;&|]*\b(main|master)\b/.test(command) || branch === 'main' || branch === 'master') {
  block([
    'push 가 보류되었습니다: main 에 직접 올리지 않습니다.',
    `- 본인 브랜치(${me.branch})에 push 한 뒤 PR 을 올리세요.`,
  ]);
}
if (branch && branch !== me.branch) {
  block([
    `push 가 보류되었습니다: 지금 브랜치(${branch})가 ${me.name} 님의 브랜치(${me.branch})가 아닙니다.`,
    `- git switch ${me.branch} 로 옮긴 뒤 작업 내용을 그 브랜치에 담아 push 하세요.`,
  ]);
}

git(['fetch', 'origin', 'main'], 25000); // 실패해도 계속 (오프라인 등)
const hasMain = git(['rev-parse', '--verify', '--quiet', 'origin/main']) !== null;
if (hasMain) {
  const upToDate = git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']) !== null;
  if (!upToDate) {
    block([
      'push 가 보류되었습니다: main 의 최신 내용을 아직 받지 않았습니다.',
      '- 먼저 git pull origin main 을 따로 실행하세요. 충돌이 나면 해결하고 커밋한 뒤 다시 push 하세요.',
      '- pull 한 김에 열린 이슈도 확인하세요.',
    ]);
  }
  const files = changedSinceMain();
  if (files.length > 0 && !files.includes(me.log)) {
    block([
      `push 가 보류되었습니다: 이번에 올리는 작업에 대한 위임 로그가 없습니다.`,
      `- ${me.log} 맨 아래에 이번 작업 항목(목표 · 프롬프트 · 결과 · 검증 · 수정 · 배운 점)을 추가하고 커밋한 뒤 다시 push 하세요.`,
    ]);
  }
}

respond({
  additionalContext: `push 후 할 일: gh pr list --head ${me.branch} --state open 으로 열린 PR 을 확인하고, 없으면 gh pr create --base main 으로 PR 을 올리세요. PR 주소를 사용자에게 알려 주세요.`,
});
