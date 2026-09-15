// 📅 시험 등록 폼 — 시험명 네 가지, 학년 고1·2·3 중복, 수학일은 시험기간 안에서만
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const html = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');
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
const T = {
  console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
  document: { getElementById: el, addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
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
const pick = () => T.__get('sePick');
// vm 안에서 만든 배열이라 deepStrictEqual은 프로토타입까지 따진다 — 값만 본다
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);

console.log('시험명 — 네 가지뿐');
ok('1학기 중간 / 1학기 기말 / 2학기 중간 / 2학기 기말', () => {
  same(T.__get('SE_TITLES'),
    ['1학기 중간고사', '1학기 기말고사', '2학기 중간고사', '2학기 기말고사']);
});
ok('누르면 시험명 칸에 들어간다', () => {
  T.seSetTitle('2학기 중간고사');
  assert.strictEqual(el('se-title').value, '2학기 중간고사');
});
ok('고른 것만 진하게', () => {
  const h = T.seTitleBoxHtml('2학기 중간고사');
  assert.ok(/2학기 중간<\/button>/.test(h.replace(/\s+/g, ' ')), '버튼 글자가 다름');
  const on = h.split('<button').filter(x => x.includes('background:var(--primary);color:#fff'));
  assert.strictEqual(on.length, 1, '진한 버튼이 ' + on.length + '개');
});
ok('직접 쓴 이름도 그대로 저장된다 (수행평가 같은 것)', () => {
  el('se-title').value = '수행평가';
  const h = T.seTitleBoxHtml();
  assert.ok(!h.includes('background:var(--primary);color:#fff'), '아무것도 안 골랐는데 진한 게 있음');
});

console.log('\n학년 — 고1·고2·고3, 중복');
ok("'고1·2'를 읽고 쓴다 (지금 데이터 모양 그대로)", () => {
  same(T.seGradesOf('고1·2'), ['고1', '고2']);
  assert.strictEqual(T.seGradeLabel(['고1', '고2']), '고1·2');
  assert.strictEqual(T.seGradeLabel(['고2', '고1']), '고1·2', '순서가 달라도 같아야 함');
  assert.strictEqual(T.seGradeLabel(['고1', '고2', '고3']), '고1·2·3');
  assert.strictEqual(T.seGradeLabel(['고3']), '고3');
  assert.strictEqual(T.seGradeLabel([]), '', '안 고르면 빈칸');
});
ok('빈칸·이상한 값도 버티게', () => {
  same(T.seGradesOf(''), []);
  same(T.seGradesOf(null), []);
  same(T.seGradesOf('중3'), ['고3'], '숫자만 본다');
});
ok('눌러서 켜고 끈다', () => {
  T.seReset();
  T.seToggleGrade('고1'); T.seToggleGrade('고2');
  assert.strictEqual(T.seGradeLabel(pick().grades), '고1·2');
  T.seToggleGrade('고1');
  assert.strictEqual(T.seGradeLabel(pick().grades), '고2');
});
ok('고른 결과를 옆에 적어준다', () => {
  T.seReset(); T.seToggleGrade('고1'); T.seToggleGrade('고3');
  assert.ok(T.seGradeBoxHtml().includes('→ 고1·3'), '결과 표시가 없음');
  T.seReset();
  assert.ok(T.seGradeBoxHtml().includes('여러 학년이면 같이 눌러요'), '안내가 없음');
});

console.log('\n수학 시험일 — 시험기간 안에서만');
ok('시험기간의 날짜를 하루씩 뽑는다', () => {
  same(T.sePeriodDays('2026-10-05', '2026-10-07'),
    ['2026-10-05', '2026-10-06', '2026-10-07']);
  assert.strictEqual(T.sePeriodDays('2026-10-01', '2026-10-07').length, 7);
});
ok('기간을 안 넣었거나 거꾸로면 날짜가 안 나온다', () => {
  same(T.sePeriodDays('', ''), []);
  same(T.sePeriodDays('2026-10-07', '2026-10-01'), [], '끝이 시작보다 앞인데 날짜가 나옴');
});
ok('기간이 터무니없이 길어도 40일에서 멈춘다', () => {
  assert.ok(T.sePeriodDays('2026-01-01', '2026-12-31').length <= 40);
});
ok('기간을 안 넣으면 먼저 넣으라고 한다', () => {
  T.seReset();
  assert.ok(T.seMathBoxHtml('', '').includes('시험기간을 넣으면'), '안내가 없음');
});
ok('날짜를 누르면 ①, 또 누르면 ②', () => {
  T.seReset();
  T.seToggleMathDay('2026-10-06');
  same(pick().math.map(m => m.date), ['2026-10-06']);
  T.seToggleMathDay('2026-10-02');
  same(pick().math.map(m => m.date), ['2026-10-06', '2026-10-02']);
});
ok('둘 다 찼으면 ②가 바뀐다 (셋째는 안 생긴다)', () => {
  T.seToggleMathDay('2026-10-07');
  same(pick().math.map(m => m.date), ['2026-10-06', '2026-10-07']);
});
ok('같은 날을 다시 누르면 지워진다', () => {
  T.seToggleMathDay('2026-10-06');
  same(pick().math.map(m => m.date), ['2026-10-07']);
});
ok('고른 날짜에 ①②가 붙는다', () => {
  T.seReset(); T.seToggleMathDay('2026-10-06');
  const h = T.seMathBoxHtml('2026-10-01', '2026-10-07');
  assert.ok(h.includes('① 10/6'), '①표시가 없음');
  assert.ok(h.includes('10/2'), '다른 날짜가 안 나옴');
});
ok('날짜칸에도 기간 밖은 못 넣게 막아둔다', () => {
  const h = T.seMathBoxHtml('2026-10-01', '2026-10-07');
  assert.ok(h.includes('min="2026-10-01"') && h.includes('max="2026-10-07"'), 'min/max가 없음');
});
ok('①을 안 골랐으면 ②칸은 안 보인다', () => {
  T.seReset();
  const h = T.seMathBoxHtml('2026-10-01', '2026-10-07');
  assert.ok(!h.includes('>②<'), '②칸이 미리 나옴');
  T.seToggleMathDay('2026-10-06');
  assert.ok(T.seMathBoxHtml('2026-10-01', '2026-10-07').includes('>②<'), '②칸이 안 나옴');
});
ok('과목 이름 후보를 준다', () => {
  assert.ok(T.__get('SE_MATH_LABELS').includes('공통수학2'));
  assert.ok(T.seMathBoxHtml('2026-10-01', '2026-10-07').includes('id="se-mlabels"'), '후보 목록이 없음');
});
ok('학생 이름·과목에 태그가 있어도 안 샌다', () => {
  T.seReset(); T.seSetMathDate(0, '2026-10-06'); T.seSetMathLabel(0, '<img src=x>');
  assert.ok(!T.seMathBoxHtml('2026-10-01', '2026-10-07').includes('<img src=x>'));
});

console.log('\n수정하러 들어갔다 나오기');
ok('시험을 고르면 그 시험 값으로 채워진다', () => {
  T.seSync({ id: 'e1', grade: '고1·2', mathDates: [{ label: '공통수학2', date: '2026-10-06' }] });
  same(pick().grades, ['고1', '고2']);
  same(pick().math, [{ label: '공통수학2', date: '2026-10-06' }]);
});
ok('같은 시험이면 고르던 걸 안 지운다 (화면을 다시 그려도)', () => {
  T.seToggleMathDay('2026-10-02');
  T.seSync({ id: 'e1', grade: '고1·2', mathDates: [{ label: '공통수학2', date: '2026-10-06' }] });
  assert.strictEqual(pick().math.length, 2, '다시 그렸더니 고른 게 날아감');
});
ok('다른 시험으로 옮기면 새로 채운다', () => {
  T.seSync({ id: 'e2', grade: '고3', mathDates: [] });
  same(pick().grades, ['고3']);
  same(pick().math, []);
});
ok("'취소'로 새 등록으로 돌아오면 비워진다", () => {
  T.seSync(null);
  same(pick().grades, []);
  same(pick().math, []);
});
ok('폼을 그릴 때 맞춰준다', () => {
  assert.ok(html.includes('seSync(editS);'), 'seSync 호출이 없음');
});
ok('저장하고 나면 다음 등록에 안 남는다', () => {
  assert.ok(html.includes('seReset();   // 다음에 새로 쓸 때 방금 고른 게 남아 있지 않게'), '저장 후 비우기가 없음');
});

console.log('\n저장');
ok('수학일은 빠른 날짜부터, 이름이 없으면 수학/수학②', () => {
  assert.ok(html.includes(".sort((a,b)=>a.date.localeCompare(b.date))"), '날짜순 정렬이 없음');
  assert.ok(html.includes("(m.label||'').trim()||(i?'수학②':'수학')"), '기본 이름이 없음');
});
ok('시험기간 밖의 수학일은 저장을 막는다', () => {
  assert.ok(html.includes("const out=mathDates.filter(m=>m.date<per.from || m.date>per.to);"), '기간 밖 검사가 없음');
  assert.ok(html.includes('이 시험기간(${per.from}~${per.to}) 밖이에요'), '안내가 없음');
});
ok('학년은 고른 버튼에서 만든다', () => {
  assert.ok(html.includes("grade:seGradeLabel(sePick.grades)"), '학년을 안 읽음');
  assert.ok(!html.includes("grade:g('se-grade')"), '옛 입력칸을 아직 읽음');
});
ok('mathDate(하나짜리)도 같이 저장한다 — 직보가 이걸 본다', () => {
  assert.ok(html.includes("const m1d=(mathDates[0]||{}).date||'';"), 'mathDate가 안 채워짐');
  assert.ok(html.includes('mathDate:m1d||'), 'mathDate 저장이 없음');
});
ok('옛 입력칸은 남아 있지 않다', () => {
  ['se-m1-date', 'se-m2-date', 'se-m1-label', 'se-m2-label'].forEach(id => {
    assert.ok(!html.includes(`id="${id}"`), id + '이 남아 있음');
  });
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(bootErr, null, bootErr && bootErr.message);
});

console.log('\n' + pass + '개 통과');
