# Android release (PWA + Trusted Web Activity)

The web application is now installable as a PWA. The Android approach is a Trusted Web Activity (TWA) wrapper generated with the pinned Bubblewrap CLI version `1.25.0`. A release bundle cannot be generated safely until the final HTTPS origin, Android package ID, release signing key, Digital Asset Links fingerprint, merchant identity, and Play billing route are finalized.

## 1. Prerequisites

- Deploy the production PWA over HTTPS and verify `/manifest.webmanifest`, `/service-worker.js`, icons, and the installability checks.
- Install an appropriate JDK and Android SDK on the release workstation.
- Choose a permanent package ID (the default script value is `in.realeducationtime.app`). Do not change it after Play publication.
- Create and protect a release keystore outside the repository. Back it up securely. Never commit the keystore, passwords, service-account JSON, or Play credentials.
- Obtain its SHA-256 certificate fingerprint with `keytool`.

## 2. Generate origin-bound configuration

Set release values in the shell/secret manager:

```bash
export APP_URL="https://YOUR_FINAL_ORIGIN"
export ANDROID_PACKAGE_ID="in.realeducationtime.app"
export ANDROID_SHA256_FINGERPRINT="AA:BB:...:32_BYTES_TOTAL"
export ANDROID_KEYSTORE_PATH="/secure/path/ret-release.keystore"
export ANDROID_KEY_ALIAS="release"
export ANDROID_VERSION_NAME="1.0.0"
export ANDROID_VERSION_CODE="1"
npm run android:configure
```

This creates:

- `android/twa-manifest.json` — Bubblewrap wrapper configuration.
- `public/.well-known/assetlinks.json` — origin-to-app Digital Asset Link.

Deploy again and confirm `https://YOUR_FINAL_ORIGIN/.well-known/assetlinks.json` is public, returns JSON without redirect, and contains the exact Play signing certificate fingerprint. If Play App Signing uses a different app-signing fingerprint, publish that fingerprint as well before release.

## 3. Generate and build the wrapper

Bubblewrap is version-pinned in the scripts but downloaded only for release work, keeping its Android toolchain dependencies out of the web runtime dependency graph.

```bash
cd android
npx --yes @bubblewrap/cli@1.25.0 update --skipVersionUpgrade
npx --yes @bubblewrap/cli@1.25.0 build
```

For the first project generation, use Bubblewrap's interactive `init` against the deployed web manifest, then replace/reconcile the generated `twa-manifest.json` with the script output:

```bash
cd android
npx --yes @bubblewrap/cli@1.25.0 init --manifest="https://YOUR_FINAL_ORIGIN/manifest.webmanifest"
```

Run `bubblewrap update` after any manifest change. Release the generated Android App Bundle (`.aab`), not a debug APK. Test the signed bundle on an internal Play track, including deep links, login, theme, trial timing, gateway return, offline recovery, and upgrade behavior.

## 4. Digital-goods payment boundary

The current web flow uses Razorpay/UPI and is suitable only where the selected Play distribution and Indian alternative-billing program permit it. Before Play submission:

1. Enroll in the applicable Google Play alternative-billing program for India if required.
2. Verify current Google Play Payments policy with counsel and the Play Console; policies and service-fee/reporting requirements can change.
3. If Play Billing is required, add a separate Android purchase path using Play Billing/Digital Goods APIs, verify purchases on the backend, acknowledge them, and map them idempotently to the existing entitlement model.
4. Do not expose an external payment method in a Play-distributed build unless the account, app, geography, disclosures, reporting, and support process are compliant.

`GOOGLE_PLAY` exists as a payment-provider enum but no Play Billing purchase verification endpoint is implemented yet. Therefore a Play production release with in-app digital purchases is **not ready** merely because the TWA shell builds.

## 5. Release gate

- [ ] Final production domain and HTTPS verified.
- [ ] PWA installability and service worker tested; protected HTML is not cached.
- [ ] Release keystore and Play App Signing fingerprints backed up and published in Asset Links.
- [ ] Merchant KYC, legal identity, grievance details, refund handling, and payment webhooks completed.
- [ ] Google Play billing/alternative-billing enrollment and disclosures approved.
- [ ] Data Safety form matches actual account, minor, AI, analytics, and payment processing.
- [ ] Content rights and editorial-review workflow approved.
- [ ] Internal/closed-track testing completed on phone and tablet.
- [ ] Signed AAB archived with version, commit/source snapshot, and release notes.
