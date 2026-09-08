// 출제 범위 자동 추출 — 끝을 '중단원'으로 적는지가 핵심
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const ROOT = require('path').join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

function inlineScript(file) {
  const html = fs.readFileSync(ROOT + '/' + file, 'utf8');
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  return out.join('\n;\n');
}

// id별로 살아 있는 가짜 DOM 요소
const els = {};
const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '', textContent: '', dataset: {}, style: {}, focus() {}, select() {} }; return els[id]; };

const toasts = [];
const src = inlineScript('teacher.html') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';
const sb = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), execCommand: () => true, body: {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '', search: '', replace: () => {} },
  navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => {},
  addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
  firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({ collection: () => ({ get: async () => ({ docs: [] }) }) }), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
};
sb.window = sb; sb.globalThis = sb; sb.self = sb;
vm.createContext(sb);
try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) {}
sb.showToast = (m) => toasts.push(m);

const P = (big, small) => ({ no: '1', bigUnit: big, smallUnit: small });

console.log('범위 추출 — 끝은 중단원으로');
ok("사용자 예시: 집합 대단원에서 포함관계까지만 나오면 '집합 > 집합의 포함관계까지'", () => {
  const r = sb.anRangeFrom([P('집합', '집합의 포함관계'), P('집합', '집합의 포함관계')]);
  assert.strictEqual(r, '집합 > 집합의 포함관계까지');
});
ok("연산까지 나오면 처음~끝을 잇는다", () => {
  const r = sb.anRangeFrom([P('집합', '집합의 포함관계'), P('집합', '집합의 연산')]);
  assert.strictEqual(r, '집합 > 집합의 포함관계 ~ 집합의 연산까지');
});
ok("중단원이 대단원으로 뭉뚱그려지지 않는다 (범위가 넓어 보이면 안 됨)", () => {
  const r = sb.anRangeFrom([P('집합', '집합의 포함관계')]);
  assert.ok(r.includes('집합의 포함관계'), '중단원이 빠짐');
  assert.notStrictEqual(r, '집합', '대단원만 적으면 연산까지 포함된 것처럼 보인다');
});
ok("여러 대단원은 ' · '로 잇고 맨 끝에만 '까지'", () => {
  const r = sb.anRangeFrom([P('집합', '집합의 포함관계'), P('집합', '집합의 연산'), P('명제', '명제의 역·대우')]);
  assert.strictEqual(r, '집합 > 집합의 포함관계 ~ 집합의 연산 · 명제 > 명제의 역·대우까지');
  assert.strictEqual((r.match(/까지/g) || []).length, 1, "'까지'가 여러 번 붙음");
});
ok("같은 중단원이 여러 문제에 나와도 한 번만 센다", () => {
  const r = sb.anRangeFrom([P('집합', '집합의 연산'), P('집합', '집합의 포함관계'), P('집합', '집합의 연산')]);
  assert.strictEqual(r, '집합 > 집합의 연산 ~ 집합의 포함관계까지');
});
ok("문제에 나온 순서를 지킨다 (가나다순으로 흐트러지지 않음)", () => {
  const r = sb.anRangeFrom([P('명제', '명제의 역·대우'), P('집합', '집합의 연산')]);
  assert.ok(r.indexOf('명제') < r.indexOf('집합'), '순서가 바뀜');
});
ok("중단원이 없으면 대단원만 적는다", () => {
  assert.strictEqual(sb.anRangeFrom([P('집합', ''), P('집합', '')]), '집합까지');
});
ok("빈 분석이면 빈 문자열 (엉뚱한 범위를 만들지 않는다)", () => {
  assert.strictEqual(sb.anRangeFrom([]), '');
  assert.strictEqual(sb.anRangeFrom(null), '');
});
ok("'기타'만 있으면 범위를 만들지 않는다", () => {
  assert.strictEqual(sb.anRangeFrom([{ no: '1' }, { no: '2' }]), '');
});
ok("옛 형식(unit 한 칸)도 대단원 > 중단원으로 읽는다", () => {
  const r = sb.anRangeFrom([{ no: '1', unit: '집합 > 집합의 포함관계' }, { no: '2', unit: '집합 > 집합의 연산' }]);
  assert.strictEqual(r, '집합 > 집합의 포함관계 ~ 집합의 연산까지');
});

