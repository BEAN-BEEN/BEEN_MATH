// ================================================================
// BEEN MATH — Cloudflare Worker
//  /api/notify  : FCM 푸시 발송 (firebase-admin 없이 Web Crypto)
//  /api/login   : 로그인 검증 + 역할이 박힌 Firebase 커스텀 토큰 발급
//  그 외 경로   : 정적 파일(HTML 등) 서빙
// ================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/login' && request.method === 'POST')     return await login(request, env);
      if (url.pathname === '/api/notify' && request.method === 'POST')   return await notify(request, env);
      if (url.pathname === '/api/school')                                return await schoolApi(url, env);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
    return env.ASSETS.fetch(request); // 정적 파일
  }
};

// ----------------------------------------------------------------
// 🏫 학교 정보 (NEIS 교육정보 개방 포털) — 급식 / 학사일정 / 시간표 / 학교검색
//   키는 Cloudflare 시크릿 NEIS_KEY 에 보관 (학생 화면에 노출 안 됨)
//   /api/school?type=search&name=송도고
//   /api/school?type=meal&atpt=E10&code=7310078&from=20260818&to=20260824
//   /api/school?type=schedule&atpt=&code=&from=&to=
//   /api/school?type=timetable&atpt=&code=&kind=his&grade=1&cls=3&from=&to=
// ----------------------------------------------------------------
async function schoolApi(url, env) {
  const KEY = env.NEIS_KEY;
  if (!KEY) return json({ error: 'NEIS_KEY 환경변수가 없어요' }, 500);
  const q = k => url.searchParams.get(k) || '';
  const type = q('type');
  const base = 'https://open.neis.go.kr/hub/';
  const common = `KEY=${KEY}&Type=json&pIndex=1&pSize=500`;
  let api, extra = '';

  if (type === 'search') {
    api = 'schoolInfo'; extra = `&SCHUL_NM=${encodeURIComponent(q('name'))}`;
  } else if (type === 'meal') {
    api = 'mealServiceDietInfo';
    extra = `&ATPT_OFCDC_SC_CODE=${q('atpt')}&SD_SCHUL_CODE=${q('code')}&MLSV_FROM_YMD=${q('from')}&MLSV_TO_YMD=${q('to')}`;
  } else if (type === 'schedule') {
    api = 'SchoolSchedule';
    extra = `&ATPT_OFCDC_SC_CODE=${q('atpt')}&SD_SCHUL_CODE=${q('code')}&AA_FROM_YMD=${q('from')}&AA_TO_YMD=${q('to')}`;
  } else if (type === 'timetable') {
    const kind = q('kind') || 'his';   // els(초) / mis(중) / his(고) / sps(특수)
    api = kind + 'Timetable';
    extra = `&ATPT_OFCDC_SC_CODE=${q('atpt')}&SD_SCHUL_CODE=${q('code')}&GRADE=${q('grade')}&CLASS_NM=${q('cls')}&TI_FROM_YMD=${q('from')}&TI_TO_YMD=${q('to')}`;
  } else {
    return json({ error: 'type이 잘못됐어요' }, 400);
  }

  const r = await fetch(base + api + '?' + common + extra);
  const j = await r.json().catch(() => null);
  if (!j) return json({ rows: [], msg: '응답을 읽지 못했어요' });
  if (j.RESULT) return json({ rows: [], msg: j.RESULT.MESSAGE || '', code: j.RESULT.CODE || '' });
  const rows = (j[api] && j[api][1] && j[api][1].row) || [];
  return new Response(JSON.stringify({ rows }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=1800' }   // 30분 캐시
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

// ----------------------------------------------------------------
// AI 단계별 힌트
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// 시험지 분석
// ----------------------------------------------------------------

// 🅰️ OMR 답안지 판독 — 학생이 표시한 답을 번호별로 읽어옵니다.
//   오독이 있을 수 있어서, 화면에서 반드시 확인·수정하고 저장하게 합니다.
// ----------------------------------------------------------------

// ----------------------------------------------------------------
// FCM 푸시 (Web Crypto로 서비스계정 JWT 서명 → OAuth → FCM v1)
// ----------------------------------------------------------------
async function notify(request, env) {
  const { tokens, title, body } = await request.json();
  if (!env.FIREBASE_SERVICE_ACCOUNT) return json({ error: 'FIREBASE_SERVICE_ACCOUNT 환경변수가 없어요' }, 500);
  if (!Array.isArray(tokens) || !tokens.length) return json({ sent: 0, note: '알림 켠 학생이 없어요' });

  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const accessToken = await getAccessToken(sa);
  let sent = 0;
  for (const t of tokens) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token: t, notification: { title: title || 'BEEN MATH', body: body || '' } } })
    });
    if (r.ok) sent++;
  }
  return json({ sent });
}

