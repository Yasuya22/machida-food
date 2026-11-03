"use client";
import { useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { IMAGE_BUCKET, publicImageUrl } from "@/lib/images";

/**
 * 画像を選ぶ → 端末で縮小・圧縮（WebP・最長辺 maxSize px）→ Storage に登録 → フォームを送信。
 * 登録できるかどうかは Storage の権限（店舗のオーナー・運営）で決まる。
 */
export function ImageUpload({
  folder,
  action,
  fields,
  current,
  maxSize = 1200,
  label = "画像を選ぶ",
}: {
  folder: string;
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  current?: string | null;
  maxSize?: number;
  label?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [path, setPath] = useState("");
  const [preview, setPreview] = useState<string | null>(publicImageUrl(current));
  const [status, setStatus] = useState<string | null>(null);

  async function onFile(file: File) {
    setStatus("縮小して送信しています…");
    try {
      const blob = await shrink(file, maxSize);
      const supabase = createSupabaseBrowser();
      if (!supabase) throw new Error("unconfigured");
      const name = `${folder}/${Date.now()}.webp`;
      const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(name, blob, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      setPath(name);
      setPreview(URL.createObjectURL(blob));
      setStatus("保存しています…");
      requestAnimationFrame(() => formRef.current?.requestSubmit());
    } catch {
      setStatus("画像を登録できませんでした（権限・通信・ファイルの種類を確認してください）");
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="image_path" value={path} />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-36 w-full rounded-xl border border-line object-cover" />
      ) : null}
      <label className="block cursor-pointer rounded-xl border border-dashed border-line px-4 py-3 text-center text-sm text-muted">
        {label}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>
      {status ? <p className="text-xs text-muted">{status}</p> : null}
      <p className="text-[11px] text-muted">自動で縮小・圧縮して保存します。実在店舗の写真は掲載の許可をいただいたものだけを使ってください。</p>
    </form>
  );
}

/** 最長辺を maxSize に縮めて WebP（画質0.82）にする */
async function shrink(file: File, maxSize: number): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("encode");
  return blob;
}
