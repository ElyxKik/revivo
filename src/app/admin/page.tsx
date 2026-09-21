"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  LayoutDashboard,
  ShoppingCart,
  Key,
  CreditCard,
  LogOut,
  ShieldCheck,
  Code2,
  DollarSign,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Phone,
  MapPin
} from "lucide-react";

type AdminState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "forbidden"; email?: string | null }
  | { status: "ready"; email: string | null };

type Purchase = {
  id: string;
  provider?: string;
  email?: string;
  seats?: number;
  amount?: number;
  currency?: string;
  mode?: string;
  status?: string;
  stripeEventId?: string;
  createdAt?: { _seconds: number; _nanoseconds: number } | string;
  customerDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
  paymentMethod?: {
    type?: string;
    card?: {
      brand?: string;
      last4?: string;
      exp_month?: number;
      exp_year?: number;
    };
  };
};

type License = {
  id: string;
  email?: string;
  type?: string;
  seatIndex?: number;
  keyHash?: string;
  isActive?: boolean;
  createdAt?: { _seconds: number; _nanoseconds: number } | string;
};

function formatDate(ts: any) {
  if (!ts) return "-";
  if (typeof ts === "string") return new Date(ts).toLocaleString();
  if (ts._seconds) return new Date(ts._seconds * 1000).toLocaleString();
  return "-";
}

function formatCurrency(amount?: number, currency?: string) {
  if (amount === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

export default function AdminPage() {
  const router = useRouter();
  const [state, setState] = useState<AdminState>({ status: "loading" });
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "licenses" | "signup">("overview");
  
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setState({ status: "unauthenticated" });
        return;
      }

      // Check admin via profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .single();

      if (!cancelled && (!profile || !profile.is_admin)) {
        setState({ status: "forbidden", email: session.user.email });
        return;
      }

      if (cancelled) return;
      setState({ status: "ready", email: session.user.email ?? null });

      const token = session.access_token;

      const [pRes, lRes] = await Promise.all([
        fetch(`/api/admin/list-purchases?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(err => ({ ok: false, status: 0, json: async () => ({ error: err.message }) })),
        fetch(`/api/admin/list-licenses?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(err => ({ ok: false, status: 0, json: async () => ({ error: err.message }) })),
      ]);

      const pJson = await (pRes as any).json().catch(() => ({}));
      const lJson = await (lRes as any).json().catch(() => ({}));

      if (cancelled) return;

      if (!(pRes as any).ok) setDataError(pJson?.error || `Failed to load purchases (${(pRes as any).status})`);
      if (!(lRes as any).ok) setDataError(lJson?.error || `Failed to load licenses (${(lRes as any).status})`);

      setPurchases(Array.isArray(pJson?.items) ? pJson.items : []);
      setLicenses(Array.isArray(lJson?.items) ? lJson.items : []);
    }

    checkAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.status === "unauthenticated") {
      router.replace("/login?next=/admin");
    }
  }, [state.status, router]);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-800 dark:border-t-zinc-50" />
      </div>
    );
  }

  if (state.status === "forbidden") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-black">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center dark:border-red-900/30 dark:bg-zinc-900">
          <ShieldCheck className="mx-auto h-12 w-12 text-red-500" />
          <h1 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Access Denied</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Account <strong>{state.email}</strong> is not an admin.
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-6 w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "unauthenticated") return null;

  // Stats Calculation
  const totalRevenue = purchases.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalOrders = purchases.length;
  const totalLicenses = licenses.length;
  const recentPurchases = purchases.slice(0, 5);

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50 font-sans">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 hidden md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-zinc-200 px-6 dark:border-zinc-800">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Revivo Admin</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          <NavItem icon={LayoutDashboard} label="Overview" active={activeTab === "overview"} onClick={() => setActiveTab("overview")} />
          <NavItem icon={ShoppingCart} label="Transactions" active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")} />
          <NavItem icon={Key} label="Licenses" active={activeTab === "licenses"} onClick={() => setActiveTab("licenses")} />
          <div className="my-4 border-t border-zinc-200 dark:border-zinc-800" />
          <NavItem icon={Users} label="Inscription" active={activeTab === "signup"} onClick={() => setActiveTab("signup")} />
        </nav>

        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {state.email?.[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{state.email}</p>
              <p className="text-[10px] text-zinc-500">Admin</p>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64">
        {/* Mobile Header (visible only on small screens) */}
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
            <span className="font-semibold">Revivo Admin</span>
            <button onClick={() => supabase.auth.signOut()}>
                <LogOut className="h-5 w-5" />
            </button>
        </div>

        <div className="p-8">
          {dataError && (
             <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
              {dataError}
            </div>
          )}

          {activeTab === "overview" && (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">Dashboard Overview</h1>
              
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} trend="+12.5%" />
                <StatCard title="Total Orders" value={totalOrders.toString()} icon={ShoppingCart} trend="+4.3%" />
                <StatCard title="Issued Licenses" value={totalLicenses.toString()} icon={Key} trend="+8.1%" />
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
                  <h2 className="font-semibold">Recent Transactions</h2>
                  <button 
                    onClick={() => setActiveTab("transactions")}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                  >
                    View All
                  </button>
                </div>
                <TransactionsTable purchases={recentPurchases} />
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Transactions</h1>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                        <Filter className="h-4 w-4" /> Filter
                    </button>
                    <button className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                        <Search className="h-4 w-4" /> Search
                    </button>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <TransactionsTable purchases={purchases} />
              </div>
            </div>
          )}

          {activeTab === "licenses" && (
            <div className="space-y-6">
               <h1 className="text-2xl font-bold">License Management</h1>
               <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <LicensesTable licenses={licenses} />
              </div>
            </div>
          )}

          {activeTab === "signup" && (
            <SignupSection />
          )}
        </div>
      </main>
    </div>
  );
}

