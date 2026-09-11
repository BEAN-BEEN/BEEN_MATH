// 점수 입력에서 '부담임 반만 다니는 학생'만 뺀다 — 담임 반이 하나라도 있으면 그대로
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const ROOT = require('path').join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
const src = (function () {
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  return out.join('\n;\n');
})() + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';

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
try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) {}
sb.showToast = () => {};
const get = n => sb.__get(n), set = (n, v) => sb.__set(n, v);

// 담임 c1(A1) / 부담임 c2(Z2, 이름으로 추정) / 부담임 c3(role 지정)
function seed() {
  set('CLASSES', [
    { id: 'c1', name: '고1T A1' },
    { id: 'c2', name: '고1T Z2' },
    { id: 'c3', name: '고1S B4', role: '부담임' }
  ]);
  set('STUDENTS_CACHE', [
    { id: 's1', name: '담임만', classIds: ['c1'], status: '재원' },
    { id: 's2', name: '부담임만', classIds: ['c2'], status: '재원' },
    { id: 's3', name: '둘다', classIds: ['c2', 'c1'], status: '재원' },
    { id: 's4', name: 'role부담임만', classIds: ['c3'], status: '재원' },
    { id: 's5', name: 'role부담임+담임', classIds: ['c3', 'c1'], status: '재원' },
    { id: 's6', name: '반없음', classIds: [], status: '재원' },
    { id: 's7', name: '휴원담임', classIds: ['c1'], status: '휴원' }
  ]);
}

console.log('누가 남고 누가 빠지는가');
seed();
ok("담임 반만 다니면 남는다", () => assert.strictEqual(sb.isHomeroomStudent(get('STUDENTS_CACHE')[0]), true));
ok("부담임 반만 다니면 빠진다 (이름 Z로 추정된 반)", () => assert.strictEqual(sb.isHomeroomStudent(get('STUDENTS_CACHE')[1]), false));
ok("★ 부담임 반에 있어도 담임 반이 하나라도 있으면 남는다", () => {
  assert.strictEqual(sb.isHomeroomStudent(get('STUDENTS_CACHE')[2]), true, '담임 반이 있는데 빠짐 — 이러면 안 됨');
});
ok("role로 부담임 지정된 반만 다니면 빠진다", () => assert.strictEqual(sb.isHomeroomStudent(get('STUDENTS_CACHE')[3]), false));
ok("★ role 부담임 + 담임이면 남는다", () => {
  assert.strictEqual(sb.isHomeroomStudent(get('STUDENTS_CACHE')[4]), true, '담임 반이 있는데 빠짐 — 이러면 안 됨');
});
ok("반이 아예 없으면 빠진다", () => assert.strictEqual(sb.isHomeroomStudent(get('STUDENTS_CACHE')[5]), false));
ok("휴원생은 담임 반이어도 빠진다 (재원생만)", () => assert.strictEqual(sb.isHomeroomStudent(get('STUDENTS_CACHE')[6]), false));
ok("내신 인원 판정도 같은 기준을 쓴다", () => {
  get('STUDENTS_CACHE').forEach(s => assert.strictEqual(sb.isNaesinStudent(s), sb.isHomeroomStudent(s), s.name + ' 판정이 다름'));
});

console.log('\n뺀 인원 세기');
ok("부담임 반만 다니는 재원생 수를 센다", () => {
  seed();
  assert.strictEqual(sb.assistantOnlyCount(get('STUDENTS_CACHE')), 3, '부담임만·role부담임만·반없음 = 3명이어야 함');
});
ok("아무도 안 빠지면 0", () => {
  set('STUDENTS_CACHE', [{ id: 'a', name: 'ㄱ', classIds: ['c1'], status: '재원' }]);
  assert.strictEqual(sb.assistantOnlyCount(get('STUDENTS_CACHE')), 0);
});
ok("뺀 사람이 없으면 안내 문구도 안 나온다", () => {
  assert.strictEqual(sb.assistantOnlyNote(0), '');
  assert.ok(sb.assistantOnlyNote(3).includes('3명은 뺐어요'), '뺀 인원 안내가 없음');
  assert.ok(sb.assistantOnlyNote(3).includes('담임 반이 하나라도 있으면 그대로'), '오해를 막는 설명이 없음');
});

