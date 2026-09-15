// 🔢 문항별 보기 (1번부터 순서대로) + 시험지 목록 번호순
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
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
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
const P = (no, answer, extra) => Object.assign({ no: String(no), difficulty: '중', answer, points: '', qType: '', bigUnit: '집합', smallUnit: '집합의 연산' }, extra || {});
const probs = [P(1, '1'), P(2, '2'), P(3, '3'), P(4, '4')];
const EA = { id: 'ea', title: '11_2025_관양고_1-2-1', classId: 'cA', className: '고1A B5', maxScore: 100, analysis: probs };
const EB = { id: 'eb', title: '11_2025_관양고_1-2-1', classId: 'cB', className: '고1S B4', maxScore: 100, analysis: probs };

function seed(subs, exams) {
  T.__set('CLASSES', [{ id: 'cA', name: '고1A B5', role: '담임' }, { id: 'cB', name: '고1S B4', role: '담임' }]);
  T.__set('STUDENTS_CACHE', [
    { id: 'a1', name: '김가은', classIds: ['cA'], status: '재원' },
    { id: 'a2', name: '김수하', classIds: ['cA'], status: '재원' },
    { id: 'b1', name: '박지후', classIds: ['cB'], status: '재원' }
  ]);
  T.__set('EXAMS_CACHE', exams || [EA, EB]);
  T.__set('EXAMSUBS_CACHE', subs || []);
  T.__set('anRepExamId', 'ea');
  T.__set('anRepStId', '');
  T.__set('anViewMode', 'question');
  T.__set('anPaperOpenMissing', false);
}
const S = (examId, studentId, answers, extra) => Object.assign({ examId, studentId, answers }, extra || {});

console.log('\n시험지 목록은 이름 번호순');
ok('01, 02 … 10, 11 순서로 (10이 2 뒤로 가지 않게)', () => {
  const mk = (t, i) => ({ id: 'x' + i, title: t, classId: 'cA', className: '고1A B5', analysis: probs });
  T.__set('CLASSES', [{ id: 'cA', name: '고1A B5' }]);
  T.__set('EXAMSUBS_CACHE', []);
  T.__set('EXAMS_CACHE', [
    mk('11_2025_관양고_1-2-1', 1), mk('02_2024_안양여고_1-2-1', 2),
    mk('01_2024_평촌고_1-2-1', 3), mk('10_2025_우성고_1-2-1', 4)
  ]);
  assert.strictEqual(T.anPaperGroups().map(g => g.title.slice(0, 2)).join(','), '01,02,10,11');
});
ok('응시자가 있어도 순서가 안 흐트러진다', () => {
  // 예전엔 응시자 있는 시험지가 맨 앞으로 튀어 번호 순서가 깨졌다
  const mk = (id, t) => ({ id, title: t, classId: 'cA', className: '고1A B5', analysis: probs });
  T.__set('CLASSES', [{ id: 'cA', name: '고1A B5' }]);
  T.__set('EXAMS_CACHE', [mk('e1', '01_2024_평촌고_1-2-1'), mk('e9', '09_2025_평촌고_1-2-1')]);
  T.__set('EXAMSUBS_CACHE', [S('e9', 'a1', { '1': '1' })]);
  assert.strictEqual(T.anPaperGroups().map(g => g.title.slice(0, 2)).join(','), '01,09');
});

