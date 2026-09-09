// 시간 넘겨 푼 문항 · 실질 점수 · 정답표 폴백 · 반 잘못 넣었을 때
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

const T = load('teacher.html');
const S = load('student.html');

const P = (no, difficulty, answer, extra) => Object.assign({ no: String(no), difficulty, answer, points: '' }, extra || {});
const exam = (probs, extra) => Object.assign({
  id: 'e1', title: '2024 평촌고 1-2-1 기출', className: '고1T A1', classId: 'c1', analysis: probs || []
}, extra || {});

console.log('\n정답표가 비면 분석서 정답을 쓴다');
ok('선생님 화면 — answerKey가 없어도 분석에서 뽑는다', () => {
  const e = exam([P(1, '중', '3'), P(2, '상', '5')]);
  const k = T.examKey(e);
  assert.strictEqual(Object.keys(k).join(','), '1,2');
  assert.strictEqual(k['1'], '3');
});
ok('학생 화면 — 같은 규칙', () => {
  const e = exam([P(1, '중', '3'), P(2, '상', '5')]);
  const k = S.examKey(e);
  assert.strictEqual(Object.keys(k).join(','), '1,2');
  assert.strictEqual(k['2'], '5');
});
ok('따로 넣어둔 정답표가 있으면 그게 우선', () => {
  const e = exam([P(1, '중', '3')], { answerKey: { '1': '4', '2': '2' } });
  assert.strictEqual(T.examKey(e)['1'], '4');
  assert.strictEqual(S.examKey(e)['1'], '4');
});
ok('범위 밖 문항은 정답표에 안 들어간다', () => {
  const e = exam([P(1, '중', '3'), P(2, '상', '5', { outOfRange: true })]);
  assert.strictEqual(Object.keys(T.examKey(e)).join(','), '1');
  assert.strictEqual(Object.keys(S.examKey(e)).join(','), '1');
});
ok('정답표가 없어도 학생 답안 패드가 뜬다', () => {
  // 예전에는 answerKey가 비면 입력칸이 통째로 안 나왔다
  const e = exam([P(1, '중', '3'), P(2, '상', 'x=2')]);
  S.__set('S_EXAMSUBS', []); S.__set('OMR_DRAFT', {}); S.__set('OMR_GUESS', {}); S.__set('OMR_LATE', {});
  const h = S.omrPadHtml(e);
  assert.ok(h.length > 0, '패드가 안 나옴');
  assert.ok(h.indexOf('답 찍기') >= 0);
  assert.ok(h.indexOf('①') >= 0, '객관식 보기가 없음');
});
ok('분석도 정답표도 없으면 패드가 없다', () => {
  const e = { id: 'e2', title: 'T' };
  assert.strictEqual(S.omrPadHtml(e), '');
});

console.log('\n시간 넘겨 푼 문항 — 학생 화면');
ok('omrLate 토글이 있다', () => {
  assert.strictEqual(typeof S.omrLate, 'function');
});
ok('켰다 끄면 사라진다', () => {
  S.renderGrades = () => {};
  S.__set('OMR_LATE', {});
  S.omrLate('e1', '5');
  assert.strictEqual(S.__get('OMR_LATE').e1['5'], true);
  S.omrLate('e1', '5');
  assert.strictEqual(S.__get('OMR_LATE').e1['5'], undefined);
});
ok('답을 지우면 찍음·시간 표시도 같이 지워진다', () => {
  S.renderGrades = () => {};
  S.__set('OMR_DRAFT', { e1: { '3': '2' } });
  S.__set('OMR_GUESS', { e1: { '3': true } });
  S.__set('OMR_LATE', { e1: { '3': true } });
  S.omrPick('e1', '3', '2');
  assert.strictEqual(S.__get('OMR_GUESS').e1['3'], undefined);
  assert.strictEqual(S.__get('OMR_LATE').e1['3'], undefined, '시간 표시가 안 지워짐');
});
ok('패드에 찍·⏱ 두 버튼이 나온다', () => {
  const e = exam([P(1, '중', '3')]);
  S.__set('S_EXAMSUBS', []); S.__set('OMR_DRAFT', {}); S.__set('OMR_GUESS', {}); S.__set('OMR_LATE', {});
  const h = S.omrPadHtml(e);
  assert.ok(h.indexOf('omrGuess(') >= 0, '찍 버튼이 없음');
  assert.ok(h.indexOf('omrLate(') >= 0, '시간 버튼이 없음');
});
ok('저장된 lateNos를 되살린다', () => {
  const e = exam([P(1, '중', '3'), P(2, '중', '4')]);
  S.__set('S_EXAMSUBS', [{ examId: 'e1', answers: { '1': '3' }, guessedNos: '1', lateNos: '2' }]);
  S.__set('OMR_DRAFT', {}); S.__set('OMR_GUESS', {}); S.__set('OMR_LATE', {});
  const h = S.omrPadHtml(e);
  assert.ok(h.indexOf('찍음 1') >= 0, '찍음 개수가 안 보임');
  assert.ok(h.indexOf('시간 넘김 1') >= 0, '시간 개수가 안 보임');
});
ok('제출할 때 lateNos도 담긴다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');
  assert.ok(html.indexOf('lateNos:') >= 0, '제출에 lateNos가 없음');
});

