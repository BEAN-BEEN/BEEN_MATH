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
    const { textbook, page, number, note, imageBase64, imageMime, level } = JSON.parse(event.body || '{}');
    const lv = Number(level) || 1;

    const levelRule = lv === 1
      ? "지금은 '1단계 힌트'야. 이 문제를 풀려면 어떤 단원의 어떤 개념·공식이 필요한지 구체적으로 콕 집어서 알려줘 (예: '미분법 단원, 접선의 기울기 = f′(a)를 이용'). '어떤 개념이 떠오르니?' 같은 막연하고 일반적인 말은 절대 하지 마. 정답과 전체 풀이는 주지 말고, 필요한 개념과 첫 접근 방향까지만 3~4문장으로."
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
${imageBase64
  ? '첨부된 문제 사진 속 실제 문제를 보고, 정확한 단원·개념을 짚어줘.'
  : '문제 사진이 없어서 정확한 내용을 모르니, 일반적인 방향을 주되 마지막에 "정확한 힌트를 원하면 문제 사진을 첨부해줘" 한 줄을 꼭 덧붙여.'}`;

    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    let hint = '';

    if (provider === 'openai') {
      // ---------- GPT (OpenAI) — 이미지 있으면 vision ----------
      const content = [{ type: 'text', text: prompt }];
      if (imageBase64) content.push({ type: 'image_url', image_url: { url: `data:${imageMime || 'image/jpeg'};base64,${imageBase64}` } });
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [{ role: 'user', content }],
          temperature: 0.7
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'OpenAI 호출 오류');
      hint = (data.choices?.[0]?.message?.content || '').trim();

    } else {
      // ---------- Gemini (Google) — 과부하 시 재시도 + 예비 모델 전환 ----------
      const parts = [{ text: prompt }];
      if (imageBase64) parts.push({ inline_data: { mime_type: imageMime || 'image/jpeg', data: imageBase64 } });
      const models = [process.env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-2.0-flash'];
      let ok = false, lastErr = 'Gemini 호출 오류';
      for (const model of models) {
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] })
          });
          const data = await res.json();
          if (res.ok) {
            hint = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
            ok = true;
            break;
          }
          lastErr = data.error?.message || lastErr;
          await new Promise(r => setTimeout(r, 700)); // 잠깐 쉬고 재시도
        }
        if (ok) break;
      }
      if (!ok) throw new Error(lastErr);
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
