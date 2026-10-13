/**
 * First-deploy seeding for a fresh production database.
 *
 * The production build is fail-closed and never seeds silently: this script only runs the
 * idempotent seed when RUN_SEED_ON_FIRST_DEPLOY="true" is present in the build environment.
 * Set that variable for the very first deploy so the catalog (boards, classes, subjects,
 * chapters, topics, concepts, questions and plans) exists, then remove it — later deploys
 * skip seeding entirely and cannot touch live rows.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

if ((process.env.RUN_SEED_ON_FIRST_DEPLOY || "").trim().toLowerCase() !== "true") {
  console.log("[maybe-seed] RUN_SEED_ON_FIRST_DEPLOY is not true — skipping seed.");
  process.exit(0);
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error("[maybe-seed] DATABASE_URL is missing, so seeding cannot run.");
  process.exit(1);
}

console.log("[maybe-seed] RUN_SEED_ON_FIRST_DEPLOY=true — running the idempotent catalog seed (SEED_DEMO_DATA=false).");
const localBin = existsSync("node_modules/.bin/tsx") ? "node_modules/.bin/tsx" : null;
const command = localBin ?? "npx";
const args = localBin ? ["prisma/seed.ts"] : ["--yes", "tsx@4.19.3", "prisma/seed.ts"];

const result = spawnSync(command, args, {
  stdio: "inherit",
  env: { ...process.env, SEED_DEMO_DATA: "false" },
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  console.error("[maybe-seed] Seeding failed. The deployment is stopped so a half-seeded database is never served.");
  process.exit(result.status ?? 1);
}
console.log("[maybe-seed] Seed finished. Remove RUN_SEED_ON_FIRST_DEPLOY from the project environment now.");
