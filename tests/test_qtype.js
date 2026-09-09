// 객관식/주관식을 직접 정하기 — 짐작이 자주 틀렸다
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

const P = (no, difficulty, answer, extra) => Object.assign({ no: String(no), difficulty, answer, points: '', qType: '' }, extra || {});
const exam = (probs, extra) => Object.assign({
  id: 'e1', title: '2024 부흥고 1-2-1 기출', className: '고1T A1', classId: 'c1', analysis: probs || []
}, extra || {});

console.log('\n형식을 직접 정하면 그대로 따른다');
ok('주관식이라고 정하면 정답이 숫자여도 주관식', () => {
  // 이게 원래 문제였다 — 주관식 정답이 "3"이면 객관식으로 보였다
  const p = P(21, '상', '3', { qType: '주관식' });
  assert.strictEqual(T.probType(p, null, 5), '주관식');
  assert.strictEqual(T.isSubjective(p, 5), true);
});
ok('객관식이라고 정하면 정답이 식이어도 객관식', () => {
  const p = P(1, '중', 'x=2', { qType: '객관식' });
  assert.strictEqual(T.probType(p, null, 5), '객관식');
});
ok('안 정했으면 예전처럼 정답 모양으로 짐작한다', () => {
  assert.strictEqual(T.probType(P(1, '중', '3'), null, 5), '객관식');
  assert.strictEqual(T.probType(P(2, '중', 'x=2'), null, 5), '주관식');
  assert.strictEqual(T.probType(P(3, '중', '12'), null, 5), '주관식');   // 보기 밖 숫자
});
ok('이상한 값이 들어오면 짐작으로 돌아간다', () => {
  assert.strictEqual(T.probType(P(1, '중', '3', { qType: '헛소리' }), null, 5), '객관식');
});
ok('JSON의 qType을 받아온다', () => {
  const r = T.parseAnalysisExams(JSON.stringify({ problems: [
    { no: 1, difficulty: '중', answer: '3', qType: '주관식' },
    { no: 2, difficulty: '중', answer: '2', qType: '이상함' },
    { no: 3, difficulty: '중', answer: '1' }
  ] }));
  const ps = r[0].problems;
  assert.strictEqual(ps[0].qType, '주관식');
  assert.strictEqual(ps[1].qType, '', '이상한 값이 그대로 들어감');
  assert.strictEqual(ps[2].qType, '');
});

console.log('\n배점도 형식을 따른다');
ok('주관식으로 정하면 서술형 가중치(8)를 받는다', () => {
  assert.strictEqual(T.probWeight(P(21, '중', '3', { qType: '주관식' }), 5), 8);
  assert.strictEqual(T.probWeight(P(1, '중', '3'), 5), 4);          // 그냥 객관식이면 난이도대로
});
ok('객관식으로 정하면 난이도 가중치를 받는다', () => {
  assert.strictEqual(T.probWeight(P(1, '상', 'x=2', { qType: '객관식' }), 5), 5);
});
ok('주관식으로 바꾸면 배점이 올라간다', () => {
  const a = [P(1, '중', '1'), P(2, '중', '2')];
  const b = [P(1, '중', '1'), P(2, '중', '2', { qType: '주관식' })];
  assert.strictEqual(T.probPoints(a[1], exam(a)), 50);                 // 4:4 → 반반
  assert.ok(T.probPoints(b[1], exam(b)) > 60, '주관식이 더 높아야 함: ' + T.probPoints(b[1], exam(b)));
});

console.log('\n답안지·채점의 형식 표');
ok('정한 형식이 답안지에 그대로 나간다', () => {
  T.__set('CLASSES', [{ id: 'c1', name: '고1T A1' }]);
  const probs = [P(1, '중', '3'), P(2, '상', '4', { qType: '주관식' })];
  const e = exam(probs);
  const tm = T.omrTypeMap(e);
  assert.strictEqual(tm['1'], '객관식');
  assert.strictEqual(tm['2'], '주관식', '정답이 4라서 객관식으로 잡힘');
  const h = T.omrSheetHtml(e);
  assert.ok(h.indexOf('맞으면 O') >= 0, '답안지에 O/X 안내가 없음');
});
ok('전부 객관식이면 O/X 칸이 안 나온다', () => {
  const h = T.omrSheetHtml(exam([P(1, '중', '3'), P(2, '중', '4')]));
  assert.ok(h.indexOf('맞으면 O') < 0);
});

