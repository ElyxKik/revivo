"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, DollarSign, Package, User, Shield } from "lucide-react";

interface TransactionDetail {
  id: string;
  provider?: string;
  email: string;
  seats: number;
  amount: number;
  currency: string;
  status: string;
  mode: string;
  createdAt: any;
  currentPeriodEnd?: any;
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
  stripeEventId?: string;
  stripeCustomerId?: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  stripePaymentIntentId?: string;
  providerEventId?: string;
  chariowSaleId?: string;
  chariowProductId?: string;
}

function TransactionDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTransaction = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const transactionId = searchParams.get("id");
        if (!transactionId) {
          setError("Transaction ID not provided");
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/admin/get-transaction?id=${transactionId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
          throw new Error(`Failed to load transaction: ${res.status}`);
        }

        const data = await res.json();
        setTransaction(data);
      } catch (err: any) {
        setError(err?.message || "Failed to load transaction");
      } finally {
        setLoading(false);
      }
    };

    loadTransaction();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-white">Chargement...</div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-red-400">{error || "Transaction non trouvée"}</div>
      </div>
    );
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "pending":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "refunded":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const getModeColor = (mode: string) => {
    return mode === "live" ? "bg-purple-500/20 text-purple-400" : "bg-orange-500/20 text-orange-400";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-300" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Détail de la Transaction</h1>
            <p className="text-slate-400 mt-1">ID: {transaction.id}</p>
          </div>
        </div>

        {/* Status and Mode */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`p-4 rounded-lg border ${getStatusColor(transaction.status)}`}>
            <div className="text-sm font-medium opacity-75">Statut</div>
            <div className="text-2xl font-bold capitalize mt-1">{transaction.status}</div>
          </div>
          <div className={`p-4 rounded-lg ${getModeColor(transaction.mode)}`}>
            <div className="text-sm font-medium opacity-75">Mode</div>
            <div className="text-2xl font-bold capitalize mt-1">{transaction.mode}</div>
          </div>
        </div>

        {/* Payment Information */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Informations de Paiement
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-slate-400">Montant</div>
              <div className="text-2xl font-bold text-white mt-1">
                {transaction.amount} {transaction.currency.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Nombre de Sièges</div>
              <div className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
                <Package className="w-5 h-5" />
                {transaction.seats}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">Date de Création</div>
              <div className="text-sm text-white mt-1">{formatDate(transaction.createdAt)}</div>
            </div>
            {transaction.currentPeriodEnd && (
              <div>
                <div className="text-sm text-slate-400">Valide Jusqu'au</div>
                <div className="text-sm text-white mt-1">{formatDate(transaction.currentPeriodEnd)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Informations Client
          </h2>
          {transaction.customerDetails ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm text-slate-400">Nom</div>
                  <div className="text-white font-medium">{transaction.customerDetails.name || "Non fourni"}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm text-slate-400">Email</div>
                  <div className="text-white font-medium">{transaction.customerDetails.email || "Non fourni"}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm text-slate-400">Téléphone</div>
                  <div className="text-white font-medium">{transaction.customerDetails.phone || "Non fourni"}</div>
                </div>
              </div>
              {transaction.customerDetails.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm text-slate-400">Adresse</div>
                    <div className="text-white font-medium">
                      {transaction.customerDetails.address.line1 || ""}
                      {transaction.customerDetails.address.line2 && (
                        <>
                          <br />
                          {transaction.customerDetails.address.line2}
                        </>
                      )}
                      {(transaction.customerDetails.address.line1 || transaction.customerDetails.address.line2) && <br />}
                      {transaction.customerDetails.address.postal_code} {transaction.customerDetails.address.city}
                      {transaction.customerDetails.address.state && `, ${transaction.customerDetails.address.state}`}
                      {(transaction.customerDetails.address.city || transaction.customerDetails.address.postal_code) && <br />}
                      {transaction.customerDetails.address.country || ""}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">Aucune information client disponible</div>
          )}
        </div>

        {/* Payment Method */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Méthode de Paiement
          </h2>
          {transaction.paymentMethod ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-slate-400">Type</div>
                <div className="text-white font-medium capitalize mt-1">{transaction.paymentMethod.type || "Non fourni"}</div>
              </div>
              {transaction.paymentMethod.card ? (
                <div className="bg-slate-700/50 rounded p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-slate-400">Marque</div>
                      <div className="text-white font-medium capitalize">{transaction.paymentMethod.card.brand || "Non fourni"}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Derniers Chiffres</div>
                      <div className="text-white font-medium">{transaction.paymentMethod.card.last4 ? `•••• ${transaction.paymentMethod.card.last4}` : "Non fourni"}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Expiration</div>
                    <div className="text-white font-medium">
                      {transaction.paymentMethod.card.exp_month && transaction.paymentMethod.card.exp_year
                        ? `${String(transaction.paymentMethod.card.exp_month).padStart(2, "0")}/${transaction.paymentMethod.card.exp_year}`
                        : "Non fourni"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-400 text-sm">Aucune information de carte disponible</div>
              )}
            </div>
          ) : (
            <div className="text-slate-400 text-sm">Aucune méthode de paiement disponible</div>
          )}
        </div>

        {/* Payment provider references */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Références {transaction.provider || "stripe"}
          </h2>
          <div className="space-y-3 text-sm">
            <div><div className="text-slate-400">Provider</div><div className="text-slate-300 font-semibold capitalize">{transaction.provider || "stripe"}</div></div>
            {transaction.chariowSaleId && <div><div className="text-slate-400">Chariow Sale ID</div><div className="text-slate-300 font-mono break-all">{transaction.chariowSaleId}</div></div>}
            {transaction.chariowProductId && <div><div className="text-slate-400">Chariow Product ID</div><div className="text-slate-300 font-mono break-all">{transaction.chariowProductId}</div></div>}
            {transaction.providerEventId && <div><div className="text-slate-400">Provider Event ID</div><div className="text-slate-300 font-mono break-all">{transaction.providerEventId}</div></div>}
            {transaction.stripeEventId && (
              <div>
                <div className="text-slate-400">Event ID</div>
                <div className="text-slate-300 font-mono break-all">{transaction.stripeEventId}</div>
              </div>
            )}
            {transaction.stripeCustomerId && (
              <div>
                <div className="text-slate-400">Customer ID</div>
                <div className="text-slate-300 font-mono break-all">{transaction.stripeCustomerId}</div>
              </div>
            )}
            {transaction.stripeSessionId && (
              <div>
                <div className="text-slate-400">Session ID</div>
                <div className="text-slate-300 font-mono break-all">{transaction.stripeSessionId}</div>
              </div>
            )}
            {transaction.stripeSubscriptionId && (
              <div>
                <div className="text-slate-400">Subscription ID</div>
                <div className="text-slate-300 font-mono break-all">{transaction.stripeSubscriptionId}</div>
              </div>
            )}
            {transaction.stripePaymentIntentId && (
              <div>
                <div className="text-slate-400">Payment Intent ID</div>
                <div className="text-slate-300 font-mono break-all">{transaction.stripePaymentIntentId}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransactionDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800"><div className="text-white">Chargement...</div></div>}>
      <TransactionDetailContent />
    </Suspense>
  );
}
