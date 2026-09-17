// 📚 교과서 과목 토글 — 학교 기본 출판사 하나 + 과목마다 다르면 그 과목만
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
T.db = { collection: (c) => ({ doc: (id) => ({ set: async (d, opt) => { writes.push({ c, id, d, opt }); } }) }) };
const books = () => T.__get('SCHOOLBOOKS_CACHE');
const J = x => JSON.stringify(x);

console.log('과목');
ok('공통수학1 · 공통수학2 · 대수 · 미적분1 · 확통 · 기하 · 미적분', () => {
  assert.strictEqual(T.__get('BOOK_SUBJECTS').map(x => x[1]).join(','), '공통수학1,공통수학2,대수,미적분1,확통,기하,미적분');
});
ok('확통은 버튼에만 줄여 쓰고, 저장은 시험 과목 이름과 같게', () => {
  // 수학 시험 이름이 '확률과 통계'로 들어가 있어서 그래야 맞춰진다
  assert.strictEqual(T.__get('BOOK_SUBJECTS')[4][0], '확률과 통계');
  assert.strictEqual(T.bookSubjectLabel('확률과 통계'), '확통');
});

console.log('\n예전에 글로 적어둔 것');
ok("교과서 칸 '공통수학1, 2' → 공통수학1 · 공통수학2", () => {
  assert.strictEqual(J(T.bookSubjectsOf({ textbook: '공통수학1, 2' })), J(['공통수학1', '공통수학2']));
});
ok("메모 칸 '확률과통계'(붙여 씀)도 읽는다", () => {
  assert.strictEqual(J(T.bookSubjectsOf({ note: '확률과통계' })), J(['확률과 통계']));
});
ok("'미적분1'을 '미적분'으로 잘못 읽지 않는다", () => {
  assert.strictEqual(J(T.bookSubjectsOf({ textbook: '미적분1' })), J(['미적분1']));
});
ok('한 번 고르면 그걸 쓰고, 글은 더 안 본다', () => {
  assert.strictEqual(J(T.bookSubjectsOf({ textbook: '공통수학1, 2', subjects: ['대수'] })), J(['대수']));
  assert.strictEqual(J(T.bookSubjectsOf({ textbook: '공통수학1', subjects: [] })), J([]), '다 끈 것을 글로 되살림');
});
ok('비어 있으면 아무것도 안 켠다 (없는 걸 지어내지 않는다)', () => {
  assert.strictEqual(J(T.bookSubjectsOf({ publisher: '비상(김)' })), J([]));
  assert.strictEqual(J(T.bookSubjectsOf(null)), J([]));
});

console.log('\n출판사 — 기본 하나, 다르면 그 과목만');
ok('과목에 따로 안 적으면 학교 기본 출판사', () => {
  assert.strictEqual(T.bookPubOf({ publisher: '비상(김)' }, '공통수학2'), '비상(김)');
});
ok('과목에 따로 적으면 그 과목만 그 출판사', () => {
  const b = { publisher: '비상(김)', subjectPub: { '대수': '천재(전)' } };
  assert.strictEqual(T.bookPubOf(b, '대수'), '천재(전)');
  assert.strictEqual(T.bookPubOf(b, '공통수학1'), '비상(김)', '다른 과목까지 바뀜');
});
ok('빈칸·공백만 적으면 기본으로', () => {
  assert.strictEqual(T.bookPubOf({ publisher: '미래엔', subjectPub: { '대수': '  ' } }, '대수'), '미래엔');
});

console.log('\n저장');
okAsync('과목을 누르면 켜지고 과목 순서대로 저장된다', async () => {
  T.__set('SCHOOLBOOKS_CACHE', { '신성고': { school: '신성고', publisher: '비상(김)' } });
  writes.length = 0;
  await T.doToggleBookSubject('신성고', '공통수학2');
  await T.doToggleBookSubject('신성고', '공통수학1');
  assert.strictEqual(J(books()['신성고'].subjects), J(['공통수학1', '공통수학2']), '순서가 뒤섞임');
  assert.strictEqual(J(writes[1].d.subjects), J(['공통수학1', '공통수학2']));
  assert.strictEqual(writes[1].c, 'schoolBooks');
});
okAsync('다시 누르면 꺼진다', async () => {
  T.__set('SCHOOLBOOKS_CACHE', { '신성고': { school: '신성고', publisher: '비상(김)', subjects: ['공통수학1', '공통수학2'] } });
  writes.length = 0;
  await T.doToggleBookSubject('신성고', '공통수학1');
  assert.strictEqual(J(writes[0].d.subjects), J(['공통수학2']));
});
okAsync('예전 글에서 읽은 과목을 이어받아 저장한다', async () => {
  T.__set('SCHOOLBOOKS_CACHE', { '과천중앙고': { school: '과천중앙고', publisher: '천재(전)', textbook: '공통수학1, 2' } });
  writes.length = 0;
  await T.doToggleBookSubject('과천중앙고', '대수');
  assert.strictEqual(J(writes[0].d.subjects), J(['공통수학1', '공통수학2', '대수']), '예전 과목이 사라짐');
});
okAsync('과목 출판사를 적으면 저장, 비우면 지운다', async () => {
  T.__set('SCHOOLBOOKS_CACHE', { '신성고': { school: '신성고', publisher: '비상(김)', subjectPub: { '대수': '천재(전)', '기하': '미래엔' } } });
  writes.length = 0;
  await T.doSetSubjectPub('신성고', '대수', '');
  assert.strictEqual(J(writes[0].d.subjectPub), J({ '기하': '미래엔' }), '비운 과목이 안 지워짐');
});
ok('★ 지운 과목이 저장소에 남지 않게 통째로 바꿔 쓴다', () => {
  // merge:true로 쓰면 지도 안의 키가 합쳐져서 지운 게 되살아난다
  assert.ok(th.includes("{mergeFields:['school','subjectPub','ts']}"), '과목 출판사를 합쳐 씀');
  assert.ok(th.includes("{mergeFields:['school','subjects','ts']}"), '과목 목록을 합쳐 씀');
});

console.log('\n화면');
ok('표 교과서 칸이 글칸이 아니라 과목 버튼', () => {
  assert.ok(th.includes("doToggleBookSubject('${sq}','${k}')"), '과목 버튼이 없음');
  assert.ok(!th.includes("f(s,'textbook','예: 수학Ⅰ'"), '옛 교과서 글칸이 남아 있음');
});
ok('켠 과목마다 출판사 칸 — 비워두면 기본 출판사라고 보여준다', () => {
  assert.ok(th.includes('placeholder="= ${esc(b.publisher||\'기본\')}"'), '기본 출판사 안내가 없음');
  assert.ok(th.includes("doSetSubjectPub('${sq}','${k}',this.value)"), '과목 출판사 저장이 없음');
});
ok('학교 정보 카드에 이번 시험 과목의 출판사를 먼저', () => {
  assert.ok(th.includes('const now=subs.filter(k=>examSubs.includes(k.replace(/\\s+/g,\'\')));'), '시험 과목으로 안 고름');
  assert.ok(th.includes('${esc(bookPubOf(b,k))}</b> ${esc(bookSubjectLabel(k))}'), '과목별 출판사가 안 나옴');
});
ok('출판사 이름에 태그가 있어도 안 샌다', () => {
  assert.ok(th.includes("const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/\"/g,'&quot;').replace(/</g,'&lt;');"), '표에서 < 를 안 막음');
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
