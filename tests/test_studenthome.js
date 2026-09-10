// 메인에 답안지 카드 · 채점 직후 힌트 · '시험 범위 아님' 체크
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

function load(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  const src = out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';
  const els = {};
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '' }; return els[id]; };
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(src, sb, { filename: file }); } catch (e) { err = e; }
  sb.__els = els; sb.__err = err;
  sb.showToast = () => {};
  return sb;
}

const S = load('student.html');
const T = load('teacher.html');

const P = (no, difficulty, answer, extra) => Object.assign({ no: String(no), difficulty, answer, points: '', qType: '' }, extra || {});
const EX = (id, probs, extra) => Object.assign({
  id, title: '2024 평촌고 1-2-1 기출', className: '고1T A1', classId: 'c1',
  maxScore: 100, analysis: probs || [], date: '2026-09-01', range: '집합'
}, extra || {});

function setExams(exams, subs) {
  S.__set('S_EXAMS', exams);
  S.__set('S_EXAMSUBS', subs || []);
  S.__set('OMR_DRAFT', {});
  S.__set('OMR_GUESS', {});
  S.__set('OMR_LATE', {});
  S.__set('OMR_SKIP', {});
}

console.log('\n메인에 답안지 넣을 시험');
ok('아직 안 낸 시험이 카드로 뜬다', () => {
  setExams([EX('e1', [P(1, '중', '3'), P(2, '상', '4')])], []);
  const h = S.pendingExamCardHtml();
  assert.ok(h.indexOf('답안지 넣을 시험') >= 0, '카드가 없음');
  assert.ok(h.indexOf('2024 평촌고') >= 0, '시험명이 없음');
  assert.ok(h.indexOf('2문항') >= 0);
  assert.ok(h.indexOf("goExam('e1')") >= 0, '바로가기 버튼이 없음');
});
ok('이미 낸 시험은 안 뜬다', () => {
  setExams([EX('e1', [P(1, '중', '3')])], [{ examId: 'e1', answers: { '1': '3' }, score: 100 }]);
  assert.strictEqual(S.pendingExamCardHtml(), '');
});
ok('정답이 하나도 없는 시험은 안 뜬다 (답을 넣을 수가 없다)', () => {
  setExams([EX('e1', [])], []);
  assert.strictEqual(S.pendingExamCardHtml(), '');
});
ok('넣다 만 시험은 몇 개 넣었는지 보여준다', () => {
  setExams([EX('e1', [P(1, '중', '3'), P(2, '상', '4')])], []);
  S.__set('OMR_DRAFT', { e1: { '1': '3' } });
  const h = S.pendingExamCardHtml();
  assert.ok(h.indexOf('1개 넣음') >= 0, '진행 개수가 없음: ' + h.slice(0, 200));
  assert.ok(h.indexOf('이어서 넣기') >= 0);
});
ok('여러 개면 개수를 알려준다', () => {
  setExams([EX('e1', [P(1, '중', '3')]), EX('e2', [P(1, '중', '3')])], []);
  assert.ok(S.pendingExamCardHtml().indexOf('2개') >= 0);
});
ok('시험명이 HTML로 새지 않는다', () => {
  setExams([EX('e1', [P(1, '중', '3')], { title: '<img src=x>' })], []);
  const h = S.pendingExamCardHtml();
  assert.ok(h.indexOf('<img src=x>') < 0, '태그가 그대로 들어감');
  assert.ok(h.indexOf('&lt;img') >= 0);
});
ok('goExam이 있다', () => {
  assert.strictEqual(typeof S.goExam, 'function');
});

console.log('\n채점하고 바로 보는 풀이 힌트');
const hintProbs = [
  P(1, '중', '3', { bigUnit: '집합', smallUnit: '집합의 연산', ability: '이해', abilityDetail: '벤다이어그램 해석', solution: '드모르간 법칙으로 정리한다' }),
  P(2, '상', '4', { bigUnit: '명제', smallUnit: '절대부등식', ability: '추론', solution: '산술·기하 평균을 쓴다' }),
  P(3, '하', '1', { bigUnit: '집합', ability: '계산', solution: '원소를 센다' })
];
ok('틀린 문제의 단원·출제의도·해결방법이 나온다', () => {
  const e = Object.assign(EX('e1', hintProbs), { wrongNos: '1, 2' });
  const h = S.examHintsHtml(e);
  assert.ok(h.indexOf('이렇게 푸는 거예요') >= 0, '힌트 상자가 없음');
  assert.ok(h.indexOf('집합 &gt; 집합의 연산') >= 0, '단원이 없음');   // > 는 이스케이프돼서 들어간다
  assert.ok(h.indexOf('드모르간 법칙으로 정리한다') >= 0, '해결 방법이 없음');
  assert.ok(h.indexOf('산술·기하 평균을 쓴다') >= 0);
  assert.ok(h.indexOf('벤다이어그램 해석') >= 0, '세부 의도가 없음');
  assert.ok(h.indexOf('2문항') >= 0);
});
ok('맞은 문제는 안 나온다', () => {
  const e = Object.assign(EX('e1', hintProbs), { wrongNos: '1' });
  const h = S.examHintsHtml(e);
  assert.ok(h.indexOf('드모르간') >= 0);
  assert.ok(h.indexOf('산술·기하') < 0, '맞은 문제까지 나옴');
  assert.ok(h.indexOf('원소를 센다') < 0);
});
ok('다 맞았으면 축하만 한다', () => {
  const e = Object.assign(EX('e1', hintProbs), { wrongNos: '' });
  const h = S.examHintsHtml(e);
  assert.ok(h.indexOf('틀린 문제가 없어요') >= 0, h.slice(0, 120));
});
ok('분석이 없는 예전 시험은 아무것도 안 보여준다', () => {
  assert.strictEqual(S.examHintsHtml(Object.assign(EX('e1', []), { wrongNos: '1' })), '');
});
ok('해결 방법에 태그가 있어도 안 샌다', () => {
  const bad = [P(1, '중', '3', { solution: '<script>alert(1)</script>' })];
  const h = S.examHintsHtml(Object.assign(EX('e1', bad), { wrongNos: '1' }));
  assert.ok(h.indexOf('<script>alert') < 0, '스크립트가 그대로 들어감');
  assert.ok(h.indexOf('&lt;script&gt;') >= 0);
});

