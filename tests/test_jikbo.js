// 직보 — 수학시험 전날부터 거슬러, 주말이 끼면 그 앞 금요일까지.
//   주말 낀 월요일 시험 → 금·토·일 / 주말 낀 화요일 시험 → 금·토·일·월
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
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) },
    // firebase-init.js가 주는 것들 — plan.html은 맨 윗줄에서 requireRole을 부른다
    requireRole: () => {}, bmAuthReady: Promise.resolve(), showToast: () => {},
    db: { collection: () => ({ get: async () => ({ docs: [] }), doc: () => ({}), add: async () => ({}) }) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  try { vm.runInContext(out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");', sb, { filename: file }); } catch (e) {}
  return sb;
}
const T = load('teacher.html');
const S = load('student.html');
const J = load('plan.html');          // 나의 플래너 — 규칙 사본이 여기에도 있다
const th = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
const ph = fs.readFileSync(ROOT + '/plan.html', 'utf8');

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const lbl = d => d.slice(5) + '(' + DOW[new Date(d + 'T00:00:00').getDay()] + ')';
// 세 화면이 같은 날짜를 봐야 한다. 플래너는 시험 id로 결과를 기억하니 매번 새 id를 준다.
let _eid = 0;
function both(e) {
  const t = T.jikboDatesOf(e).slice().sort(), s = S.__get('_jbDates')(e).slice().sort();
  assert.strictEqual(t.join(','), s.join(','), '선생님(' + t + ')과 학생(' + s + ') 결과가 다름');
  const j = J.jikboDates(Object.assign({}, e, { id: 'jb' + (++_eid) })).slice().sort();
  assert.strictEqual(t.join(','), j.join(','), '선생님(' + t + ')과 플래너(' + j + ') 결과가 다름');
  return t.map(lbl).join(' ');
}

console.log('날짜 전제 (2026-10: 1목 2금 3토 4일 5월=대체공휴일 6화)');
ok("요일과 공휴일이 예상대로다", () => {
  assert.strictEqual(new Date('2026-10-02T00:00:00').getDay(), 5, '10/2가 금요일이 아님');
  assert.strictEqual(T.holidayName('2026-10-05'), '대체공휴일', '10/5가 공휴일이 아님');
  assert.strictEqual(S.holidayName('2026-10-05'), '대체공휴일', '학생 쪽에 공휴일 표가 없음');
});

console.log('\n신성고 — 수학 10/6(화), 10/5(월)은 공휴일');
const SINSUNG = { school: '신성고', startDate: '2026-10-01', endDate: '2026-10-08', mathDate: '2026-10-06' };
ok("금·토·일·월 4일이 잡힌다", () => {
  assert.strictEqual(both(SINSUNG), '10-02(금) 10-03(토) 10-04(일) 10-05(월)');
});
ok("금요일 3시 · 토·일·공휴일 12시", () => {
  assert.strictEqual(T.jikboTime('2026-10-02', SINSUNG), '15:00~', '금요일이 3시가 아님');
  assert.strictEqual(T.jikboTime('2026-10-03', SINSUNG), '12:00~');
  assert.strictEqual(T.jikboTime('2026-10-04', SINSUNG), '12:00~');
  assert.strictEqual(T.jikboTime('2026-10-05', SINSUNG), '12:00~', '공휴일이 12시가 아님');
});

console.log('\n백영고 — 시험 첫날이 10/1이라 전날(9/30)은 시험이 없다');
const BAEKYOUNG = { school: '백영고', startDate: '2026-10-01', endDate: '2026-10-02', mathDate: '2026-10-01' };
ok("전날 9/30(수) 하루가 잡힌다", () => {
  assert.strictEqual(new Date('2026-09-30T00:00:00').getDay(), 3, '9/30이 수요일이 아님');
  assert.strictEqual(both(BAEKYOUNG), '09-30(수)');
});
ok("★ 그날 학교 시험이 없으므로 5시", () => {
  assert.strictEqual(T.jikboTime('2026-09-30', BAEKYOUNG), '17:00~', '시험 없는 평일인데 2시로 잡힘');
});
ok("시험기간 안의 평일이면 2시 (시험 끝나고 오는 것)", () => {
  // 10/1은 시험 첫날 = 그날 시험이 있다
  assert.strictEqual(T.jikboTime('2026-10-01', BAEKYOUNG), '14:00~');
});
ok("금요일은 시험 유무와 관계없이 3시", () => {
  assert.strictEqual(T.jikboTime('2026-10-02', SINSUNG), '15:00~', '시험 있는 금요일');
  assert.strictEqual(T.jikboTime('2026-11-20', { startDate: '2026-11-23', endDate: '2026-11-27' }), '15:00~', '시험 없는 금요일');
});
ok("토·일·공휴일은 시험 유무와 관계없이 12시", () => {
  assert.strictEqual(T.jikboTime('2026-10-03', SINSUNG), '12:00~');
  assert.strictEqual(T.jikboTime('2026-10-03', null), '12:00~');
});

console.log('\n말씀하신 기준 — 주말을 낀 시험');
// 2026-11: 20금 21토 22일 23월 24화 (공휴일 없음)
ok("주말 낀 월요일(11/23) 시험 → 금·토·일 3일", () => {
  assert.strictEqual(new Date('2026-11-23T00:00:00').getDay(), 1, '11/23이 월요일이 아님');
  assert.strictEqual(both({ startDate: '2026-11-20', endDate: '2026-11-26', mathDate: '2026-11-23' }),
    '11-20(금) 11-21(토) 11-22(일)');
});
ok("주말 낀 화요일(11/24) 시험 → 일요일은 쉰다 (월요일에 다른 과목 시험)", () => {
  assert.strictEqual(new Date('2026-11-24T00:00:00').getDay(), 2, '11/24가 화요일이 아님');
  // 11/23(월)은 다음 날이 수학이라 직보. 11/22(일)은 다음 날 월요일에 다른 과목 시험이라 쉰다.
  assert.strictEqual(both({ startDate: '2026-11-20', endDate: '2026-11-26', mathDate: '2026-11-24' }),
    '11-20(금) 11-21(토) 11-23(월)');
});
ok("월요일이 공휴일이어도 화요일 시험이면 4일 그대로", () => {
  // 신성고와 같은 모양 — 월이 공휴일이든 평일이든 금요일까지 간다
  assert.strictEqual(both(SINSUNG).split(' ').length, 4);
});

console.log('\n주말이 안 끼면 전날 하루');
ok("수요일(11/25) 시험 → 화요일 하루", () => {
  assert.strictEqual(both({ startDate: '2026-11-23', endDate: '2026-11-27', mathDate: '2026-11-25' }), '11-24(화)');
});
ok("목요일(11/26) 시험 → 수요일 하루, 시간은 평일 2시", () => {
  assert.strictEqual(both({ startDate: '2026-11-23', endDate: '2026-11-27', mathDate: '2026-11-26' }), '11-25(수)');
  // 11/25는 시험기간(11/23~11/27) 안이라 그날 시험이 있다 → 2시
  assert.strictEqual(T.jikboTime('2026-11-25', { startDate: '2026-11-23', endDate: '2026-11-27' }), '14:00~');
});
ok("금요일(11/27) 시험 → 목요일 하루", () => {
  assert.strictEqual(both({ startDate: '2026-11-23', endDate: '2026-11-27', mathDate: '2026-11-27' }), '11-26(목)');
});

console.log('\n수학시험 뒤로는 안 넘어간다');
ok("수학 10/2(금)이면 뒤의 주말(10/3·4)은 직보가 아니다", () => {
  const got = both({ startDate: '2026-10-01', endDate: '2026-10-08', mathDate: '2026-10-02' });
  assert.strictEqual(got, '10-01(목)');
  ['10-03', '10-04', '10-05'].forEach(d => assert.ok(got.indexOf(d) < 0, d + '이 들어감'));
});
ok("수학시험 당일은 직보에서 빠진다", () => {
  const e = { startDate: '2026-10-01', endDate: '2026-10-08', mathDates: [{ date: '2026-10-05' }, { date: '2026-10-06' }] };
  const got = both(e);
  ['10-05', '10-06'].forEach(d => assert.ok(got.indexOf(d) < 0, d + '(수학시험일)이 직보로 잡힘'));
});

console.log('\n다른 과목 시험 전날은 쉰다');
// 과천중앙고·백운고 2학기 중간 — 10/1(목)~10/7(수), 수학 10/7(수)
//   10/6(화)에 다른 과목 시험이 있으니 10/5(월·대체공휴일)은 쉬고 10/6에 직보한다
const GWACHEON = { startDate: '2026-10-01', endDate: '2026-10-07', mathDate: '2026-10-07' };
ok('10/5(월)은 쉬고 10/6(화)에 직보한다', () => {
  assert.strictEqual(both(GWACHEON), '10-02(금) 10-03(토) 10-04(일) 10-06(화)');
});
ok('쉬는 날을 따로 뽑아 보여준다', () => {
  const rest = T.jikboRestDatesOf(GWACHEON);
  assert.strictEqual(rest.join(','), '2026-10-05', '쉬는 날이 안 잡힘: ' + rest.join(','));
});
ok('내일이 수학이면 쉬지 않는다', () => {
  const mathSet = new Set(['2026-10-07']);
  assert.strictEqual(T.jikboRestDay(GWACHEON, '2026-10-06', mathSet), false);
});
ok('내일이 다른 과목 시험이면 쉰다', () => {
  const mathSet = new Set(['2026-10-07']);
  assert.strictEqual(T.jikboRestDay(GWACHEON, '2026-10-05', mathSet), true);
});
ok('시험 기간 안이어도 주말·공휴일은 시험 보는 날이 아니다', () => {
  // 10/5는 대체공휴일 — 기간 안이지만 시험을 안 본다. 그래서 10/4(일)은 쉬지 않는다.
  assert.strictEqual(T.jikboIsExamDay(GWACHEON, '2026-10-05'), false);
  assert.strictEqual(T.jikboIsExamDay(GWACHEON, '2026-10-06'), true);
  assert.strictEqual(T.jikboRestDay(GWACHEON, '2026-10-04', new Set(['2026-10-07'])), false);
});
ok('시험 기간 밖은 아무 영향 없다', () => {
  assert.strictEqual(T.jikboIsExamDay(GWACHEON, '2026-09-30'), false);
  assert.strictEqual(T.jikboIsExamDay(GWACHEON, '2026-10-08'), false);
});
ok('시험 기간이 없으면 예전처럼 동작한다', () => {
  assert.strictEqual(T.jikboIsExamDay({ mathDate: '2026-10-07' }, '2026-10-06'), false);
});
ok('신성고는 그대로 4일 (월요일이 공휴일이라 화요일 전날이 아님)', () => {
  assert.strictEqual(both(SINSUNG), '10-02(금) 10-03(토) 10-04(일) 10-05(월)');
  assert.strictEqual(T.jikboRestDatesOf(SINSUNG).length, 0, '신성고에 쉬는 날이 생김');
});
ok('선생님·학생·플래너가 같은 날짜를 본다', () => {
  // 세 파일에 규칙 사본이 따로 있어서 한쪽만 고치면 어긋난다
  [GWACHEON, SINSUNG].forEach(e => { both(e); });
});

console.log('\n📒 나의 플래너 — 쌤이 달력에서 본 그대로');
ok('플래너 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(typeof J.jikboDates, 'function', 'jikboDates가 없음');
  assert.strictEqual(typeof J.jikboTime, 'function', 'jikboTime이 없음');
});
// 실제 2학기 중간: 신성·관양 수학 10/6(화) / 과천중앙·백운 수학 10/7(수)
//   쌤 말씀 — "5일 신성고 관양고 직보, 6일 과천중앙고 백운고 직보"
const JB_SINSUNG = { id: 'p-sinsung', school: '신성고', startDate: '2026-10-01', endDate: '2026-10-07', mathDate: '2026-10-06' };
const JB_GWANYANG = { id: 'p-gwanyang', school: '관양고', startDate: '2026-10-02', endDate: '2026-10-08', mathDate: '2026-10-06' };
const JB_GWACHEON = { id: 'p-gwacheon', school: '과천중앙고', startDate: '2026-10-01', endDate: '2026-10-07', mathDate: '2026-10-07' };
const JB_BAEKWOON = { id: 'p-baekwoon', school: '백운고', startDate: '2026-10-01', endDate: '2026-10-07', mathDate: '2026-10-07' };
ok('10/5(월·대체공휴일) — 신성고·관양고', () => {
  [JB_SINSUNG, JB_GWANYANG].forEach(e => {
    assert.ok(J.jikboDates(e).includes('2026-10-05'), e.school + '이 10/5에 없음: ' + J.jikboDates(e));
  });
});
ok('10/6(화) — 과천중앙고·백운고', () => {
  [JB_GWACHEON, JB_BAEKWOON].forEach(e => {
    assert.ok(J.jikboDates(e).includes('2026-10-06'), e.school + '이 10/6에 없음: ' + J.jikboDates(e));
  });
});
ok('10/5은 과천중앙고·백운고가 쉰다 (6일에 다른 과목 시험)', () => {
  [JB_GWACHEON, JB_BAEKWOON].forEach(e => {
    assert.ok(!J.jikboDates(e).includes('2026-10-05'), e.school + '이 쉬는 날인데 10/5에 잡힘');
  });
});
ok('플래너 시간도 선생님 화면과 같다', () => {
  ['2026-10-02', '2026-10-03', '2026-10-05', '2026-09-30', '2026-11-25'].forEach(d => {
    assert.strictEqual(J.jikboTime(d, GWACHEON) + '~', T.jikboTime(d, GWACHEON), d + ' 시간이 다름');
  });
  assert.strictEqual(J.jikboTime('2026-10-05', GWACHEON), '12:00', '공휴일이 12시가 아님');
  assert.strictEqual(J.jikboTime('2026-10-02', GWACHEON), '15:00', '금요일이 3시가 아님');
});
ok('옛 11시 규칙이 남아 있지 않다', () => {
  assert.ok(!ph.includes('오전 11시'), '토·일 11시가 그대로 남음');
  assert.ok(ph.includes('const time = jikboTimeOf(dateStr, e);'), '시간을 규칙에서 안 가져옴');
  assert.ok(ph.includes('jikboSavedTime(dateStr, e&&e.school) || jikboTime(dateStr, e)'), '쌤이 고친 시간이 규칙보다 먼저가 아님');
});
ok('시험별로 한 번만 계산한다 (달력이 날짜마다 다시 부른다)', () => {
  const e = { id: 'p-cache', startDate: '2026-10-01', endDate: '2026-10-07', mathDate: '2026-10-07' };
  assert.strictEqual(J.jikboDates(e), J.jikboDates(e), '같은 시험인데 매번 새로 계산함');
});
ok('시험을 다시 읽어오면 계산해 둔 것도 버린다', () => {
  assert.ok(ph.includes('_JB_CACHE.clear()'), 'loadAll에서 기억해 둔 걸 안 버림');
});
ok('플래너 안내문이 지금 규칙을 설명한다', () => {
  assert.ok(ph.includes('다음 날 다른 과목 시험이면 그날은 쉬어요'), '쉬는 날 설명이 없음');
  assert.ok(!ph.includes('주말 뒤에 수학시험'), '옛 규칙 설명이 남아 있음');
});

console.log('\n📆 내신 관리 달력 — 애들 시험만 보이고 내 직보가 없었다');
ok('저장된 직보와 아직 안 만든 직보를 나눠 띄운다', () => {
  assert.ok(th.includes('const jbOn={}, jbSoon={};'), '직보를 안 모음');
  assert.ok(th.includes('exams.forEach(e=>jikboDatesOf(e).forEach(d=>{'), '예정 직보를 안 계산함');
  assert.ok(th.includes('🔶=내 직보'), '범례에 직보가 없음');
});
ok('이미 직보 일정에 있는 학교는 예정으로 또 띄우지 않는다', () => {
  assert.ok(th.includes("if((jbOn[d]||[]).includes(nm)) return;"), '중복 제거가 없음');
});

console.log('\n자동 생성 — 규칙이 바뀌면서 흘러간 직보 정리');
ok('지금 규칙으로 안 잡히는 날의 자동 직보를 찾아낸다', () => {
  // 쉬는 날뿐 아니라 '시험 전 연휴'에 잘못 잡혀 있던 것도 (10/8~10/11 산본·양명·우성)
  assert.ok(th.includes('jikboDatesOf(e).forEach(d=>okBySchool[sc].add(d));'), '지금 규칙의 날짜를 안 모음');
  assert.ok(th.includes('return !okBySchool[key].has(m.date);'), '흘러간 날을 안 가려냄');
});
ok('손으로 넣은 보강과 지난 날짜는 건드리지 않는다', () => {
  assert.ok(th.includes('손으로 넣은 보강(auto가 아닌 것), 지난 날짜, 다가오는 시험이 없는 학교는 건드리지 않는다'), '보호 설명이 없음');
  assert.ok(th.includes("if(!m.auto || !m.date || m.date<today) return false;"), '자동/지난 날짜를 안 거름');
});
ok('다가오는 시험이 없는 학교는 손대지 않는다', () => {
  assert.ok(th.includes("if((e.endDate||e.startDate||'') < today) return;"), '끝난 시험까지 봄');
  assert.ok(/const key = okBySchool\[sc\] \? sc :/.test(th), '학교를 못 찾으면 그냥 두는 처리가 없음');
  assert.ok(th.includes('if(!key) return false;'), '모르는 학교까지 지움');
});
ok('학교 이름은 school과 반 이름 양쪽으로 찾는다', () => {
  assert.ok(th.includes("Object.keys(okBySchool).find(k=>String(m.className||'').includes(k))"), '반 이름으로 못 찾음');
});
ok('지우기 전에 무엇을 지우는지 확인창에 적어준다', () => {
  assert.ok(th.includes('🗑 지울 직보'), '지울 목록 안내가 없음');
  assert.ok(th.includes('지금 규칙으로는 직보가 아닌 날이에요'), '왜 지우는지 안 적음');
  assert.ok(th.includes('${restMsg}${staleMsg}'), '확인창에 안 붙음');
});
ok('결과에 지운 건수를 알려준다', () => {
  assert.ok(th.includes('건 지움(규칙이 바뀐 날)'), '지운 건수 안내가 없음');
});

console.log('\n시험 전의 연휴는 이 시험과 상관없다');
// 우성고 2학기 중간 — 시험 10/13(화)~10/16, 수학 10/13.
//   10/9(한글날)~10/11 연휴는 시험이 시작되기도 전이다. 전날 10/12 하루만.
//   주말 직보는 '주말을 끼고 시험을 보는 학교' 것이다.
const WOOSUNG = { school: '우성고', startDate: '2026-10-13', endDate: '2026-10-16', mathDate: '2026-10-13' };
ok('우성고 — 연휴를 건너뛰지 않고 전날 하루', () => {
  assert.strictEqual(both(WOOSUNG), '10-12(월)');
});
ok('시험 시작 전의 토·일·공휴일은 안 잡힌다', () => {
  const got = T.jikboDatesOf(WOOSUNG);
  ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].forEach(d => {
    assert.ok(!got.includes(d), d + '이 잡힘 (시험은 10/13부터)');
  });
});
ok('산본고 — 수학이 시험 첫날이면 전날(일요일) 하루', () => {
  // 시험 10/12(월)~10/16, 수학 10/12. 앞 주말은 시험기간 밖이다.
  assert.strictEqual(both({ school: '산본고', startDate: '2026-10-12', endDate: '2026-10-16', mathDate: '2026-10-12' }), '10-11(일)');
});
ok('양명고 — 시험 첫날 다른 과목, 둘째 날 수학이면 그 전날 하루', () => {
  assert.strictEqual(both({ school: '양명고', startDate: '2026-10-12', endDate: '2026-10-16', mathDate: '2026-10-13' }), '10-12(월)');
});
ok('★ 주말이 시험기간 안이면 예전처럼 금·토·일·월', () => {
  // 신성고는 시험이 10/1부터라 주말이 기간 안 — 그대로 4일
  assert.strictEqual(both(SINSUNG), '10-02(금) 10-03(토) 10-04(일) 10-05(월)');
  assert.strictEqual(both(GWACHEON), '10-02(금) 10-03(토) 10-04(일) 10-06(화)');
});
ok('시험기간을 아직 안 넣었으면 전날 하루만', () => {
  // 기간이 없으면 어느 쉬는 날이 '기간 안'인지 알 수가 없다 → 안전하게 하루
  assert.strictEqual(both({ mathDate: '2026-10-06' }), '10-05(월)');
});
ok('직보 시작일을 직접 넣으면 그건 그대로 (기간 밖이어도)', () => {
  assert.strictEqual(both({ school: '우성고', startDate: '2026-10-13', endDate: '2026-10-16', mathDate: '2026-10-13', jikboStart: '2026-10-10' }),
    '10-10(토) 10-11(일) 10-12(월)');
});

