"use client";
import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * 会員証QR。中身は個人情報を含まない使い捨ての番号だけ（30秒で失効）。
 * 期限の数秒前に自動で新しい番号に切り替える。
 */
export function MemberQr() {
  const [svg, setSvg] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const supabase = createSupabaseBrowser();
      if (!supabase) throw new Error("unconfigured");
      const { data, error: e } = await supabase.rpc("issue_member_token");
      if (e || !data) throw e ?? new Error("no data");
      const { token, expires_at } = data as { token: string; expires_at: string };
      setSvg(await QRCode.toString(token, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1e2b24", light: "#ffffff" } }));
      setExpiresAt(Date.parse(expires_at));
      setError(null);
    } catch {
      setError("会員証を表示できませんでした。通信状況を確認して、もう一度お試しください。");
    } finally {
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  useEffect(() => {
    if (expiresAt && left <= 3) void refresh();
  }, [left, expiresAt, refresh]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-64 w-64 items-center justify-center rounded-2xl bg-white p-3 shadow-card">
        {svg ? <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="text-sm text-muted">読み込み中…</p>}
      </div>
      <div className="mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full bg-accent-bright transition-[width] duration-1000 ease-linear" style={{ width: `${Math.min(100, (left / 30) * 100)}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {svg ? `あと${left}秒で自動的に切り替わります` : ""}
      </p>
      {error ? (
        <div className="mt-3 text-center">
          <p className="text-sm text-full">{error}</p>
          <button onClick={() => void refresh()} className="mt-2 rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand">
            もう一度表示する
          </button>
        </div>
      ) : null}
    </div>
  );
}
