// ================================================================
// BEEN MATH — Cloudflare Worker
//  /api/ai      : AI 단계별 힌트 (텍스트/이미지)
//  /api/analyze : 시험지 분석 (이미지 → JSON)
//  /api/notify  : FCM 푸시 발송 (firebase-admin 없이 Web Crypto)
//  그 외 경로   : 정적 파일(HTML 등) 서빙
// ================================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/ai' && request.method === 'POST')      return await aiHint(request, env);
      if (url.pathname === '/api/analyze' && request.method === 'POST') return await analyzeExam(request, env);
      if (url.pathname === '/api/notify' && request.method === 'POST')  return await notify(request, env);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
    return env.ASSETS.fetch(request); // 정적 파일
  }
};

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
  const { imageBase64, imageMime } = await request.json();
  if (!imageBase64) return json({ error: '시험지 사진이 필요해요' }, 400);
  const prompt =
`너는 고등학교 수학 시험 분석 전문가야. 첨부된 시험지 사진을 보고 각 문제를 분석해줘.
- 단원: 문제가 속한 단원명 (예: 미분법, 수열의 극한, 함수의 그래프, 확률, 통계 등)
- 요구 능력: 다음 중 하나로만 분류 → "추론" / "계산" / "그래프활용" / "개념이해" / "문제해석"
- 난이도: "상" / "중" / "하"
사진에서 읽을 수 있는 문제만 분석해. 한국어로.
반드시 아래 JSON 형식으로만 답해 (설명 문장 없이 JSON만):
{"problems":[{"no":"1","unit":"미분법","ability":"계산","difficulty":"중"}],"summary":"이 시험의 능력별 구성과 특징을 2문장으로"}`;
  const raw = await callModel(env, prompt, imageBase64, imageMime, true);
  let parsed;
  try { parsed = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim()); }
  catch (e) { return json({ problems: [], summary: raw }); }
  return json(parsed);
}

// ----------------------------------------------------------------
// 모델 호출 (Gemini 기본, OpenAI 옵션) — 과부하 시 1회 재시도
// ----------------------------------------------------------------
async function callModel(env, prompt, imageBase64, imageMime, jsonMode) {
  const provider = (env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'openai') {
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
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const parts = [{ text: prompt }];
  if (imageBase64) parts.push({ inline_data: { mime_type: imageMime || 'image/jpeg', data: imageBase64 } });
  const reqBody = { contents: [{ parts }] };
  if (jsonMode) reqBody.generationConfig = { responseMimeType: 'application/json' };
  let lastErr = 'Gemini 오류';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody) });
    const data = await res.json();
    if (res.ok) return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    lastErr = data.error?.message || lastErr;
    if (!/overload|UNAVAILABLE|503|high demand/i.test(lastErr)) break;
    await new Promise(r => setTimeout(r, 800));
  }
  throw new Error(lastErr);
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

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600
  };
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc(header) + '.' + enc(claim);
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(unsigned));
  const jwt = unsigned + '.' + b64url(new Uint8Array(sig));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + jwt
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('OAuth 토큰 발급 실패: ' + (data.error_description || data.error || ''));
  return data.access_token;
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
