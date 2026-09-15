// 🔶 직보 인원 — 누구를 부르고 누구를 빼는가 + 플래너 달력·캡처표
//   부담임 반만 다니거나 반이 아예 없으면 뺀다. 담임 반이 하나라도 있으면 남긴다.
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
  const els = {};
  const el = id => { if (!els[id]) els[id] = { id, value: '', innerHTML: '' }; return els[id]; };
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: el, addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) },
    requireRole: () => {}, bmAuthReady: Promise.resolve(), showToast: () => {},
    db: { collection: () => ({ get: async () => ({ docs: [] }), doc: () => ({}), add: async () => ({}) }) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");', sb, { filename: file }); }
  catch (e) { err = e; }
  sb.__els = els; sb.__err = err;
  return sb;
}

const J = load('plan.html');
const T = load('teacher.html');
const ph = fs.readFileSync(path.join(ROOT, 'plan.html'), 'utf8');

// 실제 반 이름 모양 그대로 — 이름의 X/Y/Z를 부담임으로 본다 (role이 있으면 role 우선)
const CLASSES = [
  { id: 'a1', name: '고1T A1' }, { id: 'b2', name: '고1T B2' },
  { id: 'z2', name: '고1T Z2' }, { id: 'z4', name: '고1S Z4' },
  { id: 'sp', name: '고1 ST 여름 특강', role: '부담임' }
];
// 박시후처럼 부담임 반과 담임 반을 같이 다니는 학생은 남아야 한다
const STUDENTS = [
  { id: 's1', name: '박시후', school: '부흥고등학교', classIds: ['z2', 'b2', 'a1'], status: '재원' },
  { id: 's2', name: '최준서', school: '부흥고', classIds: ['z2', 'a1'], status: '재원' },
  { id: 's3', name: '설우진', school: '부흥고', classIds: ['z4'], status: '재원' },
  { id: 's4', name: '윤서진', school: '부흥고', classIds: [], status: '재원' },
  { id: 's5', name: '한휴원', school: '부흥고', classIds: ['a1'], status: '휴원' }
];
const EXAM = { id: 'e1', school: '부흥고', startDate: '2026-09-29', endDate: '2026-10-01', mathDate: '2026-09-30' };

function seedPlan() {
  J.__set('P_CLASSES', CLASSES);
  J.__set('P_STUDENTS', STUDENTS.filter(s => s.status === '재원').map(s => Object.assign({}, s, { school: J.normSchool(s.school) })));
  J.__set('P_EXAMS', [Object.assign({}, EXAM)]);
  J.__set('P_MAKEUPS', []);
  J.__get('_JB_CACHE').clear();
}
function seedTeacher() {
  T.__set('CLASSES', CLASSES);
  T.__set('STUDENTS_CACHE', STUDENTS.map(s => Object.assign({}, s, { school: T.normSchool(s.school) })));
}

console.log('직보에 부르는 사람 — 플래너');
seedPlan();
ok('부담임 반과 담임 반을 같이 다니면 남는다 (박시후)', () => {
  const s = J.__get('P_STUDENTS').find(x => x.name === '박시후');
  assert.strictEqual(J.isJikboExcluded(s), false, '담임 반이 있는데 빠졌음');
});
ok('부담임 반만 다니면 뺀다 (설우진)', () => {
  const s = J.__get('P_STUDENTS').find(x => x.name === '설우진');
  assert.strictEqual(J.isJikboExcluded(s), true, '부담임만 다니는데 남았음');
});
ok('반이 아예 없으면 뺀다 (윤서진)', () => {
  // 담임인지 부담임인지 알 수가 없다 → 인원에 안 넣는다
  const s = J.__get('P_STUDENTS').find(x => x.name === '윤서진');
  assert.strictEqual(J.isJikboExcluded(s), true, '반이 없는데 남았음');
});
ok('반 역할(role)이 적혀 있으면 이름보다 그게 먼저', () => {
  assert.strictEqual(J.classIsHomeroom({ name: '고1 ST 여름 특강', role: '부담임' }), false);
  assert.strictEqual(J.classIsHomeroom({ name: '고1T Z2', role: '담임' }), true, 'role보다 이름을 먼저 봄');
});
ok('그날 직보 명단에 박시후·최준서만', () => {
  const on = J.jikboOn('2026-09-29');
  assert.strictEqual(on.length, 1, '직보가 ' + on.length + '건');
  assert.strictEqual(on[0].students.slice().sort().join(','), '박시후,최준서');
});
ok("'부흥고'와 '부흥고등학교'를 같은 학교로 본다", () => {
  // 박시후만 '부흥고등학교'로 적혀 있어서 여태 어느 명단에도 안 잡혔다
  assert.strictEqual(J.normSchool('부흥고등학교'), '부흥고');
  assert.ok(J.jikboOn('2026-09-29')[0].students.includes('박시후'), '박시후가 빠짐');
});
ok('휴원생은 애초에 명단에 없다', () => {
  assert.ok(!J.jikboOn('2026-09-29')[0].students.includes('한휴원'));
});

