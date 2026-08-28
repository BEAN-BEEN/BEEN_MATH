// ================================================================
// BEEN MATH — Cloudflare Worker
//  /api/ai      : AI 단계별 힌트 (텍스트/이미지)
//  /api/analyze : 시험지 분석 (이미지 → JSON)
//  /api/notify  : FCM 푸시 발송 (firebase-admin 없이 Web Crypto)
//  /api/login   : 로그인 검증 + 역할이 박힌 Firebase 커스텀 토큰 발급
//  그 외 경로   : 정적 파일(HTML 등) 서빙
// ================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/login' && request.method === 'POST')     return await login(request, env);
      if (url.pathname === '/api/ai' && request.method === 'POST')       return await aiHint(request, env);
      if (url.pathname === '/api/analyze' && request.method === 'POST')  return await analyzeExam(request, env);
      if (url.pathname === '/api/feedback' && request.method === 'POST') return await examFeedback(request, env);
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
async function aiHint(request, env) {
  const { textbook, page, number, note, imageBase64, imageMime, level } = await request.json();
  const lv = Number(level) || 1;
  const levelRule = lv === 1
    ? "지금은 '1단계 힌트'야. 이 문제를 풀려면 어떤 단원의 어떤 개념·공식이 필요한지 구체적으로 콕 집어서 알려줘 (예: '미분법 단원, 접선의 기울기 = f′(a)를 이용'). '어떤 개념이 떠오르니?' 같은 막연한 말은 절대 하지 마. 정답과 전체 풀이는 주지 말고, 필요한 개념과 첫 접근 방향까지만 3~4문장으로."
    : lv === 2
    ? "지금은 '2단계 힌트'야. 필요한 개념을 적용해서 어떤 식을 세우고 어떻게 전개하는지 풀이의 중간 과정까지 구체적으로 보여줘. 단, 최종 정답은 남겨두고 학생이 마무리하게 해줘."
    : "지금은 '3단계(전체 풀이)'야. 전체 풀이를 단계별로 자세히 보여주고 최종 정답까지 알려줘.";
  const prompt =
`너는 고등학교 수학 선생님이야. 학생이 아래 문제를 질문했어.

- 교재: ${textbook || '(미입력)'}
- 페이지: ${page || '-'}
- 문제 번호: ${number || '-'}
- 학생이 어려워하는 점: ${note || '(없음)'}

${levelRule}
인사말이나 이름 부르기 없이 바로 핵심부터. 한국어로, 중·고등학생 눈높이로.
${imageBase64 ? '첨부된 문제 사진 속 실제 문제를 보고, 정확한 단원·개념을 짚어줘.' : '문제 사진이 없어서 정확한 내용을 모르니, 일반적인 방향을 주되 마지막에 "정확한 힌트를 원하면 문제 사진을 첨부해줘" 한 줄을 꼭 덧붙여.'}`;

  const hint = await callModel(env, prompt, imageBase64, imageMime, false);
  return json({ hint, provider: (env.AI_PROVIDER || 'gemini') });
}

// ----------------------------------------------------------------
// 시험지 분석
// ----------------------------------------------------------------
async function analyzeExam(request, env) {
  const { imageBase64, imageMime, examKind, title, range } = await request.json();
  if (!imageBase64) return json({ error: '시험지 사진 또는 PDF가 필요해요' }, 400);
  const isPdf = (imageMime || '') === 'application/pdf';
  const kind = (examKind || '').trim();
  // 시험 종류에 따라 보는 눈이 달라요 — 내신은 학교 시험 범위, 데일리 테스트는 그날 배운 것
  const kindHint =
      kind === '내신'   ? '이건 학교 내신 시험지야. 학교 시험 범위 안에서 단원을 잡아줘.'
    : kind === '데일리' ? '이건 학원 데일리 테스트(그날 배운 내용 확인용 소테스트)야. 한두 단원에 몰려 있을 수 있어.'
    : kind === '모의'   ? '이건 모의고사(학력평가)야. 여러 단원이 고루 섞여 있어.'
    : '';
  const prompt =
`너는 고등학교 수학 시험 분석 전문가야. 첨부된 시험지 ${isPdf ? 'PDF(여러 쪽일 수 있어)를 처음부터 끝까지 보고' : '사진을 보고'} 각 문제를 분석해줘.
${kindHint}${title ? `\n- 시험명: ${title}` : ''}${range ? `\n- 출제 범위: ${range}` : ''}

문제마다 다음을 채워줘:
- no: 문제 번호 (시험지에 적힌 그대로)
- bigUnit: 대단원 (예: 다항식, 방정식과 부등식, 도형의 방정식, 함수와 그래프, 수열, 미분법, 적분법, 확률과 통계)
- smallUnit: 중단원 (예: 이차함수의 최대·최소, 등차수열의 합, 접선의 방정식)
- ability: 요구 해결능력 — 다음 중 하나로만 → "추론" / "계산" / "그래프활용" / "개념이해" / "문제해석"
- difficulty: 난이도 — "상" / "중" / "하"
- intent: 출제의도 — 이 문제로 무엇을 확인하려는지 한 문장 (예: 완전제곱식 변형을 스스로 떠올릴 수 있는지)
- solution: 이 문제를 푸는 핵심 해결 방법을 학생이 읽고 바로 떠올릴 수 있게 1~2문장으로 간략히 (풀이 전체가 아니라 '어떻게 접근하는지' 실마리)

${isPdf ? '모든 쪽의 문제를 빠짐없이, 번호 순서대로 분석해.' : '사진에서 읽을 수 있는 문제만 분석해.'} 한국어로.
반드시 아래 JSON 형식으로만 답해 (설명 문장 없이 JSON만):
{"problems":[{"no":"1","bigUnit":"함수와 그래프","smallUnit":"이차함수의 최대·최소","ability":"계산","difficulty":"중","intent":"구간이 주어진 이차함수의 최댓값을 스스로 판단할 수 있는지","solution":"완전제곱식으로 변형해 꼭짓점을 찾고, 주어진 구간의 양 끝값과 비교해요."}],"summary":"이 시험의 단원·능력별 구성과 특징을 2~3문장으로"}`;
  const raw = await callModel(env, prompt, imageBase64, imageMime, true);
  let parsed;
  try { parsed = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim()); }
  catch (e) { return json({ problems: [], summary: raw }); }
  // 예전 화면(unit 하나만 쓰던 곳)이 깨지지 않게 unit 을 채워둡니다
  if (Array.isArray(parsed.problems)) {
    parsed.problems = parsed.problems.map(p => ({
      ...p,
      unit: p.unit || [p.bigUnit, p.smallUnit].filter(Boolean).join(' > ') || ''
    }));
  }
  return json(parsed);
}