console.log('\n시험 범위 아님 체크');
ok('omrSkip 토글이 있다', () => {
  assert.strictEqual(typeof S.omrSkip, 'function');
});
ok('켰다 끄면 사라진다', () => {
  S.renderGrades = () => {};
  S.__set('OMR_SKIP', {});
  S.omrSkip('e1', '7');
  assert.strictEqual(S.__get('OMR_SKIP').e1['7'], true);
  S.omrSkip('e1', '7');
  assert.strictEqual(S.__get('OMR_SKIP').e1['7'], undefined);
});
ok('답안 패드에 범 버튼이 나온다', () => {
  setExams([EX('e1', [P(1, '중', '3')])], []);
  const h = S.omrPadHtml(S.getExams()[0]);
  assert.ok(h.indexOf('omrSkip(') >= 0, '범 버튼이 없음');
  assert.ok(h.indexOf('>범<') >= 0);
});
ok('표시하면 뱃지에 개수가 뜬다', () => {
  setExams([EX('e1', [P(1, '중', '3'), P(2, '중', '4')])], []);
  S.__set('OMR_SKIP', { e1: { '1': true } });
  const h = S.omrPadHtml(S.getExams()[0]);
  assert.ok(h.indexOf('범위 아님 1') >= 0, '뱃지가 없음');
});
ok('저장된 skipNos를 되살린다', () => {
  setExams([EX('e1', [P(1, '중', '3'), P(2, '중', '4')])],
    [{ examId: 'e1', answers: { '1': '3' }, skipNos: '2' }]);
  const h = S.omrPadHtml(S.getExams()[0]);
  assert.ok(h.indexOf('범위 아님 1') >= 0, '되살아나지 않음');
});

console.log('\n범위 아님은 점수에서 빠진다');
ok('학생 점수에서 빠진다', () => {
  const probs = [P(1, '중', '1'), P(2, '중', '2'), P(3, '중', '3')];
  const e = EX('e1', probs, { answerKey: { '1': '1', '2': '2', '3': '3' } });
  const g = S.gradeOmr(e.answerKey, { '1': '1', '2': '2' });      // 3번 안 씀 → 오답
  assert.strictEqual(S.sScore(e, g, {}), Math.round(2 / 3 * 100));   // 67
  assert.strictEqual(S.sScore(e, g, { '3': true }), 100, '범위 아님이 안 빠짐');
});
ok('선생님 분석서 점수에서도 빠진다', () => {
  const probs = [P(1, '중', '1'), P(2, '중', '2'), P(3, '중', '3')];
  const e = EX('e1', probs);
  const ox = { '1': true, '2': true, '3': false };
  assert.strictEqual(T.scoreFromOX(e, ox).score, Math.round(2 / 3 * 100));
  assert.strictEqual(T.scoreFromOX(e, ox, new Set(['3'])).score, 100, '범위 아님이 안 빠짐');
});
ok('skipSet이 학생 표시를 읽는다', () => {
  assert.strictEqual([...T.skipSet({ skipNos: '3, 9' })].join(','), '3,9');
  assert.strictEqual(T.skipSet(null).size, 0);
});
ok('전부 범위 아님이면 0/0', () => {
  const e = EX('e1', [P(1, '중', '1')]);
  const r = T.scoreFromOX(e, { '1': true }, new Set(['1']));
  assert.strictEqual(r.total, 0);
});
ok('제출에 skipNos가 담긴다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');
  assert.ok(html.indexOf('skipNos:') >= 0, '제출에 skipNos가 없음');
});

console.log('\n문법');
ok('student.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(S.__err, null, S.__err && S.__err.message);
});
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});

console.log('\n' + pass + '개 통과');
