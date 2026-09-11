// 📋 응시자 성적표 — 시험 하나를 고르면 누가 봤는지 한 번에
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
  const copied = [];
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node', clipboard: { writeText: (t) => { copied.push(t); return Promise.resolve(); } } },
    alert: () => {}, confirm: () => true, prompt: (a, t) => { copied.push(t); return ''; },
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(src, sb, { filename: file }); } catch (e) { err = e; }
  sb.__els = els; sb.__err = err; sb.__copied = copied;
  sb.showToast = () => {};
  return sb;
}

const T = load('teacher.html');
const P = (no, difficulty, answer, extra) => Object.assign({ no: String(no), difficulty, answer, points: '', qType: '' }, extra || {});
const probs4 = [P(1, '하', '1'), P(2, '중', '2'), P(3, '상', '3'), P(4, '중', '4')];
const EXAM = { id: 'e1', title: '2024 평촌고 1-2-1 기출', classId: 'c1', className: '고1T A1', maxScore: 100, analysis: probs4 };

function seed(subs) {
  T.__set('CLASSES', [{ id: 'c1', name: '고1T A1', role: '담임' }, { id: 'c9', name: '고1T Z9', role: '부담임' }]);
  T.__set('STUDENTS_CACHE', [
    { id: 's1', name: '김민서', classIds: ['c1'], status: '재원' },
    { id: 's2', name: '이서준', classIds: ['c1'], status: '재원' },
    { id: 's3', name: '박지후', classIds: ['c1'], status: '재원' },
    { id: 's4', name: '최유나', classIds: ['c1'], status: '퇴원' }
  ]);
  T.__set('EXAMS_CACHE', [EXAM]);
  T.__set('EXAMSUBS_CACHE', subs || []);
  T.__set('anRepExamId', 'e1');
  T.__set('anRepStId', '');
  T.__set('anRosterOpenMissing', false);
}

console.log('\n한 학생 결과 (분석서와 같은 규칙)');
ok('다 맞으면 100점', () => {
  seed();
  const r = T.examResultOf(EXAM, { answers: { '1': '1', '2': '2', '3': '3', '4': '4' } });
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.correct, 4);
  assert.strictEqual(r.n, 4);
  assert.strictEqual(r.wrongNos.length, 0);
});
ok('틀린 번호를 모은다', () => {
  seed();
  const r = T.examResultOf(EXAM, { answers: { '1': '1', '2': '5', '3': '3', '4': '1' } });
  assert.strictEqual(r.wrongNos.join(','), '2,4');
  assert.strictEqual(r.correct, 2);
});
ok('찍어서 맞은 게 있으면 실질 점수가 낮다', () => {
  seed();
  const r = T.examResultOf(EXAM, { answers: { '1': '1', '2': '2', '3': '3', '4': '4' }, guessedNos: '3' });
  assert.strictEqual(r.score, 100);
  assert.ok(r.real < 100, '실질 점수가 안 깎임: ' + r.real);
  assert.strictEqual(r.guess, 1);
});
ok('시간 넘긴 것도 센다 (찍음과 겹치면 한 번만)', () => {
  seed();
  const r = T.examResultOf(EXAM, { answers: { '1': '1', '2': '2', '3': '3', '4': '4' }, guessedNos: '3', lateNos: '3, 4' });
  assert.strictEqual(r.guess, 1);
  assert.strictEqual(r.late, 1, '찍음과 겹친 3번까지 셈');
});
ok('범위 아님은 점수에서 빠진다', () => {
  seed();
  const r = T.examResultOf(EXAM, { answers: { '1': '1', '2': '2', '3': '3' }, skipNos: '4' });
  assert.strictEqual(r.score, 100, '안 푼 범위 밖 문항 때문에 깎임');
  assert.strictEqual(r.n, 3);
  assert.strictEqual(r.skip, 1);
});
ok('답안 없이 정오표만 찍은 경우도 읽는다', () => {
  seed();
  const r = T.examResultOf(EXAM, { wrongNos: '2, 3' });
  assert.strictEqual(r.wrongNos.join(','), '2,3');
});
ok('분석서 점수와 같은 숫자가 나온다', () => {
  // 표와 분석서 숫자가 다르면 선생님이 헷갈린다
  const sub = { examId: 'e1', studentId: 's1', answers: { '1': '1', '2': '9', '3': '3', '4': '4' }, guessedNos: '4' };
  seed([sub]);
  T.__set('anRepStId', 's1');
  T.__set('anOX', null);
  const r = T.examResultOf(EXAM, sub);
  const h = T.anReportHtml();
  assert.ok(h.indexOf(r.score + '/100') >= 0, '분석서 점수(' + r.score + ')가 안 보임');
  assert.ok(h.indexOf(r.real + '/100') >= 0, '분석서 실질 점수(' + r.real + ')가 안 보임');
});