console.log('\n수학시험이 여러 날 / 직접 지정');
ok("수학이 여러 날이면 각각 앞을 따로 계산한다", () => {
  const e = { startDate: '2026-11-20', endDate: '2026-11-27', mathDates: [{ date: '2026-11-24' }, { date: '2026-11-27' }] };
  // 11/24(화) → 금·토·월 (일요일은 월요일 시험 때문에 쉼) / 11/27(금) → 목(11/26)
  assert.strictEqual(both(e), '11-20(금) 11-21(토) 11-23(월) 11-26(목)');
});
ok("직보 시작일을 지정하면 그 규칙이 우선", () => {
  assert.strictEqual(both({ startDate: '2026-10-01', endDate: '2026-10-08', mathDate: '2026-10-06', jikboStart: '2026-10-03' }),
    '10-03(토) 10-04(일) 10-05(월)');
});

console.log('\n예외·안전');
ok("수학시험일이 없으면 직보를 만들지 않는다", () => {
  assert.strictEqual(both({ startDate: '2026-10-01', endDate: '2026-10-08' }), '');
});
ok("추석 연휴가 껴도 9일을 넘지 않는다", () => {
  const got = both({ startDate: '2026-09-20', endDate: '2026-09-30', mathDate: '2026-09-28' });
  assert.ok(got.split(' ').length <= 9, '직보가 ' + got.split(' ').length + '일이나 잡힘: ' + got);
});

