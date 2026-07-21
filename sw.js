/* ============================================================
   Service worker: сеть в первую очередь, кэш — запасной вариант.

   Зачем: приложение с домашнего экрана iOS держит свой снимок и может
   не ходить в сеть неделями — обновления не доезжают, а «переустановить
   иконку» стоит пользователю всех данных. Пока страницей управляет этот
   воркер, каждый запуск сверяется с сервером, а кэш нужен только офлайну.
   ============================================================ */

const CACHE = 'ration-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  e.respondWith((async () => {
    try {
      // no-cache — это «сверься с сервером», а не «качай заново»: без него запрос
      // ушёл бы в HTTP-кэш браузера и воркер раздавал бы ту же старую версию.
      // Файлов десяток, ответом обычно идёт пустой 304.
      const fresh = await fetch(e.request, { cache: 'no-cache' });
      if (fresh.ok) (await caches.open(CACHE)).put(e.request, fresh.clone());
      return fresh;
    } catch {
      // сети нет: отдаём последнее удачное, для перехода по адресу — стартовую
      const hit = await caches.match(e.request);
      return hit || (e.request.mode === 'navigate' ? caches.match('./') : Response.error());
    }
  })());
});
