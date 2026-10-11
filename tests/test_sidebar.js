// 🔝 위쪽 메뉴 — 왼쪽 바 대신. 윗줄은 큰 메뉴(대단원), 아랫줄은 그 메뉴의 하위 탭(소단원).
//   왼쪽 바를 접으면 아이콘만 남아 뭐가 뭔지 알기 어렵다고 해서 위로 올렸다 (2026-10-10).
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const th = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');

function load() {
  const out = []; let i = 0;
  for (;;) {
    const s = th.indexOf('<script', i); if (s < 0) break;
    const gt = th.indexOf('>', s), head = th.slice(s, gt), e = th.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(th.slice(gt + 1, e));
    i = e + 9;
  }
  const src = out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';
  const els = {};
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} } }; return els[id]; };
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    scrollTo: () => {},
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) { err = e; }
  sb.__els = els; sb.__err = err;
  return sb;
}
const T = load();
const get = n => T.__get(n);

console.log('왼쪽 바는 없다');
ok('왼쪽 바·모바일 서랍·접기가 남아 있지 않다', () => {
  ['class="sidebar"', 'mobile-header', 'mob-overlay', 'sb-fold', 'toggleFold', 'toggleMob', 'closeMob('].forEach(k =>
    assert.ok(!th.includes(k), k + ' 가 남아 있음'));
});
ok('본문이 왼쪽으로 밀려 있지 않다', () => {
  assert.ok(!/\.main-content\{[^}]*margin-left/.test(th), '본문에 왼쪽 여백이 남음');
});

