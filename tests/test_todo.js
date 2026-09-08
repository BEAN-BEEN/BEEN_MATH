// 체크리스트 — 여러 줄 쓰기 + 내신 대비(교재별)
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
const sb = {
  console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
  document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), body: {} },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '', search: '', replace: () => {} },
  navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => '',
  addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
  firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
};
sb.window = sb; sb.globalThis = sb; sb.self = sb;
vm.createContext(sb);
try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) {}
const toasts = [];
sb.showToast = (m, t) => toasts.push({ m, t });
sb.rDashboard = () => {};
sb.__set('db', { collection: () => ({ doc: (id) => ({ set: async (d) => { written.push({ id, d }); }, get: async () => ({ exists: false, data: () => ({}) }) }) }) });
const get = n => sb.__get(n), set = (n, v) => sb.__set(n, v);

const TWO = '기출편 3회 채점\n오답 번호 정리까지';

console.log('두 줄 쓰기');
(async () => {
  await okA("줄바꿈이 그대로 저장된다", async () => {
    set('MYTODOS', []); written.length = 0;
    el('todo-new-my').value = TWO;
    await sb.doAddTodo('my');
    assert.strictEqual(get('MYTODOS').length, 1);
    assert.strictEqual(get('MYTODOS')[0].text, TWO, '줄바꿈이 사라짐');
    assert.ok(written.length, '서버에 저장 안 함');
  });
  ok("보여줄 때도 줄바꿈이 살아 있다 (pre-wrap)", () => {
    const h = sb.todoItemHtml('my', { id: 't1', text: TWO, done: false });
    assert.ok(/white-space:pre-wrap/.test(h), 'pre-wrap이 없어 한 줄로 붙어버림');
    assert.ok(h.includes('오답 번호 정리까지'), '둘째 줄이 안 보임');
  });
  ok("체크 표시가 위에 붙어 정렬된다 (두 줄이어도 안 흐트러짐)", () => {
    const h = sb.todoItemHtml('my', { id: 't1', text: TWO, done: false });
    assert.ok(/align-items:flex-start/.test(h), '가운데 정렬이라 두 줄일 때 어긋남');
  });
  ok("입력칸이 textarea이고 Shift+Enter로 줄바꿈한다", () => {
    const h = sb.todoInputHtml('my', '할 일 추가');
    assert.ok(/<textarea/.test(h), 'textarea가 아님');
    assert.ok(/event\.key==='Enter'&&!event\.shiftKey/.test(h), 'Shift+Enter 처리가 없음');
    assert.ok(/Shift\+Enter 줄바꿈/.test(h), '안내 문구가 없음');
  });
  await okA("빈 내용·공백만 있으면 추가되지 않는다", async () => {
    set('MYTODOS', []);
    el('todo-new-my').value = '   \n  ';
    await sb.doAddTodo('my');
    assert.strictEqual(get('MYTODOS').length, 0);
  });
  await okA("뒤쪽 빈 줄은 정리하되 가운데 줄바꿈은 살린다", async () => {
    set('MYTODOS', []);
    el('todo-new-my').value = '첫 줄\n둘째 줄\n\n\n';
    await sb.doAddTodo('my');
    assert.strictEqual(get('MYTODOS')[0].text, '첫 줄\n둘째 줄');
  });
  ok("HTML이 섞여 들어와도 태그로 실행되지 않는다", () => {
    // 이 코드베이스 관례대로 '<'만 막는다. 그것만으로 태그가 만들어지지 않는다.
    const h = sb.todoItemHtml('my', { id: 't1', text: '<script>x</script>', done: false });
    assert.ok(!/<script>/.test(h), '태그가 그대로 들어감');
    assert.ok(/&lt;script>x/.test(h), '내용이 사라짐');
  });

  console.log('\n고쳐 쓰기');
  await okA("항목을 고치면 내용이 바뀐다", async () => {
    set('MYTODOS', [{ id: 't1', text: '옛 내용', done: false }]);
    set('todoEditId', 't1');
    el('todo-edit').value = '새 내용\n둘째 줄';
    await sb.doSaveTodoEdit('my', 't1');
    assert.strictEqual(get('MYTODOS')[0].text, '새 내용\n둘째 줄');
    assert.strictEqual(get('todoEditId'), null, '편집 상태가 안 풀림');
  });
  await okA("고칠 때 내용을 비우면 막는다", async () => {
    set('MYTODOS', [{ id: 't1', text: '지키자', done: false }]);
    set('todoEditId', 't1'); toasts.length = 0;
    el('todo-edit').value = '  ';
    await sb.doSaveTodoEdit('my', 't1');
    assert.strictEqual(get('MYTODOS')[0].text, '지키자', '내용이 날아감');
    assert.ok(/비울 수 없어요/.test(toasts.map(t => t.m).join(' ')));
  });
  ok("편집 중이면 그 항목만 입력창으로 바뀐다", () => {
    set('todoEditId', 't1');
    const h = sb.todoItemHtml('my', { id: 't1', text: 'x', done: false });
    assert.ok(/id="todo-edit"/.test(h));
    const other = sb.todoItemHtml('my', { id: 't2', text: 'y', done: false });
    assert.ok(!/id="todo-edit"/.test(other), '다른 항목까지 편집 상태가 됨');
    set('todoEditId', null);
  });

  console.log('\n화면 배치·색');
  ok("--purple이 선언돼 있다 (진행 막대가 투명해지지 않게)", () => {
    assert.ok(/--purple:#[0-9A-Fa-f]{6}/.test(html), '선언이 없어 색이 안 나옴');
  });
  // 함수를 지우다 옆 함수까지 날려도 구문 검사는 통과한다. 실제로 있는지 확인한다.
  ok("대시보드가 부르는 함수가 전부 살아 있다", () => {
    const body = html.slice(html.indexOf("document.getElementById('dashboardContent').innerHTML=`"));
    const called = new Set();
    const re = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\(/g;
    let m, guard = 0;
    while ((m = re.exec(body.slice(0, 4000))) && guard++ < 200) called.add(m[1]);
    assert.ok(called.size >= 4, '호출을 못 찾음');
    called.forEach(fn => assert.strictEqual(typeof sb[fn], 'function', fn + '() 가 없음 — 지우다 같이 날아갔을 수 있음'));
  });
  ok("내 체크리스트가 실제로 그려진다", () => {
    set('MYTODOS', [{ id: 't1', text: '가나', done: false }]);
    const h = sb.myTodosHtml();
    assert.ok(/내 체크리스트/.test(h));
    assert.ok(/가나/.test(h));
  });

  console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
})();
