/* Service worker — Verificador de Productos
   · HTML/app: red primero (siempre la versión más nueva); si no hay red, la última copia guardada.
   · Archivos estáticos y librerías de CDN: se sirven del caché y se actualizan en segundo plano.
   · Supabase, Groq y cualquier petición que no sea GET nunca se tocan (los datos siempre van a la red). */
const CACHE = 'verificador-v1';
const CORE = ['./', 'index.html', 'manifest.json', 'icon.svg'];
const CDN = ['cdn.jsdelivr.net', 'unpkg.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN.includes(url.hostname)) return;          // Supabase, Groq, etc.: directo a la red
  if (sameOrigin && url.pathname.includes('/rest/v1/')) return;
  if (req.mode === 'navigate' || (sameOrigin && /\.html?$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html') || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
