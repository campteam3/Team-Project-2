/**
 * 축하 메시지 설문을 구글 설문지로 만들어 주는 Apps Script 입니다.
 *
 * 쓰는 방법
 *  1. https://script.google.com 에서 "새 프로젝트"를 만듭니다.
 *  2. 이 파일 내용을 전부 붙여 넣고 저장합니다.
 *  3. 위쪽에서 createSurvey 를 고르고 "실행"을 누릅니다. 처음에는 권한 승인을 묻습니다.
 *  4. 아래 "실행 로그"에 설문 수정 링크와 응답 링크가 나옵니다.
 *
 * 한 번 실행할 때마다 설문이 하나씩 새로 만들어집니다.
 */

// 예시 이미지 (내 구글 드라이브에 올려 둔 파일). 다른 이미지로 바꾸려면 파일 ID 를 바꿉니다.
const IMAGE_FILE_ID = '1iyJgLwqjrtRqdp236zj0dtBoOo1oZDTT';

// 8번(친구에게 부탁) 보기
const ASK_CHOICES = [
  '해 볼 것이다',
  '생일이나 연말 같은 특별한 날이라면 해 볼 것이다',
  '친구가 대신 만들어 주면 좋겠다',
  '부탁하기가 민망해서 안 할 것 같다',
  '관심 없다',
];
// 9번(이미지를 본 뒤) 문구. 5점 척도로 묻습니다.
const IMAGE_QUESTION = '메시지가 이렇게 스노우볼 속 장식으로 모인다면, 받고 싶은 마음이 어떻게 달라지나요?';
const IMAGE_QUESTION_HELP = '1 = 많이 줄어든다 · 3 = 달라지지 않는다 · 5 = 많이 커진다';