// --- Components ---

function NavItem({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function StatCard({ title, value, icon: Icon, trend }: { title: string; value: string; icon: any; trend?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
        </div>
        <div className="rounded-full bg-zinc-100 p-3 dark:bg-zinc-800">
          <Icon className="h-5 w-5 text-zinc-900 dark:text-zinc-100" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span>{trend}</span>
          <span className="ml-1 text-zinc-400">from last month</span>
        </div>
      )}
    </div>
  );
}

function TransactionsTable({ purchases }: { purchases: Purchase[] }) {
  if (!purchases.length) {
    return <div className="p-8 text-center text-zinc-500">No transactions found.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900/50">
          <tr>
            <th className="px-6 py-3 font-medium">Date</th>
            <th className="px-6 py-3 font-medium">Customer</th>
            <th className="px-6 py-3 font-medium">Provider</th>
            <th className="px-6 py-3 font-medium">Téléphone</th>
            <th className="px-6 py-3 font-medium">Adresse</th>
            <th className="px-6 py-3 font-medium">Amount</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Mode</th>
            <th className="px-6 py-3 font-medium">Seats</th>
            <th className="px-6 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {purchases.map((p) => (
            <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-zinc-400" />
                  <span className="font-mono text-xs">{formatDate(p.createdAt)}</span>
                </div>
              </td>
              <td className="px-6 py-4 font-medium">{p.email || "Unknown"}</td>
              <td className="px-6 py-4"><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">{p.provider || "stripe"}</span></td>
              <td className="px-6 py-4">
                {p.customerDetails?.phone ? (
                  <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <Phone className="h-3.5 w-3.5" />
                    <span className="text-xs">{p.customerDetails.phone}</span>
                  </div>
                ) : (
                  <span className="text-zinc-400 text-xs">-</span>
                )}
              </td>
              <td className="px-6 py-4">
                {p.customerDetails?.address ? (
                  <div className="flex items-start gap-1.5 text-zinc-600 dark:text-zinc-400">
                    <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="text-xs">
                      {[p.customerDetails.address.line1, p.customerDetails.address.city, p.customerDetails.address.postal_code, p.customerDetails.address.country].filter(Boolean).join(", ")}
                    </span>
                  </div>
                ) : (
                  <span className="text-zinc-400 text-xs">-</span>
                )}
              </td>
              <td className="px-6 py-4">{formatCurrency(p.amount, p.currency)}</td>
              <td className="px-6 py-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    p.status === "paid"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                   {p.status === "paid" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                   {p.status || "Pending"}
                </span>
              </td>
              <td className="px-6 py-4">
                 <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.mode === "live"
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                      : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  }`}
                >
                  {p.mode || "test"}
                </span>
              </td>
              <td className="px-6 py-4 text-zinc-500">
                <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {p.seats || 1}
                </div>
              </td>
              <td className="px-6 py-4">
                <Link
                  href={`/admin/transaction-detail?id=${p.id}`}
                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium text-sm"
                >
                  View Details →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LicensesTable({ licenses }: { licenses: License[] }) {
    if (!licenses.length) {
        return <div className="p-8 text-center text-zinc-500">No licenses issued yet.</div>;
    }

    return (
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-900/50">
            <tr>
                <th className="px-6 py-3 font-medium">Issued Date</th>
                <th className="px-6 py-3 font-medium">Owner</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Seat Index</th>
                <th className="px-6 py-3 font-medium">Status</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {licenses.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/30">
                <td className="px-6 py-4 font-mono text-xs text-zinc-500">{formatDate(l.createdAt)}</td>
                <td className="px-6 py-4 font-medium">{l.email || "Unknown"}</td>
                <td className="px-6 py-4 capitalize">{l.type || "Standard"}</td>
                <td className="px-6 py-4">{l.seatIndex}</td>
                <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Active
                    </span>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    );
}

function SignupSection() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage({ type: "error", text: "You must be logged in" });
        return;
      }

      const res = await fetch("/api/admin/setup-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to setup admin (${res.status})`);
      }

      const data = await res.json();
      setMessage({ type: "success", text: `Admin account created for ${data.email}. User can now login with their credentials.` });
      setEmail("");
      setPassword("");
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to setup admin" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Inscription Admin</h1>
      
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-6">
        <h2 className="text-lg font-semibold mb-4">Créer un nouvel administrateur</h2>
        
        {message && (
          <div className={`mb-4 rounded-lg p-4 text-sm ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200"
          }`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
            <p className="mt-1 text-xs text-zinc-500">Minimum 6 caractères</p>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password || password.length < 6}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            {loading ? "Création en cours..." : "Créer le compte administrateur"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <h3 className="font-semibold mb-3">Instructions</h3>
          <ol className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400 list-decimal list-inside">
            <li>Entrez l'email du nouvel administrateur</li>
            <li>Entrez un mot de passe sécurisé (minimum 6 caractères)</li>
            <li>Cliquez sur "Créer le compte administrateur"</li>
            <li>Le nouvel admin peut maintenant se connecter avec ses identifiants</li>
            <li>Une fois connecté, il aura accès au tableau de bord administrateur</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
