import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth-actions";

export const metadata: Metadata = {
  title: "Your Account — LEVR Auto",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, email, full_name, created_at")
    .eq("id", user.id)
    .single();

  return (
    <section className="bg-zinc-950 py-24">
      <div className="mx-auto max-w-md px-6 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-zinc-950">
          ✓
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-white">You&apos;re signed in</h1>
        <p className="mt-3 text-zinc-400">{user.email}</p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-left text-sm">
          {customer ? (
            <>
              <p className="font-semibold text-white">customers row found</p>
              <p className="mt-2 text-zinc-400">
                id: <span className="text-zinc-300">{customer.id}</span>
              </p>
              <p className="mt-1 text-zinc-400">
                full_name: <span className="text-zinc-300">{customer.full_name ?? "—"}</span>
              </p>
              <p className="mt-1 text-zinc-400">
                created_at: <span className="text-zinc-300">{customer.created_at}</span>
              </p>
            </>
          ) : (
            <p className="text-red-400">
              No matching customers row found — the signup trigger may not have run.
            </p>
          )}
        </div>

        <form action={logout} className="mt-8">
          <button
            type="submit"
            className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Log Out
          </button>
        </form>
      </div>
    </section>
  );
}
