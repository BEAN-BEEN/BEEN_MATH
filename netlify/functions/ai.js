// ================================================================
// BEEN MATH — AI 힌트 서버리스 함수 (Netlify Functions)
// ----------------------------------------------------------------
// API 키를 브라우저에 노출하지 않기 위해 이 서버에서 AI를 호출해요.
// 환경변수 AI_PROVIDER 로 Gemini / OpenAI(GPT)를 전환합니다.
//
//   AI_PROVIDER = "gemini"  (기본) → GEMINI_API_KEY 사용
//   AI_PROVIDER = "openai"        → OPENAI_API_KEY 사용
//
// 의존성(npm) 없이 Node 내장 fetch만 사용 → 드래그 배포에서도 동작.
// ================================================================
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { textbook, page, number, note } = JSON.parse(event.body || '{}');

    const prompt =
`너는 친절하고 따뜻한 고등학교 수학 선생님이야.
학생이 아래 문제를 질문했어.

- 교재: ${textbook || '(미입력)'}
- 페이지: ${page || '-'}
- 문제 번호: ${number || '-'}
- 학생이 어려워하는 점: ${note || '(없음)'}

규칙:
1) 정답을 바로 알려주지 마.
2) 학생이 스스로 풀 수 있도록 "1단계 힌트"만 줘.
3) 어떤 개념·공식을 떠올려야 하는지, 첫 접근을 어떻게 시작하면 좋은지 2~3문장으로 짧고 따뜻하게 안내해줘.
4) 한국어로, 중·고등학생 눈높이로 설명해줘.`;

    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    let hint = '';

    if (provider === 'openai') {
      // ---------- GPT (OpenAI) ----------
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'OpenAI 호출 오류');
      hint = (data.choices?.[0]?.message?.content || '').trim();

    } else {
      // ---------- Gemini (Google) ----------
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Gemini 호출 오류');
      hint = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hint, provider })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