console.log('\n학생 화면 — 주관식은 O/X만');
function pad(probs, extra) {
  const e = exam(probs, extra);
  S.__set('S_EXAMSUBS', []); S.__set('OMR_DRAFT', {}); S.__set('OMR_GUESS', {}); S.__set('OMR_LATE', {});
  return S.omrPadHtml(e);
}
ok('주관식으로 정한 문항은 정답이 숫자여도 O/X', () => {
  const h = pad([P(1, '중', '3'), P(2, '상', '4', { qType: '주관식' })]);
  assert.ok(h.indexOf('>O<') >= 0 && h.indexOf('>X<') >= 0, 'O/X 버튼이 없음');
  assert.ok(h.indexOf('주관식') >= 0, '주관식 표시가 없음');
});
ok('전부 주관식이면 보기 번호가 하나도 없다', () => {
  const h = pad([P(1, '중', '3', { qType: '주관식' }), P(2, '중', '4', { qType: '주관식' })]);
  assert.ok(h.indexOf('①') < 0, '주관식인데 보기 번호가 나옴');
  assert.ok(h.indexOf('>O<') >= 0);
});
ok('객관식으로 정한 문항은 정답이 식이어도 보기 번호', () => {
  const h = pad([P(1, '중', 'x=2', { qType: '객관식' })]);
  assert.ok(h.indexOf('①') >= 0 && h.indexOf('⑤') >= 0, '보기 번호가 없음');
});
ok('선생님·학생이 같은 형식을 본다', () => {
  const probs = [P(1, '중', '3'), P(2, '상', '4', { qType: '주관식' }), P(3, '중', 'x=1')];
  const e = exam(probs);
  const t = T.omrTypeMap(e);
  const s = S.sTypeMap(e);
  assert.strictEqual(JSON.stringify(t), JSON.stringify(s), '선생님 ' + JSON.stringify(t) + ' vs 학생 ' + JSON.stringify(s));
});
ok('O/X 채점은 그대로 동작한다', () => {
  const key = { '1': '3', '2': '4' };
  const r = S.gradeOmr(key, { '1': '3', '2': 'O' });
  assert.strictEqual(r.correct, 2);
  const r2 = S.gradeOmr(key, { '1': '3', '2': 'X' });
  assert.strictEqual(r2.correct, 1);
  assert.strictEqual(r2.wrong.join(','), '2');
});

console.log('\n뒤 문항을 한꺼번에 주관식으로');
ok('anTailSubjective가 뒤 N개만 주관식으로 바꾼다', () => {
  const rows = [P(1, '중', '1'), P(2, '중', '2'), P(3, '중', '3'), P(4, '중', '4'), P(5, '중', '5')];
  T.collectAnalysis = () => rows.map(r => Object.assign({}, r));
  let rendered = null;
  T.renderAnalysis = (a) => { rendered = a; };
  T.__set('lastAnalysis', { problems: [] });
  T.anTailSubjective(2);
  assert.strictEqual(rendered.problems.map(p => p.qType).join(','), '객관식,객관식,객관식,주관식,주관식');
});
ok('0을 주면 전부 객관식', () => {
  const rows = [P(1, '중', '1', { qType: '주관식' }), P(2, '중', '2')];
  T.collectAnalysis = () => rows.map(r => Object.assign({}, r));
  let rendered = null;
  T.renderAnalysis = (a) => { rendered = a; };
  T.__set('lastAnalysis', { problems: [] });
  T.anTailSubjective(0);
  assert.strictEqual(rendered.problems.map(p => p.qType).join(','), '객관식,객관식');
});
ok('문항이 없으면 아무 일도 안 한다', () => {
  T.collectAnalysis = () => [];
  let called = false;
  T.renderAnalysis = () => { called = true; };
  T.anTailSubjective(2);
  assert.strictEqual(called, false);
});

console.log('\n지시서');
ok('GPT에게 qType을 달라고 한다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
  assert.ok(html.indexOf("'- qType: 객관식 | 주관식") >= 0, 'qType 설명이 없음');
  assert.ok(html.indexOf("'- answer: 객관식은 1~5의 번호 문자열") >= 0, 'answer 설명이 사라짐');
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});
ok('student.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(S.__err, null, S.__err && S.__err.message);
});

console.log('\n' + pass + '개 통과');
