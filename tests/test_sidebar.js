// 🗂 사이드바 접기 — 아이패드 가로·작은 노트북에서 본문을 250px 넓게
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const th = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');

console.log('접기 버튼');
ok('사이드바 머리에 접기 버튼이 있다', () => {
  assert.ok(th.includes('id="sbToggle" onclick="toggleFold()"'), '접기 버튼이 없음');
  assert.ok(th.includes('function toggleFold()'), '접기 동작이 없음');
});
ok('접으면 « 가 » 로 바뀌고 안내도 바뀐다', () => {
  assert.ok(th.includes("b.textContent = on?'»':'«'"), '방향 표시가 안 바뀜');
  assert.ok(th.includes("b.title = on?'메뉴 펼치기':'메뉴 접기'"), '안내가 안 바뀜');
});
ok('한 번 접어두면 다음에 들어와도 그대로', () => {
  assert.ok(th.includes("localStorage.setItem('bm_sbFold', on?'1':'0')"), '고른 걸 안 기억함');
  assert.ok(th.includes("on=localStorage.getItem('bm_sbFold')==='1'"), '기억한 걸 안 씀');
});

console.log('\n접었을 때');
ok('폭이 250px에서 64px로 준다', () => {
  assert.ok(th.includes('body.sb-fold{--sidebar-w:64px}'), '폭이 안 줄어듦');
  // 사이드바와 본문이 같은 값을 쓰니 본문도 같이 넓어진다
  assert.ok(th.includes('.sidebar{width:var(--sidebar-w)'), '사이드바가 변수를 안 씀');
  assert.ok(th.includes('.main-content{margin-left:var(--sidebar-w)'), '본문이 변수를 안 씀');
});
ok('글자는 숨고 아이콘만 남는다', () => {
  assert.ok(th.includes('body.sb-fold .sb-label{display:none}'), '글자가 안 숨음');
  assert.ok(th.includes('body.sb-fold .nav-item{justify-content:center'), '아이콘이 가운데로 안 감');
});
ok('메뉴·플래너·로그아웃 글자에 모두 표시가 붙어 있다', () => {
  assert.ok(th.includes('<span class="sb-label">${n.label}</span>'), '메뉴 글자에 표시가 없음');
  assert.ok(th.includes('📒<span class="sb-label"> 나의 플래너 →</span>'), '플래너 글자에 표시가 없음');
  assert.ok(th.includes('🚪<span class="sb-label"> 로그아웃</span>'), '로그아웃 글자에 표시가 없음');
  assert.ok(th.includes('<span class="sb-label">BEEN MATH</span>'), '로고 글자에 표시가 없음');
});
ok('아이콘만 남아도 무엇인지 알 수 있게 이름을 달아둔다', () => {
  assert.ok(th.includes('data-sec="${n.id}" title="${n.label}"'), '메뉴에 이름이 없음');
  assert.ok(th.includes('title="나의 플래너"'), '플래너에 이름이 없음');
  assert.ok(th.includes('title="로그아웃"'), '로그아웃에 이름이 없음');
});
ok('스르륵 움직인다', () => {
  assert.ok(/\.sidebar\{[^}]*transition:width \.18s/.test(th), '사이드바가 툭 바뀜');
  assert.ok(/\.main-content\{[^}]*transition:margin-left \.18s/.test(th), '본문이 툭 바뀜');
});

console.log('\n좁은 화면은 건드리지 않는다');
ok('접기는 901px부터만 먹는다', () => {
  // 900px 아래는 이미 서랍으로 숨는다 — 거기서 64px로 줄면 서랍이 망가진다
  assert.ok(/@media\(min-width:901px\)\{[\s\S]{0,900}body\.sb-fold\{--sidebar-w:64px\}/.test(th), '넓은 화면 전용이 아님');
});
ok('좁은 화면에서는 접기 버튼을 감춘다', () => {
  assert.ok(/@media\(max-width:900px\)\{[\s\S]{0,400}\.sb-toggle\{display:none\}/.test(th), '좁은 화면에 버튼이 남음');
});

console.log('\n안전');
ok('body가 아직 없어도 안 터진다', () => {
  // 화면이 그려지기 전에 불려도 페이지 전체가 멈추면 안 된다
  assert.ok(th.includes('if(bd && bd.classList) bd.classList.toggle'), 'body를 그냥 믿고 씀');
});
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  const out = []; let i = 0;
  for (;;) {
    const s = th.indexOf('<script', i); if (s < 0) break;
    const gt = th.indexOf('>', s), head = th.slice(s, gt), e = th.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(th.slice(gt + 1, e));
    i = e + 9;
  }
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: () => null, addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(out.join('\n;\n'), sb, { filename: 'teacher.html' }); } catch (e) { err = e; }
  assert.strictEqual(err, null, err && err.message);
});

console.log('\n' + pass + '개 통과');