// ----------------------------------------------------------------
// 성적 리포트 — 틀린 문항 → 능력·문항별 피드백 (JSON)
// ----------------------------------------------------------------
async function examFeedback(request, env) {
  const { examTitle, range, maxScore, wrongNos, imageBase64, imageMime } = await request.json();
  if (!wrongNos && !imageBase64) return json({ error: '틀린 문항 번호 또는 시험지 사진이 필요해요' }, 400);
  const prompt =
`너는 고등학교 수학 선생님이야. 한 학생의 시험 결과를 보고 학생에게 줄 피드백을 작성해줘.
- 시험명: ${examTitle || '(미입력)'}
- 출제 범위: ${range || '(미입력)'}
- 만점: ${maxScore || 100}
- 학생이 틀린 문항 번호: ${wrongNos || '(사진 참고)'}

각 틀린 문항에 대해 "왜 틀렸을 가능성이 높은지(개념/계산 등) + 무엇을 더 연습해야 하는지"를 1~2문장으로 구체적으로 써줘.
그리고 틀린 문항들을 종합해 이 학생이 보완해야 할 '요구 능력'을 다음 중에서 골라줘 → "추론" / "계산" / "그래프활용" / "개념이해" / "문제해석".
중·고등학생 눈높이의 한국어로, 따뜻하지만 핵심을 콕 집어서.
반드시 아래 JSON 형식으로만 답해 (설명 문장 없이 JSON만):
{"weakAbilities":["계산","그래프활용"],"perQuestion":[{"no":"3","feedback":"이차함수 최댓값을 구할 때 꼭짓점 공식을 헷갈렸어요. 완전제곱식 변형을 5문제 더 연습해요."}],"summary":"전반적으로 계산 실수가 많아요. 검산 습관과 그래프 해석 연습이 필요해요."}`;
  const raw = await callModel(env, prompt, imageBase64, imageMime, true);
  let parsed;
  try { parsed = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim()); }
  catch (e) { return json({ weakAbilities: [], perQuestion: [], summary: raw }); }
  return json(parsed);
}

// ----------------------------------------------------------------
// 모델 호출 (Gemini 기본, OpenAI 옵션) — 과부하 시 1회 재시도
// ----------------------------------------------------------------
async function callModel(env, prompt, imageBase64, imageMime, jsonMode) {
  const provider = (env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'openai') {
    // OpenAI의 image_url 은 PDF를 못 받습니다 (Gemini만 PDF 지원)
    if ((imageMime || '') === 'application/pdf') throw new Error('PDF 분석은 Gemini에서만 돼요. 사진으로 올려주세요.');
    const content = [{ type: 'text', text: prompt }];
    if (imageBase64) content.push({ type: 'image_url', image_url: { url: `data:${imageMime || 'image/jpeg'};base64,${imageBase64}` } });
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || 'gpt-4o-mini',
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [{ role: 'user', content }]
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'OpenAI 오류');
    return (data.choices?.[0]?.message?.content || '').trim();
  }
  // Gemini
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY 환경변수가 없어요');
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const parts = [{ text: prompt }];
  if (imageBase64) parts.push({ inline_data: { mime_type: imageMime || 'image/jpeg', data: imageBase64 } });
  const reqBody = { contents: [{ parts }] };
  if (jsonMode) reqBody.generationConfig = { responseMimeType: 'application/json' };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || ('Gemini 오류 ' + res.status));
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

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
