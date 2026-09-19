// 알림 — 왜 안 갔는지 알 수 있어야 한다. 실패를 성공이라고 말하면 안 된다.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const ROOT = require('path').join(__dirname, '..');

let pass = 0;
const ok = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };
const okA = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + ' :: ' + e.message); process.exitCode = 1; } };

// ── Worker의 notify()를 그대로 떼어내 실행한다 (FCM 오류 해석이 핵심)
function loadWorkerNotify(fetchStub) {
  const src = fs.readFileSync(ROOT + '/src/index.js', 'utf8');
  const start = src.indexOf('async function notify(request, env) {');
  const end = src.indexOf('\nasync function getAccessToken');
  if (start < 0 || end < 0) throw new Error('notify 함수를 못 찾음');
  const body = src.slice(start, end);
  const ctx = {
    fetch: fetchStub,
    Response: class { constructor(b, i) { this.body = b; this.status = (i && i.status) || 200; } },
    getAccessToken: async () => 'fake-token',
    JSON, console
  };
  ctx.json = (obj, status = 200) => ({ obj, status });
  vm.createContext(ctx);
  vm.runInContext(body + '\n;globalThis.__notify=notify;', ctx);
  return ctx.__notify;
}
const SA = JSON.stringify({ project_id: 'been-math', client_email: 'x@y', private_key: 'k' });
const fcmOk = () => ({ ok: true, status: 200, text: async () => '{}' });
const fcmErr = (status, errorCode) => ({
  ok: false, status,
  text: async () => JSON.stringify({ error: { status: 'NOT_FOUND', message: 'bad', details: [{ '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', errorCode }] } })
});

