import { env } from "cloudflare:workers";

export const customerLedgerEnv = env as typeof env & { DB: D1Database };