console.log('\n문항별 — 1번부터 순서대로');
ok('번호 순서로 나온다 (분석이 뒤섞여 있어도)', () => {
  const mixed = [P(3, '3'), P(1, '1'), P(10, '5'), P(2, '2')];
  const E = Object.assign({}, EA, { analysis: mixed });
  seed([S('ea', 'a1', { '1': '1', '2': '2', '3': '3', '10': '5' })], [E]);
  const h = T.anQuestionViewHtml(E);
  const nos = [...h.matchAll(/text-align:center;font-weight:800">(\d+)/g)].map(m => m[1]);
  assert.strictEqual(nos.join(','), '1,2,3,10', '번호순이 아님: ' + nos.join(','));
});
ok('문항마다 정답률과 틀린 학생이 나온다', () => {
  seed([
    S('ea', 'a1', { '1': '1', '2': '9', '3': '3', '4': '4' }),   // 2번 틀림
    S('eb', 'b1', { '1': '1', '2': '9', '3': '9', '4': '4' })    // 2,3번 틀림
  ]);
  const h = T.anQuestionViewHtml(EA);
  assert.ok(h.indexOf('김가은') >= 0 && h.indexOf('박지후') >= 0, '틀린 학생 이름이 없음');
  assert.ok(h.indexOf('0%') >= 0, '2번 정답률 0%가 없음');
  assert.ok(h.indexOf('다 맞았어요') >= 0, '전원 정답 문항 표시가 없음');
});
ok('여러 반 학생을 함께 센다', () => {
  seed([S('ea', 'a1', { '1': '9' }), S('eb', 'b1', { '1': '1' })]);
  const h = T.anQuestionViewHtml(EA);
  assert.ok(/1\/2/.test(h), '두 반 합쳐 1/2 가 아님');
});
ok('제일 낮은 문항을 위에 짚어준다', () => {
  seed([S('ea', 'a1', { '1': '1', '2': '9', '3': '3', '4': '4' })]);
  const h = T.anQuestionViewHtml(EA);
  assert.ok(h.indexOf('다시 짚어야 할 문항') >= 0, '안내가 없음');
  assert.ok(/다시 짚어야 할 문항[\s\S]{0,80}2번/.test(h), '2번을 안 짚음');
});
ok('찍거나 시간 넘겨 맞은 학생을 따로 알려준다', () => {
  seed([S('ea', 'a1', { '1': '1', '2': '2', '3': '3', '4': '4' }, { guessedNos: '3' })]);
  const h = T.anQuestionViewHtml(EA);
  assert.ok(h.indexOf('찍거나 시간 넘겨 맞음') >= 0, '찍음 안내가 없음');
});
ok('학생이 범위 아님으로 표시한 문항은 안 센다', () => {
  seed([S('ea', 'a1', { '1': '1', '2': '2', '3': '3' }, { skipNos: '4' })]);
  const h = T.anQuestionViewHtml(EA);
  // 4번은 응시자 0명 → 정답률 '-'
  assert.ok(/text-align:center;font-weight:800">4[\s\S]{0,500}?>-<\/strong>/.test(h), '4번이 집계에서 안 빠짐');
});
ok('그 반에서 범위 밖인 문항도 안 센다', () => {
  const EBout = Object.assign({}, EB, { analysis: probs.map((p, i) => Object.assign({}, p, { outOfRange: i === 3 })) });
  seed([S('ea', 'a1', { '1': '1', '4': '4' }), S('eb', 'b1', { '1': '1' })], [EA, EBout]);
  const h = T.anQuestionViewHtml(EA);
  assert.ok(/text-align:center;font-weight:800">4[\s\S]{0,500}?1\/1/.test(h), '4번을 고1A B5 한 명만 세야 함');
});
ok('틀린 학생 이름을 누르면 그 학생 분석서로', () => {
  seed([S('eb', 'b1', { '1': '9' })]);
  assert.ok(T.anQuestionViewHtml(EA).indexOf("anPickStudentIn('eb','b1')") >= 0);
});
ok('아무도 안 냈으면 안내만', () => {
  seed([]);
  assert.ok(T.anQuestionViewHtml(EA).indexOf('아직 답안을 낸 학생이 없어요') >= 0);
});
ok('이름에 태그가 있어도 안 샌다', () => {
  seed([S('ea', 'x', { '1': '9' })]);
  T.__set('EXAMSUBS_CACHE', [S('ea', 'x', { '1': '9' }, { studentName: '<img src=x>' })]);
  assert.ok(T.anQuestionViewHtml(EA).indexOf('<img src=x>') < 0);
});

console.log('\n보기 전환');
ok('학생별 / 문항별 버튼이 있다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
  // 버튼은 map으로 만들어져서 소스엔 anSetView('${v}') 꼴로 들어 있다
  assert.ok(html.indexOf("['student','👤 학생별'],['question','🔢 문항별']") >= 0, '보기 전환 버튼이 없음');
  assert.ok(html.indexOf('onclick="anSetView(') >= 0);
  assert.strictEqual(typeof T.anSetView, 'function');
});
ok('기본은 학생별', () => {
  const T2 = load('teacher.html');
  assert.strictEqual(T2.__get('anViewMode'), 'student');
});
ok('문항별을 고르면 문항 표가 나온다', () => {
  seed([S('ea', 'a1', { '1': '1', '2': '9' })]);
  T.__set('anViewMode', 'question');
  const h = T.anPaperRosterHtml(EA);
  assert.ok(h.indexOf('>틀린 학생</th>') >= 0, '문항 표가 아님');
  assert.ok(h.indexOf('>등수</th>') < 0, '학생 표가 같이 나옴');
});
ok('학생별로 돌아오면 학생 표', () => {
  seed([S('ea', 'a1', { '1': '1', '2': '9' })]);
  T.__set('anViewMode', 'student');
  const h = T.anPaperRosterHtml(EA);
  assert.ok(h.indexOf('>등수</th>') >= 0, '학생 표가 아님');
  assert.ok(h.indexOf('>틀린 학생</th>') < 0, '문항 표가 같이 나옴');
});
ok('어느 쪽이든 미응시 명단은 그대로', () => {
  seed([S('ea', 'a1', { '1': '1' })]);
  ['student', 'question'].forEach(v => {
    T.__set('anViewMode', v);
    assert.ok(T.anPaperRosterHtml(EA).indexOf('아직 안 낸 학생') >= 0, v + ' 에서 미응시가 사라짐');
  });
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});

console.log('\n' + pass + '개 통과');
