import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession, safeNext } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "会員登録" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const session = await requireSession("/register");
  const { data } = await session.supabase.from("profiles").select("user_id").eq("user_id", session.userId).maybeSingle();
  if (data) redirect(next);

  return (
    <main>
      <PageHeader title="会員登録" lead="あと少しで完了です" />
      <div className="mx-auto max-w-md px-4 py-6">
        <RegisterForm next={next} />
      </div>
    </main>
  );
}
