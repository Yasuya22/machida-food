"use client";
import jsQR from "jsqr";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { redeem, type RedeemResult } from "../actions";

type CouponOption = { id: string; title: string; kind: string };

/**
 * 会員証QRの読み取り（店舗端末のカメラ）。カメラが使えないときは番号の手入力もできる。
 * 付与の判定はすべてサーバー（DBの関数）で行う。
 */
export function Scanner({ storeId, coupons }: { storeId: string; coupons: CouponOption[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const [mode, setMode] = useState<string>("visit");
  const [camera, setCamera] = useState<"off" | "on" | "error">("off");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [pending, startTransition] = useTransition();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("off");
  }, []);

  const submit = useCallback(
    (token: string) => {
      if (busy.current) return;
      busy.current = true;
      stop();
      startTransition(async () => {
        const r = await redeem(storeId, token, mode === "visit" ? null : mode);
        setResult(r);
        busy.current = false;
      });
    },
    [mode, stop, storeId],
  );

  const start = useCallback(async () => {
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera("on");
    } catch {
      setCamera("error");
    }
  }, []);

  // カメラの映像から QR を探す
  useEffect(() => {
    if (camera !== "on") return;
    const timer = setInterval(() => {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.readyState < 2) return;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code?.data) submit(code.data);
    }, 250);
    return () => clearInterval(timer);
  }, [camera, submit]);

  useEffect(() => stop, [stop]);

  const selected = coupons.find((c) => c.id === mode);

  return (
    <div className="space-y-4">
      <fieldset className="rounded-2xl border border-line bg-surface p-4 shadow-card">
        <legend className="px-1 text-sm font-bold">何をしますか</legend>
        <label className="flex items-center gap-2 py-1.5 text-sm">
          <input type="radio" name="mode" value="visit" checked={mode === "visit"} onChange={() => setMode("visit")} />
          来店スタンプを付ける
        </label>
        {coupons.map((c) => (
          <label key={c.id} className="flex items-center gap-2 py-1.5 text-sm">
            <input type="radio" name="mode" value={c.id} checked={mode === c.id} onChange={() => setMode(c.id)} />
            クーポン：{c.title}
            {c.kind === "welcome" ? <span className="text-[10px] text-muted">（初回登録特典）</span> : null}
          </label>
        ))}
      </fieldset>

      {result ? (
        <div className={`rounded-2xl p-5 text-center shadow-card ${result.ok ? "bg-ok-soft text-ok" : "bg-full-soft text-full"}`} role="status">
          <p className="font-display text-xl font-bold">{result.title}</p>
          <ul className="mt-2 space-y-0.5 text-sm text-ink">
            {result.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <button onClick={() => { setResult(null); setManual(""); }} className="mt-4 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-on-brand">
            次のお客様
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: "1 / 1", display: camera === "on" ? "block" : "none" }}>
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <span className="pointer-events-none absolute inset-10 rounded-2xl border-2 border-accent-bright" />
          </div>
          <canvas ref={canvasRef} className="hidden" />
          {camera !== "on" ? (
            <button onClick={start} disabled={pending} className="w-full rounded-xl bg-brand py-4 text-base font-bold text-on-brand">
              {pending ? "処理中…" : "カメラで会員証を読み取る"}
            </button>
          ) : (
            <button onClick={stop} className="w-full rounded-xl border border-line py-2.5 text-sm text-muted">カメラを止める</button>
          )}
          {camera === "error" ? <p className="text-sm text-full">カメラを使えませんでした。ブラウザのカメラの許可を確認するか、下の番号入力をお使いください。</p> : null}
          <p className="text-center text-xs text-muted">
            {selected ? `「${selected.title}」を使用済みにします` : "来店スタンプ（1店舗1日1回）を付けます"}
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-muted">カメラが使えないとき（番号を入力）</summary>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit(manual);
              }}
            >
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="会員証の番号（32文字）"
                className="flex-1 rounded-xl border border-line px-3 py-2 font-mono text-xs"
                autoCapitalize="off"
                autoCorrect="off"
              />
              <button className="rounded-xl bg-brand px-3 text-sm font-bold text-on-brand">確定</button>
            </form>
          </details>
        </div>
      )}
    </div>
  );
}