console.log('\n시험명 기본값');
ok("종류 + 대단원으로 만든다", () => {
  sb.__set('anKind', '기출');
  assert.strictEqual(sb.anTitleFrom([P('집합', '집합의 포함관계')]), '과년도 기출 - 집합');
});
ok("대단원이 여럿이면 둘까지 쓰고 '외'", () => {
  sb.__set('anKind', '내신');
  const t = sb.anTitleFrom([P('집합', 'a'), P('명제', 'b'), P('함수', 'c')]);
  assert.strictEqual(t, '내신 시험지 - 집합·명제 외');
});
ok("단원을 모르면 종류만", () => {
  sb.__set('anKind', '데일리');
  assert.strictEqual(sb.anTitleFrom([{ no: '1' }]), '데일리 테스트');
});

console.log('\n중단원은 교과서 기준으로');
ok("대단원마다 중단원 목록이 있다", () => {
  assert.strictEqual(sb.anUnitsOf('도형의 방정식').join(','), '평면좌표,직선의 방정식,원의 방정식,도형의 이동');
  assert.strictEqual(sb.anUnitsOf('집합').join(','), '집합의 뜻과 포함관계,집합의 연산');
  assert.strictEqual(sb.anUnitsOf('함수와 그래프').join(','), '함수의 뜻과 그래프,합성함수와 역함수,유리함수,무리함수');
});
ok("모르는 대단원이면 빈 목록", () => {
  assert.strictEqual(sb.anUnitsOf('없는단원').length, 0);
  assert.strictEqual(sb.anUnitsOf('').length, 0);
});
ok("표의 중단원 칸이 그 대단원의 중단원을 제안한다", () => {
  const h = sb.renderAnalysis && (function () {
    sb.__set('lastAnalysis', { problems: [{ no: '1', bigUnit: '도형의 방정식', smallUnit: '삼각형의 무게중심' }], summary: '' });
    sb.renderAnalysis(sb.__get('lastAnalysis'));
    return el('an-result').innerHTML;
  })();
  assert.ok(/list="anu-0"/.test(h), '중단원 칸에 제안 목록이 안 붙음');
  assert.ok(h.includes('<option value="평면좌표">'), '그 대단원의 중단원이 제안에 없음');
  assert.ok(h.includes('원의 방정식'), '제안 목록이 비어 있음');
});
ok("지시서가 중단원 목록을 못박고 유형을 금지한다", () => {
  const t = sb.analysisPromptText();
  assert.ok(t.includes('교과서 <중단원>. 문제 유형이 아니다.'), '중단원이라고 못박지 않음');
  assert.ok(t.includes('평면좌표 / 직선의 방정식 / 원의 방정식 / 도형의 이동'), '중단원 목록이 없음');
  assert.ok(t.includes('집합의 뜻과 포함관계 / 집합의 연산'), '집합 중단원이 없음');
  assert.ok(t.includes('삼각형의 무게중심'), '쓰지 말라는 예시가 없음');
});

console.log('\n시험명은 출처 기준으로');
ok("출처를 주면 '2024 평촌고 1-2-1 기출'이 된다", () => {
  sb.__set('anKind', '기출');
  assert.strictEqual(sb.anTitleFrom([P('도형의 방정식', '평면좌표')], '2024 평촌고 1-2-1'), '2024 평촌고 1-2-1 기출');
});
ok("다른 종류면 그 종류 이름이 붙는다", () => {
  sb.__set('anKind', '내신');
  assert.strictEqual(sb.anTitleFrom([P('집합', '집합의 연산')], '2024 평촌고 1-2-1'), '2024 평촌고 1-2-1 내신 시험지');
});
ok("출처가 없으면 예전처럼 종류 + 대단원", () => {
  sb.__set('anKind', '기출');
  assert.strictEqual(sb.anTitleFrom([P('집합', '집합의 연산')], ''), '과년도 기출 - 집합');
  assert.strictEqual(sb.anTitleFrom([P('집합', '집합의 연산')]), '과년도 기출 - 집합');
});
ok("지시서가 시험명 형식을 알려준다", () => {
  const t = sb.analysisPromptText();
  assert.ok(t.includes('2024 평촌고 1-2-1 기출'), '시험명 예시가 없음');
  assert.ok(t.includes('1-2-1 = 1학년 2학기 1차 지필'), '표기 설명이 없음');
});

