const CACHE_NAME = 'vc-offline-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Relative to the SW scope so the app works when deployed under a
      // sub-path (e.g. /pc-os/) as well as at the origin root.
      return cache.addAll([
        './',
        './index.html',
        './manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

/**
 * Cache the hashed build assets (JS/CSS) that index.html actually references.
 *
 * The SW activates AFTER the page has already fetched its bundles, so those
 * fetches are never intercepted and the runtime cache stays empty for them.
 * The shell alone is not a working app: offline you would get index.html with
 * no code behind it, i.e. a blank screen. Reading the asset URLs out of
 * index.html keeps this correct across rebuilds without a build step, since
 * the filenames change hash every build.
 */
async function precacheBuildAssets() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await fetch('./index.html', { cache: 'reload' });
    if (!res || !res.ok) return;
    await cache.put('./index.html', res.clone());

    const html = await res.text();
    const urls = new Set();
    // src="..." / href="..." for same-origin build output only.
    const attrRe = /(?:src|href)="([^"]+)"/g;
    let m;
    while ((m = attrRe.exec(html)) !== null) {
      const url = m[1];
      if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) continue;
      if (/\.(js|css|woff2?|png|svg|ico|webmanifest|json)$/i.test(url)) urls.add(url);
    }

    await Promise.all([...urls].map(async (url) => {
      try {
        const assetRes = await fetch(url, { cache: 'reload' });
        if (assetRes && assetRes.ok) await cache.put(url, assetRes);
      } catch (_) { /* one bad asset must not abort the rest */ }
    }));
  } catch (_) {
    // Offline at activate time — the runtime cache still fills on later visits.
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    }).then(() => precacheBuildAssets())
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // We only want to cache GET requests
  if (event.request.method !== 'GET') return;
  // Ignore chrome-extension and firestore long polling
  if (event.request.url.startsWith('chrome-extension') || event.request.url.includes('firestore.googleapis.com')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return from cache immediately, but fetch in background to update cache
        event.waitUntil(
          fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          }).catch(() => {})
        );
        return cachedResponse;
      }

      // If not in cache, fetch from network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        // Only cache basic or cors responses, avoid opaque responses if possible, though opaque might be needed for some third party images without cors
        if (networkResponse.type === 'opaque') {
            return networkResponse;
        }
        
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(async () => {
        // A page load with no network must still open the desktop. This is a
        // single-page app, so every navigation resolves to the same shell:
        // serving the cached index.html here is what lets the OS start from a
        // cold launch, a reload, or a deep link while fully offline. Without
        // it a navigation fell through to the bare "Offline" text below, so
        // the app was unreachable off-grid even though its assets were cached.
        if (event.request.mode === 'navigate') {
          const shell = await caches.match('./index.html') || await caches.match('./');
          if (shell) return shell;
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
