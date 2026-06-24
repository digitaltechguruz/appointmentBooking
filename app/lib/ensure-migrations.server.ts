import { execSync } from "node:child_process";
import { statSync } from "node:fs";
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

function runPrisma(command: string) {
  execSync(`npx prisma ${command}`, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
}

/** Regenerate Prisma client when schema is newer than the generated output. */
export function ensurePrismaClient() {
  if (process.env.NODE_ENV === "production") return;

  const schemaMtime = fileMtime(schemaPath);
  const clientMtime = fileMtime(generatedClientPath);

  if (schemaMtime > clientMtime) {
    console.log("[dev] Prisma schema changed — running prisma generate…");
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
