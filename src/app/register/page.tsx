"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ShieldAlert, ArrowRight, Loader2, Lock } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: name },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registration failed");

      // 2. Get session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Failed to get session token");

      // 3. Call setup-admin API to set admin flag
      const res = await fetch("/api/admin/setup-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "X-Setup-Secret": secret.trim(),
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to set admin");
      }

      // 4. Redirect
      router.replace("/admin");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-black text-zinc-900 dark:text-zinc-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-900">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Create Admin Account</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Internal registration. Requires setup secret.
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Full Name</label>
              <input
                className="w-full h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-indigo-500"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</label>
              <input
                className="w-full h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-indigo-500"
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
                className="w-full h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-indigo-500"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                <Lock className="h-3 w-3" /> Setup Secret
              </label>
              <input
                className="w-full h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-indigo-500"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                required
                placeholder="Enter the deployment secret"
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
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 font-medium text-white transition-all hover:bg-zinc-800 disabled:opacity-70 disabled:cursor-not-allowed dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Create Account <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <a href="/login" className="text-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300">
              Already have an account? Sign in
            </a>
          </form>
        </div>
      </div>
    </div>
  );
}
