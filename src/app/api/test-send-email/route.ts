import { NextRequest, NextResponse } from "next/server";
import { sendLicenseEmail, sendPrivacyAlertEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const providedSecret = req.headers.get("X-Test-Secret");
  const expectedSecret = process.env.TEST_WEBHOOK_SECRET;
  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  const keys = Array.isArray(body.keys) ? body.keys : ["TEST-KEY-001", "TEST-KEY-002"];
  const seats = Number(body.seats) || keys.length;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  try {
    if (body.template === "privacy-alert") {
      const verifiedFindings = Array.isArray(body.verifiedFindings)
        ? body.verifiedFindings.map((finding: unknown) => String(finding).trim()).filter(Boolean)
        : [];
      if (body.analysisConfirmed !== true || verifiedFindings.length === 0) {
        return NextResponse.json(
          { error: "A confirmed analysis and at least one verified finding are required" },
          { status: 400 },
        );
      }

      await sendPrivacyAlertEmail({
        to: email,
        firstName: typeof body.firstName === "string" ? body.firstName : undefined,
        trackerCount: typeof body.trackerCount === "number" ? body.trackerCount : undefined,
        verifiedFindings,
        offerName: "Zecleaner",
        checkoutUrl: "https://zecleaner.com/internet-protector.html#offres",
      });
      return NextResponse.json({ ok: true, message: `Privacy alert email sent to ${email}` });
    }

    await sendLicenseEmail({ to: email, keys, seats, amountEur: body.amountEur });
    return NextResponse.json({ ok: true, message: `Email sent to ${email}` });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to send email" }, { status: 500 });
  }
}