console.log('\n실질 점수 — 선생님 화면');
ok('guessedSet·lateSet이 번호를 읽는다', () => {
  assert.strictEqual([...T.guessedSet({ guessedNos: '3, 7' })].join(','), '3,7');
  assert.strictEqual([...T.lateSet({ lateNos: ' 5 ,9' })].join(','), '5,9');
  assert.strictEqual(T.lateSet(null).size, 0);
  assert.strictEqual(T.lateSet({}).size, 0);
});

// 분석서 전체를 그려서 실질 점수가 나오는지 본다
function report(guessedNos, lateNos) {
  const probs = [P(1, '하', '1'), P(2, '하', '2'), P(3, '상', '3'), P(4, '상', '4')];
  const e = exam(probs, { maxScore: 100, kind: '기출' });
  T.__set('CLASSES', [{ id: 'c1', name: '고1T A1' }]);
  T.__set('EXAMS_CACHE', [e]);
  T.__set('STUDENTS_CACHE', [{ id: 's1', name: '김민서', classId: 'c1', status: '재원' }]);
  T.__set('EXAMSUBS_CACHE', [{ examId: 'e1', studentId: 's1', answers: { '1': '1', '2': '2', '3': '3', '4': '4' }, guessedNos, lateNos }]);
  T.__set('anRepExamId', 'e1');
  T.__set('anRepStId', 's1');
  T.__set('anOX', { '1': true, '2': true, '3': true, '4': true });   // 다 맞음
  return T.anReportHtml();
}
ok('아무 표시도 없으면 실질 점수 칸이 안 나온다', () => {
  const h = report('', '');
  assert.ok(h.indexOf('실질 점수') < 0, '괜히 나옴');
  assert.ok(h.indexOf('100/100') >= 0, '점수가 100이 아님');
});
ok('찍은 게 있으면 실질 점수가 같이 나온다', () => {
  const h = report('3', '');   // 3번(상, 가중치 5)을 찍어서 맞음
  assert.ok(h.indexOf('실질 점수') >= 0, '실질 점수 칸이 없음');
  assert.ok(h.indexOf('찍어서 맞은 문항 1개') >= 0);
});
ok('시간 넘긴 것도 실질 점수에서 빠진다', () => {
  const h = report('', '4');
  assert.ok(h.indexOf('실질 점수') >= 0, '실질 점수 칸이 없음');
  assert.ok(h.indexOf('시간 넘겨서 푼 문항 1개') >= 0, h.indexOf('시간') >= 0 ? '문구가 다름' : '시간 항목이 없음');
  assert.ok(h.indexOf('속도') >= 0, '속도 이야기가 없음');
});
ok('실질 점수가 받은 점수보다 낮다', () => {
  // 1·2번 하(3), 3·4번 상(5) → 합 16. 3번을 찍었으면 실질은 11/16
  const h = report('3', '');
  const m = h.match(/실질 점수<\/div><div[^>]*>(\d+)\/(\d+)/);
  assert.ok(m, '실질 점수를 못 읽음');
  assert.strictEqual(Number(m[1]), Math.round(11 / 16 * 100));
  assert.strictEqual(Number(m[2]), 100);
});
ok('찍음과 시간 넘김을 겹쳐 세지 않는다', () => {
  const h = report('3', '3');   // 같은 문항에 둘 다
  const m = h.match(/실질 점수<\/div><div[^>]*>(\d+)\//);
  assert.strictEqual(Number(m[1]), Math.round(11 / 16 * 100), '두 번 빠짐');
  assert.ok(h.indexOf('시간 넘겨서 푼 문항') < 0, '찍음과 중복해서 또 보여줌');
});
ok('틀린 문항에 표시가 있어도 점수는 그대로', () => {
  const probs = [P(1, '하', '1'), P(2, '상', '2')];
  const e = exam(probs, { maxScore: 100 });
  T.__set('EXAMS_CACHE', [e]);
  T.__set('EXAMSUBS_CACHE', [{ examId: 'e1', studentId: 's1', answers: { '1': '1' }, guessedNos: '2', lateNos: '' }]);
  T.__set('anOX', { '1': true, '2': false });
  const h = T.anReportHtml();
  // 2번은 어차피 틀렸으니 실질 점수도 그대로여야 한다
  assert.ok(h.indexOf('실질 점수') < 0, '틀린 문항 때문에 실질 점수가 뜸');
});
ok('문항표에 찍음·시간↑ 표시가 붙는다', () => {
  const h = report('3', '4');
  assert.ok(h.indexOf('찍음') >= 0, '찍음 표시가 없음');
  assert.ok(h.indexOf('시간↑') >= 0, '시간 표시가 없음');
});

console.log('\n반을 잘못 넣었을 때');
ok('반 바꾸기·지우기 함수가 있다', () => {
  assert.strictEqual(typeof T.anMoveExam, 'function');
  assert.strictEqual(typeof T.anDelExam, 'function');
  assert.strictEqual(typeof T.anSetMax100, 'function');
});
ok('학생이 답을 넣을 수 있는 상태인지 알려준다', () => {
  const e = exam([P(1, '중', '3')]);
  T.__set('CLASSES', [{ id: 'c1', name: '고1T A1' }]);
  T.__set('STUDENTS_CACHE', [{ id: 's1', name: '김민서', classIds: ['c1'], status: '재원' }]);
  const r = T.anExamReady(e);
  assert.strictEqual(r.keys, 1);
  assert.strictEqual(r.students, 1);
});
ok('반에 학생이 없으면 0으로 알려준다', () => {
  const e = exam([P(1, '중', '3')], { classId: 'c9' });
  const r = T.anExamReady(e);
  assert.strictEqual(r.students, 0);
});

console.log('\n만점 100점으로 맞추기');
ok('만점이 100이 아닌 시험을 찾아낸다', () => {
  T.__set('EXAMS_CACHE', [
    exam([P(1, '중', '3')], { id: 'a', maxScore: 71 }),
    exam([P(1, '중', '3')], { id: 'b', maxScore: 100 }),
    Object.assign(exam([], { id: 'c', maxScore: 55 }))       // 분석 없는 건 건드리지 않는다
  ]);
  assert.strictEqual(T.examsNeedingMax().map(e => e.id).join(','), 'a');
});
ok('만점을 100으로 바꾸면 배점이 다시 나뉜다', () => {
  const probs = [P(1, '하', '1'), P(2, '상', '2')];       // 3 : 5
  const before = exam(probs, { maxScore: 16 });
  const after = exam(probs, { maxScore: 100 });
  assert.strictEqual(T.examTotalPoints(before), 16);
  assert.strictEqual(T.examTotalPoints(after), 100);
  assert.ok(T.probPoints(probs[1], after) > T.probPoints(probs[0], after), '상이 더 높아야 함');
  const sum = probs.reduce((a, p) => a + T.probPoints(p, after), 0);
  assert.strictEqual(sum, 100, '합이 100이 아님: ' + sum);
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});
ok('student.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(S.__err, null, S.__err && S.__err.message);
});

console.log('\n' + pass + '개 통과');
