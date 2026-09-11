// 📸 숙제 캡처를 대시보드에서 — 숙제 관리 탭까지 안 들어가게
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };
const Q = [];
const okA = (name, fn) => { Q.push(async () => { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } }); };

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
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '', style: {} }; return els[id]; };
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  let err = null;
  try { vm.runInContext(src, sb, { filename: file }); } catch (e) { err = e; }
  sb.__els = els; sb.__err = err;
  sb.showToast = () => {};
  return sb;
}

const T = load('teacher.html');
const html = fs.readFileSync(path.join(ROOT, 'teacher.html'), 'utf8');

// 2026-09-11 은 금요일
const FRI = '2026-09-11';
function seed() {
  T.__set('CLASSES', [
    { id: 'mon1', name: '고1T A1', weekdays: ['mon'] },
    { id: 'fri1', name: '고1T B1', weekdays: ['fri'] },
    { id: 'fri2', name: '고1S B4', weekdays: ['fri'] }
  ]);
  T.__set('ASSIGNMENTS_CACHE', []);
  T.dashDay = () => FRI;
}

console.log('\n대시보드에서 캡처 열기');
ok('반 카드의 오늘 출제 줄에 📸 캡처 버튼이 있다', () => {
  assert.ok(html.indexOf("onclick=\"openHwShot('${c.id}')\">📸 캡처</button>") >= 0, '반 카드에 캡처 버튼이 없음');
});
ok('대시보드 숙제 카드에 📸 숙제 캡처 버튼이 있다', () => {
  assert.ok(html.indexOf("onclick=\"openHwShot('')\" title=\"학생에게 캡처해서 보낼 숙제 화면\">📸 숙제 캡처</button>") >= 0);
});
ok('반을 정해서 열면 그 반', () => {
  seed();
  T.openHwShot('fri2');
  assert.strictEqual(T.__get('hwShotClassId'), 'fri2');
  assert.strictEqual(T.__els['hwShotModal'].style.display, 'flex', '창이 안 열림');
});
ok('반을 안 정하고 열면 보고 있는 날 수업하는 반부터', () => {
  // 예전엔 무조건 첫 번째 반(월요일 반)이 열렸다
  seed();
  T.openHwShot('');
  assert.strictEqual(T.__get('hwShotClassId'), 'fri1', '오늘(금) 수업 반이 아님');
});
ok('그날 수업이 없으면 첫 번째 반', () => {
  seed();
  T.dashDay = () => '2026-09-13';     // 일요일
  T.openHwShot('');
  assert.strictEqual(T.__get('hwShotClassId'), 'mon1');
});
ok('끝난 반은 건너뛴다', () => {
  seed();
  T.__set('CLASSES', [
    { id: 'old', name: '여름특강', weekdays: ['fri'], endDate: '2026-08-31' },
    { id: 'fri1', name: '고1T B1', weekdays: ['fri'] }
  ]);
  T.openHwShot('');
  assert.strictEqual(T.__get('hwShotClassId'), 'fri1', '끝난 반이 열림');
});

console.log('\n빠른 숙제 입력 → 바로 캡처');
ok('저장 + 캡처 버튼이 있다', () => {
  assert.ok(html.indexOf('onclick="doQuickSaveHw(false,true)">📸 저장 + 캡처</button>') >= 0);
});
okA('저장하고 그 반 캡처 화면을 연다 (알림은 안 보낸다)', async () => {
  seed();
  T.__set('qhwClassId', 'fri2');
  T.__els['qhw-title'] = { value: '쎈 p.50~60' };
  let saved = null, shot = null, notified = false;
  T.saveAssignment = async (d) => { saved = d; return 'newid'; };
  T.openHwShot = (cid) => { shot = cid; };
  T.doNotifyNewHw = async () => { notified = true; };
  T.rDashboard = () => {};
  T.__set('curSec', 'dashboard');
  await T.doQuickSaveHw(false, true);
  assert.ok(saved, '저장이 안 됨');
  assert.strictEqual(saved.title, '쎈 p.50~60');
  assert.strictEqual(shot, 'fri2', '그 반 캡처가 안 열림');
  assert.strictEqual(notified, false, '알림까지 보냄');
});
okA('저장만 누르면 캡처는 안 연다', async () => {
  seed();
  T.__set('qhwClassId', 'fri1');
  T.__els['qhw-title'] = { value: '기출편 3회' };
  let shot = null;
  T.saveAssignment = async () => 'id2';
  T.openHwShot = (cid) => { shot = cid; };
  T.rDashboard = () => {};
  await T.doQuickSaveHw(false);
  assert.strictEqual(shot, null);
});
okA('반을 안 고르면 저장도 캡처도 안 한다', async () => {
  seed();
  T.__set('qhwClassId', null);
  let saved = false, shot = false;
  T.saveAssignment = async () => { saved = true; return 'x'; };
  T.openHwShot = () => { shot = true; };
  await T.doQuickSaveHw(false, true);
  assert.strictEqual(saved, false);
  assert.strictEqual(shot, false);
});

console.log('\n문법');
ok('teacher.html 스크립트가 끝까지 실행된다', () => {
  assert.strictEqual(T.__err, null, T.__err && T.__err.message);
});

(async () => {
  for (const t of Q) await t();
  console.log('\n' + pass + '개 통과');
})();
