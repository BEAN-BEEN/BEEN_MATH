// 범위 밖 문항은 점수에서 빼기 · 찍어서 맞은 문항은 따로 표시
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const ROOT = require('path').join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

function load(file) {
  const html = fs.readFileSync(ROOT + '/' + file, 'utf8');
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
    console, setTimeout: (f) => { if (typeof f === 'function') f(); }, clearTimeout, setInterval, clearInterval,
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
  return sb;
}

const T = load('teacher.html');
const S = load('student.html');
T.showToast = () => {};
S.showToast = () => {};

const P = (no, difficulty, answer, extra) => Object.assign({ no: String(no), difficulty, answer, points: '' }, extra || {});
const exam = (probs, extra) => Object.assign({
  id: 'e1', title: '2024 평촌고 1-2-1 기출', className: '고1T A1', classId: 'c1', analysis: probs || []
}, extra || {});

console.log('\n범위 밖 문항 — 판정');
ok('outOfRange가 true면 범위 밖', () => {
  assert.strictEqual(T.isOutOfRange(P(1, '중', '2', { outOfRange: true })), true);
  assert.strictEqual(T.isOutOfRange(P(1, '중', '2')), false);
  assert.strictEqual(T.isOutOfRange(null), false);
});
ok('JSON의 outOfRange를 받아온다', () => {
  const r = T.parseAnalysisExams(JSON.stringify({ problems: [
    { no: 1, difficulty: '중', answer: '2' },
    { no: 2, difficulty: '상', answer: '3', outOfRange: true }
  ] }));
  assert.strictEqual(r[0].problems[0].outOfRange, false);
  assert.strictEqual(r[0].problems[1].outOfRange, true);
});

console.log('\n범위 밖은 배점에서 빠진다');
ok('범위 밖 문항의 배점은 0', () => {
  const probs = [P(1, '중', '1'), P(2, '상', '2', { outOfRange: true })];
  const e = exam(probs);
  assert.strictEqual(T.probPoints(probs[1], e), 0);
  assert.strictEqual(T.probPoints(probs[0], e), 100);   // 남은 한 문항이 100점을 다 가져간다
});
ok('남은 문항으로 다시 100점을 나눈다', () => {
  const probs = [P(1, '하', '1'), P(2, '하', '2'), P(3, '상', '3', { outOfRange: true })];
  const e = exam(probs);
  assert.strictEqual(T.probPoints(probs[0], e), 50);
  assert.strictEqual(T.probPoints(probs[1], e), 50);
  assert.strictEqual(T.examTotalPoints(e), 100);
});
ok('전부 범위 밖이면 만점 0', () => {
  const e = exam([P(1, '중', '1', { outOfRange: true })]);
  assert.strictEqual(T.examTotalPoints(e), 0);
});

console.log('\n범위 밖은 점수에도 안 들어간다');
ok('안 푼 범위 밖 문항 때문에 점수가 깎이지 않는다', () => {
  const probs = [P(1, '중', '1'), P(2, '중', '2'), P(3, '상', '3', { outOfRange: true })];
  const e = exam(probs);
  const r = T.scoreFromOX(e, { '1': true, '2': true });   // 3번은 안 풀어서 false
  assert.strictEqual(r.score, 100, '범위 밖이 오답으로 잡힘');
  assert.strictEqual(r.total, 100);
});
ok('범위 안에서 틀리면 정상적으로 깎인다', () => {
  const probs = [P(1, '중', '1'), P(2, '중', '2'), P(3, '상', '3', { outOfRange: true })];
  const r = T.scoreFromOX(exam(probs), { '1': true });
  assert.strictEqual(r.score, 50);
});
ok('정답표에도 범위 밖은 안 들어간다 (학생 채점에서 빠지게)', () => {
  const probs = [P(1, '중', '1'), P(2, '상', '3', { outOfRange: true })];
  const key = T.answerKeyFromAnalysis({ analysis: probs });
  assert.strictEqual(Object.keys(key).join(','), '1');
});

