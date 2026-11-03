/** 線のアイコン（外部ライブラリを使わず、必要なものだけ持つ） */
const PATHS = {
  home: "M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2",
  tag: "M3 12V4h8l9 9-8 8-9-9Zm5-4.5h.01",
  gift: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7S10.5 3 8 3.8C6 4.5 7 7 12 7Zm0 0s1.5-4 4-3.2C18 4.5 17 7 12 7Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9c.8-4 4-6 8-6s7.2 2 8 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  arrow: "M9 5l7 7-7 7",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