console.log('\n직보 참석 명단 — 선생님 화면도 같은 기준');
seedTeacher();
ok('부담임 반만 다니거나 반이 없으면 뺀다', () => {
  const m = { id: 'm1', date: '2026-09-29', className: '부흥고 직보', school: '부흥고', auto: true };
  const all = T.makeupRoster(m);
  const roster = all.filter(s => !T.isJikboSkip(s)).map(s => s.name).sort();
  assert.strictEqual(roster.join(','), '박시후,최준서', '명단이 다름: ' + roster);
});
ok('학교 전체로 잡힌 직보에서만 거른다', () => {
  assert.strictEqual(T.makeupIsSchoolWide({ date: '2026-09-29', className: '부흥고 직보', school: '부흥고' }), true);
  assert.strictEqual(T.makeupIsSchoolWide({ date: '2026-09-29', className: '설우진', school: '부흥고' }), false, '개인 보강인데 학교 전체로 봄');
  assert.strictEqual(T.makeupIsSchoolWide({ date: '2026-09-29', className: '고1T A1' }), false, '학교가 없는데 학교 전체로 봄');
});
ok('개인 이름으로 잡은 보강은 부담임이어도 그대로 부른다', () => {
  const m = { date: '2026-09-29', className: '설우진', school: '부흥고' };
  const all = T.makeupRoster(m);
  const hidden = T.makeupIsSchoolWide(m) ? all.filter(T.isJikboSkip) : [];
  assert.strictEqual(hidden.length, 0, '직접 부른 학생이 빠짐');
  assert.strictEqual(all.map(s => s.name).join(','), '설우진');
});
ok('학교 이름을 양쪽 다 맞춰 본다', () => {
  const r = T.makeupRoster({ date: '2026-09-29', className: '부흥고등학교 직보', school: '부흥고등학교' });
  assert.ok(r.some(s => s.name === '박시후'), '박시후가 빠짐');
});
ok('몇 명을 뺐는지 알려준다', () => {
  const note = T.assistantOnlyNote(2);
  assert.ok(note.includes('2명'), '인원이 없음');
  assert.ok(note.includes('반이 없는'), '반 없는 학생 설명이 없음');
});
ok('선생님 화면과 플래너가 같은 사람을 부른다', () => {
  const m = { date: '2026-09-29', className: '부흥고 직보', school: '부흥고' };
  const t = T.makeupRoster(m).filter(s => !T.isJikboSkip(s)).map(s => s.name).sort().join(',');
  const p = J.jikboOn('2026-09-29')[0].students.slice().sort().join(',');
  assert.strictEqual(t, p, '선생님(' + t + ')과 플래너(' + p + ')가 다름');
});

