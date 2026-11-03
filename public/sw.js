/*
 * MACHIDA FOOD のサービスワーカー（PWA）
 * - 電波がないときに「オフライン」の案内画面を出す
 * - 画面の部品（/_next/static/）だけを端末に保存して表示を速くする
 * - ログイン情報・会員証・空席などのデータは保存しない（個人情報と鮮度のため）
 */
const VERSION = "v1";
const STATIC_CACHE = `mf-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("mf-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 画面の移動：常に最新を取りに行き、つながらないときだけ案内画面
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // 画面の部品（ファイル名に版が入っていて変わらない）：保存したものを使う
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/characters/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
