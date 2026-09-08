// 반별 체크리스트 — 방학 단원(기존) + 내신 대비 교재 칸(새로). 따로/함께 보기.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const ROOT = require('path').join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };
const okA = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
const src = (function () {
  const out = []; let i = 0;
  for (;;) {
    const s = html.indexOf('<script', i); if (s < 0) break;
    const gt = html.indexOf('>', s), head = html.slice(s, gt), e = html.indexOf('</script>', gt);
    if (e < 0) break;
    if (!head.includes('src=')) out.push(html.slice(gt + 1, e));
    i = e + 9;
  }
  return out.join('\n;\n');
})() + '\n;globalThis.__get=(n)=>eval(n);globalThis.__set=(n,v)=>eval(n+"=v");';

const els = {};
const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '' }; return els[id]; };
const written = [];
let promptReply = '';
const sb = {
  console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
  document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), body: {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '', search: '', replace: () => {} },
  navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true,
  prompt: () => promptReply,
  addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
  firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
};
sb.window = sb; sb.globalThis = sb; sb.self = sb;
vm.createContext(sb);
try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) {}
sb.showToast = () => {};
sb.rDashboard = () => {};
sb.__set('db', { collection: () => ({ doc: (id) => ({ set: async (d) => { written.push({ id, d }); } }) }) });
const get = n => sb.__get(n), set = (n, v) => sb.__set(n, v);

const CID = 'c1';
function seed(doc) {
  written.length = 0;
  set('CLASSES', [{ id: CID, name: 'A반', weekday: 'mon', weekdays: ['mon'] }]);
  set('STUDENTS_CACHE', [
    { id: 's1', name: '가나', classIds: [CID], status: '재원' },
    { id: 's2', name: '다라', classIds: [CID], status: '재원' }
  ]);
  set('CLASSCHECK_CACHE', { [CID]: Object.assign({ id: CID, units: [], marks: {}, testLog: {} }, doc || {}) });
  set('ckBoardClassId', CID);
  set('ckGroup', '');
  set('ckCopyOpen', false);
}
const UNITS = [{ id: 'u1', name: '1단원' }, { id: 'u2', name: '2단원' }];
const NAESIN = [
  { id: 'n1', name: '1주차', book: '마스터교재' },
  { id: 'n2', name: '2주차', book: '마스터교재' },
  { id: 'n3', name: '1주차', book: '기출편' }
];