console.log('\nJSON 가져오기에서 자동으로 채워지는가');
function paste(json, pre) {
  Object.keys(els).forEach(k => delete els[k]);
  toasts.length = 0;
  sb.__set('anTitleDraft', ''); sb.__set('anRangeDraft', '');
  el('an-paste').value = JSON.stringify(json);
  if (pre) { if (pre.title != null) el('an-title').value = pre.title; if (pre.range != null) el('an-range').value = pre.range; }
  sb.doPasteAnalysis();
  return { title: el('an-title').value, range: el('an-range').value, toast: toasts.join(' | ') };
}
const probs2 = [
  { no: '1', bigUnit: '집합', smallUnit: '집합의 포함관계', ability: '개념이해', difficulty: '하', answer: '3' },
  { no: '2', bigUnit: '집합', smallUnit: '집합의 연산', ability: '추론', difficulty: '중', answer: '' }
];
ok("GPT가 준 examTitle·examRange가 있으면 그대로 쓴다", () => {
  const r = paste({ examTitle: '2학기 중간고사', examRange: '집합 > 집합의 포함관계까지', problems: probs2 });
  assert.strictEqual(r.title, '2학기 중간고사');
  assert.strictEqual(r.range, '집합 > 집합의 포함관계까지');
});
ok("없으면 분석 결과에서 뽑아 채운다", () => {
  const r = paste({ problems: probs2 });
  assert.strictEqual(r.range, '집합 > 집합의 포함관계 ~ 집합의 연산까지');
  assert.ok(r.title.includes('집합'), '시험명이 안 채워짐: ' + r.title);
});
ok("이미 적어둔 시험명·범위는 덮어쓰지 않는다", () => {
  const r = paste({ examTitle: 'GPT가 준 이름', examRange: 'GPT가 준 범위', problems: probs2 },
    { title: '내가 쓴 이름', range: '내가 쓴 범위' });
  assert.strictEqual(r.title, '내가 쓴 이름');
  assert.strictEqual(r.range, '내가 쓴 범위');
});
ok("자동으로 채웠으면 안내에 알려준다", () => {
  const r = paste({ problems: probs2 });
  assert.ok(/자동/.test(r.toast), '안내에 자동 채움 표시가 없음: ' + r.toast);
  assert.ok(/정답 1개/.test(r.toast), '정답 개수 안내가 사라짐: ' + r.toast);
});
ok("드래프트에도 같이 들어간다 (다시 그려도 안 날아가게)", () => {
  paste({ problems: probs2 });
  assert.ok(sb.__get('anRangeDraft'), 'anRangeDraft가 비어 있음');
  assert.strictEqual(sb.__get('anRangeDraft'), '집합 > 집합의 포함관계 ~ 집합의 연산까지');
});
ok("배열만 온 JSON도 그대로 동작한다", () => {
  const r = paste(probs2);
  assert.strictEqual(r.range, '집합 > 집합의 포함관계 ~ 집합의 연산까지');
});

console.log('\n폼이 다시 그려져도 값이 남는가');
const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
ok("시험명·범위·만점 입력칸이 상태와 연결돼 있다", () => {
  ['an-title', 'an-range', 'an-max'].forEach(id => {
    const line = html.split('\n').find(l => l.includes('id="' + id + '"'));
    assert.ok(line, id + ' 입력칸을 못 찾음');
    assert.ok(line.includes('value="${'), id + ' 에 value 바인딩이 없음 (다시 그리면 값이 날아감)');
    assert.ok(line.includes('oninput='), id + ' 에 oninput이 없음');
  });
});
ok("지시서가 시험명(title)·범위(examRange)를 요구한다", () => {
  // v4 계약에서 시험명 필드는 exams[].title 이다 (예전 examTitle도 파서는 계속 받아준다)
  const t = sb.analysisPromptText();
  assert.ok(/- title:/.test(t), '지시서에 title 요청이 없음');
  assert.ok(t.includes('examRange'), '지시서에 examRange 요청이 없음');
  assert.ok(t.includes('중단원'), '중단원 기준 설명이 없음');
  assert.ok(t.includes('집합의 포함관계까지'), '예시가 없음');
});
ok("예전 examTitle 형식도 파서가 계속 받아준다", () => {
  const r = paste({ examTitle: '옛 형식 이름', problems: probs2 });
  assert.strictEqual(r.title, '옛 형식 이름');
});
ok("등록에 성공하면 폼을 비운다", () => {
  assert.ok(html.includes("anTitleDraft=''; anRangeDraft='';"), '등록 후 초기화가 없음');
});

console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
