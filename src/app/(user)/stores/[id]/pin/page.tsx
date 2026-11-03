import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth";
import { PinForm } from "./PinForm";

export const metadata: Metadata = { title: "店舗PINでスタンプ" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 会員証QRをお店の端末で読み取れないときの予備（スタッフがお客様のスマホに店舗PINを入力する） */
export default async function PinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const s = await requireSession(`/stores/${id}/pin`);
  const [{ data: profile }, { data: store }] = await Promise.all([
    s.supabase.from("profiles").select("user_id").eq("user_id", s.userId).maybeSingle(),
    s.supabase.from("stores").select("id,name").eq("id", id).maybeSingle(),
  ]);
  if (!profile) redirect(`/register?next=/stores/${id}/pin`);
  if (!store) notFound();
  const st = store as { id: string; name: string };

  return (
    <main>
      <PageHeader title="店舗PINでスタンプ" lead={st.name} />
      <div className="mx-auto max-w-md space-y-4 px-4 py-6">
        <p className="text-sm text-muted">お店の端末で会員証を読み取れないときに使います。このスマホをお店の方に渡して、店舗PINを入力してもらってください。</p>
        <PinForm storeId={st.id} />
        <p className="text-xs text-muted">来店スタンプは1店舗につき1日1回です。PINを何度も間違えると、その日はPINでの処理ができなくなります。</p>
        <Link href={`/stores/${st.id}`} className="block text-center text-sm text-muted underline">お店のページに戻る</Link>
      </div>
    </main>
  );
}
