// 직접 채점 — 정답지 보고 스스로 매긴 뒤 틀린 번호만 누른다
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

const run = [];
const okA = (name, fn) => run.push([name, fn]);
function arm() {
  const w = { doc: null };
  S.db = { collection: () => ({ add: async d => { w.doc = d; }, doc: () => ({ update: async d => { w.doc = d; } }) }) };
  S.refreshMine = async () => {};
  S.renderGrades = () => {};
  Object.assign(S.__get('STUDENT'), { id: 's1', name: '학생' });
  S.__set('OMR_SELF', {});
  return w;
}

console.log('\n직접 채점 — 틀린 번호만 누른다');
ok('정답이 없는 시험도 문항 수만 있으면 홈 카드에 뜬다', () => {
  setExams([EX('e1', [], { qCount: '20' })], []); S.__set('OMR_SELF', {});
  const h = S.pendingExamCardHtml();
  assert.ok(h.indexOf('20문항') >= 0, h);
});
ok('문항 수도 분석도 없으면 안 뜬다', () => {
  setExams([EX('e1', [])], []);
  assert.strictEqual(S.pendingExamCardHtml(), '');
});
ok('정답이 없으면 직접 채점 칸이 바로 나온다', () => {
  const e = EX('e1', [], { qCount: '5' });
  setExams([e], []); S.__set('OMR_SELF', {});
  assert.strictEqual(S.omrSelfOn(e), true);
  assert.strictEqual(S.selfNos(e).join(','), '1,2,3,4,5');
  const h = S.selfPadHtml(e);
  assert.ok(h.indexOf('직접 채점') >= 0 && h.indexOf("selfPick('e1','5')") >= 0);
  assert.ok(h.indexOf('omrSelfMode') < 0, '정답이 없는데 답 찍기로 가는 버튼이 있음');
});
ok('정답이 있으면 답 찍기가 그대로 먼저, 버튼으로 넘어간다', () => {
  const e = EX('e1', [P(1, '중', '3'), P(2, '중', '4')]);
  setExams([e], []); arm();
  assert.strictEqual(S.omrSelfOn(e), false);
  assert.ok(S.omrPadHtml(e).indexOf("omrSelfMode('e1',true)") >= 0);
  S.__get('OMR_DRAFT').e1 = { '1': '3' };
  S.omrSelfMode('e1', true);
  assert.strictEqual(S.omrSelfOn(e), true);
  assert.strictEqual(Object.keys(S.__get('OMR_DRAFT').e1).length, 0, '찍던 답이 틀림 표시로 남으면 안 됨');
  assert.ok(S.selfPadHtml(e).indexOf("omrSelfMode('e1',false)") >= 0);
});
ok('누르면 틀림, 다시 누르면 풀린다', () => {
  const e = EX('e1', [], { qCount: '5' });
  setExams([e], []); arm();
  S.selfPick('e1', '2'); S.selfPick('e1', '4'); S.selfPick('e1', '4');
  assert.strictEqual(S.selfWrong(e).join(','), '2');
});
ok('버튼 태그 균형', () => {
  const e = EX('e1', [P(1, '중', '3'), P(2, '중', '4')]);
  setExams([e], []); arm(); S.omrSelfMode('e1', true);
  const h = S.selfPadHtml(e);
  const n = (re) => (h.match(re) || []).length;
  assert.strictEqual(n(/<div/g), n(/<\/div>/g));
  assert.strictEqual(n(/<button/g), n(/<\/button>/g));
});

okA('문항 수만 있는 시험 — 4개 중 1개 틀리면 75점', async () => {
  const e = EX('e1', [], { qCount: '4' });
  setExams([e], []); const w = arm();
  S.selfPick('e1', '3');
  const g = await S.submitExamAnswer('e1');
  assert.strictEqual(g.correct, 3);
  assert.strictEqual(w.doc.score, 75);
  assert.strictEqual(w.doc.wrongNos, '3');
  assert.strictEqual(w.doc.selfGraded, true);
  assert.strictEqual(JSON.stringify(w.doc.answers), JSON.stringify({ 1: 'O', 2: 'O', 3: 'X', 4: 'O' }));
  // 선생님 명단도 0점이 아니라 같은 점수
  const r = T.examResultOf(e, w.doc);
  assert.strictEqual(r.score, 75);
  assert.strictEqual(r.wrongNos.join(','), '3');
  assert.strictEqual(r.correct + '/' + r.n, '3/4');
});
okA('정답이 있는 시험을 직접 채점 — 선생님 화면 점수와 같다', async () => {
  const e = EX('e1', [P(1, '하', '3'), P(2, '중', '4'), P(3, '상', '1'), P(4, '중', '17')]);
  setExams([e], []); const w = arm();
  S.omrSelfMode('e1', true);
  S.selfPick('e1', '3');
  await S.submitExamAnswer('e1');
  const r = T.examResultOf(e, w.doc);
  assert.strictEqual(w.doc.score, r.score);
  assert.strictEqual(r.wrongNos.join(','), '3');
  assert.strictEqual(w.doc.selfGraded, true);
});
okA('분석만 있고 정답이 없는 시험 — 범위 밖 문항은 번호판에 없다', async () => {
  const e = EX('e1', [P(1, '하', ''), P(2, '중', ''), P(3, '상', '', { outOfRange: true })]);
  setExams([e], []); const w = arm();
  assert.strictEqual(S.selfNos(e).join(','), '1,2');
  S.selfPick('e1', '1');
  await S.submitExamAnswer('e1');
  const r = T.examResultOf(e, w.doc);
  assert.strictEqual(w.doc.score, r.score);
  assert.strictEqual(r.wrongNos.join(','), '1');
});
okA('답 찍기로 낸 건 예전 그대로 (직접 채점 표시 없음)', async () => {
  const e = EX('e1', [P(1, '중', '3'), P(2, '중', '4')]);
  setExams([e], []); const w = arm();
  S.__get('OMR_DRAFT').e1 = { '1': '3', '2': '1' };
  const g = await S.submitExamAnswer('e1');
  assert.strictEqual(g.wrong.join(','), '2');
  assert.strictEqual(w.doc.selfGraded, false);
  assert.strictEqual(w.doc.answers['2'], '1');
});
ok('선생님 명단에 직접 채점 표시', () => {
  assert.ok(T.selfMark({ selfGraded: true }).indexOf('직접') >= 0);
  assert.strictEqual(T.selfMark({}), '');
});

(async () => {
  for (const [name, fn] of run) {
    try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; }
  }
  console.log('\n' + pass + ' passed');
})();
