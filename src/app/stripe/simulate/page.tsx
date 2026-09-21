"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { CreditCard, ArrowLeft, Loader2, ShieldCheck, Mail, User, CheckCircle2 } from "lucide-react";

const formSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  seats: z.union([z.literal(1), z.literal(3)]),
  brand: z.string().min(1),
  last4: z.string().regex(/^\d{4}$/),
});

type FormState = z.infer<typeof formSchema>;

export default function StripeSimulatePage() {
  const [form, setForm] = useState<FormState>({
    email: "",
    name: "",
    seats: 1,
    brand: "visa",
    last4: "4242",
  });

  const amountEur = useMemo(() => (form.seats === 1 ? 69 : 120), [form.seats]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i: z.ZodIssue) => i.message).join("\n"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_details: { email: parsed.data.email, name: parsed.data.name },
          line_items: [{ seats: parsed.data.seats, amount_eur: amountEur }],
          payment_method_details: { brand: parsed.data.brand, last4: parsed.data.last4 },
          currency: "usd",
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || `Request failed (${res.status})`);
        return;
      }

      setResult(json);
    } catch (err: any) {
      setError(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto w-full max-w-4xl">
        <a 
          href="/admin" 
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </a>

        <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-center gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
                        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">
                            <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold">Stripe Checkout Simulation</h1>
                            <p className="text-sm text-zinc-500">Mock payment flow for testing.</p>
                        </div>
                    </div>

                    <form id="checkout-form" className="mt-6 space-y-6" onSubmit={onSubmit}>
                        <div className="space-y-4">
                            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Customer Details</h2>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-zinc-500 uppercase">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                                        <input
                                            className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900"
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                            required
                                            placeholder="customer@example.com"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-zinc-500 uppercase">Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                                        <input
                                            className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900"
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                            required
                                            placeholder="John Doe"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                         <div className="space-y-4">
                            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Payment Method (Mock)</h2>
                            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                                <div className="flex gap-4">
                                     <div className="space-y-1 flex-1">
                                        <label className="text-xs font-medium text-zinc-500 uppercase">Card Brand</label>
                                        <input
                                            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-black"
                                            type="text"
                                            value={form.brand}
                                            onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1 flex-1">
                                        <label className="text-xs font-medium text-zinc-500 uppercase">Last 4 Digits</label>
                                        <input
                                            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-black"
                                            type="text"
                                            maxLength={4}
                                            value={form.last4}
                                            onChange={(e) => setForm((f) => ({ ...f, last4: e.target.value }))}
                                            required
                                        />
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-zinc-500 flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" /> No real card data is processed.
                                </p>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        {result && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/30">
                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
                                    <CheckCircle2 className="h-4 w-4" /> Payment Simulated Successfully
                                </div>
                                <pre className="mt-2 overflow-auto rounded bg-white/50 p-2 text-xs text-emerald-800 dark:bg-black/20 dark:text-emerald-300">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </div>
                        )}
                    </form>
                </div>
            </div>

            {/* Sidebar Summary */}
            <div className="lg:col-span-1">
                 <div className="sticky top-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Order Summary</h2>
                    
                    <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                             <label className="text-xs font-medium text-zinc-500 uppercase">Selected Plan</label>
                             <select
                                className="h-10 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-indigo-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                                value={form.seats}
                                onChange={(e) => setForm((f) => ({ ...f, seats: Number(e.target.value) as 1 | 3 }))}
                            >
                                <option value={1}>Annual (1 License)</option>
                                <option value={3}>Annual (3 Licenses)</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
                            <span className="text-sm text-zinc-500">Total Due</span>
                            <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">${amountEur}</span>
                        </div>

                        <button
                            form="checkout-form"
                            type="submit"
                            disabled={loading}
                            className="w-full flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 font-medium text-white transition-all hover:bg-zinc-800 disabled:opacity-70 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay Now"}
                        </button>
                    </div>
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
}
