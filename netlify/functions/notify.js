// ================================================================
// BEEN MATH — 푸시 알림 발송 함수 (FCM, firebase-admin)
// ----------------------------------------------------------------
// 특정 반의 학생들에게 푸시를 보냄.
// 서비스 계정 키는 Netlify 환경변수 FIREBASE_SERVICE_ACCOUNT 에 넣어요.
//   (Firebase 콘솔 → 프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성 → JSON 전체 붙여넣기)
// ================================================================
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT 환경변수가 없어요');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  try {
    initAdmin();
    const { classId, title, body } = JSON.parse(event.body || '{}');
    if (!classId) return { statusCode: 400, body: JSON.stringify({ error: 'classId 필요' }) };

    const db = admin.firestore();
    const snap = await db.collection('students').get();

    // 해당 반 학생들의 FCM 토큰 모으기
    const tokens = [];
    snap.forEach(doc => {
      const s = doc.data();
      const ids = s.classIds || (s.classId ? [s.classId] : []);
      if (ids.includes(classId) && Array.isArray(s.fcmTokens)) {
        s.fcmTokens.forEach(t => { if (t && !tokens.includes(t)) tokens.push(t); });
      }
    });

    if (!tokens.length) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sent: 0, note: '알림 켠 학생이 없어요' }) };
    }

    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: title || 'BEEN MATH', body: body || '' }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sent: res.successCount, failed: res.failureCount })
    };
  } catch (err) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: err.message }) };
  }
};
