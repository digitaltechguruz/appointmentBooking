import { PrismaClient } from "@prisma/client";
import { statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ensureDevDatabaseReady } from "./lib/ensure-migrations.server";

ensureDevDatabaseReady();

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatedClientPath = join(
  __dirname,
  "../node_modules/.prisma/client/index.js",
);

function getGeneratedClientMtime() {
  try {
    return statSync(generatedClientPath).mtimeMs;
  } catch {
    return 0;
  }
}

function createPrismaClient() {
  return new PrismaClient();
}

function getPrismaClient() {
  const clientMtime = getGeneratedClientMtime();

  if (process.env.NODE_ENV !== "production") {
    if (
      !global.prismaGlobal ||
      global.prismaClientMtime !== clientMtime
    ) {
      if (global.prismaGlobal) {
        void global.prismaGlobal.$disconnect();
      }
      global.prismaGlobal = createPrismaClient();
      global.prismaClientMtime = clientMtime;
    }
    return global.prismaGlobal;
  }

  if (!global.prismaGlobal) {
    global.prismaGlobal = createPrismaClient();
  }
  return global.prismaGlobal;
}

/** Lazy proxy so dev picks up prisma generate without a full server restart. */
const prisma = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getPrismaClient();
      const value = client[prop];
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
);

export default prisma;
