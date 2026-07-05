import { readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = join(root, "prisma/schema.prisma");
const generatedClientPath = join(root, "node_modules/.prisma/client/index.js");

let devReadyEnsured = false;

function fileMtime(path: string) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

const generatedClientTypesPath = join(
  root,
  "node_modules/.prisma/client/index.d.ts",
);

function runPrisma(command: string) {
  execSync(`npx prisma ${command}`, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

/** Detect stale client after schema pulls (mtime alone can miss pnpm layout changes). */
function clientIncludesServiceBookingRules() {
  try {
    const source = readFileSync(generatedClientTypesPath, "utf8");
    return source.includes("useCustomBookingRules");
  } catch {
    return false;
  }
}

/** Regenerate Prisma client when schema is newer than the generated output. */
export function ensurePrismaClient() {
  if (process.env.NODE_ENV === "production") return;

  const schemaMtime = fileMtime(schemaPath);
  const clientMtime = fileMtime(generatedClientPath);
  const stale =
    schemaMtime > clientMtime || !clientIncludesServiceBookingRules();

  if (stale) {
    console.log("[dev] Prisma client out of date — running prisma generate…");
    runPrisma("generate");
  }
}

/** Apply pending migrations in development. */
export function ensureMigrations() {
  if (process.env.NODE_ENV === "production") return;

  try {
    runPrisma("migrate deploy");
  } catch (error) {
    console.error("[dev] prisma migrate deploy failed:", error);
  }
}

/** Called once per dev server process — keeps DB + client in sync after pulls. */
export function ensureDevDatabaseReady() {
  if (process.env.NODE_ENV === "production" || devReadyEnsured) return;
  devReadyEnsured = true;

  ensureMigrations();
  ensurePrismaClient();
}