console.log('\n모의고사 점수 입력 명단');
ok("부담임 반만 다니는 학생이 명단에서 빠진다", () => {
  seed();
  set('MOCKEXAMS_CACHE', [{ id: 'm1', title: '9월 모평', maxScore: 100 }]);
  set('MOCKSUBS_CACHE', []);
  const h = sb.mockScoreRosterHtml('m1');
  assert.ok(h.includes('담임만'), '담임 학생이 안 보임');
  assert.ok(h.includes('둘다'), '★ 담임 반도 있는 학생이 빠짐');
  assert.ok(h.includes('role부담임+담임'), '★ 담임 반도 있는 학생이 빠짐');
  assert.ok(!/data-name="부담임만"/.test(h), '부담임 반만 다니는 학생이 남아 있음');
  assert.ok(!/data-name="role부담임만"/.test(h), 'role 부담임만 다니는 학생이 남아 있음');
});
ok("몇 명 뺐는지 알려준다", () => {
  seed();
  set('MOCKEXAMS_CACHE', [{ id: 'm1', title: '9월 모평', maxScore: 100 }]);
  set('MOCKSUBS_CACHE', []);
  assert.ok(sb.mockScoreRosterHtml('m1').includes('3명은 뺐어요'), '뺀 인원 안내가 없음');
});

console.log('\n시험 점수 직접 입력 명단');
ok("부담임 반 학생은 빠지고, 담임 반도 있으면 남는다", () => {
  seed();
  set('EXAMS_CACHE', [{ id: 'e1', classId: 'c2', className: '고1T Z2', maxScore: 100 }]);
  set('EXAMSUBS_CACHE', []);
  el('ds-exam').value = 'e1';
  sb.renderDirectScores();
  const h = el('directScores').innerHTML;
  assert.ok(h.includes('둘다'), '★ 담임 반도 있는 학생이 빠짐');
  assert.ok(!h.includes('부담임만'), '부담임 반만 다니는 학생이 남아 있음');
});

console.log('\n분석서 정오표 학생 고르기');
ok("같은 기준으로 걸러진다", () => {
  seed();
  set('EXAMS_CACHE', [{ id: 'e1', classId: 'c2', className: '고1T Z2', maxScore: 100, analysis: [{ no: '1' }] }]);
  set('EXAMSUBS_CACHE', []);
  set('anRepExamId', 'e1');
  const h = sb.examAnalysisTabHtml();
  // 응시자 표는 반마다 시험 문서가 달라서 anPickStudentIn(시험, 학생) 으로 연다
  assert.ok(/anPickStudent(In)?\((?:'e1',)?'s3'\)/.test(h), '★ 담임 반도 있는 학생이 빠짐');
  assert.ok(!/anPickStudent(In)?\((?:'e1',)?'s2'\)/.test(h), '부담임 반만 다니는 학생이 남아 있음');
});

console.log('\n모의고사 명단에 반이 보이는가');
ok("담임 반과 부담임 반을 구분해 보여준다", () => {
  seed();
  const h = sb.mockClassChipsHtml(get('STUDENTS_CACHE')[2]);   // 둘다 [c2(부담임), c1(담임)]
  assert.ok(h.includes('title="부담임 반"'), '부담임 반 표시가 없음');
  assert.ok(h.includes('title="담임 반"'), '담임 반 표시가 없음');
  assert.ok(h.includes('고1T Z2') && h.includes('고1T A1'), '반 이름이 안 보임');
});
ok("반이 없으면 '-'", () => {
  assert.ok(sb.mockClassChipsHtml({ classIds: [] }).includes('-'));
});
// 같은 이름의 함수를 또 만들면 나중 것이 앞의 것을 조용히 덮어쓴다 (실제로 한 번 냈던 실수)
ok("같은 이름의 함수가 두 번 선언되지 않았다", () => {
  const names = {};
  const dup = [];
  const re = /^function ([A-Za-z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = re.exec(html))) { if (names[m[1]]) dup.push(m[1]); names[m[1]] = 1; }
  assert.strictEqual(dup.join(','), '', '이름이 겹치는 함수: ' + dup.join(', '));
});

console.log('\n다른 화면은 안 건드렸는가');
ok("반별 명단(getStudentsByClass)은 그대로다", () => {
  seed();
  assert.strictEqual(sb.getStudentsByClass('c2').length, 2, '부담임 반 명단 자체가 줄어듦 (출석·숙제가 깨짐)');
});
ok("대시보드·숙제는 여전히 반 전체를 본다", () => {
  assert.ok(html.includes('function getStudentsByClass(cid, includeInactive){'), 'getStudentsByClass가 바뀜');
  assert.ok(!/getStudentsByClass\([^)]*\)\.filter\(isHomeroomStudent\)[\s\S]{0,40}rDashboard/.test(html), '대시보드까지 걸러짐');
});

console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
