// ================================================================
// BEEN MATH — AI 시험지 분석 함수
// 시험지 사진 → 문제별 (단원 / 요구 능력 / 난이도) + 능력 구성 요약
// 결과를 JSON으로 반환.
// ================================================================
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    const { imageBase64, imageMime } = JSON.parse(event.body || '{}');
    if (!imageBase64) return { statusCode: 400, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ error: '시험지 사진이 필요해요' }) };

    const prompt =
`너는 고등학교 수학 시험 분석 전문가야. 첨부된 시험지 사진을 보고 각 문제를 분석해줘.
- 단원: 문제가 속한 단원명 (예: 미분법, 수열의 극한, 함수의 그래프, 확률, 통계 등)
- 요구 능력: 다음 중 하나로만 분류 → "추론" / "계산" / "그래프활용" / "개념이해" / "문제해석"
- 난이도: "상" / "중" / "하"
사진에서 읽을 수 있는 문제만 분석해. 한국어로.
반드시 아래 JSON 형식으로만 답해 (설명 문장 없이 JSON만):
{"problems":[{"no":"1","unit":"미분법","ability":"계산","difficulty":"중"}],"summary":"이 시험의 능력별 구성과 특징을 2문장으로"}`;

    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    let raw = '';

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${imageMime || 'image/jpeg'};base64,${imageBase64}` } }
          ] }]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'OpenAI 오류');
      raw = data.choices?.[0]?.message?.content || '';
    } else {
      const parts = [{ text: prompt }, { inline_data: { mime_type: imageMime || 'image/jpeg', data: imageBase64 } }];
      const models = [process.env.GEMINI_MODEL || 'gemini-2.5-flash', 'gemini-2.0-flash'];
      let ok = false, lastErr = 'Gemini 오류';
      for (const model of models) {
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
          const res = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } })
          });
          const data = await res.json();
          if (res.ok) { raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''; ok = true; break; }
          lastErr = data.error?.message || lastErr;
          await new Promise(r => setTimeout(r, 700));
        }
        if (ok) break;
      }
      if (!ok) throw new Error(lastErr);
    }

    // JSON 파싱 (혹시 ```json 코드펜스가 있으면 제거)
    let parsed;
    try {
      const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      return { statusCode: 200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ problems: [], summary: raw }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed) };
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
  }
};
