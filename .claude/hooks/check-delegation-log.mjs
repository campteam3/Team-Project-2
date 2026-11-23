#!/usr/bin/env node
// 커밋 전 위임 로그 확인 훅 (Claude Code PreToolUse)
// git commit 을 실행하려 할 때 docs/위임로그/ 에 변경이 없으면 커밋을 막고 이유를 알려 준다.
// 커밋 메시지에 [no-log] 가 있으면 통과.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const LOG_DIR = 'docs/위임로그/';
const TEMPLATE = '_양식.md';

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // 입력을 못 읽으면 막지 않는다
}

const command = input?.tool_input?.command ?? '';
const isCommit = /\bgit\b[^\n;&|]*\bcommit\b/.test(command);
if (!isCommit || command.includes('[no-log]')) process.exit(0);

const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
let status;
try {
  status = execFileSync(
    'git',
    ['-c', 'core.quotepath=false', 'status', '--porcelain', '--untracked-files=all'],
    { cwd, encoding: 'utf8' },
  );
} catch {
  process.exit(0); // git 저장소가 아니면 막지 않는다
}

const changed = status
  .split('\n')
  .filter(Boolean)
  .map((line) => line.slice(3).split(' -> ').pop().replace(/^"|"$/g, '').normalize('NFC'));

const logUpdated = changed.some((p) => p.startsWith(LOG_DIR) && !p.endsWith(TEMPLATE));
if (logUpdated) process.exit(0);

console.error(
  [
    '커밋이 보류되었습니다: 위임 로그에 변경이 없습니다.',
    `- 이번 작업 내용을 작업자 본인의 ${LOG_DIR}(이름).md 맨 아래에 추가한 뒤 다시 커밋하세요. (양식: ${LOG_DIR}${TEMPLATE}, 규칙: CLAUDE.md)`,
    '- 로그를 쓸 일이 아닌 커밋(오타, 설정, 문서 정리, 같은 작업의 후속 커밋)이면 커밋 메시지에 [no-log] 를 넣어 다시 실행하세요.',
  ].join('\n'),
);
process.exit(2);