async function getAccessToken(sa, scope) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: scope || 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  };
  const jwt = await signJwt(sa, { alg: 'RS256', typ: 'JWT' }, claim);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('OAuth 토큰 발급 실패: ' + (data.error_description || data.error || ''));
  return data.access_token;
}

// 서비스 계정 개인키로 JWT 서명 (RS256) — OAuth 토큰과 커스텀 토큰이 함께 씀
async function signJwt(sa, header, payload) {
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc(header) + '.' + enc(payload);
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(unsigned));
  return unsigned + '.' + b64url(new Uint8Array(sig));
}

// ================================================================
// 🔐 로그인 — 서버에서 확인하고 '역할이 박힌' Firebase 커스텀 토큰을 발급
//   · 클라이언트가 학생 명단을 통째로 읽지 않아도 됨
//   · 발급된 토큰의 role/studentId 로 Firestore 규칙을 잠글 수 있음
//   · 응답에는 전화번호를 절대 담지 않는다 (필요한 것만 골라서 내려줌)
// ================================================================
const FS_SCOPE = 'https://www.googleapis.com/auth/datastore';

async function login(request, env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return json({ error: '서버 설정이 없어요 (FIREBASE_SERVICE_ACCOUNT)' }, 500);
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const body = await request.json().catch(() => ({}));
  const pw = String(body.pw || '');
  if (!pw.trim()) return json({ error: '비밀번호를 입력해주세요' }, 400);

  const at = await getAccessToken(sa, FS_SCOPE);
  return (body.role === 'teacher')
    ? await loginTeacher(sa, at, pw)
    : await loginStudent(sa, at, String(body.name || '').trim(), pw, String(body.last4 || '').trim());
}

async function loginTeacher(sa, at, pw) {
  const doc = await fsGet(sa, at, 'config/teacher');
  const d = doc ? fsPlain(doc.fields) : null;
  const h = await hashPw('teacher', pw);
  // 문서가 없거나 비어 있으면 최초 설정 (해시로만 저장)
  if (!d || (!d.pwHash && !d.password)) {
    await fsPatch(sa, at, 'config/teacher', { pwHash: h });
    return json({ ok: true, role: 'teacher', firstSetup: true, token: await mintCustomToken(sa, 'teacher', { role: 'teacher' }) });
  }
  let ok = false;
  if (d.pwHash) ok = (d.pwHash === h);
  else if (d.password === pw) {                      // 예전 평문 → 해시로 옮기고 평문 삭제
    ok = true;
    await fsPatch(sa, at, 'config/teacher', { pwHash: h }, ['password']);
  }
  if (!ok) return json({ error: '비밀번호가 틀렸어요' }, 401);
  return json({ ok: true, role: 'teacher', token: await mintCustomToken(sa, 'teacher', { role: 'teacher' }) });
}

