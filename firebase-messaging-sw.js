// ================================================================
// BEEN MATH — 백그라운드 푸시 알림 서비스워커 (FCM)
// 앱이 꺼져있거나 다른 탭일 때 오는 알림을 처리해요.
// ================================================================
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCjlKRYQnZ4rPKzj06gdRwFgCcyKROntfM",
  authDomain: "been-math.firebaseapp.com",
  projectId: "been-math",
  storageBucket: "been-math.firebasestorage.app",
  messagingSenderId: "84606687461",
  appId: "1:84606687461:web:ed098795a2964442dddc0c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const title = (payload.notification && payload.notification.title) || 'BEEN MATH';
  const body  = (payload.notification && payload.notification.body)  || '';
  self.registration.showNotification(title, {
    body: body,
    icon: '/icon.svg',
    badge: '/icon.svg'
  });
});

// 알림 클릭하면 사이트 열기
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/student.html'));
});
