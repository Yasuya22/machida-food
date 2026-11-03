/** Supabase Storage（public-images）に置いた画像の表示用URL。http で始まる値・/ で始まる値はそのまま使う */
export const IMAGE_BUCKET = "public-images";

/** デモ用のイメージ写真か（アプリに同梱した public/demo/ の画像） */
export function isDemoImage(path: string | null | undefined): boolean {
  return !!path && path.startsWith("/demo/");
}

export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${path}` : null;
}