function createSurvey() {
  const form = FormApp.create('축하 메시지, 어떻게 주고받으세요? (3분 설문)');
  form
    .setDescription(
      '친구들과 축하 메시지를 주고받는 방법에 대한 짧은 설문입니다. 3분이면 끝나요.\n' +
        '이름이나 연락처는 받지 않습니다. 응답은 팀 프로젝트의 기획 참고용으로만 씁니다.',
    )
    .setCollectEmail(false)
    .setProgressBar(true)
    .setConfirmationMessage('응답해 주셔서 고맙습니다. 따뜻한 연말 보내세요.');

  const choice = (title, options, { other = false, required = true } = {}) => {
    const item = form.addMultipleChoiceItem().setTitle(title).setRequired(required);
    item.setChoiceValues(options);
    if (other) item.showOtherOption(true);
    return item;
  };
  const checks = (title, options, { other = false, required = true, atMost = 0, help = '' } = {}) => {
    const item = form.addCheckboxItem().setTitle(title).setRequired(required);
    item.setChoiceValues(options);
    if (other) item.showOtherOption(true);
    if (help) item.setHelpText(help);
    if (atMost > 0) {
      item.setValidation(
        FormApp.createCheckboxValidation()
          .setHelpText(atMost + '개까지 골라 주세요.')
          .requireSelectAtMost(atMost)
          .build(),
      );
    }
    return item;
  };

  // ── 응답자 ────────────────────────────────────────────────
  choice('1. 나이대를 알려 주세요.', ['20~24', '25~29', '30~34', '35 이상']);

  // ── A. 지금까지의 경험 ────────────────────────────────────
  form.addSectionHeaderItem().setTitle('지금까지의 경험');

  checks(
    '2. 최근 1년 동안 어떤 일로 축하나 기념 메시지를 보냈나요?',
    ['생일', '새해 · 명절', '크리스마스 · 연말', '졸업 · 수료 · 합격', '취업 · 이직 · 퇴사', '결혼 · 출산', '보낸 적 없다'],
    { other: true, help: '해당하는 것을 모두 골라 주세요.' },
  );
  choice(
    '3. 그때 주로 어떤 방법을 썼나요?',
    ['카카오톡 개인 메시지', '단톡방', '인스타그램 등 SNS', '손편지 · 카드', '온라인 롤링페이퍼'],
    { other: true },
  );
  checks(
    '4. 메시지를 보낼 때 아쉬웠던 점이 있나요?',
    [
      '텍스트만으로는 마음을 전하기 어렵다',
      '뭐라고 써야 할지 모르겠다',
      '다른 사람들 메시지에 묻힌다',
      '단톡방에서는 남들이 다 봐서 부담된다',
      '금방 지나가 버려 기억에 남지 않는다',
      '아쉬운 점이 없었다',
    ],
    { help: '해당하는 것을 모두 골라 주세요.' },
  );
  choice('5. 내가 받은 축하 메시지를 나중에 다시 찾아본 적이 있나요?', ['여러 번 있다', '한두 번 있다', '없다']);
  choice(
    '6. 다시 보지 않았다면 이유는 무엇인가요?',
    ['어디 있는지 찾기 어렵다', '여기저기 흩어져 있다', '다시 볼 계기가 없다'],
    { other: true, required: false },
  ).setHelpText('5번에서 "없다"를 고른 분만 답해 주세요.');

  // ── B-1. 이런 것이 있다면 (형태는 아직 밝히지 않음) ───────
  form.addPageBreakItem().setTitle('이런 것이 있다면');

  form
    .addScaleItem()
    .setTitle('7. 지인들에게 받은 축하 메시지를 한곳에 모아 한눈에 보고, 기념품처럼 간직할 수 있다면 어떨 것 같나요?')
    .setBounds(1, 5)
    .setLabels('전혀 필요 없다', '꼭 갖고 싶다')
    .setRequired(true);
  choice(
    '8. 그런 것을 받으려면 내가 친구들에게 링크를 보내 메시지를 부탁해야 합니다. 그래도 해 볼 건가요?',
    ASK_CHOICES,
  );

  // ── B-2. 예시 이미지를 보고 ──────────────────────────────
  form.addPageBreakItem().setTitle('예시 이미지를 보고 답해 주세요');

  const image = form
    .addImageItem()
    .setTitle('친구들이 보낸 메시지가 스노우볼 속 트리의 장식으로 하나씩 달립니다')
    .setHelpText('장식을 누르면 메시지를 읽을 수 있어요. ※ 예시 이미지이며 실제 화면과 다를 수 있습니다.');
  try {
    image.setImage(DriveApp.getFileById(IMAGE_FILE_ID).getBlob()).setWidth(420);
  } catch (error) {
    Logger.log('이미지를 넣지 못했습니다. 설문 수정 화면에서 직접 넣어 주세요: ' + error);
  }

  form
    .addScaleItem()
    .setTitle('9. ' + IMAGE_QUESTION)
    .setHelpText(IMAGE_QUESTION_HELP)
    .setBounds(1, 5)
    .setLabels('많이 줄어든다', '많이 커진다')
    .setRequired(true);
  form
    .addParagraphTextItem()
    .setTitle('10. 걱정되거나 귀찮을 것 같은 점이 있다면 적어 주세요.')
    .setHelpText('없으면 비워 두셔도 됩니다.')
    .setRequired(false);

  // ── C. 어떻게 만들면 좋을까요 ─────────────────────────────
  form.addPageBreakItem().setTitle('어떻게 만들면 좋을까요');

  choice('11. 받은 메시지는 언제 읽고 싶나요?', ['달리는 대로 바로', '정해진 날에 한꺼번에', '내가 고르고 싶다']);
  choice('12. 메시지를 남길 때 이름은 어떻게 하고 싶나요?', ['이름을 밝힌다', '익명으로 남긴다', '그때그때 고르고 싶다']);
  checks(
    '13. 있으면 좋겠는 기능을 3개까지 골라 주세요.',
    [
      '장식 모양과 색 고르기',
      '장식을 달 위치 직접 고르기',
      '스노우볼 꾸미기',
      '배경 음악',
      '새 메시지 알림',
      '이미지로 저장해 공유',
      '메시지에 답장',
      '메시지에 사진 넣기',
    ],
    { atMost: 3 },
  );

  // 응답을 스프레드시트로 모읍니다.
  const sheet = SpreadsheetApp.create('축하 메시지 설문 (응답)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('설문 수정 링크: ' + form.getEditUrl());
  Logger.log('응답 링크(동기들에게 보낼 주소): ' + form.getPublishedUrl());
  Logger.log('응답 스프레드시트: ' + sheet.getUrl());
}

/**
 * 이미 만든 설문지에서 성별 문항을 빼고 번호를 하나씩 당깁니다.
 * 응답 링크는 그대로 유지됩니다. 한 번만 실행하세요.
 * (성별 문항이 없는 설문지에서는 아무것도 바꾸지 않습니다.)
 */
function removeGenderQuestion() {
  const FORM_TITLE = '축하 메시지, 어떻게 주고받으세요? (3분 설문)';
  const files = DriveApp.getFilesByName(FORM_TITLE);
  let changed = 0;

  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() !== 'application/vnd.google-apps.form' || file.isTrashed()) continue;

    const form = FormApp.openById(file.getId());
    const items = form.getItems();
    const gender = items.find((item) => item.getTitle().indexOf('성별') !== -1);
    if (!gender) {
      Logger.log('성별 문항이 없어 건너뜁니다: ' + form.getEditUrl());
      continue;
    }
    form.deleteItem(gender);

    // 남은 문항의 번호를 하나씩 당깁니다. (예: "2. 나이대…" → "1. 나이대…")
    form.getItems().forEach((item) => {
      const match = item.getTitle().match(/^(\d+)\.\s(.*)$/);
      if (match) item.setTitle(Number(match[1]) - 1 + '. ' + match[2]);
      const help = item.getHelpText();
      if (help && help.indexOf('6번에서') !== -1) item.setHelpText(help.replace('6번에서', '5번에서'));
    });

    changed++;
    Logger.log('성별 문항을 뺐습니다: ' + form.getEditUrl());
  }

  if (changed === 0) Logger.log('바꾼 설문지가 없습니다. 설문지 제목이 바뀌었는지 확인해 주세요.');
}