(async () => {
  console.log('두 묶음이 한 표에 선다');
  ok("방학 단원과 교재 항목이 한 줄로 이어진다", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    const cols = sb.ckColumns(CID);
    assert.strictEqual(cols.length, 5);
    assert.strictEqual(cols.map(c => c.name).join(','), '1단원,2단원,1주차,2주차,1주차');
  });
  ok("각 열이 어느 묶음인지 들고 있다", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    const cols = sb.ckColumns(CID);
    assert.strictEqual(cols[0].group, '방학 단원');
    assert.strictEqual(cols[0].kind, 'unit');
    assert.strictEqual(cols[2].group, '마스터교재');
    assert.strictEqual(cols[2].kind, 'naesin');
    assert.strictEqual(cols[4].group, '기출편');
  });
  ok("묶음 목록은 방학 단원 + 교재 3종", () => {
    assert.strictEqual(sb.ckGroups().join(','), '방학 단원,마스터교재,기출편,유형편');
  });
  ok("교재가 안 적힌 옛 항목은 첫 교재로 본다", () => {
    seed({ units: [], naesinItems: [{ id: 'x', name: '이름만' }] });
    assert.strictEqual(sb.ckColumns(CID)[0].group, '마스터교재');
  });

  console.log('\n따로 보기 / 함께 보기');
  ok("전체 보기면 다섯 열이 다 나오고 묶음 이름이 붙는다", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    set('ckGroup', '');
    const h = sb.classCheckBoardHtml();
    ['1단원', '2단원', '2주차', '기출편', '마스터교재'].forEach(t => assert.ok(h.includes(t), t + '이 안 보임'));
  });
  ok("교재를 고르면 그 교재 열만 나온다", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    set('ckGroup', '기출편');
    const h = sb.classCheckBoardHtml();
    assert.ok(!/ckToggle\('c1','unit','u1'/.test(h), '방학 단원이 섞여 나옴');
    assert.ok(/ckToggle\('c1','naesin','n3'/.test(h), '기출편 열이 안 나옴');
    assert.ok(!/ckToggle\('c1','naesin','n1'/.test(h), '다른 교재가 섞여 나옴');
  });
  ok("방학 단원만 고르면 교재 열이 안 나온다", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    set('ckGroup', '방학 단원');
    const h = sb.classCheckBoardHtml();
    assert.ok(/ckToggle\('c1','unit','u1'/.test(h));
    assert.ok(!/ckToggle\('c1','naesin'/.test(h), '교재 열이 섞여 나옴');
  });
  ok("묶음 칩에 열 수와 진행이 보인다", () => {
    seed({ units: UNITS, naesinItems: NAESIN, marks: { u1: { s1: true } }, naesinMarks: { n1: { s1: true, s2: true } } });
    set('ckGroup', '');
    const h = sb.classCheckBoardHtml();
    assert.ok(/방학 단원 <strong>2<\/strong> <span[^>]*>1\/4</.test(h), '방학 단원 진행이 1/4가 아님');
    assert.ok(/마스터교재 <strong>2<\/strong> <span[^>]*>2\/4</.test(h), '마스터교재 진행이 2/4가 아님');
    assert.ok(/유형편 <strong>0<\/strong>/.test(h), '빈 교재도 보여야 함');
    assert.ok(/전체 <strong>5<\/strong>/.test(h), '전체가 5가 아님');
  });

  console.log('\n체크가 서로 안 섞이는가');
  ok("체크 여부를 각자의 저장소에서 읽는다", () => {
    seed({ units: UNITS, naesinItems: NAESIN, marks: { u1: { s1: true } }, naesinMarks: { n1: { s2: true } } });
    const cols = sb.ckColumns(CID);
    assert.strictEqual(sb.ckMarked(CID, cols[0], 's1'), true);
    assert.strictEqual(sb.ckMarked(CID, cols[0], 's2'), false);
    assert.strictEqual(sb.ckMarked(CID, cols[2], 's2'), true);
    assert.strictEqual(sb.ckMarked(CID, cols[2], 's1'), false);
  });
  await okA("교재 체크는 naesinMarks에만 저장된다 (방학 기록 안 건드림)", async () => {
    seed({ units: UNITS, naesinItems: NAESIN, marks: { u1: { s1: true } } });
    await sb.ckToggle(CID, 'naesin', 'n1', 's1');
    const c = get('CLASSCHECK_CACHE')[CID];
    assert.strictEqual(c.naesinMarks.n1.s1, true);
    assert.strictEqual(c.marks.u1.s1, true, '방학 체크가 사라짐');
    assert.ok(written.some(w => w.d.naesinMarks), '서버 저장에 naesinMarks가 없음');
    assert.ok(!written.some(w => w.d.marks), '교재 체크인데 marks까지 덮어씀');
  });
  await okA("방학 단원 체크는 예전 그대로 marks에 저장된다", async () => {
    seed({ units: UNITS, naesinItems: NAESIN, naesinMarks: { n1: { s1: true } } });
    await sb.ckToggle(CID, 'unit', 'u1', 's2');
    const c = get('CLASSCHECK_CACHE')[CID];
    assert.strictEqual(c.marks.u1.s2, true);
    assert.strictEqual(c.naesinMarks.n1.s1, true, '교재 체크가 사라짐');
  });
  await okA("같은 이름(1주차)이 교재마다 있어도 따로 체크된다", async () => {
    seed({ naesinItems: NAESIN });
    await sb.ckToggle(CID, 'naesin', 'n1', 's1');   // 마스터교재 1주차
    const c = get('CLASSCHECK_CACHE')[CID];
    assert.strictEqual(c.naesinMarks.n1.s1, true);
    assert.ok(!(c.naesinMarks.n3 && c.naesinMarks.n3.s1), '기출편 1주차까지 같이 체크됨');
  });
  await okA("한 번 더 누르면 체크가 풀린다", async () => {
    seed({ naesinItems: NAESIN, naesinMarks: { n1: { s1: true } } });
    await sb.ckToggle(CID, 'naesin', 'n1', 's1');
    assert.ok(!get('CLASSCHECK_CACHE')[CID].naesinMarks.n1.s1);
  });

  console.log('\n주차 추가·삭제');
  await okA("교재를 고른 상태면 그 교재에 주차가 들어간다", async () => {
    seed({ naesinItems: [] });
    set('ckGroup', '기출편'); promptReply = '1주차';
    await sb.doAddCkItem(CID);
    const items = sb.naesinAllItems(CID);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].book, '기출편');
    assert.strictEqual(items[0].name, '1주차');
  });
  await okA("다음 주차 번호를 알아서 채워준다", async () => {
    seed({ naesinItems: [{ id: 'a', name: '1주차', book: '유형편' }] });
    set('ckGroup', '유형편');
    let suggested = '';
    sb.prompt = (msg, def) => { suggested = def; return def; };
    await sb.doAddCkItem(CID);
    sb.prompt = () => promptReply;
    assert.strictEqual(suggested, '2주차', '기본값이 2주차가 아님: ' + suggested);
  });
  await okA("방학 단원을 고른 상태면 기존 단원 추가로 간다", async () => {
    seed({ units: [] });
    set('ckGroup', '방학 단원'); promptReply = '3단원';
    await sb.doAddCkItem(CID);
    assert.strictEqual(get('CLASSCHECK_CACHE')[CID].units.length, 1);
    assert.strictEqual(sb.naesinAllItems(CID).length, 0, '단원인데 교재 쪽에 들어감');
  });
  await okA("주차를 지우면 그 체크 기록만 사라진다", async () => {
    seed({ units: UNITS, naesinItems: NAESIN, marks: { u1: { s1: true } }, naesinMarks: { n1: { s1: true }, n3: { s2: true } } });
    await sb.doDelNaesinItem(CID, 'n1');
    const c = get('CLASSCHECK_CACHE')[CID];
    assert.strictEqual(c.naesinItems.length, 2);
    assert.ok(!c.naesinMarks.n1, '지운 열의 기록이 남음');
    assert.strictEqual(c.naesinMarks.n3.s2, true, '다른 열 기록이 사라짐');
    assert.strictEqual(c.marks.u1.s1, true, '방학 기록이 사라짐');
  });

  console.log('\n기존 화면이 그대로인가');
  ok("반 선택 칩은 그대로 있다", () => {
    seed({ units: UNITS });
    assert.ok(/setCkBoardClass\('c1'\)/.test(sb.classCheckBoardHtml()));
  });
  ok("복사 버튼은 어느 묶음을 보든 나온다 (교재도 반들이 똑같이 쓰므로)", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    set('CLASSES', [{ id: CID, name: 'A반' }, { id: 'c2', name: 'B반' }]);
    ['', '방학 단원', '기출편'].forEach(g => {
      set('ckGroup', g);
      assert.ok(/toggleCkCopy/.test(sb.classCheckBoardHtml()), (g || '전체') + '에서 복사 버튼이 안 보임');
    });
  });
  ok("복사 패널이 지금 보고 있는 묶음 이름을 보여준다", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    set('CLASSES', [{ id: CID, name: 'A반' }, { id: 'c2', name: 'B반' }]);
    set('ckCopyOpen', true);
    set('ckGroup', '기출편');
    const h = sb.classCheckBoardHtml();
    assert.ok(/기출편<\/span>을 다른 반에도/.test(h), '묶음 이름이 안 나옴');
    assert.ok(/모든 반 선택/.test(h), '전체 선택 버튼이 없음');
    set('ckGroup', '');
    assert.ok(/전체 항목<\/span>을 다른 반에도/.test(sb.classCheckBoardHtml()), '전체 보기 표기가 다름');
    set('ckCopyOpen', false);
  });
  ok("추가 버튼 이름이 보고 있는 묶음에 맞춰 바뀐다", () => {
    seed({ units: UNITS });
    set('ckGroup', '방학 단원');
    assert.ok(/＋ 단원 추가/.test(sb.classCheckBoardHtml()));
    set('ckGroup', '유형편');
    assert.ok(/＋ 주차 추가/.test(sb.classCheckBoardHtml()));
  });
  ok("항목이 없으면 무엇을 만들지 알려준다", () => {
    seed({ units: [], naesinItems: [] });
    set('ckGroup', '기출편');
    assert.ok(/기출편에 아직 항목이 없어요/.test(sb.classCheckBoardHtml()));
  });
  ok("학생이 없는 반은 그렇게 알려준다", () => {
    seed({ units: UNITS });
    set('STUDENTS_CACHE', []);
    assert.ok(/배정된 학생이 없어요/.test(sb.classCheckBoardHtml()));
  });
  ok("왼쪽에 잘못 넣었던 카드는 사라졌다", () => {
    assert.ok(!html.includes('naesinTodosHtml'), '아직 남아 있음');
    assert.ok(!html.includes('naesinTodos'), 'settings/naesinTodos 흔적이 남음');
  });

  console.log('\n다른 반에 복사');
  ok("교재를 볼 때는 그 교재 주차만 복사 대상", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    set('ckGroup', '기출편');
    const src = sb.ckCopySrc(CID);
    assert.strictEqual(src.length, 1);
    assert.strictEqual(src[0].group, '기출편');
  });
  ok("전체 보기면 방학 단원과 교재가 다 복사 대상", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    set('ckGroup', '');
    assert.strictEqual(sb.ckCopySrc(CID).length, 5);
  });
  ok("이미 있는 이름은 복사 계획에서 빠진다", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    const cache = get('CLASSCHECK_CACHE');
    cache['c2'] = { id:'c2', units:[], naesinItems:[{id:'z', name:'1주차', book:'기출편'}] };
    set('CLASSCHECK_CACHE', cache);
    set('CLASSES', [{id:CID,name:'A반'},{id:'c2',name:'B반'}]);
    set('ckGroup', '기출편');
    assert.strictEqual(sb.ckCopyPlan(CID, ['c2']).length, 0, '이미 있는데 또 복사하려 함');
  });
  await okA("복사하면 주차는 naesinItems로, 단원은 units로 들어간다", async () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    const cache = get('CLASSCHECK_CACHE');
    cache['c2'] = { id: 'c2', units: [], marks: {}, testLog: {} };
    set('CLASSCHECK_CACHE', cache);
    set('CLASSES', [{ id: CID, name: 'A반' }, { id: 'c2', name: 'B반' }]);
    set('ckGroup', '');
    sb.document.querySelectorAll = (sel) => (sel === '.ck-copy-chk' ? [{ value: 'c2', checked: true, disabled: false }] : []);
    written.length = 0;
    await sb.doCopyUnits(CID);
    sb.document.querySelectorAll = () => [];
    const t = get('CLASSCHECK_CACHE')['c2'];
    assert.strictEqual(t.units.length, 2, '단원이 안 들어감');
    assert.strictEqual(t.naesinItems.length, 3, '주차가 안 들어감');
    assert.strictEqual(t.naesinItems.filter(x => x.book === '기출편').length, 1, '교재 표시가 안 따라감');
    assert.ok(!t.units.some(u => u.name === '1주차'), '주차가 단원 쪽에 섞임');
    assert.ok(written.some(w => w.id === 'c2'), '서버에 저장 안 함');
  });
  await okA("복사해도 받는 반의 학생 체크는 그대로", async () => {
    seed({ naesinItems: NAESIN });
    const cache = get('CLASSCHECK_CACHE');
    cache['c2'] = { id: 'c2', units: [], marks: { u9: { s1: true } }, naesinMarks: { z: { s1: true } }, naesinItems: [] };
    set('CLASSCHECK_CACHE', cache);
    set('CLASSES', [{ id: CID, name: 'A반' }, { id: 'c2', name: 'B반' }]);
    set('ckGroup', '마스터교재');
    sb.document.querySelectorAll = (sel) => (sel === '.ck-copy-chk' ? [{ value: 'c2', checked: true, disabled: false }] : []);
    await sb.doCopyUnits(CID);
    sb.document.querySelectorAll = () => [];
    const t = get('CLASSCHECK_CACHE')['c2'];
    assert.strictEqual(t.marks.u9.s1, true, '방학 체크가 사라짐');
    assert.strictEqual(t.naesinMarks.z.s1, true, '교재 체크가 사라짐');
  });
  ok("교재가 다르면 같은 1주차라도 새로 복사한다", () => {
    seed({ units: UNITS, naesinItems: NAESIN });
    const cache = get('CLASSCHECK_CACHE');
    cache['c2'] = { id:'c2', units:[], naesinItems:[{id:'z', name:'1주차', book:'마스터교재'}] };
    set('CLASSCHECK_CACHE', cache);
    set('CLASSES', [{id:CID,name:'A반'},{id:'c2',name:'B반'}]);
    set('ckGroup', '기출편');
    const plan = sb.ckCopyPlan(CID, ['c2']);
    assert.strictEqual(plan.length, 1);
    assert.strictEqual(plan[0].add[0].group, '기출편');
  });
  console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
})();
