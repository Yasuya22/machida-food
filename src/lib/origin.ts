import type { NextRequest } from "next/server";

/**
 * 利用者のブラウザから見たサイトのアドレス（例：https://machida-food.jp）。
 * ホスティングの中継サーバー越しでも正しくなるよう、転送ヘッダーと Host を優先する。
 * （request.nextUrl.origin はサーバー内部の値になることがあり、ログインの戻り先がずれる）
 */
export function requestOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}
