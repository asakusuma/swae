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