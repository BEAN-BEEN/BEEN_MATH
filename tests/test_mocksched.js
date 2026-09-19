// 📝 모의고사 일정 — 쌤이 직접 등록 (전엔 학생 화면 코드에 박혀 있어 못 고쳤다)
// 📅 오늘 날짜 — UTC 말고 한국 시간
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };
const Q = [];
const okAsync = (name, fn) => Q.push([name, fn]);

function load(file, extra) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  const sb = Object.assign({
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) },
    requireRole: () => {}, bmAuthReady: Promise.resolve(), showToast: () => {}
  }, extra || {});
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");', sb, { filename: file }); }
  catch (e) { err = e; }
  sb.__err = err;
  return sb;
}
const writes = [];
const T = load('teacher.html', {
  db: { collection: (c) => ({ get: async () => ({ docs: [] }), doc: (id) => ({ update: async d => writes.push({ op: 'update', c, id, d }), delete: async () => writes.push({ op: 'delete', c, id }) }), add: async d => { writes.push({ op: 'add', c, d }); return { id: 'new' }; } }) }
});
T.rNaesin = () => {};
T.showToast = () => {};   // 페이지가 제 showToast를 덮어써서, 불러온 뒤에 다시 막는다
const S = load('student.html');
const th = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
const st = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');

console.log('📅 오늘 날짜 — 한국 시간');
ok('UTC로 오늘을 계산하지 않는다', () => {
  // 자정~오전 9시 사이엔 UTC가 아직 어제라서 D-day·마감이 하루 밀렸다
  ['teacher.html', 'student.html', 'plan.html'].forEach(f => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!s.includes('new Date().toISOString().slice(0,10)'), f + '에 UTC 오늘이 남아 있음');
  });
});
ok('선생님·학생 화면에 한국 시간 오늘이 있다', () => {
  assert.strictEqual(typeof T.bmToday, 'function', '선생님 화면에 없음');
  assert.strictEqual(typeof S.bmToday, 'function', '학생 화면에 없음');
});
ok('오늘이 내 컴퓨터 날짜와 같다', () => {
  const d = new Date(), p = x => String(x).padStart(2, '0');
  const want = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  assert.strictEqual(T.bmToday(), want);
  assert.strictEqual(S.bmToday(), want);
});

console.log('\n모의고사 일정 — 등록·수정·삭제');
ok('알려진 일정이 씨앗으로 들어 있다 (10월 학력평가 포함)', () => {
  const seed = T.__get('MOCK_SEED');
  assert.ok(seed.some(x => x.date === '2026-10-20' && x.name === '10월 학력평가'), '10월 학력평가가 없음');
  assert.ok(seed.some(x => x.tentative), '잠정 표시가 없음');
});
ok('6월·9월 모의평가는 고3만, 학력평가는 고1·2·3', () => {
  const seed = T.__get('MOCK_SEED');
  const jun = seed.find(x => x.name === '6월 모의평가' && x.date.startsWith('2026'));
  const oct = seed.find(x => x.name === '10월 학력평가');
  assert.strictEqual(jun.grades.join(','), '3', '6월 모평이 고3만이 아님');
  assert.strictEqual(oct.grades.join(','), '1,2,3', '10월 학평이 전 학년이 아님');
});
ok('학년 묶어 적기', () => {
  assert.strictEqual(T.msGradeLabel([1, 2, 3]), '고1·2·3');
  assert.strictEqual(T.msGradeLabel([3]), '고3');
  assert.strictEqual(T.msGradeLabel([2, 1]), '고1·2', '순서가 달라도 같아야 함');
});
ok('학년을 눌러서 켜고 끈다', () => {
  T.__set('msPick', { for: undefined, grades: [1, 2, 3] });
  T.msToggleGrade(1); T.msToggleGrade(2);
  assert.strictEqual(T.msGradeLabel(T.__get('msPick').grades), '고3');
});
ok('수정하러 들어가면 그 일정 학년으로 채워진다', () => {
  T.__set('msPick', { for: undefined, grades: [1, 2, 3] });
  T.msSync({ id: 'x1', grades: [3] });
  assert.strictEqual(T.msGradeLabel(T.__get('msPick').grades), '고3');
  T.msToggleGrade(1);
  T.msSync({ id: 'x1', grades: [3] });
  assert.strictEqual(T.__get('msPick').grades.length, 2, '같은 일정인데 고르던 게 날아감');
  T.msSync(null);
  assert.strictEqual(T.msGradeLabel(T.__get('msPick').grades), '고1·2·3', '새로 쓸 때 기본이 아님');
});
okAsync('이미 있는 날짜는 다시 안 넣는다', async () => {
  T.__set('MOCKSCHED_CACHE', [{ id: 'a', date: '2026-10-20', name: '10월 학력평가', grades: [1, 2, 3] }]);
  writes.length = 0;
  await T.doSeedMockSched();
  const dates = writes.filter(w => w.op === 'add').map(w => w.d.date);
  assert.ok(dates.length, '아무것도 안 넣음');
  assert.ok(!dates.includes('2026-10-20'), '이미 있는 날짜를 또 넣음');
});
okAsync('삭제하면 그 문서만', async () => {
  T.__set('MOCKSCHED_CACHE', [{ id: 'a', date: '2026-10-20', name: '10월 학력평가', grades: [1, 2, 3] }]);
  writes.length = 0;
  await T.deleteMockSched('a');
  assert.strictEqual(writes[0].op, 'delete');
  assert.strictEqual(writes[0].c, 'mockSchedule');
  assert.strictEqual(writes[0].id, 'a');
});
ok('학사일정 탭 맨 위에 나온다', () => {
  assert.ok(th.includes("naesinTab==='neis' ? (mockSchedCardHtml() + examTimelineHtml()"), '탭에 안 붙음');
});
ok('다음 모의고사를 머리에 적어준다', () => {
  T.__set('MOCKSCHED_CACHE', T.__get('MOCK_SEED').map((x, i) => Object.assign({ id: 'd' + i }, x)));
  T.__set('msEditId', null);
  const h = T.mockSchedCardHtml();
  assert.ok(h.includes('다음 모의고사'), '다음 일정 안내가 없음');
  assert.ok(h.includes('📥 알려진 일정 한 번에 넣기'), '씨앗 버튼이 없음');
});
ok('이름에 태그가 있어도 안 샌다', () => {
  T.__set('MOCKSCHED_CACHE', [{ id: 'z', date: '2099-01-01', name: '<img src=x>', grades: [1] }]);
  T.__set('msEditId', null);
  assert.ok(!T.mockSchedCardHtml().includes('<img src=x>'));
});

