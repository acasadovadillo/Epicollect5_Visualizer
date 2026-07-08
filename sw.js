const CACHE = 'polvoranca-v1';

// Resolve base path dynamically so the SW works on any hosting
// (localhost, GitHub Pages /Epicollect5_Visualizer/, custom domain, etc.)
const BASE = new URL('.', self.location).href;

const STATIC = [
    BASE,
    BASE + 'index.html',
    BASE + 'atropellos.html',
    BASE + 'paleo.html',
    BASE + 'manifest.json',
    BASE + 'css/style.css',
    BASE + 'js/app.js',
    BASE + 'js/atropellos.js',
    BASE + 'js/paleo.js',
    BASE + 'icons/icon-192.png',
    BASE + 'icons/icon-512.png',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2',
];

// Pre-cache all static assets on install
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

// Remove old caches on activate
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // EpiCollect5 API → Network first, cache as fallback (datos siempre frescos)
    if (url.hostname === 'five.epicollect.net') {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Everything else → Cache first, network as fallback
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(res => {
                if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
                return res;
            });
        })
    );
});
