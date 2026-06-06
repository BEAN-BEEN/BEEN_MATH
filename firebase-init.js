// ================================================================
// Firebase 초기화 — 모든 페이지(index/student/teacher)가 공유
// ================================================================
// HTML에서 firebase-app-compat.js → firestore-compat.js → 이 파일 순서로 로드돼요.
// (로그인은 Firebase Auth(이메일) 대신, Firestore 명단 + 이름/핸드폰 방식을 써요)
// ----------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyCjlKRYQnZ4rPKzj06gdRwFgCcyKROntfM",
  authDomain: "been-math.firebaseapp.com",
  projectId: "been-math",
  storageBucket: "been-math.firebasestorage.app",
  messagingSenderId: "84606687461",
  appId: "1:84606687461:web:ed098795a2964442dddc0c",
  measurementId: "G-DN4ZZZQYJJ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ================================================================
// 예전 데모(가짜) 데이터 한 번만 청소 — 제로베이스 보장
// ================================================================
(function cleanupOldData(){
  if (localStorage.getItem('bm_schema') === 'v2') return;
  var keep = ['bm_role','bm_studentId','bm_studentName','bm_classId','bm_className','bm_email','bm_uid','bm_demo','bm_schema'];
  Object.keys(localStorage).forEach(function(k){
    if ((k.indexOf('bm_') === 0 || k.indexOf('tbm_') === 0) && keep.indexOf(k) < 0) {
      localStorage.removeItem(k);
    }
  });
  localStorage.setItem('bm_schema', 'v2');
})();

// ================================================================
// 최근 3개월만 보관 — 그 이전의 날짜 기록은 자동 삭제
//  (출석/숙제제출/시험제출/질문/상담 등 날짜가 있는 기록에만 적용)
//  학생 명단·반 정보처럼 날짜 없는 정보는 그대로 유지돼요.
// ================================================================
(function pruneOldData(){
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
  const cut = cutoff.getTime();
  const specs = [
    ['tbm_attendance','date'], ['tbm_submissions','submittedAt'], ['tbm_esubs','submittedAt'],
    ['tbm_questions','createdAt'], ['tbm_consults','submittedAt'],
    ['bm_s_attendance','date'], ['bm_s_questions','createdAt'], ['bm_s_consultations','submittedAt']
  ];
  specs.forEach(function(sp){
    var key = sp[0], field = sp[1];
    try {
      var raw = localStorage.getItem(key); if (!raw) return;
      var arr = JSON.parse(raw); if (!Array.isArray(arr)) return;
      var kept = arr.filter(function(o){
        var t = Date.parse((o && o[field]) || '');
        return isNaN(t) ? true : (t >= cut);   // 날짜 못 읽으면 보존
      });
      if (kept.length !== arr.length) localStorage.setItem(key, JSON.stringify(kept));
    } catch(e){}
  });
})();

// ================================================================
// 로그인 가드 — 해당 역할이 아니면 로그인 페이지로 보냄
//  student.html → requireRole('student')
//  teacher.html → requireRole('teacher')
// ================================================================
function requireRole(role){
  if (localStorage.getItem('bm_role') !== role) {
    location.href = 'index.html';
  }
}