console.log('\n윗줄 — 큰 메뉴');
ok('위쪽 바가 본문 맨 위에 있고 스크롤해도 붙어 있다', () => {
  assert.ok(th.indexOf('<div class="topbar" id="topBar">') > th.indexOf('<main class="main-content">'));
  assert.ok(/\.topbar\{[^}]*position:sticky;top:0/.test(th), '위에 안 붙음');
});
ok('메뉴마다 아이콘과 이름이 같이 나온다', () => {
  T.renderThemeDots = () => {};   // firebase-init.js 에 있는 함수
  T.buildSidebar();
  const h = T.__els.topNav.innerHTML;
  get('NAV').forEach(n => {
    assert.ok(h.includes(`onclick="navigate('${n.id}')"`), n.id + ' 버튼이 없음');
    assert.ok(h.includes('</span>' + n.short + '</button>'), n.id + ' 이름이 안 보임');
  });
  assert.ok((h.match(/class="nav-icon"/g) || []).length === get('NAV').length, '아이콘 수가 다름');
});
ok('플래너·테마·로그아웃이 위쪽 바에 있다', () => {
  const bar = th.slice(th.indexOf('<div class="topbar" id="topBar">'), th.indexOf('<div class="section active" id="sec-dashboard">'));
  assert.ok(bar.includes('href="plan.html"') && bar.includes('onclick="logout()"'));
  assert.ok(bar.includes('id="themeDots"') && bar.includes('toggleThemePop()'));
  assert.strictEqual(th.split('id="themeDots"').length - 1, 1, '테마 칸이 둘 이상');
});
ok('좁은 화면에서는 글자를 줄여도 메뉴 이름은 남는다', () => {
  assert.ok(th.includes('@media(max-width:1400px){ .tb-txt{display:none} }'));
  assert.ok(/\.topnav\{[^}]*flex-wrap:wrap/.test(th), '좁으면 끝 메뉴가 옆으로 밀려 안 보임');
  assert.ok(!/\.tn-item[^{]*\{[^}]*font-size:0/.test(th));
});

console.log('\n아랫줄 — 하위 탭');
ok('하위 탭이 있는 메뉴는 넷 — 학생·반, 숙제, 성적, 내신', () => {
  assert.strictEqual(Object.keys(get('SUBNAV')).join(','), 'manage,homework,grades,naesin');
});
ok('지금 보는 탭이 눌린 모양으로 뜬다', () => {
  T.__set('naesinTab', 'jikbo');
  const h = T.subNavHtml('naesin');
  assert.ok(h.includes(`class="sn-item active" onclick="goSub('naesin','jikbo')"`), h);
  assert.strictEqual((h.match(/sn-item active/g) || []).length, 1);
  assert.strictEqual((h.match(/<button/g) || []).length, 5);
});
ok('하위 탭이 없는 메뉴는 아랫줄이 비고, 빈 줄은 숨는다', () => {
  assert.strictEqual(T.subNavHtml('dashboard'), '');
  assert.strictEqual(T.subNavHtml('curriculum'), '');
  assert.ok(th.includes('.subnav:empty{display:none}'));
});
ok('하위 탭을 누르면 그 탭으로 바뀌고 그 화면을 그린다', () => {
  const seen = [];
  T.navigate = (s) => seen.push('nav:' + s);
  T.renderSection = (s) => seen.push('render:' + s);
  T.__set('curSec', 'dashboard');
  T.goSub('grades', 'analysis');
  assert.strictEqual(get('gradeTab'), 'analysis');
  T.__set('curSec', 'grades');
  T.goSub('grades', 'mock');
  assert.strictEqual(get('gradeTab'), 'mock');
  assert.strictEqual(seen.join(' '), 'nav:grades render:grades');
});
ok('화면 안에 있던 하위 탭 줄은 없앴다 (두 군데에 같은 줄이 있으면 헷갈린다)', () => {
  ['id="mgTabs"', 'id="hwTabs"', 'id="naesinTabs"'].forEach(k => assert.ok(!th.includes(k), k));
  assert.ok(!th.includes(`onclick="gradeTab='analysis';rGrades()">📋 시험지 분석서</button>`));
});
ok('화면 안에서 탭이 바뀌어도 위쪽 표시가 따라온다', () => {
  ['function rManage(){', 'function rHomeworkHub(){', 'function rNaesin(){', 'function rGrades(){'].forEach(f => {
    const i = th.indexOf(f);
    assert.ok(i >= 0 && th.slice(i, i + 160).includes('renderSubNav();'), f);
  });
});

console.log('\n화면 크기 버튼');
ok('－ 100% ＋ 가 위쪽 바에 있다', () => {
  assert.ok(th.includes('onclick="zoomStep(-1)"') && th.includes('onclick="zoomStep(1)"') && th.includes('id="zoomVal" onclick="zoomSet(100)"'));
});
ok('한 칸씩 움직이고 끝에서 멈춘다', () => {
  assert.strictEqual(T.zoomNext(100, -1), 90);
  assert.strictEqual(T.zoomNext(100, 1), 110);
  assert.strictEqual(T.zoomNext(40, -1), 40);
  assert.strictEqual(T.zoomNext(150, 1), 150);
  assert.strictEqual(T.zoomNext(77, 1), 110);   // 모르는 값이면 100%에서 시작
});
ok('고른 크기를 화면에 적용하고 100%면 원래대로 비운다', () => {
  T.document.documentElement = { style: {} };
  T.zoomApply(60);
  assert.strictEqual(T.document.documentElement.style.zoom, '0.6');
  assert.strictEqual(T.__els.zoomVal.textContent, '60%');
  T.zoomApply(100);
  assert.strictEqual(T.document.documentElement.style.zoom, '');
});
ok('기억해 둔 값이 이상하면 100%로', () => {
  T.localStorage.getItem = () => '9999';
  assert.strictEqual(T.zoomNow(), 100);
  T.localStorage.getItem = () => '70';
  assert.strictEqual(T.zoomNow(), 70);
  T.localStorage.getItem = () => null;
});

ok('Ctrl + 휠 — 위로 굴리면 크게, 아래로 굴리면 작게', () => {
  let saved = '100';
  T.localStorage.getItem = () => saved;
  T.localStorage.setItem = (k, v) => { saved = v; };
  let stopped = 0;
  const ev = (dy, ctrl) => ({ ctrlKey: ctrl, deltaY: dy, preventDefault: () => { stopped++; } });
  T.__set('zoomWheelAt', 0);
  assert.strictEqual(T.zoomOnWheel(ev(100, true)), true);
  assert.strictEqual(saved, '90');
  T.__set('zoomWheelAt', 0);
  T.zoomOnWheel(ev(-100, true)); T.__set('zoomWheelAt', 0); T.zoomOnWheel(ev(-100, true));
  assert.strictEqual(saved, '110');
  assert.strictEqual(stopped, 3, '브라우저 자체 확대를 안 막음');
  // 연달아 쏟아지는 신호는 한 칸만
  T.zoomOnWheel(ev(-100, true));
  assert.strictEqual(saved, '110');
  T.localStorage.getItem = () => null; T.localStorage.setItem = () => {};
});
ok('Ctrl 없이 굴리면 그냥 스크롤 — 건드리지 않는다', () => {
  let stopped = 0;
  assert.strictEqual(T.zoomOnWheel({ ctrlKey: false, deltaY: 100, preventDefault: () => { stopped++; } }), false);
  assert.strictEqual(stopped, 0);
});

console.log('\n안전');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.ifError(T.__err);
});

console.log('\n' + pass + ' passed');
