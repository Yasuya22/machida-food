/**
 * MACHIDA FOOD 専用のアイコン（外部ライブラリを使わず、必要なものだけ持つ）
 * - 線（d）＋薄い塗り（fill）の2色。よくある細線アイコンと見分けがつくよう、
 *   ホームは「のれんの掛かった店先」、お得は「値札」など、町の飲食店のモチーフにしている
 * - 線の太さ・角は全画面で統一（太さ2・角丸）
 */
type IconDef = { d: string; fill?: string };

const ICONS = {
  // 店先にのれん（ホーム）
  home: { d: "M3 9.5 12 4l9 5.5M5 9v11h14V9M7 10h10v4.5H7zM10.3 10v4.5M13.7 10v4.5M10 20v-3h4v3", fill: "M7 10h10v4.5H7z" },
  search: { d: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2", fill: "M11 6.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" },
  // 値札（お得）
  tag: { d: "M3.5 11.5V4.5a1 1 0 0 1 1-1h7l9 9-8 8-9-9Zm5-4h.01", fill: "M3.5 11.5V4.5a1 1 0 0 1 1-1h7l9 9-8 8z" },
  gift: { d: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7S10.5 3 8 3.8C6 4.5 7 7 12 7Zm0 0s1.5-4 4-3.2C18 4.5 17 7 12 7Z", fill: "M4 11h16v9H4z" },
  user: { d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9c.8-4 4-6 8-6s7.2 2 8 6", fill: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
  clock: { d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2" },
  arrow: { d: "M9 5l7 7-7 7" },
  map: { d: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", fill: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" },
  flame: { d: "M12 21c-4 0-7-2.7-7-6.5 0-3 2-5 3.5-6.5.3 1.6 1.2 2.8 2.5 3.5C11 8 12.5 5 15 3c.2 3 4 5.5 4 10.5 0 4.3-3 7.5-7 7.5Z", fill: "M12 21c-1.7 0-3-1.2-3-2.9 0-1.6 1.3-2.6 2-3.6.7 1 4 1.9 4 3.6 0 1.7-1.3 2.9-3 2.9Z" },
  qr: { d: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM16 16h2v2h-2z", fill: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" },
  seat: { d: "M6 4v9h12V4M4 13h16v3H4zM6 16v5M18 16v5", fill: "M6 4h12v9H6z" },
  sale: { d: "M5 19 19 5M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" },
  list: { d: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" },
  gear: { d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h5l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" },
  star: { d: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z", fill: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" },
  calendar: { d: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4", fill: "M4 6h16v4H4z" },
  yen: { d: "M6 4l6 8 6-8M12 12v8M7 13h10M7 17h10" },
  // 歩く（駅からの道のり）
  walk: { d: "M13 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 21l2-6 2.5 2.5V21M8 12l2.5-4 3 1 2 3 2.5.5M12.5 15l-1-4.5" },
  // どんぶり（料理・品書き）
  bowl: { d: "M3 11h18a9 9 0 0 1-18 0ZM8 20h8M9 3l1 6M15 3l-1 6", fill: "M3 11h18a9 9 0 0 1-18 0Z" },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const icon: IconDef = ICONS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {icon.fill ? <path d={icon.fill} fill="currentColor" stroke="none" opacity={0.18} /> : null}
      <path d={icon.d} />
    </svg>
  );
}
