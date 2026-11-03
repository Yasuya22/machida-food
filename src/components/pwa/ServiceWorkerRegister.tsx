"use client";
import { useEffect } from "react";

/** サービスワーカーの登録（本番の組み立てのときだけ。開発中は古い画面が残らないよう登録しない） */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
