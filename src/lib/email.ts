import { Resend } from "resend";

export type LicenseEmailArgs = {
  to: string;
  keys: string[];
  seats: number;
  amount?: number;
  currency?: string;
  orderId?: string;
  productName?: string;
  durationYears?: number;
  validUntil?: string;
  invoiceUrl?: string;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(amount);
}

export async function sendLicenseEmail(args: LicenseEmailArgs & { amountEur?: number }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || "Zecleaner <no-reply@zecleaner.com>";

  const subject = args.seats === 1 ? "Votre clé Zecleaner" : "Vos clés Zecleaner";
  const keysBlock = args.keys.map((k, idx) => `${idx + 1}. ${k}`).join("\n");
  const amount = typeof args.amount === "number" ? args.amount : args.amountEur;
  const currency = args.currency || "EUR";
  const amountLabel = typeof amount === "number" ? formatMoney(amount, currency) : undefined;
  const validUntilLabel = args.validUntil ? new Date(args.validUntil).toLocaleDateString("fr-FR") : undefined;

  const text =
    `Merci pour votre achat.\n\n` +
    `Nombre de clés: ${args.seats}\n` +
    (args.orderId ? `Commande: ${args.orderId}\n` : "") +
    (args.productName ? `Produit: ${args.productName}\n` : "") +
    (amountLabel ? `Montant: ${amountLabel}\n` : "") +
    (validUntilLabel ? `Valide jusqu’au: ${validUntilLabel}\n` : "") +
    `\nClé(s):\n${keysBlock}\n`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .logo { height: 60px; margin-bottom: 15px; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; font-size: 16px; opacity: 0.9; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: 600; color: #667eea; margin-bottom: 10px; }
    .keys-box { background: white; border: 2px solid #667eea; border-radius: 6px; padding: 20px; margin-top: 10px; }
    .key-item { background: #f0f4ff; padding: 12px; margin-bottom: 10px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 13px; word-break: break-all; }
    .key-item:last-child { margin-bottom: 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .info-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: #667eea; }
    .value { color: #333; }
    .footer { text-align: center; padding-top: 20px; font-size: 12px; color: #999; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 15px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <svg class="logo" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ffffff;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#f0f4ff;stop-opacity:1" />
          </linearGradient>
        </defs>
        <text x="10" y="45" font-size="40" font-weight="bold" fill="url(#logoGradient)">Zecleaner</text>
      </svg>
      <p>Vos clés de licence</p>
    </div>
    <div class="content">
      <p>Merci pour votre achat! Voici vos clés de licence Zecleaner.</p>
      
      <div class="section">
        <div class="section-title">📋 Détails de votre commande</div>
        <div class="info-row">
          <span class="label">Nombre de clés:</span>
          <span class="value">${args.seats}</span>
        </div>
        ${args.orderId ? `<div class="info-row"><span class="label">Commande:</span><span class="value">${escapeHtml(args.orderId)}</span></div>` : ""}
        ${args.productName ? `<div class="info-row"><span class="label">Produit:</span><span class="value">${escapeHtml(args.productName)}</span></div>` : ""}
        ${amountLabel ? `
        <div class="info-row">
          <span class="label">Montant:</span>
          <span class="value">${escapeHtml(amountLabel)}</span>
        </div>
        ` : ""}
        ${validUntilLabel ? `<div class="info-row"><span class="label">Valide jusqu’au:</span><span class="value">${escapeHtml(validUntilLabel)}</span></div>` : ""}
      </div>

      <div class="section">
        <div class="section-title">🔑 Vos clés de licence</div>
        <div class="keys-box">
          ${args.keys.map((k, idx) => `<div class="key-item"><strong>Clé ${idx + 1}:</strong> ${k}</div>`).join("")}
        </div>
      </div>

      <div class="section">
        <p style="font-size: 14px; color: #666;">
          <strong>Comment utiliser vos clés?</strong><br>
          Utilisez ces clés pour activer Zecleaner sur vos appareils. Chaque clé peut être utilisée sur un appareil à la fois.
        </p>
      </div>

      <div style="text-align: center;">
        <a href="https://zecleaner.com" class="cta-button">Accéder à Zecleaner</a>
        ${args.invoiceUrl ? `<br><a href="${escapeHtml(args.invoiceUrl)}" style="display:inline-block;margin-top:14px;color:#4f46e5;">Télécharger la facture Chariow</a>` : ""}
      </div>

      <div class="footer">
        <p>Si vous avez des questions, contactez-nous à contact@zecleaner.com</p>
        <p>&copy; 2026 Zecleaner. Tous droits réservés.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const result = await resend.emails.send({ from, to: args.to, subject, html, text });
  if (result.error) throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  return result.data;
}

export type PrivacyAlertEmailArgs = {
  to: string;
  firstName?: string;
  trackerCount?: number;
  verifiedFindings?: string[];
  offerName: string;
  checkoutUrl: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] || character);
}

export async function sendPrivacyAlertEmail(args: PrivacyAlertEmailArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");

  let checkoutUrl: URL;
  try {
    checkoutUrl = new URL(args.checkoutUrl);
  } catch {
    throw new Error("Invalid checkout URL");
  }
  if (checkoutUrl.protocol !== "https:") throw new Error("Checkout URL must use HTTPS");

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || "Zecleaner <no-reply@zecleaner.com>";
  const subject = "⚠️ Alerte confidentialité — vos données personnelles circulent peut-être à votre insu";
  const firstName = args.firstName?.trim();
  const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
  const offerName = args.offerName.trim() || "Zecleaner";
  const trackerFinding = typeof args.trackerCount === "number" && args.trackerCount >= 0
    ? `${Math.floor(args.trackerCount)} traceurs et bots de collecte détectés sur votre machine ou votre navigateur`
    : null;
  const findings = [trackerFinding, ...(args.verifiedFindings || [])]
    .filter((finding): finding is string => Boolean(finding?.trim()));

  if (findings.length === 0) {
    throw new Error("At least one verified privacy finding is required");
  }

  const risks = [
    "du profilage publicitaire intensif",
    "des tentatives de phishing ciblé",
    "de l’usurpation d’identité",
    "du démarchage agressif",
    "la revente à des courtiers de données",
  ];
  const benefits = [
    "Protection en temps réel 24/7 : blocage des traqueurs, bots et connexions suspectes.",
    "Suppression et désindexation : accompagnement pour les demandes de suppression ou d’opposition auprès des sites, courtiers et régies publicitaires, lorsque la loi le permet.",
    "Surveillance continue : alertes lorsqu’une nouvelle exposition est détectée.",
    "Inclus directement dans le logiciel Zecleaner.",
    "Assistance prioritaire : un expert vous accompagne pas à pas.",
  ];

  const text = `${greeting}

Dans le cadre de l’analyse de cybersécurité réalisée avec Zecleaner sur votre appareil, nous avons identifié les éléments suivants :

${findings.map((finding) => `- ${finding}`).join("\n")}

Selon leur nature, ces données peuvent favoriser :

${risks.map((risk) => `- ${risk}`).join("\n")}

Votre vie privée ne devrait pas être une marchandise. Vous pouvez reprendre le contrôle.

Découvrez l’offre ${offerName} Protection Privée :

${benefits.map((benefit) => `✓ ${benefit}`).join("\n")}

Je me protège maintenant : ${checkoutUrl.toString()}

© 2026 Zecleaner. Tous droits réservés.`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#172033;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Consultez les constats de l’analyse de confidentialité Zecleaner.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:28px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 16px 45px rgba(30,41,59,.10);">
      <tr><td style="padding:34px 36px;background:linear-gradient(135deg,#1e1b4b,#312e81 55%,#1e3a8a);color:#ffffff;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#c7d2fe;margin-bottom:12px;">Zecleaner · Rapport de confidentialité</div>
        <h1 style="margin:0;font-size:27px;line-height:1.25;">⚠️ Vos données personnelles circulent peut-être à votre insu</h1>
      </td></tr>
      <tr><td style="padding:34px 36px;">
        <p style="margin:0 0 18px;font-size:16px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 22px;line-height:1.65;color:#475569;">Dans le cadre de l’analyse de cybersécurité réalisée avec Zecleaner sur votre appareil, nous avons identifié plusieurs éléments qui méritent votre attention :</p>
        <div style="padding:18px 20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;margin-bottom:28px;">
          <ul style="margin:0;padding-left:21px;color:#7c2d12;line-height:1.7;">${findings.map((finding) => `<li style="margin:5px 0;">${escapeHtml(finding)}</li>`).join("")}</ul>
        </div>
        <h2 style="font-size:18px;margin:0 0 12px;">Quels sont les risques ?</h2>
        <ul style="padding-left:21px;margin:0 0 28px;color:#475569;line-height:1.7;">${risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>
        <div style="padding:20px;background:#eef2ff;border-radius:14px;margin-bottom:28px;">
          <p style="margin:0;color:#312e81;font-size:17px;font-weight:700;line-height:1.5;">Votre vie privée ne devrait pas être une marchandise. Vous pouvez reprendre le contrôle.</p>
        </div>
        <h2 style="font-size:20px;margin:0 0 16px;">${escapeHtml(offerName)} Protection Privée</h2>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${benefits.map((benefit) => `<tr><td valign="top" style="width:26px;padding:5px 0;color:#16a34a;font-weight:700;">✓</td><td style="padding:5px 0;color:#334155;line-height:1.55;">${escapeHtml(benefit)}</td></tr>`).join("")}</table>
        <div style="text-align:center;margin:32px 0 20px;"><a href="${escapeHtml(checkoutUrl.toString())}" style="display:inline-block;padding:15px 25px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:11px;font-weight:800;font-size:16px;">Je me protège maintenant !</a></div>
        <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.55;text-align:center;">&copy; 2026 Zecleaner. Tous droits réservés.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;

  const result = await resend.emails.send({ from, to: args.to, subject, html, text });
  if (result.error) throw new Error(`Resend error: ${JSON.stringify(result.error)}`);
  return result.data;
}