console.log('\n범위 밖 화면 표시');
ok('답안지에 범위 밖은 안 풀어도 된다고 적힌다', () => {
  T.__set('CLASSES', [{ id: 'c1', name: '고1T A1' }]);
  const probs = [P(1, '중', '1'), P(2, '상', '3', { outOfRange: true })];
  const h = T.omrSheetHtml(exam(probs));
  assert.ok(h.indexOf('안 풀어도 돼요') >= 0, '안내가 없음');
  assert.ok(h.indexOf('범위 밖') >= 0);
});
ok('분석 표에 범위 밖 체크칸이 있다', () => {
  const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
  assert.ok(html.indexOf('data-k="outOfRange"') >= 0, '체크칸이 없음');
  assert.ok(html.indexOf("(el.type==='checkbox') ? el.checked : el.value") >= 0, '체크박스 값을 안 읽음');
});

console.log('\n찍어서 맞은 문항');
ok('guessedNos를 읽어 집합으로 만든다', () => {
  const g = T.guessedSet({ guessedNos: '3, 7 ,12' });
  assert.strictEqual(g.has('3'), true);
  assert.strictEqual(g.has('7'), true);
  assert.strictEqual(g.has('12'), true);
  assert.strictEqual(g.has('4'), false);
  assert.strictEqual(T.guessedSet(null).size, 0);
  assert.strictEqual(T.guessedSet({}).size, 0);
});
ok('학생 화면에 찍음 토글이 있다', () => {
  assert.strictEqual(typeof S.omrGuess, 'function');
  const html = fs.readFileSync(ROOT + '/student.html', 'utf8');
  assert.ok(html.indexOf('omrGuess(') >= 0, '찍음 버튼이 없음');
  assert.ok(html.indexOf('guessedNos:') >= 0, '제출에 guessedNos가 없음');
});
ok('찍음을 켰다 끄면 사라진다', () => {
  S.renderGrades = () => {};
  S.__set('OMR_GUESS', {});
  S.omrGuess('e1', '3');
  assert.strictEqual(S.__get('OMR_GUESS').e1['3'], true);
  S.omrGuess('e1', '3');
  assert.strictEqual(S.__get('OMR_GUESS').e1['3'], undefined);
});
ok('답을 지우면 찍음 표시도 지워진다', () => {
  S.renderGrades = () => {};
  S.__set('OMR_DRAFT', { e1: { '3': '2' } });
  S.__set('OMR_GUESS', { e1: { '3': true } });
  S.omrPick('e1', '3', '2');            // 같은 값을 다시 누르면 지워진다
  assert.strictEqual(S.__get('OMR_DRAFT').e1['3'], '');
  assert.strictEqual(S.__get('OMR_GUESS').e1['3'], undefined);
});
ok('찍은 문항이 답안 패드에 노랗게 남는다', () => {
  const e = { id: 'e1', title: 'T', answerKey: { '1': '3', '2': '4' } };
  S.__set('S_EXAMSUBS', [{ examId: 'e1', answers: { '1': '3' }, guessedNos: '1' }]);
  S.__set('OMR_DRAFT', {});
  S.__set('OMR_GUESS', {});
  const h = S.omrPadHtml(e);
  assert.ok(h.indexOf('찍음 1') >= 0, '찍음 개수가 안 보임: ');
  assert.ok(h.indexOf('omrGuess(') >= 0);
});

console.log('\n학생 점수도 난이도 가중치로');
ok('선생님 화면과 같은 점수가 나온다', () => {
  const probs = [P(1, '하', '1'), P(2, '상', '2')];         // 3 : 5
  const e = exam(probs, { maxScore: 100, answerKey: { '1': '1', '2': '2' } });
  const g = S.gradeOmr(e.answerKey, { '1': '1', '2': '9' });   // 2번 틀림
  assert.strictEqual(S.sScore(e, g), Math.round(3 / 8 * 100));
  assert.strictEqual(T.scoreFromOX(e, { '1': true, '2': false }).score, Math.round(3 / 8 * 100));
});
ok('범위 밖은 학생 점수에서도 빠진다', () => {
  const probs = [P(1, '중', '1'), P(2, '상', '2', { outOfRange: true })];
  const e = exam(probs, { answerKey: { '1': '1' } });
  const g = S.gradeOmr(e.answerKey, { '1': '1' });
  assert.strictEqual(S.sScore(e, g), 100);
});
ok('분석이 없는 예전 시험은 예전 방식 그대로', () => {
  const e = { id: 'e1', maxScore: 100, answerKey: { '1': '1', '2': '2' } };
  const g = S.gradeOmr(e.answerKey, { '1': '1', '2': '9' });
  assert.strictEqual(S.sScore(e, g), 50);
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});
ok('student.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(S.__err, null, S.__err && S.__err.message);
});

console.log('\n' + pass + '개 통과');