console.log('\n📆 플래너 직보 카드 — 주 단위 칸, 글씨는 크게');
ok('달력이 아니라 주 단위 칸이다 (위에 달력이 이미 있다)', () => {
  assert.ok(ph.includes('function jikboDayCell('), '주 단위 칸이 없음');
  assert.ok(!ph.includes('function jbCalShift('), '달력이 또 남아 있음');
  assert.ok(ph.includes('let jbWeekStart=null, jbWeeks=2;'), '주 단위 상태가 없음');
});
ok('1 · 2 · 3 · 4주 — 시험기간이 한 달까지 늘어질 때가 있다', () => {
  assert.ok(ph.includes("${[1,2,3,4].map(wkBtn).join('')}"), '주 버튼이 없음');
  assert.ok(ph.includes('function jbSetWeeks(k)'), '주 바꾸기가 없음');
  assert.ok(ph.includes("onclick=\"jbShift(-7)\"") && ph.includes("onclick=\"jbShift(7)\""), '앞뒤로 넘기기가 없음');
});
ok('주마다 날짜 범위와 직보 일수·연인원을 머리에 적는다', () => {
  assert.ok(/🔶 직보 \${wDays}일 · 연인원 \${wJb}명/.test(ph), '주 요약이 없음');
  assert.ok(ph.includes("'<span class=\"badge b-green\">이번 주</span>'"), '이번 주 표시가 없음');
});
ok('칸에 학생 이름이 그대로 나온다', () => {
  assert.ok(ph.includes("${e.students.join(', ')}"), '학생 이름이 없음');
  assert.ok(ph.includes("🔶${e.time} ${shortSchool(e.school)}"), '시간·학교가 없음');
});
ok('칸 맨 아래에 직보 / 수업 / 총원', () => {
  assert.ok(ph.includes('직보 ${N}'), '직보 인원이 없음');
  assert.ok(ph.includes('수업 ${M}'), '수업 인원이 없음');
  assert.ok(ph.includes('총 ${total}명'), '총원이 없음');
});
ok('캡처해서 보내는 것이라 글씨가 크다', () => {
  // 원래는 이름이 10.5px이라 캡처하면 안 읽혔다
  assert.ok(ph.includes('font-size:13px;color:var(--text-sub);line-height:1.45'), '학생 이름이 작음');
  assert.ok(ph.includes('font-size:14px;font-weight:800;color:var(--orange)'), '시간·학교가 작음');
  assert.ok(ph.includes('font-size:16px;color:var(--text)">총 ${total}명'), '총원이 작음');
  assert.ok(!/font-size:10\.5px/.test(ph), '옛 10.5px가 남아 있음');
});
ok('수학 시험일과 공휴일도 칸 머리에 적는다', () => {
  assert.ok(ph.includes('📐 ${math.join(\' \')}'), '수학 시험일이 없음');
  assert.ok(/const math=\[\][\s\S]{0,200}math\.indexOf\(nm\)<0/.test(ph), '같은 학교가 두 번 찍힘');
});
ok('수업 인원은 직보 가는 학생과 다음 날 시험인 학생을 뺀다', () => {
  assert.ok(ph.includes('function classComingOn(ds)'), '수업 예상 인원이 없음');
  assert.ok(/classComingOn[\s\S]{0,400}if\(J\.has\(id\)\) return;/.test(ph), '직보 가는 학생을 안 뺌');
  assert.ok(/classComingOn[\s\S]{0,400}if\(hasOtherExamNextDay\(st, ds\)\) return;/.test(ph), '다음 날 시험인 학생을 안 뺌');
});
ok('좁은 화면에서는 옆으로 넘겨 본다', () => {
  assert.ok(/overflow-x:auto[\s\S]{0,120}grid-template-columns:repeat\(7,minmax\(94px,1fr\)\)/.test(ph), '가로 스크롤이 없음');
});
ok('직보 규칙 설명이 카드에 남아 있다', () => {
  assert.ok(ph.includes('다음 날 다른 과목 시험이면 그날은 쉬어요'), '쉬는 날 설명이 없음');
});
ok('표를 따로 그리지 않는다 (카드 하나)', () => {
  assert.ok(!ph.includes('jikboSheet'), '표 카드가 남아 있음');
  assert.ok(ph.includes('rBriefing(); rJikbo();'), '처음 그리기가 안 맞음');
});

console.log('\n문법');
ok('plan.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(J.__err, null, J.__err && J.__err.message);
});
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});

console.log('\n' + pass + '개 통과');
