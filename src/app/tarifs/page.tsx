"use client";

export const dynamic = "force-dynamic";

import { CheckCircle2, Shield, CreditCard, RotateCcw } from "lucide-react";

const plans = [
  {
    name: "Solo",
    badge: "1 Licence — 2 ans",
    price: "$159",
    period: "/ 2 ans",
    subtitle: "Moins de $7 / mois",
    seats: 1,
    duration: "2 ans",
    features: [
      "1 PC Windows",
      "Nettoyage en profondeur",
      "Démarrage accéléré",
      "Vie privée protégée",
      "Toutes les mises à jour",
      "Support prioritaire",
    ],
    url: "https://buy.stripe.com/fZu5kDbhdaEY5NE3bc5EY07",
    highlight: false,
  },
  {
    name: "Famille / Pro",
    badge: "3 Licences — 2 ans",
    price: "$199",
    period: "/ 2 ans",
    subtitle: "Économisez $161",
    seats: 3,
    duration: "2 ans",
    features: [
      "3 PC Windows",
      "Toutes les fonctionnalités",
      "Nettoyage avancé",
      "Vie privée protégée",
      "Mises à jour incluses",
      "Support VIP",
    ],
    url: "https://buy.stripe.com/8x2aEXbhdeVe0tkh225EY05",
    highlight: true,
  },
  {
    name: "Solo",
    badge: "1 Licence — 3 ans",
    price: "$249",
    period: "/ 3 ans",
    subtitle: "Moins de $7 / mois",
    seats: 1,
    duration: "3 ans",
    features: [
      "1 PC Windows",
      "Nettoyage en profondeur",
      "Démarrage accéléré",
      "Vie privée protégée",
      "Toutes les mises à jour",
      "Support prioritaire",
    ],
    url: "https://buy.stripe.com/5kQeVd4SP6oIekaeTU5EY06",
    highlight: false,
  },
  {
    name: "Famille / Pro",
    badge: "3 Licences — 3 ans",
    price: "$299",
    period: "/ 3 ans",
    subtitle: "Économisez $261",
    seats: 3,
    duration: "3 ans",
    features: [
      "3 PC Windows",
      "Toutes les fonctionnalités",
      "Nettoyage avancé",
      "Vie privée protégée",
      "Mises à jour incluses",
      "Support VIP",
    ],
    url: "https://buy.stripe.com/8x2eVd99528s4JA3bc5EY04",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <a href="/" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            ← Retour
          </a>
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-7xl px-6 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Choisissez votre formule
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Protégez et optimisez votre PC avec Zecleaner
        </p>
      </div>

      {/* Plans grid */}
      <div className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                plan.highlight
                  ? "border-indigo-500 bg-white shadow-lg dark:border-indigo-400 dark:bg-zinc-950"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                  Meilleure offre
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{plan.badge}</p>
              </div>

              <div className="mb-2">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">{plan.period}</span>
              </div>
              <p className="mb-6 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {plan.subtitle}
              </p>

              <ul className="mb-6 space-y-3 flex-1">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                    <span className="text-zinc-700 dark:text-zinc-300">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full rounded-lg px-4 py-3 text-center text-sm font-medium transition-colors ${
                  plan.highlight
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                }`}
              >
                Choisir
              </a>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <RotateCcw className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-sm font-medium">14 jours satisfait ou remboursé</p>
              <p className="text-xs text-zinc-500">Testez sans risque</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <CreditCard className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-sm font-medium">Paiement sécurisé</p>
              <p className="text-xs text-zinc-500">Via Stripe</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            <div>
              <p className="text-sm font-medium">Vie privée protégée</p>
              <p className="text-xs text-zinc-500">Aucune donnée revendue</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
