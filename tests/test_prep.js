// 📦 내신 대비 자료 — 학교마다 몇 부 뽑을지(담임 + 부담임), 챙길 네 가지
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };
const Q = [];
const okAsync = (name, fn) => Q.push([name, fn]);

const th = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
const out = []; let i = 0;
for (;;) {
  const s = th.indexOf('<script', i); if (s < 0) break;
  const gt = th.indexOf('>', s), head = th.slice(s, gt), e = th.indexOf('</script>', gt);
  if (e < 0) break;
  if (!head.includes('src=')) out.push(th.slice(gt + 1, e));
  i = e + 9;
}
const writes = [];
const T = {
  console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
  document: { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '', search: '', replace: () => {} },
  navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
  addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
  firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
};
T.window = T; T.globalThis = T; T.self = T;
vm.createContext(T);
let bootErr = null;
try { vm.runInContext(out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");', T, { filename: 'teacher.html' }); }
catch (e) { bootErr = e; }
T.showToast = () => {};
T.rNaesin = () => {};
T.db = { collection: (c) => ({ doc: (id) => ({ update: async (d) => { writes.push({ c, id, d }); } }) }) };

// 실제 모양: 최준서는 T·S·A 세 반을 다 다닌다 / 설우진은 부담임 반만 / 윤서진은 반이 없다
const CLASSES = [
  { id: 'tz2', name: '고1T Z2' }, { id: 'ta1', name: '고1T A1' },
  { id: 'sa4', name: '고1S A4' }, { id: 'ab5', name: '고1A B5' },
  { id: 'sz4', name: '고1S Z4' }, { id: 'sema', name: '고2 세마' }
];
const STUDENTS = [
  { id: 'a', name: '박시후', school: '부흥고', classIds: ['tz2', 'ta1'], status: '재원' },
  { id: 'b', name: '최준서', school: '부흥고', classIds: ['tz2', 'sa4', 'ab5'], status: '재원' },
  { id: 'c', name: '설우진', school: '부흥고', classIds: ['sz4'], status: '재원' },
  { id: 'd', name: '윤서진', school: '부흥고', classIds: [], status: '재원' },
  { id: 'e', name: '한휴원', school: '부흥고', classIds: ['ta1'], status: '휴원' },
  { id: 'f', name: '이세마', school: '부흥고', classIds: ['sema'], status: '재원' }
];
function seed(prep) {
  T.__set('CLASSES', CLASSES);
  T.__set('STUDENTS_CACHE', STUDENTS.map(x => Object.assign({}, x)));
  T.__set('SCHOOLEXAMS_CACHE', [{ id: 'ex1', school: '부흥고', title: '2학기 중간고사', startDate: '2026-09-29', endDate: '2026-10-01', mathDate: '2026-09-30', prep: prep || {} }]);
  writes.length = 0;
}

console.log('누구를 세나');
seed();
ok('부담임 반만 다니면 부담임으로 센다', () => {
  assert.strictEqual(T.isAssistantStudent(STUDENTS[2]), true, '설우진이 부담임이 아님');
});
ok('담임 반이 하나라도 있으면 부담임으로 안 센다 (담임 쪽에서 센다)', () => {
  assert.strictEqual(T.isAssistantStudent(STUDENTS[0]), false, '박시후가 부담임으로 세어짐');
});
ok('반이 아예 없으면 어느 쪽에도 안 센다', () => {
  assert.strictEqual(T.isAssistantStudent(STUDENTS[3]), false, '윤서진이 부담임으로 세어짐');
  assert.strictEqual(T.isHomeroomStudent(STUDENTS[3]), false, '윤서진이 담임으로 세어짐');
});
ok('휴원생은 안 센다', () => {
  assert.strictEqual(T.isAssistantStudent(STUDENTS[4]), false);
});

console.log('\n몇 부 — 사람 수로');
ok('★ 여러 반을 다니는 학생을 겹쳐 세지 않는다', () => {
  // 최준서는 T·S·A 세 반 — 예전엔 세 번 세어서 부흥고가 5부로 나왔다
  seed();
  const h = T.schoolInfoHtml();
  assert.ok(h.includes('📄 필요 4부'), '부흥고 필요 부수가 틀림: ' + (h.match(/📄 필요 \d+부/) || [])[0]);
  assert.ok(h.includes('✏️ 변형 3 · 📘 원본 1'), '담임·부담임 나눔이 틀림');
});
ok('반 이름에 T·S·A가 없는 학생도 빠뜨리지 않는다', () => {
  seed();
  const h = T.schoolInfoHtml();
  assert.ok(h.includes('이세마'), '고2 세마 학생이 빠짐');
  assert.ok(h.includes('>기타</span>'), '기타 줄이 없음');
});
ok('부담임 반 학생은 따로 이름까지', () => {
  seed();
  const h = T.schoolInfoHtml();
  assert.ok(h.includes('부담임 반 1명'), '부담임 인원이 없음');
  assert.ok(/부담임 반 1명[\s\S]{0,200}설우진/.test(h), '부담임 이름이 없음');
});
ok('반 없는 학생·휴원생은 명단에도 없다', () => {
  seed();
  const h = T.schoolInfoHtml();
  assert.ok(!h.includes('윤서진'), '반 없는 학생이 나옴');
  assert.ok(!h.includes('한휴원'), '휴원생이 나옴');
});
ok('머리에 전체 부수와 담임·부담임 합계', () => {
  seed();
  const h = T.schoolInfoHtml();
  // 원본은 부담임반, 변형은 담임반에 준다
  assert.ok(/✏️ 변형 <strong style="font-size:16px">3부<\/strong> <span style="color:var\(--text-muted\)">담임반/.test(h), '변형 합계가 틀림');
  assert.ok(/📘 원본 <strong style="font-size:16px;color:var\(--orange\)">1부<\/strong> <span style="color:var\(--text-muted\)">부담임반/.test(h), '원본 합계가 틀림');
  assert.ok(h.includes('📄 합 4부'), '전체 합이 틀림');
});

console.log('\n챙길 자료 네 가지');
ok('출판사 원본 · 출판사 변형 · 학교 프린트 · 프린트 변형', () => {
  const items = T.__get('PREP_ITEMS').map(x => x[1]).join(',');
  assert.strictEqual(items, '출판사 원본,출판사 변형,학교 프린트,프린트 변형');
});
ok('몇 개 챙겼는지 센다', () => {
  assert.strictEqual(T.prepDone({ prep: { pubOrig: true, printVar: true } }), 2);
  assert.strictEqual(T.prepDone({}), 0);
  assert.strictEqual(T.prepDone(null), 0);
});
okAsync('누르면 켜지고 시험 문서에 저장된다', async () => {
  seed({ pubOrig: false });
  await T.doTogglePrep('ex1', 'pubVar');
  assert.strictEqual(writes.length, 1, '저장을 안 함');
  assert.strictEqual(writes[0].c, 'schoolExams');
  assert.strictEqual(writes[0].id, 'ex1');
  assert.strictEqual(writes[0].d.prep.pubVar, true, '켜지지 않음');
});
okAsync('다시 누르면 꺼진다 — 다른 칸은 그대로', async () => {
  seed({ pubOrig: true, pubVar: true });
  await T.doTogglePrep('ex1', 'pubVar');
  assert.strictEqual(writes[0].d.prep.pubVar, false, '꺼지지 않음');
  assert.strictEqual(writes[0].d.prep.pubOrig, true, '다른 칸이 지워짐');
});
okAsync('없는 시험이면 아무것도 안 한다', async () => {
  seed();
  await T.doTogglePrep('없는시험', 'pubOrig');
  assert.strictEqual(writes.length, 0);
});
ok('네 개 다 챙기면 초록 테두리와 ✓ 다 챙김', () => {
  seed({ pubOrig: true, pubVar: true, printOrig: true, printVar: true });
  const h = T.schoolInfoHtml();
  assert.ok(h.includes('border:2px solid var(--green)'), '초록 테두리가 없음');
  assert.ok(h.includes('✓ 다 챙김'), '다 챙김 표시가 없음');
  assert.ok(h.includes('📦 챙길 자료 4/4'), '4/4가 아님');
});
ok('머리에 몇 곳 끝났는지', () => {
  seed({ pubOrig: true, pubVar: true, printOrig: true, printVar: true });
  assert.ok(T.schoolInfoHtml().includes('1/1곳'), '끝난 곳 수가 없음');
  seed();
  assert.ok(T.schoolInfoHtml().includes('0/1곳'), '안 끝난 곳 수가 없음');
});

console.log('\n📚 출판사·범위별 부수 — 원본은 부담임반, 변형은 담임반');
function seedMany() {
  T.__set('CLASSES', [{ id: 'ta', name: '고1T A1' }, { id: 'tz', name: '고1T Z2' }]);
  const st = (id, school, cls) => ({ id, name: id, school, classIds: cls, status: '재원' });
  T.__set('STUDENTS_CACHE', [
    st('d1', '동안고', ['ta']), st('d2', '동안고', ['ta']),
    st('y1', '양명고', ['ta']), st('y2', '양명고', ['tz']),      // 양명고: 담임 1 + 부담임 1
    st('s1', '신성고', ['ta']), st('s2', '신성고', ['tz']),
    st('b1', '백영고', ['ta'])
  ]);
  T.__set('SCHOOLBOOKS_CACHE', {
    '동안고': { school: '동안고', publisher: '미래엔' },
    '양명고': { school: '양명고', publisher: '미래엔' },
    '신성고': { school: '신성고', publisher: '비상(김)' },
    '백영고': { school: '백영고', publisher: '미래엔' }
  });
  return [
    { id: 'e1', school: '동안고', title: '2학기 중간고사', scope: '도형의 방정식 ~ 집합' },
    { id: 'e2', school: '양명고', title: '2학기 중간고사', scope: '도형의 방정식  ～ 집합' },   // 띄어쓰기·물결표만 다름
    { id: 'e3', school: '신성고', title: '2학기 중간고사', scope: '도형의 방정식 ~ 집합' },     // 범위는 같지만 출판사가 다름
    { id: 'e4', school: '백영고', title: '2학기 중간고사', scope: '도형의 방정식 ~ 집합(포함관계)' }   // 출판사는 같지만 범위가 다름
  ];
}
ok('같은 출판사·같은 범위면 한 묶음으로', () => {
  const g = T.prepGroups(seedMany());
  const mirae = g.find(x => x.pub === '미래엔' && x.scope.indexOf('포함') < 0);
  assert.ok(mirae, '미래엔 묶음이 없음');
  assert.strictEqual(mirae.schools.map(x => x.name).join(','), '동안고,양명고', '띄어쓰기·물결표가 달라서 갈라짐');
});
ok('변형 = 담임반 인원, 원본 = 부담임반 인원', () => {
  const g = T.prepGroups(seedMany());
  const mirae = g.find(x => x.pub === '미래엔' && x.scope.indexOf('포함') < 0);
  assert.strictEqual(mirae.hr, 3, '담임(변형)이 틀림');   // 동안 2 + 양명 1
  assert.strictEqual(mirae.as, 1, '부담임(원본)이 틀림'); // 양명 1
});
ok('범위가 같아도 출판사가 다르면 따로', () => {
  const g = T.prepGroups(seedMany());
  assert.ok(g.some(x => x.pub === '비상(김)'), '비상 묶음이 없음');
  assert.strictEqual(g.find(x => x.pub === '비상(김)').schools.length, 1);
});
ok("출판사가 같아도 범위가 다르면 따로 ('~ 집합' ≠ '~ 집합(포함관계)')", () => {
  const g = T.prepGroups(seedMany());
  assert.strictEqual(g.filter(x => x.pub === '미래엔').length, 2, '범위가 다른데 합쳐짐');
});
ok('출판사끼리 모아 둔다', () => {
  const pubs = T.prepGroups(seedMany()).map(x => x.pub);
  assert.strictEqual(pubs.join(','), [...pubs].sort((a, b) => a.localeCompare(b)).join(','), '출판사 순서가 뒤섞임');
});
ok('이번 시험 과목에 맞는 교과서의 출판사로 묶는다', () => {
  const ex = seedMany();
  T.__set('SCHOOLBOOKS_CACHE', Object.assign({}, T.__get('SCHOOLBOOKS_CACHE'), {
    '신성고': { school: '신성고', publisher: '비상(김)', subjects: ['공통수학2', '대수'], subjectPub: { '대수': '천재(전)' } }
  }));
  ex[2].mathDates = [{ label: '공통수학2', date: '2026-10-06' }];
  const g = T.prepGroups(ex).find(x => x.schools.some(s => s.name === '신성고'));
  assert.strictEqual(g.pub, '비상(김)', '과목에 맞는 출판사가 아님');
  assert.strictEqual(g.subj, '공통수학2', '과목이 안 붙음');
});
ok('같은 학교 시험 문서가 둘이어도 한 번만 센다', () => {
  const ex = seedMany();
  ex.push(Object.assign({}, ex[0], { id: 'e1dup' }));
  const g = T.prepGroups(ex).find(x => x.schools.some(s => s.name === '동안고'));
  assert.strictEqual(g.schools.filter(s => s.name === '동안고').length, 1, '동안고가 두 번 세어짐');
});
ok('범위가 비어 있으면 범위 미정으로 따로, 넣으라고 알려준다', () => {
  const ex = seedMany(); ex[0].scope = '';
  T.__set('SCHOOLEXAMS_CACHE', ex.map(e => Object.assign({ startDate: '2099-01-01', endDate: '2099-01-02' }, e)));
  T.__set('naesinExamTitle', '2학기 중간고사');
  const h = T.schoolInfoHtml();
  assert.ok(h.includes('범위 미정'), '범위 미정 표시가 없음');
  assert.ok(h.includes('범위를 넣으면 같은 범위 학교와 묶여요'), '안내가 없음');
});
ok('표에 변형(담임반) · 원본(부담임반) 칸', () => {
  const ex = seedMany();
  T.__set('SCHOOLEXAMS_CACHE', ex.map(e => Object.assign({ startDate: '2099-01-01', endDate: '2099-01-02' }, e)));
  T.__set('naesinExamTitle', '2학기 중간고사');
  const h = T.schoolInfoHtml();
  assert.ok(h.includes('📚 출판사·범위별 부수'), '묶음 표가 없음');
  assert.ok(/✏️ 변형<div[^>]*>담임반<\/div>/.test(h), '변형 칸이 없음');
  assert.ok(/📘 원본<div[^>]*>부담임반<\/div>/.test(h), '원본 칸이 없음');
});

console.log('\n볼 시험');
ok('따로 안 고르면 다가오는 시험부터 연다', () => {
  // 예전엔 늘 1학기 것이 먼저 열려서 매번 다시 눌러야 했다
  assert.ok(th.includes("const _next=list.filter(e=>(e.endDate||e.startDate||'')>=_today)"), '다가오는 시험을 안 찾음');
  assert.ok(th.includes('let cur=naesinExamTitle && titles.includes(naesinExamTitle) ? naesinExamTitle : _def;'), '기본값이 안 바뀜');
});

console.log('\n안전');
ok('학생 이름에 태그가 있어도 안 샌다', () => {
  seed();
  T.__set('STUDENTS_CACHE', STUDENTS.map(x => Object.assign({}, x)).concat([{ id: 'x', name: '<img src=x>', school: '부흥고', classIds: ['sz4'], status: '재원' }]));
  assert.ok(!T.schoolInfoHtml().includes('<img src=x>'));
});
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(bootErr, null, bootErr && bootErr.message);
});

(async () => {
  for (const [name, fn] of Q) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; }
  }
  console.log('\n' + pass + '개 통과');
})();
