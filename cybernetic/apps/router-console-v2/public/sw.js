/**
 * Service Worker — Offline-first caching strategy
 * Network-first for API calls, cache-first for assets
 */

const CACHE_NAME = "cybernetic-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// Install: Cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Fail gracefully if assets aren't available yet
      });
    })
  );
  self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first for API, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const { url } = request;

  // API calls: network first, fallback to cache
  if (url.includes("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Return cached response if offline
          return caches.match(request);
        })
    );
    return;
  }

  // Assets: cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (request.method === "GET" && response.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response.clone());
            });
          }
          return response;
        })
        .catch(() => {
          // Return a fallback page if the asset isn't cached
          if (request.destination === "document") {
            return caches.match("/");
          }
        });
    })
  );
});

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-tasks") {
    event.waitUntil(syncPendingTasks());
  }
});

async function syncPendingTasks() {
  try {
    const db = await openIDB();
    const pendingTasks = await db.getAll("pendingTasks");

    for (const task of pendingTasks) {
      try {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(task),
        });
        await db.delete("pendingTasks", task.id);
      } catch (error) {
        // Will retry on next sync
      }
    }
  } catch (error) {
    console.error("Sync failed:", error);
  }
}

function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("cybernetic", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("pendingTasks")) {
        db.createObjectStore("pendingTasks", { keyPath: "id" });
      }
    };
  });
}
