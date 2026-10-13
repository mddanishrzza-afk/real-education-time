import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const fail = (message) => { console.error(`Android TWA configuration failed: ${message}`); process.exit(1); };
const origin = process.env.APP_URL?.trim();
const packageId = process.env.ANDROID_PACKAGE_ID?.trim() || "in.realeducationtime.app";
const fingerprint = process.env.ANDROID_SHA256_FINGERPRINT?.trim().toUpperCase();
const keyPath = process.env.ANDROID_KEYSTORE_PATH?.trim() || "./android.keystore";
const keyAlias = process.env.ANDROID_KEY_ALIAS?.trim() || "release";
const versionName = process.env.ANDROID_VERSION_NAME?.trim() || "1.0.0";
const versionCode = Number(process.env.ANDROID_VERSION_CODE || 1);

if (!origin) fail("APP_URL is required");
let appUrl;
try { appUrl = new URL(origin); } catch { fail("APP_URL must be an absolute URL"); }
if (appUrl.protocol !== "https:" || appUrl.pathname !== "/" || appUrl.search || appUrl.hash) fail("APP_URL must be a path-free HTTPS origin");
if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(packageId)) fail("ANDROID_PACKAGE_ID must be a reverse-domain Android application ID");
if (!fingerprint || !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint)) fail("ANDROID_SHA256_FINGERPRINT must be the 32-byte SHA-256 signing fingerprint separated by colons");
if (!Number.isInteger(versionCode) || versionCode < 1) fail("ANDROID_VERSION_CODE must be a positive integer");

const manifest = {
  packageId,
  host: appUrl.host,
  name: "Real Education Time",
  launcherName: "RET Learn",
  display: "standalone",
  themeColor: "#5B43D6",
  themeColorDark: "#1F1853",
  navigationColor: "#F7F7FC",
  navigationColorDark: "#111024",
  navigationDividerColor: "#E7E4F4",
  navigationDividerColorDark: "#2C2948",
  backgroundColor: "#F7F7FC",
  enableNotifications: false,
  startUrl: "/?source=android",
  iconUrl: `${origin}/icons/icon-512.png`,
  maskableIconUrl: `${origin}/icons/maskable-512.png`,
  splashScreenFadeOutDuration: 300,
  signingKey: { path: keyPath, alias: keyAlias },
  appVersionName: versionName,
  appVersionCode: versionCode,
  shortcuts: [],
  generatorApp: "bubblewrap-cli",
  webManifestUrl: `${origin}/manifest.webmanifest`,
  fallbackType: "customtabs",
  features: {},
  alphaDependencies: { enabled: false },
  enableSiteSettingsShortcut: true,
  isChromeOSOnly: false,
  orientation: "default",
  fingerprints: [{ value: fingerprint }],
  additionalTrustedOrigins: [],
  retainedBundles: [],
};
const assetLinks = [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: packageId, sha256_cert_fingerprints: [fingerprint] } }];

await mkdir("android", { recursive: true });
await mkdir(path.join("public", ".well-known"), { recursive: true });
await writeFile(path.join("android", "twa-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join("public", ".well-known", "assetlinks.json"), `${JSON.stringify(assetLinks, null, 2)}\n`);
console.log(`Android TWA configured for ${origin} (${packageId}, version ${versionName}/${versionCode}).`);
console.log("Generated android/twa-manifest.json and public/.well-known/assetlinks.json. Keep the signing keystore and passwords outside source control.");
