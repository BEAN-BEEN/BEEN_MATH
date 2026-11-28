// 📱 단계별 숙제 제출 — 사진(받는 숙제만) → 틀린 번호 → 확인, 고르던 번호는 폰에 바로 임시 저장
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
  const src = out.join('\n;\n') + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';
  const store = {};
  const els = {};
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '', style: {}, classList: { add() {}, remove() {} }, querySelector: () => null }; return els[id]; };
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }), body: { style: {}, appendChild() {} } },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: { href: '', search: '', replace: () => {} }, history: { pushState() {}, back() {}, state: null },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  try { vm.runInContext(src, sb, { filename: file }); } catch (e) { sb.__err = e; }
  sb.__store = store;
  return sb;
}
const S = load('student.html');
const stL = fs.readFileSync(path.join(ROOT, 'student.html'), 'utf8');
S.__get('STUDENT').id = 'st1';

console.log('① 어떤 단계를 거치나');
ok('번호 숙제 + 사진 받기 → 사진·틀린 번호·확인', () => {
  assert.strictEqual(S.hwfSteps({ isOap: true, needPhoto: true, hasPhoto: false, oapEntered: false }).join(','), 'photo,wrong,check');
});
ok('사진 안 받는 번호 숙제 → 사진 단계 없음', () => {
  assert.strictEqual(S.hwfSteps({ isOap: true, needPhoto: false, hasPhoto: false, oapEntered: false }).join(','), 'wrong,check');
});
ok('사진은 이미 냈고 번호만 남음 → 번호부터', () => {
  assert.strictEqual(S.hwfSteps({ isOap: true, needPhoto: true, hasPhoto: true, oapEntered: false }).join(','), 'wrong,check');
});
ok('다 낸 숙제 → 열 게 없음', () => {
  assert.strictEqual(S.hwfSteps({ isOap: true, needPhoto: true, hasPhoto: true, oapEntered: true }).length, 0);
});
ok('사진만 받는 숙제 → 사진 한 단계', () => {
  assert.strictEqual(S.hwfSteps({ isOap: false, needPhoto: true, hasPhoto: false }).join(','), 'photo');
});

console.log('② 고르던 번호 임시 저장');
ok('고르면 폰에 남고, 다시 열면 되살아난다', () => {
  const PW = S.__get('PENDING_WRONG');
  PW.a1 = S.__get('new Set(' + JSON.stringify(['3', '17']) + ')');
  S.__get('PENDING_FREE').a1 = 'H30';
  S.hwDraftSave('a1');
  assert.ok(S.__store['bm_hwdraft_st1_a1'], '저장 키');
  delete PW.a1; delete S.__get('PENDING_FREE').a1;           // 앱이 꺼진 셈
  assert.strictEqual(S.hwDraftCount('a1'), 2);
  assert.strictEqual(S.hwDraftRestore('a1'), 3);
  assert.strictEqual([...S.__get('PENDING_WRONG').a1].join(','), '3,17');
  assert.strictEqual(S.hwfPicked('a1').join(','), '3,17,H30');
});
ok('다 지우면 저장도 지운다', () => {
  S.__get('PENDING_WRONG').a1 = S.__get('new Set()'); S.__get('PENDING_FREE').a1 = '';
  S.hwDraftSave('a1');
  assert.strictEqual(S.__store['bm_hwdraft_st1_a1'], undefined);
});
ok('제출하면(clearPendingWrong) 임시 저장도 사라진다', () => {
  S.__get('PENDING_WRONG').a2 = S.__get('new Set(' + JSON.stringify(['5']) + ')'); S.hwDraftSave('a2');
  S.clearPendingWrong('a2');
  assert.strictEqual(S.__store['bm_hwdraft_st1_a2'], undefined);
});
ok('학생마다 따로 저장 (같은 폰을 형제가 같이 써도 안 섞임)', () => {
  assert.notStrictEqual(S.hwDraftKey('a1'), (S.__get('STUDENT').id = 'st2', S.hwDraftKey('a1')));
  S.__get('STUDENT').id = 'st1';
});
ok('이미 고르고 있던 게 있으면 저장본으로 덮지 않는다', () => {
  S.__get('PENDING_WRONG').a3 = S.__get('new Set(' + JSON.stringify(['1']) + ')'); S.hwDraftSave('a3');
  S.__get('PENDING_WRONG').a3 = S.__get('new Set(' + JSON.stringify(['1', '2']) + ')');
  assert.strictEqual(S.hwDraftRestore('a3'), 0);
  assert.strictEqual(S.__get('PENDING_WRONG').a3.size, 2);
});

console.log('③ 화면 연결');
ok('숙제 카드와 첫 화면에 단계별 버튼', () => {
  assert.ok(/hwfStartBtn\(a\)/.test(stL), '숙제 카드');
  assert.ok(/hwfStartBtn\(a, true\)/.test(stL), '첫 화면');
  assert.ok(/hwDraftSave\('\$\{a\.id\}'\)/.test(stL), '직접 입력 칸도 저장');
});
ok('뒤로 가기 = 한 단계 앞', () => {
  assert.ok(/addEventListener\('popstate'/.test(stL));
});
ok('스크립트가 끝까지 돈다', () => { assert.ok(!S.__err, S.__err && S.__err.message); });

console.log(`\n${pass}개 통과`);