async function loginStudent(sa, at, name, pw, last4) {
  if (!name) return json({ error: '이름을 입력해주세요' }, 400);
  const cands = await fsQuery(sa, at, 'students', 'name', name);
  if (!cands.length) return json({ error: '등록되지 않은 이름이에요. 선생님께 문의하세요' }, 401);

  // 1) 이미 비밀번호를 정한 학생
  for (const c of cands) {
    if (c.pwHash && c.pwHash === await hashPw(c.id, pw)) return await studentOk(sa, c);
  }
  // 2) 첫 로그인 — 핸드폰 뒤 4자리로 본인 확인 후 비밀번호 설정
  const noPw = cands.filter(c => !c.pwHash);
  if (noPw.length) {
    if (!last4) return json({ needLast4: true, error: '처음 로그인이에요! 핸드폰 뒤 4자리로 본인 확인이 필요해요' }, 401);
    const target = noPw.find(c => String(c.phoneLast4 || '') === last4);
    if (!target) return json({ error: '본인 확인 실패 — 핸드폰 뒤 4자리를 확인하세요' }, 401);
    await fsPatch(sa, at, 'students/' + target.id, { pwHash: await hashPw(target.id, pw) });
    return await studentOk(sa, target, true);
  }
  return json({ error: '비밀번호가 틀렸어요. 기억나지 않으면 선생님께 초기화를 요청하세요' }, 401);
}

// 로그인 성공 응답 — 화면에 필요한 것만. phone/parentPhone 은 내려주지 않는다.
async function studentOk(sa, s, firstSetup) {
  if ((s.status || '재원') === '퇴원') return json({ error: '퇴원 처리된 계정이에요. 선생님께 문의해주세요' }, 403);
  const classIds = Array.isArray(s.classIds) ? s.classIds : (s.classId ? [s.classId] : []);
  const classNames = Array.isArray(s.classNames) ? s.classNames : (s.className ? [s.className] : []);
  return json({
    ok: true, role: 'student', firstSetup: !!firstSetup,
    token: await mintCustomToken(sa, 'stu_' + s.id, { role: 'student', studentId: s.id }),
    student: { id: s.id, name: s.name || '', classIds, classNames, school: s.school || '' }
  });
}

// Firebase 커스텀 토큰 — 클라이언트가 signInWithCustomToken 으로 교환한다
async function mintCustomToken(sa, uid, claims) {
  const now = Math.floor(Date.now() / 1000);
  return await signJwt(sa, { alg: 'RS256', typ: 'JWT' }, {
    iss: sa.client_email, sub: sa.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    uid, iat: now, exp: now + 3600, claims
  });
}

// 학생 포털과 같은 해시 — sha256('bm:소금:비번')
async function hashPw(salt, pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bm:' + salt + ':' + pw));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- Firestore REST (서비스 계정으로 접근 — 보안 규칙을 거치지 않음) ----
function fsBase(sa) { return `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`; }
// Firestore의 타입 표기({stringValue:...})를 평범한 값으로
function fsPlain(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = fsValue(v);
  return out;
}
function fsValue(v) {
  if (!v || typeof v !== 'object') return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fsValue);
  if ('mapValue' in v) return fsPlain(v.mapValue.fields);
  return null;
}
async function fsGet(sa, at, path) {
  const r = await fetch(`${fsBase(sa)}/${path}`, { headers: { Authorization: 'Bearer ' + at } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Firestore 읽기 실패 ' + r.status);
  return await r.json();
}
async function fsQuery(sa, at, collection, field, value) {
  const r = await fetch(`${fsBase(sa)}:runQuery`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } },
        limit: 20
      }
    })
  });
  if (!r.ok) throw new Error('Firestore 조회 실패 ' + r.status);
  const rows = await r.json();
  return (Array.isArray(rows) ? rows : []).filter(x => x.document).map(x => {
    const o = fsPlain(x.document.fields);
    o.id = x.document.name.split('/').pop();
    return o;
  });
}
// 일부 필드만 수정 (updateMask). deleteFields 에 넣은 필드는 값 없이 마스크에만 넣어 삭제된다.
async function fsPatch(sa, at, path, fields, deleteFields) {
  const params = [...Object.keys(fields), ...(deleteFields || [])]
    .map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  const body = { fields: {} };
  for (const [k, v] of Object.entries(fields)) body.fields[k] = { stringValue: String(v) };
  const r = await fetch(`${fsBase(sa)}/${path}?${params}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + at, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('Firestore 저장 실패 ' + r.status);
  return await r.json();
}

async function importPrivateKey(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