console.log('\n자동 생성 — 이미 있는 항목');
ok("자동으로 만든 옛 항목은 지금 규칙에 맞춰 고친다", () => {
  assert.ok(th.includes('if(!ex.timeFixed && ex.time!==p.time) patch.time=p.time;'), '옛 항목 시간 수정이 없음');
  assert.ok(th.includes('updateMakeupFS(ex.id, patch)'), '수정 호출이 없음');
});
ok("손으로 만든 보강은 건드리지 않는다", () => {
  assert.ok(th.includes('손으로 만든 보강은 선생님이 정한 시간이므로 건드리지 않는다'), '수동 보강 보호 설명이 없음');
});
ok("안내에 생성·고침·그대로를 나눠 알려준다", () => {
  assert.ok(th.includes('건 고침(시간·메모)'), '고침 건수 안내가 없음');
  assert.ok(th.includes('건 그대로'), '그대로 건수 안내가 없음');
});

console.log('\n⏱ 직보 시간 바꾸기 — 자동 생성된 걸 그 자리에서 고친다');
ok("표의 시간 칸을 고칠 수 있다 (예전엔 삭제밖에 없었다)", () => {
  const h = T.mkTimeCellHtml({ id: 'm1', date: '2026-10-05', time: '12:00~' });
  assert.ok(h.includes("doSetMakeupTime('m1'"), '시간 칸이 저장을 안 함');
  assert.ok(h.includes('value="12:00~"'), '지금 시간이 안 채워짐');
  assert.ok(h.includes('list="mk-times"'), '빠른 시간 목록이 없음');
});
ok("빠른 시간 목록에 규칙 시간 네 개가 있다", () => {
  assert.ok(th.includes('<datalist id="mk-times">'), '목록이 없음');
  ['12:00~', '14:00~', '15:00~', '17:00~'].forEach(t => {
    assert.ok(th.includes('<option value="' + t + '">'), t + '가 목록에 없음');
  });
});
ok("직접 고친 시간은 눈에 띄고 되돌릴 수 있다", () => {
  const h = T.mkTimeCellHtml({ id: 'm1', date: '2026-10-05', time: '13:00~', timeFixed: true });
  assert.ok(h.includes('직접 지정'), '직접 고쳤다는 표시가 없음');
  assert.ok(h.includes("doResetMakeupTime('m1')"), '규칙으로 되돌리는 길이 없음');
});
ok("안 고친 건 되돌리기가 안 뜬다", () => {
  const h = T.mkTimeCellHtml({ id: 'm2', date: '2026-10-05', time: '12:00~' });
  assert.ok(!h.includes('doResetMakeupTime'), '고치지도 않았는데 되돌리기가 뜸');
  assert.ok(!h.includes('직접 지정'));
});
ok("고치면 timeFixed를 같이 남긴다", () => {
  assert.ok(th.includes('updateMakeupFS(id, {time:t, timeFixed:true})'), 'timeFixed를 안 남김');
});
ok("자동 생성이 직접 고친 시간을 덮지 않는다", () => {
  assert.ok(th.includes('if(!ex.timeFixed && ex.time!==p.time) patch.time=p.time;'), '고친 시간이 다시 규칙으로 덮임');
  assert.ok(th.includes('if(ex.note!==note) patch.note=note;'), '메모는 그대로 따라가야 함');
});
ok("되돌리면 규칙 시간으로 돌아간다", () => {
  assert.ok(th.includes('jikboTime(m.date, makeupExamOf(m))'), '규칙 시간을 다시 계산하지 않음');
  assert.ok(th.includes('{time:t, timeFixed:false}'), 'timeFixed를 안 끔');
});
ok("시간을 고칠 수 있다는 걸 화면에서 알려준다", () => {
  assert.ok(th.includes('표의 시간 칸을 고치면'), '안내가 없음');
});

