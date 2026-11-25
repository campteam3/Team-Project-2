# git.md — 협업 순서

`CLAUDE.md`의 고정 규율을 실제 명령으로 풀어 쓴 문서입니다. 규칙을 바꾸려면 이 파일과 `CLAUDE.md`를 함께 고치는 PR 을 올립니다.

## 브랜치

| 이름 | 브랜치 |
| --- | --- |
| 차명근 | `myeonggeun` |
| 김미영 | `miyoung` |
| 이민정 | `minjeong` |

- 각자 본인 브랜치 하나를 계속 씁니다. `main`에는 PR 로만 들어갑니다.
- 처음 한 번: `git fetch origin` 후 원격에 브랜치가 있으면 `git switch <브랜치>`, 없으면 `git switch -c <브랜치> origin/main`

## 작업 한 바퀴

```bash
# 1. 시작: 최신 내용 받기 + 이슈 확인
git pull origin main
gh issue list --state open          # 본인 이름이 있는 이슈가 있는지 확인

# 2. 작업하고 위임 로그 추가 (docs/위임로그/본인이름.md)

# 3. 커밋
git add -A
git commit -m "feat: 한 줄 설명"

# 4. 올리기 전: 다시 최신 내용 받기 (충돌이 나면 해결하고 커밋)
git pull origin main

# 5. 본인 브랜치로 push
git push origin <본인 브랜치>

# 6. PR (열린 PR 이 없을 때만)
gh pr list --head <본인 브랜치> --state open
gh pr create --base main --title "feat: 한 줄 설명" --body "무엇을 바꿨는지 / Closes #이슈번호"
```

- 커밋 메시지는 `종류: 설명` 정도면 충분합니다 (`feat`, `fix`, `design`, `docs`, `chore`).
- PR 이 머지된 뒤에도 같은 브랜치에서 계속 작업합니다. 다음 작업 전에 `git pull origin main` 만 하면 됩니다.
- 팀장은 PR 을 **"Create a merge commit"** 방식으로 머지합니다. (Squash 로 머지하면 개인 브랜치를 계속 쓸 때 충돌이 생깁니다.)

## 이슈

- 받는 사람 이름을 제목에 넣습니다: `[To 김미영] 오너먼트 색상 값 공유 부탁`
- 본문에는 무엇을, 왜, 언제까지 필요한지와 보내는 사람을 적습니다.
- 올리기 전에 사용자 승인을 받습니다.

```bash
gh issue create --title "[To 이름] 내용" --body "내용 / 보내는 사람: 이름"
gh issue list --state open --search "본인이름"
```

## 충돌

- `git pull origin main` 에서 충돌이 나면 충돌 표시를 정리하고 `git add` → `git commit` 합니다.
- 다른 사람이 만든 부분이라 어느 쪽이 맞는지 모르겠으면 사용자에게 묻거나 이슈로 올립니다.
- `git push --force` 는 쓰지 않습니다.

## 훅이 대신 확인해 주는 것

`.claude/hooks/`의 훅이 에이전트의 명령을 확인합니다.

| 상황 | 훅의 동작 |
| --- | --- |
| 세션 시작 | 작업자 이름 · 브랜치 · 위임 로그 파일을 알려 줌. 이름이 없으면 먼저 묻게 함 |
| `git commit` | main 에서의 커밋을 막음. 위임 로그가 아직 없으면 알려 줌 |
| `git push` | main 으로의 push, 남의 브랜치에서의 push, pull 하지 않은 push, 위임 로그 없는 push 를 막음 |
| `gh issue create` | 받는 팀원 이름이 없으면 막음. 있으면 사용자 승인 창을 띄움 |

훅은 에이전트가 실행하는 명령만 확인합니다. 터미널에서 직접 친 명령은 확인하지 않습니다.
