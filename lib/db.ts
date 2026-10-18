import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });

  pool.on("error", (err) => {
    // Ignorar cierres normales de clientes inactivos por el pooler de Supabase
    console.warn("Supabase pooler idle client warning (ignored):", err.message);
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: ["error"],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
