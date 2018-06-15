const version = '%VERSION%';
self.addEventListener('install', (e) => {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (e) => {
  console.log('activate');
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode === 'navigate') {
    e.respondWith(addMarker(e.request));
  }
});
self.addEventListener('message', (e) => {
  const data = e.data;
  if (data.request === 'throwError') {
    throw new Error('Postmessage Test Error');
  } else if (data.request === 'cacheTest') {
    e.waitUntil(cacheTest(e));
  }
});

function addMarker(req) {
  return fetch(req).then((res) => {
    return res.text().then((text) => {
      const init = {
        status: 200,
        headers: res.headers
      };
      const marker = '<meta name="from-service-worker" />';
      const newBody = text.replace('</head>', marker + '</head>');
      return new Response(newBody, init);
    });
  });
}

function cacheTest(e) {
  let megaString = '';
  for (let i = 0; i < 9999; i++) {
    megaString += String(Math.random());
  }
  return caches.open('test-cache').then((cache) => {
    return cache.put('testpath', new Response(megaString));
  });
}