// 画面のスクリーンショット（幅375px）を撮る。自動チェック（GitHub Actions）で使う。
// 一時的なSupabase（supabase start）に対して、ログイン→会員登録→店舗・運営の画面まで通す。
// 使い方：node scripts/screenshots.mjs <出力フォルダ>
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const OUT = process.argv[2] ?? "shots";
const APP = "http://127.0.0.1:3000";
const MAIL = "http://127.0.0.1:54324";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const EMAIL = "demo-owner@example.com";
const STORE = "11111111-1111-1111-1111-000000000001";
mkdirSync(OUT, { recursive: true });

const sql = (q) => execFileSync("psql", [DB, "-v", "ON_ERROR_STOP=1", "-qtAc", q], { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 撮影用のデモの状態（空席を新しく、タイムセール・限定メニューを今日に）
sql(`update public.store_seat_status set updated_at = now() - interval '3 minutes' where store_id is not null`);
sql(`insert into public.time_sales (store_id, title, starts_at, ends_at) values
  ('11111111-1111-1111-1111-000000000003', '【デモ】ハッピーアワー：生ビール半額', now() - interval '1 hour', now() + interval '2 hours')`);
sql(`insert into public.daily_specials (store_id, name, price, note) values
  ('11111111-1111-1111-1111-000000000002', '【デモ】限定 牡蠣の塩そば', 1200, '1日20杯まで'),
  ('11111111-1111-1111-1111-000000000003', '【デモ】本日の鮮魚 カワハギ肝和え', 980, '数量限定')`);

/** メールボックス（Mailpit または Inbucket）からログイン用リンクを取り出す */
async function loginLink() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await (await fetch(`${MAIL}/api/v1/messages`)).json();
      const id = list?.messages?.[0]?.ID;
      if (id) {
        const msg = await (await fetch(`${MAIL}/api/v1/message/${id}`)).json();
        const m = String(msg.HTML ?? msg.Text ?? "").match(/https?:\/\/[^"'\s<>]+verify[^"'\s<>]+/);
        if (m) return m[0].replaceAll("&amp;", "&");
      }
    } catch {
      try {
        const box = await (await fetch(`${MAIL}/api/v1/mailbox/${EMAIL.split("@")[0]}`)).json();
        const last = box?.[box.length - 1];
        if (last) {
          const msg = await (await fetch(`${MAIL}/api/v1/mailbox/${EMAIL.split("@")[0]}/${last.id}`)).json();
          const m = String(msg?.body?.html ?? msg?.body?.text ?? "").match(/https?:\/\/[^"'\s<>]+verify[^"'\s<>]+/);
          if (m) return m[0].replaceAll("&amp;", "&");
        }
      } catch {}
    }
    await sleep(1000);
  }
  throw new Error("ログイン用のメールが見つかりません");
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, locale: "ja-JP", timezoneId: "Asia/Tokyo" });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
let n = 0;
async function shot(name, url, opts = {}) {
  if (url) await page.goto(APP + url, { waitUntil: "networkidle" });
  if (opts.wait) await sleep(opts.wait);
  const file = `${OUT}/${String(++n).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: opts.full ?? true });
  console.log("shot", file, page.url());
}

// ---- ログインなし ----
await shot("home", "/");
await shot("search", "/search");
await shot("search-now", "/search?now=1");
await shot("store-detail", `/stores/${STORE}`);
await shot("store-detail-izakaya", "/stores/11111111-1111-1111-1111-000000000003");
await shot("deals", "/deals");
await shot("install", "/install");

// ---- ログイン・会員登録 ----
await page.goto(APP + "/login?next=/mypage", { waitUntil: "networkidle" });
await shot("login", null, { full: false });
await page.fill('input[name="email"]', EMAIL);
await page.click('button[type="submit"]');
await page.waitForSelector("text=メールを送りました", { timeout: 20000 });
await page.goto(await loginLink(), { waitUntil: "networkidle" });
await page.waitForURL(/\/register/, { timeout: 20000 });
await shot("register", null);
await page.fill('input[name="nickname"]', "まちだ太郎");
await page.selectOption('select[name="birth_month"]', "4");
await page.check('input[name="adult"]');
await page.check('input[name="agree"]');
await page.click('button[type="submit"]');
await page.waitForSelector("text=登録ありがとうございます", { timeout: 20000 });
await shot("register-done", null, { full: false });

// 撮影用：この利用者を運営・まちだ苑のオーナーにし、ポイントを足してゴールドランクにする
const uid = sql(`select id from auth.users where email = '${EMAIL}'`);
sql(`insert into public.admins (user_id) values ('${uid}') on conflict do nothing`);
sql(`insert into public.store_members (store_id, user_id, role) values ('${STORE}', '${uid}', 'store_owner') on conflict do nothing`);
sql(`insert into public.point_ledger (user_id, delta, reason) values ('${uid}', 2800, '撮影用の加算')`);
sql(`update public.profiles set equipped_title_id = (select id from public.cosmetics where name = '町田の美食家'),
       equipped_frame_id = (select id from public.cosmetics where name = 'ゴールドの枠'),
       equipped_outfit_id = (select id from public.cosmetics where name = 'コック衣装') where user_id = '${uid}'`);

await shot("mypage", "/mypage");
await shot("member-card", "/mypage/card", { wait: 1500, full: false });

// 店舗の来店処理：会員証の番号を発行して、店舗画面で番号入力
const token = await page.evaluate(async () => {
  const el = Array.from(document.querySelectorAll("p")).find((p) => p.textContent?.startsWith("開発用："));
  return el?.textContent?.replace("開発用：", "") ?? null;
});
await shot("store-scan", `/store/${STORE}/scan`);
if (token) {
  await page.click("text=カメラが使えないとき（番号を入力）");
  await page.fill('input[placeholder="会員証の番号（32文字）"]', token);
  await page.click("text=確定");
  await page.waitForSelector("text=次のお客様", { timeout: 15000 });
  await shot("store-scan-done", null, { full: false });
} else {
  // 本番の組み立てでは開発用の番号が出ないため、DBで番号を発行して手入力する
  const t = sql(`insert into public.member_tokens (token, user_id, expires_at) values (replace(gen_random_uuid()::text,'-',''), '${uid}', now() + interval '30 seconds') returning token`);
  await page.goto(APP + `/store/${STORE}/scan`, { waitUntil: "networkidle" });
  await page.click("text=カメラが使えないとき（番号を入力）");
  await page.fill('input[placeholder="会員証の番号（32文字）"]', t);
  await page.click("text=確定");
  await page.waitForSelector("text=次のお客様", { timeout: 15000 });
  await shot("store-scan-done", null, { full: false });
}
await shot("store-seats", `/store/${STORE}`);
await shot("store-deals", `/store/${STORE}/deals`);
await shot("store-logs", `/store/${STORE}/logs`);
await shot("store-manage", `/store/${STORE}/manage`);
await shot("rewards", "/rewards");
await shot("pin", `/stores/11111111-1111-1111-1111-000000000003/pin`);
await shot("admin", "/admin");
await shot("delete", "/mypage/delete");

await browser.close();
console.log("done", n, "shots");