console.log('\n바꾼 시간이 학생·플래너까지 간다');
ok("플래너는 저장된 시간을 규칙보다 먼저 본다", () => {
  const e = { id: 'jt1', school: '신성고', startDate: '2026-10-05', endDate: '2026-10-08', mathDate: '2026-10-06' };
  J.__set('P_MAKEUPS', [{ date: '2026-10-05', school: '신성고', time: '13:30~' }]);
  assert.strictEqual(J.jikboTimeOf('2026-10-05', e), '13:30', '쌤이 고친 시간이 안 나옴');
  J.__set('P_MAKEUPS', []);
  assert.strictEqual(J.jikboTimeOf('2026-10-05', e), J.jikboTime('2026-10-05', e), '안 고쳤으면 규칙대로여야 함');
});
ok("다른 학교 직보 시간을 끌어오지 않는다", () => {
  const e = { id: 'jt2', school: '신성고', startDate: '2026-10-05', endDate: '2026-10-08', mathDate: '2026-10-06' };
  J.__set('P_MAKEUPS', [{ date: '2026-10-05', school: '백영고', time: '09:00~' }]);
  assert.strictEqual(J.jikboTimeOf('2026-10-05', e), J.jikboTime('2026-10-05', e), '남의 학교 시간을 가져옴');
  J.__set('P_MAKEUPS', []);
});
ok("학생 화면도 바뀐 시간을 본다", () => {
  S.__set('ALL_MAKEUPS', [{ date: '2026-10-05', school: '신성고', time: '13:30~' }]);
  assert.strictEqual(S._jbSavedTime('2026-10-05', '신성고'), '오후 1시 30분');
  assert.strictEqual(S._jbSavedTime('2026-10-05', '백영고'), '', '남의 학교 시간을 가져옴');
  S.__set('ALL_MAKEUPS', []);
  assert.strictEqual(S._jbSavedTime('2026-10-05', '신성고'), '');
});
ok("시간 표기를 학생이 읽기 좋게 바꾼다", () => {
  assert.strictEqual(S._jbTimeLabel('12:00~'), '낮 12시');
  assert.strictEqual(S._jbTimeLabel('14:00~'), '오후 2시');
  assert.strictEqual(S._jbTimeLabel('17:00~'), '오후 5시');
  assert.strictEqual(S._jbTimeLabel('09:30~'), '오전 9시 30분');
  assert.strictEqual(S._jbTimeLabel('14:00~16:00'), '14:00~16:00', '끝 시간까지 적은 건 그대로 둬야 함');
  assert.strictEqual(S._jbTimeLabel(''), '');
});

console.log('\n화면');
ok("직보·보강 목록이 최신순이다", () => {
  assert.ok(/sort\(\(a,b\)=>\(b\.date\|\|''\)\.localeCompare\(a\.date\|\|''\)\)/.test(th), '오름차순 그대로임');
});
ok("안내문이 새 규칙을 설명한다", () => {
  assert.ok(th.includes('주말이 끼면 그 앞 금요일까지'), '금요일까지 간다는 설명이 없음');
  assert.ok(th.includes('화요일 시험이면 금·토·일·월'), '예시가 없음');
});

console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