console.log('\n학생 화면 D-day');
ok('쌤이 넣은 일정을 먼저 본다 (코드에 박힌 건 그때만)', () => {
  assert.ok(st.includes('const src=(S_MOCKSCHED&&S_MOCKSCHED.length)?S_MOCKSCHED:MOCK_SCHEDULE;'), '쌤 일정을 안 봄');
});
ok('학년이 맞는 것만 — 고1은 6월 모평이 안 뜬다', () => {
  S.__set('S_MOCKSCHED', [
    { date: '2099-06-03', name: '6월 모의평가', grades: [3] },
    { date: '2099-10-20', name: '10월 학력평가', grades: [1, 2, 3] }
  ]);
  S.__set('S_MOCKEXAMS', []); S.__set('S_CLASSES', [{ name: '고1T A1' }]);
  const n = S.nextMockExam();
  assert.strictEqual(n.name, '10월 학력평가', '고1인데 ' + (n && n.name) + '이 떴음');
});
ok('고3은 6월 모평이 뜬다', () => {
  S.__set('S_CLASSES', [{ name: '고3 A' }]);
  assert.strictEqual(S.nextMockExam().name, '6월 모의평가');
});
ok('잠정이면 (잠정)이라고 붙는다', () => {
  S.__set('S_MOCKSCHED', [{ date: '2099-11-18', name: '수능', grades: [3], tentative: true }]);
  S.__set('S_CLASSES', [{ name: '고3 A' }]);
  assert.ok(S.nextMockExam().name.includes('(잠정)'), '잠정 표시가 없음');
});
ok('학년이 안 적힌 옛 일정은 전 학년으로 본다', () => {
  S.__set('S_MOCKSCHED', [{ date: '2099-10-20', name: '10월 학력평가' }]);
  S.__set('S_CLASSES', [{ name: '고1T A1' }]);
  assert.ok(S.nextMockExam(), '학년 없는 일정이 안 잡힘');
});
ok('지난 일정은 안 뜬다', () => {
  S.__set('S_MOCKSCHED', [{ date: '2000-03-01', name: '옛날 시험', grades: [1, 2, 3] }]);
  S.__set('S_CLASSES', [{ name: '고1T A1' }]);
  assert.strictEqual(S.nextMockExam(), null);
});

console.log('\n문법');
ok('선생님·학생 화면이 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
  assert.strictEqual(S.__err, null, S.__err && S.__err.message);
});

(async () => {
  for (const [name, fn] of Q) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; }
  }
  console.log('\n' + pass + '개 통과');
})();