/**
 * 이미 만든 설문지에 두 가지 수정을 반영합니다. 응답 링크는 그대로 유지됩니다.
 *  - "친구에게 부탁" 문항의 보기를 새 보기로 바꿉니다.
 *  - 이미지를 본 뒤의 문항을 3단계 선택에서 5점 척도로 바꿉니다.
 * 문항 앞 번호는 지금 설문지에 적힌 번호를 그대로 씁니다. 여러 번 실행해도 됩니다.
 * 주의: 척도로 바꾸는 문항은 새로 만들어지므로, 그 문항에 이미 들어온 응답은 사라집니다.
 */
function applyRevision2() {
  const FORM_TITLE = '축하 메시지, 어떻게 주고받으세요? (3분 설문)';
  const files = DriveApp.getFilesByName(FORM_TITLE);
  let changed = 0;

  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() !== 'application/vnd.google-apps.form' || file.isTrashed()) continue;
    const form = FormApp.openById(file.getId());

    // 1) 친구에게 부탁하는 문항의 보기
    const ask = form.getItems().find((item) => item.getTitle().indexOf('부탁해야 합니다') !== -1);
    if (ask && ask.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      ask.asMultipleChoiceItem().setChoiceValues(ASK_CHOICES);
      Logger.log('보기를 바꿨습니다: ' + ask.getTitle());
    } else {
      Logger.log('"친구에게 부탁" 문항을 찾지 못했습니다.');
    }

    // 2) 이미지를 본 뒤의 문항을 5점 척도로
    const old = form.getItems().find((item) => item.getTitle().indexOf('받고 싶은 마음이 어떻게 달라지나요') !== -1);
    if (!old) {
      Logger.log('"받고 싶은 마음" 문항을 찾지 못했습니다.');
    } else if (old.getType() === FormApp.ItemType.SCALE) {
      Logger.log('이미 척도 문항입니다: ' + old.getTitle());
    } else {
      const title = old.getTitle();
      const index = old.getIndex();
      form.deleteItem(old);
      const scale = form
        .addScaleItem()
        .setTitle(title)
        .setHelpText(IMAGE_QUESTION_HELP)
        .setBounds(1, 5)
        .setLabels('많이 줄어든다', '많이 커진다')
        .setRequired(true);
      form.moveItem(scale.getIndex(), index);
      Logger.log('5점 척도로 바꿨습니다: ' + title);
    }

    changed++;
    Logger.log('반영한 설문지: ' + form.getEditUrl());
  }

  if (changed === 0) Logger.log('설문지를 찾지 못했습니다. 설문지 제목이 바뀌었는지 확인해 주세요.');
}
