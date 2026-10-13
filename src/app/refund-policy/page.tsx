import type { Metadata } from "next";
import Link from "next/link";
import { PolicyShell } from "@/components/policy-shell";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPolicyPage() {
  return <PolicyShell title="Refund Policy" updated="17 August 2026">
    <section><h2>1. Scope</h2><p>This policy applies to Real Education Time&apos;s ₹7 Class 6–12 and ₹9 Board/Competitive one-time digital-access plans. The one-hour email demo is free and has no cash value. This policy supplements non-waivable rights available under applicable consumer law.</p></section>
    <section><h2>2. When to contact us</h2><p>Contact support@realeducationtime.com promptly, preferably within seven calendar days of the transaction, when:</p><ul><li>the same plan was charged more than once;</li><li>a provider-confirmed captured payment did not unlock the correct category;</li><li>the purchased category is materially unavailable because of a verified platform failure; or</li><li>the law otherwise requires a refund.</li></ul><p>Include the account email, date, amount, gateway order/payment identifier or UPI transaction reference, and a description. Never send a UPI PIN, OTP, full card number, CVV, or banking password.</p></section>
    <section><h2>3. Cases that require investigation</h2><p>Changing your mind after successfully using the digital category does not automatically establish a refund, subject always to applicable law. A screenshot, QR scan, or submitted UTR alone does not prove settlement. Static-QR claims remain pending until matched against the receiver&apos;s actual account record. Fraudulent, altered, reused, or third-party transaction references may be rejected and the account may be restricted.</p></section>
    <section><h2>4. Resolution and access</h2><p>We will acknowledge a complete request, investigate provider and platform records, and communicate the decision. If approved, the refund is initiated to the original payment method where technically possible. Bank or provider processing may then take approximately 5–10 business days and is outside our direct control. Refunded, reversed, or charged-back purchases may have the corresponding entitlement revoked.</p></section>
    <section><h2>5. Failed and pending payments</h2><p>If a payment fails before capture, your bank or UPI provider may temporarily show a debit and then reverse it under its own timeline. Real Education Time does not unlock access for an unverified or failed payment. Do not pay again until you check payment history or contact support.</p></section>
    <section><h2>6. Escalation and launch boundary</h2><p>Payment and grievance contact: support@realeducationtime.com. Privacy matters: privacy@realeducationtime.com. Before production collection begins, the responsible merchant&apos;s verified legal identity, address, grievance officer details, and any legally required cancellation/refund disclosures must be added after professional India-specific review.</p><p>See also the <Link href="/terms">Terms of Use</Link> and <Link href="/privacy">Privacy Policy</Link>.</p></section>
  </PolicyShell>;
}
