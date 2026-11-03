"use client";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** Android（Chrome）で「アプリをインストール」を直接出すボタン。iPhone では手順の案内を見てもらう */
export function InstallButton() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="rounded-xl bg-ok-soft p-3 text-center text-sm font-bold text-ok">アプリとして使用中です</p>;
  if (!event) return null;
  return (
    <button
      onClick={async () => {
        await event.prompt();
        const r = await event.userChoice;
        if (r.outcome === "accepted") setInstalled(true);
        setEvent(null);
      }}
      className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-on-brand"
    >
      ホーム画面にインストール
    </button>
  );
}
