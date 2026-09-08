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
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  try { vm.runInContext(out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);', sb, { filename: file }); } catch (e) {}
  return sb;
}
const T = load('teacher.html');
const S = load('student.html');
const th = fs.readFileSync(ROOT + '/teacher.html', 'utf8');

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const lbl = d => d.slice(5) + '(' + DOW[new Date(d + 'T00:00:00').getDay()] + ')';
function both(e) {
  const t = T.jikboDatesOf(e).slice().sort(), s = S.__get('_jbDates')(e).slice().sort();
  assert.strictEqual(t.join(','), s.join(','), '선생님(' + t + ')과 학생(' + s + ') 결과가 다름');
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
ok("주말 낀 화요일(11/24) 시험 → 금·토·일·월 4일", () => {
  assert.strictEqual(new Date('2026-11-24T00:00:00').getDay(), 2, '11/24가 화요일이 아님');
  assert.strictEqual(both({ startDate: '2026-11-20', endDate: '2026-11-26', mathDate: '2026-11-24' }),
    '11-20(금) 11-21(토) 11-22(일) 11-23(월)');
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

console.log('\n수학시험이 여러 날 / 직접 지정');
ok("수학이 여러 날이면 각각 앞을 따로 계산한다", () => {
  const e = { startDate: '2026-11-20', endDate: '2026-11-27', mathDates: [{ date: '2026-11-24' }, { date: '2026-11-27' }] };
  // 11/24(화) → 금·토·일·월 / 11/27(금) → 목(11/26)
  assert.strictEqual(both(e), '11-20(금) 11-21(토) 11-22(일) 11-23(월) 11-26(목)');
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
  assert.ok(th.includes('if(ex.auto && (ex.time!==p.time || ex.note!==note))'), '옛 항목 수정이 없음');
  assert.ok(th.includes('updateMakeupFS(ex.id, {time:p.time, note})'), '수정 호출이 없음');
});
ok("손으로 만든 보강은 건드리지 않는다", () => {
  assert.ok(th.includes('손으로 만든 보강은 선생님이 정한 시간이므로 건드리지 않는다'), '수동 보강 보호 설명이 없음');
});
ok("안내에 생성·고침·그대로를 나눠 알려준다", () => {
  assert.ok(th.includes('건 고침(시간·메모)'), '고침 건수 안내가 없음');
  assert.ok(th.includes('건 그대로'), '그대로 건수 안내가 없음');
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