console.log('Worker — 실패 이유를 버리지 않는가');
(async () => {
  await okA("모두 성공하면 sent만큼 센다", async () => {
    const notify = loadWorkerNotify(async () => fcmOk());
    const r = await notify({ json: async () => ({ tokens: ['a', 'b'], title: 't', body: 'b' }) }, { FIREBASE_SERVICE_ACCOUNT: SA });
    assert.strictEqual(r.obj.sent, 2);
    assert.strictEqual(r.obj.failed, 0);
    assert.strictEqual(r.obj.total, 2);
  });
  await okA("만료된 토큰(UNREGISTERED)을 invalid로 따로 모은다", async () => {
    const notify = loadWorkerNotify(async () => fcmErr(404, 'UNREGISTERED'));
    const r = await notify({ json: async () => ({ tokens: ['dead1', 'dead2'] }) }, { FIREBASE_SERVICE_ACCOUNT: SA });
    assert.strictEqual(r.obj.sent, 0);
    assert.strictEqual(r.obj.failed, 2);
    assert.strictEqual(r.obj.invalid.join(','), 'dead1,dead2');
    assert.strictEqual(r.obj.errors[0].code, 'UNREGISTERED');
  });
  await okA("일부만 성공하면 성공·실패를 나눠 센다", async () => {
    let i = 0;
    const notify = loadWorkerNotify(async () => (i++ === 0 ? fcmOk() : fcmErr(404, 'UNREGISTERED')));
    const r = await notify({ json: async () => ({ tokens: ['live', 'dead'] }) }, { FIREBASE_SERVICE_ACCOUNT: SA });
    assert.strictEqual(r.obj.sent, 1);
    assert.strictEqual(r.obj.failed, 1);
    assert.strictEqual(r.obj.invalid.join(','), 'dead');
  });
  await okA("만료가 아닌 오류는 invalid에 넣지 않는다 (멀쩡한 토큰을 지우면 안 됨)", async () => {
    const notify = loadWorkerNotify(async () => fcmErr(503, 'UNAVAILABLE'));
    const r = await notify({ json: async () => ({ tokens: ['good'] }) }, { FIREBASE_SERVICE_ACCOUNT: SA });
    assert.strictEqual(r.obj.invalid.length, 0, '멀쩡한 토큰이 삭제 대상이 됨');
    assert.strictEqual(r.obj.errors[0].code, 'UNAVAILABLE');
  });
  await okA("토큰이 없으면 total 0으로 알려준다", async () => {
    const notify = loadWorkerNotify(async () => fcmOk());
    const r = await notify({ json: async () => ({ tokens: [] }) }, { FIREBASE_SERVICE_ACCOUNT: SA });
    assert.strictEqual(r.obj.total, 0);
    assert.strictEqual(r.obj.sent, 0);
  });
  await okA("서비스 계정이 없으면 500과 이유를 준다", async () => {
    const notify = loadWorkerNotify(async () => fcmOk());
    const r = await notify({ json: async () => ({ tokens: ['a'] }) }, {});
    assert.strictEqual(r.status, 500);
    assert.ok(/FIREBASE_SERVICE_ACCOUNT/.test(r.obj.error));
  });

  // ── 선생님 화면
  console.log('\n선생님 화면 — 실패를 성공이라고 말하지 않는가');
  const els = {};
  const el = (id) => { if (!els[id]) els[id] = { id, value: '', innerHTML: '', textContent: '', dataset: {}, style: {} }; return els[id]; };
  const toasts = [];
  let lastFetch = null, fetchReply = null;
  const src = (function () {
    const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
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
  const updated = [];
  const sb = {
    console, setTimeout: () => {}, clearTimeout, setInterval, clearInterval,
    document: { getElementById: (id) => el(id), addEventListener: () => {}, querySelectorAll: () => [], createElement: () => ({}), body: {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    location: { href: '', search: '', replace: () => {} },
    navigator: { userAgent: 'node' }, alert: () => {}, confirm: () => true, prompt: () => 'msg',
    addEventListener: () => {}, removeEventListener: () => {}, matchMedia: () => ({ matches: false, addListener: () => {} }),
    fetch: async (u, o) => { lastFetch = { u, body: JSON.parse(o.body) }; return { json: async () => fetchReply }; },
    firebase: { initializeApp: () => {}, firestore: Object.assign(() => ({}), { FieldValue: class {} }), auth: () => ({}), storage: () => ({}) }
  };
  sb.window = sb; sb.globalThis = sb; sb.self = sb;
  vm.createContext(sb);
  try { vm.runInContext(src, sb, { filename: 'teacher.html' }); } catch (e) {}
  sb.showToast = (m, t) => toasts.push({ m, t: t || 'success' });
  sb.__set('db', { collection: () => ({ doc: (id) => ({ update: async (u) => { updated.push({ id, u }); } }) }) });
  const get = n => sb.__get(n), set = (n, v) => sb.__set(n, v);

  const msgOf = (j, total) => sb.pushMsg(j, total);
  ok("한 명도 못 받으면 '실패'라고 말한다 (예전엔 '발송 완료'라고 했다)", () => {
    const [m, t] = msgOf({ sent: 0, failed: 3, total: 3, errors: [{ code: 'UNREGISTERED' }] }, 3);
    assert.strictEqual(t, 'error');
    assert.ok(/한 명도 못 받았어요/.test(m), m);
    assert.ok(!/발송 완료/.test(m), "여전히 '발송 완료'라고 함");
  });
  ok("실패 이유를 사람 말로 알려준다", () => {
    const [m] = msgOf({ sent: 0, failed: 1, total: 1, errors: [{ code: 'UNREGISTERED' }] }, 1);
    assert.ok(/알림이 꺼졌거나/.test(m), m);
  });
  ok("전부 성공하면 성공", () => {
    const [m, t] = msgOf({ sent: 3, failed: 0, total: 3 }, 3);
    assert.strictEqual(t, 'success');
    assert.ok(/3명에게 발송/.test(m));
  });
  ok("일부만 가면 몇 명이 실패했는지 같이 알려준다", () => {
    const [m, t] = msgOf({ sent: 2, failed: 1, total: 3, errors: [{ code: 'UNREGISTERED' }] }, 3);
    assert.strictEqual(t, 'warning');
    assert.ok(/2명 발송/.test(m) && /1명 실패/.test(m), m);
  });
  ok("알림 켠 학생이 0명이면 그렇게 말한다", () => {
    const [m, t] = msgOf({ sent: 0, failed: 0, total: 0 }, 0);
    assert.strictEqual(t, 'warning');
    assert.ok(/알림을 켠 학생이 없어요/.test(m), m);
  });
  ok("서버가 오류를 주면 그대로 보여준다", () => {
    const [m, t] = msgOf({ error: 'FIREBASE_SERVICE_ACCOUNT 환경변수가 없어요' }, 3);
    assert.strictEqual(t, 'error');
    assert.ok(/FIREBASE_SERVICE_ACCOUNT/.test(m), m);
  });
  ok("응답 자체가 없으면 연결 실패로 알린다", () => {
    const [m, t] = msgOf(null, 3);
    assert.strictEqual(t, 'error');
    assert.ok(/연결하지 못했어요/.test(m), m);
  });

  console.log('\n끊긴 토큰 정리');
  await okA("만료된 토큰만 학생 문서에서 지운다", async () => {
    updated.length = 0;
    set('STUDENTS_CACHE', [
      { id: 's1', name: '가나', fcmTokens: ['dead1', 'live1'] },
      { id: 's2', name: '다라', fcmTokens: ['live2'] },
      { id: 's3', name: '마바', fcmTokens: ['dead2'] }
    ]);
    const cleaned = await sb.dropDeadTokens(['dead1', 'dead2']);
    assert.strictEqual(cleaned, 2, '정리된 학생 수가 다름');
    assert.strictEqual(updated.length, 2);
    const s1 = updated.find(x => x.id === 's1');
    assert.strictEqual(s1.u.fcmTokens.join(','), 'live1', '멀쩡한 토큰까지 지워짐');
    const s3 = updated.find(x => x.id === 's3');
    assert.strictEqual(s3.u.fcmTokens.length, 0);
    assert.ok(!updated.find(x => x.id === 's2'), '관계없는 학생을 건드림');
  });
  await okA("지울 게 없으면 아무 일도 안 한다", async () => {
    updated.length = 0;
    assert.strictEqual(await sb.dropDeadTokens([]), 0);
    assert.strictEqual(await sb.dropDeadTokens(null), 0);
    assert.strictEqual(updated.length, 0);
  });

  console.log('\nsendPush 통합');
  await okA("보낸 뒤 결과를 알리고 끊긴 토큰을 정리한다", async () => {
    updated.length = 0; toasts.length = 0;
    set('STUDENTS_CACHE', [{ id: 's1', name: '가나', fcmTokens: ['dead1'] }]);
    fetchReply = { sent: 0, failed: 1, total: 1, invalid: ['dead1'], errors: [{ code: 'UNREGISTERED' }] };
    await sb.sendPush(['dead1'], '제목', '내용');
    assert.strictEqual(lastFetch.u, '/api/notify');
    assert.strictEqual(lastFetch.body.tokens.join(','), 'dead1');
    assert.strictEqual(toasts[0].t, 'error', '실패인데 ' + toasts[0].t);
    assert.strictEqual(updated.length, 1, '끊긴 토큰이 정리되지 않음');
  });
  await okA("성공한 경우엔 토큰을 지우지 않는다", async () => {
    updated.length = 0; toasts.length = 0;
    set('STUDENTS_CACHE', [{ id: 's1', name: '가나', fcmTokens: ['live1'] }]);
    fetchReply = { sent: 1, failed: 0, total: 1, invalid: [], errors: [] };
    await sb.sendPush(['live1'], '제목', '내용');
    assert.strictEqual(toasts[0].t, 'success');
    assert.strictEqual(updated.length, 0, '성공했는데 토큰을 지움');
  });

  // ── 🧪 쌤 기기 테스트 알림 — 권한이 풀린 뒤 '진짜 가는지'를 학생 없이 확인하는 길
  console.log('\n쌤 기기 테스트 알림 — 학생에게는 안 간다');
  const store = {};
  sb.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  sb.rDashboard = () => {};
  let tpDoc = { tokens: ['쌤기기1'] };
  const cfgWrites = [];
  set('db', {
    collection: (c) => ({
      doc: (id) => ({
        get: async () => ({ exists: c === 'config' && !!tpDoc, data: () => tpDoc || {} }),
        set: async (u) => { cfgWrites.push({ c, id, u }); if (c === 'config') tpDoc = Object.assign({}, tpDoc, u); },
        update: async (u) => { updated.push({ id, u }); }
      })
    })
  });
  sb.fetch = async (u, o) => { lastFetch = { u, body: o && o.body ? JSON.parse(o.body) : null }; return { json: async () => fetchReply }; };

  ok("등록 전에는 '이 기기에서 받기'가 뜬다", () => {
    delete store['bm_teacher_push'];
    const h = sb.teacherPushHtml();
    assert.ok(/이 기기에서 받기/.test(h), h.slice(0, 300));
    assert.ok(!/이 기기 받는 중/.test(h), '안 켰는데 받는 중이라고 함');
  });
  ok("켠 기기에서는 '받는 중'으로 바뀐다", () => {
    store['bm_teacher_push'] = '1';
    const h = sb.teacherPushHtml();
    assert.ok(/이 기기 받는 중/.test(h), h.slice(0, 300));
    assert.ok(!/이 기기에서 받기/.test(h), '이미 켰는데 또 켜라고 함');
  });
  ok("테스트 알림 · 설정 점검 버튼이 카드에 있다", () => {
    const h = sb.teacherPushHtml();
    assert.ok(/onclick="doTestPush\(\)"/.test(h), '테스트 버튼 없음');
    assert.ok(/onclick="doPushCheck\(\)"/.test(h), '점검 버튼 없음');
    assert.ok(/쌤 기기에만/.test(h), '학생에게 안 간다는 안내가 없음');
  });

  await okA("테스트 알림은 쌤 기기에만 가고 학생 토큰이 섞이지 않는다", async () => {
    toasts.length = 0; lastFetch = null;
    tpDoc = { tokens: ['쌤폰', '쌤PC'] };
    set('STUDENTS_CACHE', [{ id: 's1', name: '가나', fcmTokens: ['학생토큰'], status: '재원' }]);
    fetchReply = { sent: 2, failed: 0, total: 2, invalid: [], errors: [] };
    await sb.doTestPush();
    assert.strictEqual(lastFetch.u, '/api/notify');
    assert.strictEqual(lastFetch.body.tokens.join(','), '쌤폰,쌤PC', '보낸 대상이 다름');
    assert.ok(!lastFetch.body.tokens.includes('학생토큰'), '학생에게 테스트 알림이 갔다');
    assert.ok(toasts.some(t => t.t === 'success'), '결과를 성공으로 안 알림');
  });
  await okA("켠 기기가 하나도 없으면 보내지 않고 안내만 한다", async () => {
    toasts.length = 0; lastFetch = null;
    tpDoc = { tokens: [] };
    await sb.doTestPush();
    assert.strictEqual(lastFetch, null, '보낼 곳이 없는데 발송함');
    assert.ok(toasts.some(t => /이 기기에서 받기/.test(t.m)), '어떻게 하라는 안내가 없음');
  });
  await okA("끊긴 토큰 정리는 쌤 기기에도 적용된다 (학생 수에는 안 센다)", async () => {
    updated.length = 0; cfgWrites.length = 0;
    tpDoc = { tokens: ['죽은쌤', '살아있는쌤'] };
    set('STUDENTS_CACHE', [{ id: 's1', name: '가나', fcmTokens: ['dead1', 'live1'] }]);
    const cleaned = await sb.dropDeadTokens(['dead1', '죽은쌤']);
    assert.strictEqual(cleaned, 1, '학생 수에 쌤 기기가 섞임');
    const w = cfgWrites.find(x => x.c === 'config' && x.id === 'teacherPush');
    assert.ok(w, '쌤 기기 토큰이 정리되지 않음');
    assert.strictEqual(w.u.tokens.join(','), '살아있는쌤', '멀쩡한 기기까지 지움');
  });
  await okA("쌤 기기 토큰이 멀쩡하면 건드리지 않는다", async () => {
    cfgWrites.length = 0;
    tpDoc = { tokens: ['살아있는쌤'] };
    set('STUDENTS_CACHE', [{ id: 's1', name: '가나', fcmTokens: ['dead1'] }]);
    await sb.dropDeadTokens(['dead1']);
    assert.strictEqual(cfgWrites.length, 0, '지울 게 없는데 썼다');
  });

  console.log('\n발송 설정 점검 — 아무에게도 안 간다');
  await okA("점검은 토큰 없이 서버에만 묻는다", async () => {
    toasts.length = 0; lastFetch = null;
    fetchReply = { ok: true, fcm: 'INVALID_ARGUMENT', oauth: 'ok', why: '권한 정상 — 가짜 토큰이라 거절된 것뿐이에요. 실제 발송은 됩니다.' };
    await sb.doPushCheck();
    assert.strictEqual(lastFetch.u, '/api/pushcheck');
    assert.strictEqual(lastFetch.body, null, '점검인데 토큰을 보냈다');
    assert.ok(toasts.some(t => t.t === 'success'), '정상인데 정상이라고 안 함');
  });
  ok("점검 결과가 카드에 남아 나중에 다시 볼 수 있다", () => {
    const h = sb.pushCheckHtml();
    assert.ok(/설정 점검/.test(h) && /정상/.test(h), h.slice(0, 300));
  });
  await okA("점검이 문제를 찾으면 이유를 그대로 보여준다", async () => {
    toasts.length = 0;
    fetchReply = { ok: false, fcm: 'PERMISSION_DENIED', oauth: 'ok', why: '서버가 알림을 보낼 권한이 없어요' };
    await sb.doPushCheck();
    assert.ok(toasts.some(t => t.t === 'error'), '문제인데 오류로 안 알림');
    const h = sb.pushCheckHtml();
    assert.ok(/문제 있음/.test(h), h.slice(0, 300));
    assert.ok(/권한이 없어요/.test(h), '이유가 안 보임');
  });
  await okA("점검 서버에 연결 못 하면 그렇다고 말한다", async () => {
    toasts.length = 0;
    fetchReply = null;
    await sb.doPushCheck();
    assert.ok(toasts.some(t => t.t === 'error' && /연결하지 못했어요/.test(t.m)), JSON.stringify(toasts));
  });

  console.log('\n화면·서비스워커에 제대로 붙었는가');
  ok("🔔 카드 안(마지막 발송 바로 아래)에 있다 — 새 화면을 만들지 않았다", () => {
    const h = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
    assert.ok(/\$\{lastPushHtml\(\)\}\s*\$\{teacherPushHtml\(\)\}/.test(h), '🔔 카드에 안 붙어 있음');
  });
  ok("알림 모듈(messaging)을 불러온다", () => {
    const h = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
    assert.ok(h.includes('firebase-messaging-compat.js'), 'messaging SDK가 없어 getToken이 안 됨');
  });
  ok("새로고침해도 이 기기 알림 연결이 살아난다", () => {
    const h = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
    assert.ok(/initTeacherPush\(\);/.test(h), 'init에서 다시 연결하지 않음');
  });
  ok("알림을 누르면 열려 있던 창을 띄운다 (엉뚱한 화면이 안 뜨게)", () => {
    const sw = fs.readFileSync(ROOT + '/firebase-messaging-sw.js', 'utf8');
    assert.ok(/clients\.matchAll/.test(sw), '무조건 새 창을 연다');
    assert.ok(/w\.focus/.test(sw), '열린 창을 안 띄움');
    assert.ok(/openWindow\('\/student\.html'\)/.test(sw), '열린 창이 없을 때가 빠짐');
  });

  console.log('\n숙제 등록만으로는 알림을 안 보낸다');
  ok("숙제 관리 탭에서 등록해도 자동 발송하지 않는다", () => {
    const h = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
    const i = h.indexOf('async function doSaveAsgn(');
    assert.ok(i > 0, 'doSaveAsgn을 못 찾음');
    const body = h.slice(i, i + 2200);
    assert.ok(!/sendPush\(/.test(body), '등록하자마자 알림을 보냄');
    assert.ok(/🔔 알림 버튼으로 보내요/.test(body), '어떻게 보내는지 안내가 없음');
  });
  ok("목록의 알림 버튼은 그대로 있다", () => {
    const h = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
    assert.ok(h.includes("onclick=\"doNotifyNewHw('${a.id}')\""), '수동 알림 버튼이 사라짐');
  });
  ok("빠른 숙제는 체크했을 때만 보낸다 (그대로)", () => {
    const h = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
    assert.ok(h.includes('if(notify) await doNotifyNewHw(id, true);'), '빠른 숙제의 선택 발송이 사라짐');
  });

  console.log('\n코드에 남은 거짓 안내');
  const html = fs.readFileSync(ROOT + '/teacher.html', 'utf8');
  ok("'알림 발송 완료'라는 무조건 성공 문구가 사라졌다", () => {
    // 설명 주석에 나오는 건 괜찮다. 실제로 화면에 띄우는 코드만 본다.
    const bad = html.split(/\r?\n/).filter(l => l.includes('알림 발송 완료') && !l.trim().startsWith('//'));
    assert.strictEqual(bad.length, 0, '아직 남아 있음: ' + bad.join(' | '));
  });
  ok("알림 발송이 sendPush 한 곳으로 모였다", () => {
    assert.strictEqual((html.match(/api\/notify/g) || []).length, 1, '직접 호출이 남아 있음');
  });
  ok("한 명도 못 받으면 '알림 보냄' 표시를 하지 않는다", () => {
    assert.ok(/if\(j && j\.sent\) \{ try\{ await updateAssignment/.test(html), 'notifiedAt이 무조건 찍힘');
  });

  console.log('\n통과 ' + pass + '개' + (process.exitCode ? ' / 실패 있음' : ' / 실패 없음'));
})();
