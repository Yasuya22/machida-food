import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Flash, buttonClass, cardClass, inputClass, subButtonClass } from "@/components/ui/Flash";
import { requireStoreAccess } from "@/lib/store/access";
import { feeLabel, minutesToLabel, timeToMinutes, tokyoNow, yen, type FeePolicy } from "@/lib/stores/status";
import * as A from "./actions";

export const metadata: Metadata = { title: "店舗設定" };

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const KIND_LABEL: Record<string, string> = { normal: "通常", rain: "雨の日", welcome: "初回登録特典", exchange: "ポイント交換" };

function Block({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className={`${cardClass} group`}>
      <summary className="cursor-pointer list-none font-bold">
        <span className="mr-2 inline-block text-accent transition-transform group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="mt-4 space-y-3">{children}</div>
    </details>
  );
}

function Hidden({ storeId }: { storeId: string }) {
  return <input type="hidden" name="store_id" value={storeId} />;
}

type Store = {
  name: string; genre: string; area_id: string | null; description: string | null; address: string | null; walk_minutes: number | null;
  price_min: number | null; price_max: number | null; max_party: number; payment_methods: string[]; features: string[];
  parking: string | null; holiday_note: string | null; stamp_goal: number; stamp_reward: string | null;
};

export default async function ManagePage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ msg?: string }> }) {
  const { storeId } = await params;
  const { msg } = await searchParams;
  const { session, canManage } = await requireStoreAccess(storeId);
  if (!canManage) redirect(`/store/${storeId}`);
  const db = session.supabase;
  const today = tokyoNow().ymd;

  const [store, areas, hours, closed, menu, plans, coupons, seats] = await Promise.all([
    db.from("stores").select("name,genre,area_id,description,address,walk_minutes,price_min,price_max,max_party,payment_methods,features,parking,holiday_note,stamp_goal,stamp_reward").eq("id", storeId).maybeSingle(),
    db.from("areas").select("id,name").order("sort").returns<{ id: string; name: string }[]>(),
    db.from("store_hours").select("id,weekday,opens,closes,last_order").eq("store_id", storeId).order("weekday").order("opens").returns<{ id: string; weekday: number; opens: string; closes: string; last_order: string | null }[]>(),
    db.from("store_closed_days").select("day,note").eq("store_id", storeId).gte("day", today).order("day").returns<{ day: string; note: string | null }[]>(),
    db.from("menu_items").select("id,name,price,is_active").eq("store_id", storeId).order("sort").returns<{ id: string; name: string; price: number; is_active: boolean }[]>(),
    db.from("budget_plans").select("id,price,dishes,drinks,note,fee,is_active").eq("store_id", storeId).order("sort").returns<{ id: string; price: number; dishes: number; drinks: number; note: string | null; fee: FeePolicy; is_active: boolean }[]>(),
    db.from("coupons").select("id,title,conditions,kind,ends_at,total_limit,is_active").eq("store_id", storeId).order("created_at").returns<{ id: string; title: string; conditions: string | null; kind: string; ends_at: string | null; total_limit: number | null; is_active: boolean }[]>(),
    db.from("seat_types").select("id,name,kind,unit_size,total").eq("store_id", storeId).order("sort").returns<{ id: string; name: string; kind: string; unit_size: number; total: number }[]>(),
  ]);
  const s = store.data as Store | null;
  if (!s) redirect(`/store/${storeId}`);
  const t = (v: string) => minutesToLabel(timeToMinutes(v));

  return (
    <div className="space-y-3">
      <Flash msg={msg} />
      <p className="text-xs text-muted">ここで変えた内容は、すぐにお客様の画面に反映されます。</p>

      <Block title="店舗情報" open>
        <form action={A.saveStoreInfo} className="space-y-2 text-xs text-muted">
          <Hidden storeId={storeId} />
          <label className="block space-y-1">店名<input name="name" defaultValue={s.name} required className={inputClass} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">ジャンル<input name="genre" defaultValue={s.genre} required className={inputClass} /></label>
            <label className="space-y-1">エリア
              <select name="area_id" defaultValue={s.area_id ?? ""} className={inputClass}>
                <option value="">未設定</option>
                {(areas.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1">紹介文<textarea name="description" defaultValue={s.description ?? ""} rows={3} className={inputClass} /></label>
          <label className="block space-y-1">住所<input name="address" defaultValue={s.address ?? ""} className={inputClass} /></label>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">駅から徒歩（分）<input name="walk_minutes" type="number" min={0} defaultValue={s.walk_minutes ?? ""} className={inputClass} /></label>
            <label className="space-y-1">予算 下限（円）<input name="price_min" type="number" min={0} defaultValue={s.price_min ?? ""} className={inputClass} /></label>
            <label className="space-y-1">予算 上限（円）<input name="price_max" type="number" min={0} defaultValue={s.price_max ?? ""} className={inputClass} /></label>
          </div>
          <label className="block space-y-1">最大人数<input name="max_party" type="number" min={1} defaultValue={s.max_party} className={inputClass} /></label>
          <label className="block space-y-1">支払い方法（「、」で区切る）<input name="payment_methods" defaultValue={s.payment_methods.join("、")} className={inputClass} /></label>
          <label className="block space-y-1">こだわり条件（「、」で区切る。探す画面の条件になります）<input name="features" defaultValue={s.features.join("、")} className={inputClass} /></label>
          <label className="block space-y-1">駐車場<input name="parking" defaultValue={s.parking ?? ""} className={inputClass} /></label>
          <label className="block space-y-1">定休日の説明<input name="holiday_note" defaultValue={s.holiday_note ?? ""} className={inputClass} /></label>
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <label className="space-y-1">スタンプ目標<input name="stamp_goal" type="number" min={3} max={50} defaultValue={s.stamp_goal} className={inputClass} /></label>
            <label className="space-y-1">たまったときの特典<input name="stamp_reward" defaultValue={s.stamp_reward ?? ""} className={inputClass} /></label>
          </div>
          <button className={`${buttonClass} w-full`}>保存する</button>
        </form>
      </Block>

      <Block title="営業時間・L.O.・臨時休業">
        <ul className="space-y-1 text-sm">
          {(hours.data ?? []).map((h) => (
            <li key={h.id} className="flex items-center justify-between">
              <span>{DAYS[h.weekday]}　{t(h.opens)}〜{t(h.closes)}{h.last_order ? `（L.O. ${t(h.last_order)}）` : ""}</span>
              <form action={A.deleteHours}><Hidden storeId={storeId} /><input type="hidden" name="id" value={h.id} /><button className={subButtonClass}>削除</button></form>
            </li>
          ))}
        </ul>
        <form action={A.addHours} className="grid grid-cols-4 gap-2 text-xs text-muted">
          <Hidden storeId={storeId} />
          <label className="space-y-1">曜日<select name="weekday" className={inputClass}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
          <label className="space-y-1">開店<input name="opens" type="time" required className={inputClass} /></label>
          <label className="space-y-1">閉店<input name="closes" type="time" required className={inputClass} /></label>
          <label className="space-y-1">L.O.<input name="last_order" type="time" className={inputClass} /></label>
          <button className={`${buttonClass} col-span-4`}>営業時間を追加</button>
          <p className="col-span-4 text-[11px]">昼・夜の2部制は、同じ曜日に2行登録します。行がない曜日は定休日になります。24時閉店は「23:59」で登録してください。</p>
        </form>
        <div className="border-t border-line pt-3">
          <ul className="space-y-1 text-sm">
            {(closed.data ?? []).map((c) => (
              <li key={c.day} className="flex items-center justify-between">
                <span>臨時休業 {c.day}{c.note ? `（${c.note}）` : ""}</span>
                <form action={A.deleteClosedDay}><Hidden storeId={storeId} /><input type="hidden" name="day" value={c.day} /><button className={subButtonClass}>取消</button></form>
              </li>
            ))}
          </ul>
          <form action={A.addClosedDay} className="mt-2 flex gap-2">
            <Hidden storeId={storeId} />
            <input name="day" type="date" min={today} required className={inputClass} />
            <input name="note" placeholder="理由（任意）" className={inputClass} />
            <button className={`${buttonClass} shrink-0`}>追加</button>
          </form>
        </div>
      </Block>

      <Block title="メニュー（税込み）">
        <ul className="space-y-1 text-sm">
          {(menu.data ?? []).map((m) => (
            <li key={m.id} className={`flex items-center justify-between ${m.is_active ? "" : "text-muted line-through"}`}>
              <span>{m.name}　{yen(m.price)}</span>
              <form action={A.toggleMenu}><Hidden storeId={storeId} /><input type="hidden" name="id" value={m.id} /><input type="hidden" name="active" value={m.is_active ? "0" : "1"} /><button className={subButtonClass}>{m.is_active ? "非表示" : "表示"}</button></form>
            </li>
          ))}
        </ul>
        <form action={A.addMenu} className="flex gap-2">
          <Hidden storeId={storeId} />
          <input name="name" required placeholder="メニュー名" className={inputClass} />
          <input name="price" type="number" min={0} required placeholder="税込み" className={`${inputClass} w-28`} />
          <button className={`${buttonClass} shrink-0`}>追加</button>
        </form>
      </Block>

      <Block title="予算別プラン">
        <ul className="space-y-2 text-sm">
          {(plans.data ?? []).map((p) => (
            <li key={p.id} className={`flex items-center justify-between gap-2 ${p.is_active ? "" : "text-muted line-through"}`}>
              <span>{yen(p.price)}・料理{p.dishes}品・ドリンク{p.drinks}杯・{feeLabel(p.fee)}{p.note ? `（${p.note}）` : ""}</span>
              <form action={A.togglePlan}><Hidden storeId={storeId} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.is_active ? "0" : "1"} /><button className={subButtonClass}>{p.is_active ? "非表示" : "表示"}</button></form>
            </li>
          ))}
        </ul>
        <form action={A.addPlan} className="grid grid-cols-3 gap-2 text-xs text-muted">
          <Hidden storeId={storeId} />
          <label className="space-y-1">総額（税込み）<input name="price" type="number" min={500} required className={inputClass} /></label>
          <label className="space-y-1">料理（品）<input name="dishes" type="number" min={0} max={20} required className={inputClass} /></label>
          <label className="space-y-1">ドリンク（杯）<input name="drinks" type="number" min={0} max={20} required className={inputClass} /></label>
          <label className="col-span-3 space-y-1">お通し・席料
            <select name="fee" required className={inputClass}>
              <option value="none">お通し・席料なし</option>
              <option value="included">お通し・席料込み</option>
              <option value="separate">お通し・席料は別途</option>
            </select>
          </label>
          <label className="col-span-3 space-y-1">内容<input name="note" placeholder="例：前菜・メイン・デザート" className={inputClass} /></label>
          <button className={`${buttonClass} col-span-3`}>プランを追加</button>
        </form>
      </Block>

      <Block title="クーポン">
        <ul className="space-y-2 text-sm">
          {(coupons.data ?? []).map((c) => (
            <li key={c.id} className={`flex items-center justify-between gap-2 ${c.is_active ? "" : "text-muted"}`}>
              <span>
                <span className="mr-1 rounded bg-accent-soft px-1.5 text-[10px] text-accent">{KIND_LABEL[c.kind] ?? c.kind}</span>
                {c.title}
                <span className="block text-[11px] text-muted">{c.conditions ?? ""}{c.ends_at ? `・${tokyoNow(new Date(c.ends_at)).ymd}まで` : ""}{c.total_limit ? `・先着${c.total_limit}枚` : ""}</span>
              </span>
              <form action={A.toggleCoupon}><Hidden storeId={storeId} /><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={c.is_active ? "0" : "1"} /><button className={subButtonClass}>{c.is_active ? "停止" : "公開"}</button></form>
            </li>
          ))}
        </ul>
        <form action={A.addCoupon} className="space-y-2 text-xs text-muted">
          <Hidden storeId={storeId} />
          <input name="title" required placeholder="内容（例：ドリンク1杯サービス）" className={inputClass} />
          <input name="conditions" placeholder="条件（例：4名様以上）" className={inputClass} />
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">種類
              <select name="kind" className={inputClass}>
                <option value="normal">通常</option>
                <option value="rain">雨の日</option>
                <option value="welcome">初回登録特典</option>
              </select>
            </label>
            <label className="space-y-1">期限（任意）<input name="ends_at" type="date" min={today} className={inputClass} /></label>
            <label className="space-y-1">先着枚数（任意）<input name="total_limit" type="number" min={1} className={inputClass} /></label>
          </div>
          <button className={`${buttonClass} w-full`}>クーポンを追加</button>
          <p className="text-[11px]">表示は実際の内容と一致させ、「最大」「今だけ」など誤解を招く表現は避けてください。初回登録特典は景品の上限の確認が済むまで、金額を確定しないでください。</p>
        </form>
      </Block>

      <Block title="店舗PIN（予備の来店認証）">
        <p className="text-sm text-muted">PINはお店ごとに毎日自動で変わります。漏れたおそれがあるときは作り直してください。今日のPINは「来店処理」画面で確認できます。</p>
        <form action={A.rotatePin}>
          <Hidden storeId={storeId} />
          <button className={`${buttonClass} w-full`}>店舗PINを作り直す</button>
        </form>
      </Block>

      <Block title="席の種類（空席表示用）">
        <ul className="space-y-1 text-sm">
          {(seats.data ?? []).map((st) => (
            <li key={st.id} className="flex items-center justify-between">
              <span>{st.name}（{st.kind === "counter" ? `${st.total}席` : `${st.unit_size}名×${st.total}卓`}）</span>
              <form action={A.deleteSeatType}><Hidden storeId={storeId} /><input type="hidden" name="id" value={st.id} /><button className={subButtonClass}>削除</button></form>
            </li>
          ))}
        </ul>
        <form action={A.addSeatType} className="grid grid-cols-4 gap-2 text-xs text-muted">
          <Hidden storeId={storeId} />
          <label className="col-span-4 space-y-1">名前<input name="name" required placeholder="例：テーブル（4名）" className={inputClass} /></label>
          <label className="col-span-2 space-y-1">種類<select name="kind" className={inputClass}><option value="unit">テーブル・個室（卓）</option><option value="counter">カウンター（席）</option></select></label>
          <label className="space-y-1">1卓の人数<input name="unit_size" type="number" min={1} defaultValue={4} className={inputClass} /></label>
          <label className="space-y-1">数<input name="total" type="number" min={0} required className={inputClass} /></label>
          <button className={`${buttonClass} col-span-4`}>席の種類を追加</button>
        </form>
      </Block>
    </div>
  );
}
