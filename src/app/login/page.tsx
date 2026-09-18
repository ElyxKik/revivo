"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ShieldCheck, ArrowRight, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => searchParams.get("next") || "/admin", [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) router.replace(next);
    });
    return () => authListener.subscription.unsubscribe();
  }, [router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Invalid email or password.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to access Revivo Admin.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</label>
            <input
              className="w-full h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-zinc-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-indigo-500 placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@zecleaner.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Password</label>
            <input
              className="w-full h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-zinc-900 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-indigo-500 placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Sign in <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
            >
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-black text-zinc-900 dark:text-zinc-50">
      <Suspense fallback={<div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}