console.log('\n응시자 표');
ok('낸 학생만 표에 나오고 점수 높은 순', () => {
  seed([
    { examId: 'e1', studentId: 's1', answers: { '1': '1', '2': '9', '3': '9', '4': '9' } },   // 1개
    { examId: 'e1', studentId: 's2', answers: { '1': '1', '2': '2', '3': '3', '4': '4' } }    // 전부
  ]);
  const h = T.anRosterHtml(EXAM);
  assert.ok(h.indexOf('응시한 학생') >= 0);
  assert.ok(h.indexOf('>2명<') >= 0, '응시 인원이 틀림');
  const i1 = h.indexOf('이서준'), i2 = h.indexOf('김민서');
  assert.ok(i1 >= 0 && i2 >= 0);
  assert.ok(i1 < i2, '점수 높은 순이 아님');
});
ok('평균 점수를 보여준다', () => {
  seed([
    { examId: 'e1', studentId: 's1', answers: { '1': '1', '2': '2', '3': '3', '4': '4' } },
    { examId: 'e1', studentId: 's2', answers: { '1': '1', '2': '2', '3': '3', '4': '4' } }
  ]);
  assert.ok(T.anRosterHtml(EXAM).indexOf('평균 <strong style="color:var(--text)">100점') >= 0);
});
ok('틀린 번호가 표에 바로 보인다', () => {
  seed([{ examId: 'e1', studentId: 's1', answers: { '1': '1', '2': '9', '3': '3', '4': '9' } }]);
  assert.ok(T.anRosterHtml(EXAM).indexOf('2, 4') >= 0);
});
ok('행을 누르면 그 학생 분석서로', () => {
  seed([{ examId: 'e1', studentId: 's1', answers: { '1': '1' } }]);
  assert.ok(T.anRosterHtml(EXAM).indexOf("anPickStudent('s1')") >= 0);
});
ok('반을 옮긴 학생도 답안이 있으면 표에 남는다', () => {
  seed([{ examId: 'e1', studentId: 'gone', studentName: '전학간학생', answers: { '1': '1' } }]);
  assert.ok(T.anRosterHtml(EXAM).indexOf('전학간학생') >= 0);
});

console.log('\n아직 안 낸 학생');
ok('안 낸 학생 수를 보여준다 (퇴원생은 뺀다)', () => {
  seed([{ examId: 'e1', studentId: 's1', answers: { '1': '1' } }]);
  const h = T.anRosterHtml(EXAM);
  assert.ok(h.indexOf('아직 안 낸 학생 2명') >= 0, '미응시 인원이 틀림');
  assert.ok(h.indexOf('최유나') < 0, '퇴원생이 나옴');
});
ok('누가 냈으면 미응시 명단은 접혀 있다', () => {
  seed([{ examId: 'e1', studentId: 's1', answers: { '1': '1' } }]);
  const h = T.anRosterHtml(EXAM);
  assert.ok(h.indexOf("anPickStudent('s2')") < 0, '접혀 있어야 하는데 펼쳐짐');
  assert.ok(h.indexOf('펼치기') >= 0);
});
ok('아무도 안 냈으면 미응시 명단이 펼쳐져 있다', () => {
  seed([]);
  const h = T.anRosterHtml(EXAM);
  assert.ok(h.indexOf("anPickStudent('s1')") >= 0, '아무도 안 냈는데 명단이 숨음');
  assert.ok(h.indexOf('아직 답안을 낸 학생이 없어요') >= 0);
});
ok('부담임 반만 다니는 학생은 명단에 없다', () => {
  seed([]);
  const st = T.__get('STUDENTS_CACHE');
  st.push({ id: 's9', name: '부담임만', classIds: ['c9'], status: '재원' });
  T.__set('STUDENTS_CACHE', st);
  // c9 반 시험이면 이 학생은 대상이 아니다
  const e9 = Object.assign({}, EXAM, { id: 'e9', classId: 'c9', className: '고1T Z9' });
  assert.ok(T.anRosterHtml(e9).indexOf('부담임만') < 0, '부담임 반만 다니는 학생이 나옴');
});
ok('명단 복사 — 카톡에 붙일 문장', () => {
  seed([{ examId: 'e1', studentId: 's1', answers: { '1': '1' } }]);
  T.__copied.length = 0;
  T.anCopyMissingExam('e1');
  assert.strictEqual(T.__copied.length, 1);
  assert.ok(T.__copied[0].indexOf('이서준') >= 0 && T.__copied[0].indexOf('박지후') >= 0);
  assert.ok(T.__copied[0].indexOf('김민서') < 0, '낸 학생까지 들어감');
  assert.ok(T.__copied[0].indexOf('답안지 넣을 시험') >= 0, '어디서 넣는지 안내가 없음');
});

console.log('\n시험 고르기');
ok('응시한 학생이 있는 시험이 앞으로 온다', () => {
  seed([{ examId: 'b', studentId: 's1', answers: {} }]);
  const list = [{ id: 'a', title: 'A', createdAt: '2026-09-10' }, { id: 'b', title: 'B', createdAt: '2026-08-01' }];
  assert.strictEqual(T.anExamChipOrder(list).map(e => e.id).join(','), 'b,a');
});
ok('시험을 바꾸면 고른 학생이 풀린다', () => {
  seed();
  T.__set('anRepStId', 's1');
  T.rGrades = () => {};
  T.anPickExam('e1');
  assert.strictEqual(T.__get('anRepStId'), '');
});
ok('칩에 반 이름이 한 번만 나온다', () => {
  const html = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
  const i = html.indexOf('anExamChipOrder(withAn).map(');
  assert.ok(i >= 0, '칩 코드를 못 찾음');
  const line = html.slice(i, html.indexOf('\n', i));
  assert.strictEqual((line.match(/e\.className/g) || []).length, 1, '반 이름이 중복됨');
});
ok('이름에 태그가 있어도 안 샌다', () => {
  seed([{ examId: 'e1', studentId: 'x', studentName: '<img src=x>', answers: { '1': '1' } }]);
  assert.ok(T.anRosterHtml(EXAM).indexOf('<img src=x>') < 0);
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});

console.log('\n' + pass + '개 통과');
