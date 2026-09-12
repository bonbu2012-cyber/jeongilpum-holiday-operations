/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vpyedzjycmphoutztxnr.supabase.co").replace(/^\uFEFF/, "").trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweWVkemp5Y21waG91dHp0eG5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzY4NjgsImV4cCI6MjA5OTExMjg2OH0.u0iUtRnlIUoi8nzrYH1xMLSWIk5f1xGxJ_--pCX9Qo0").replace(/^\uFEFF/, "").trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey).replace(/^\uFEFF/, "").trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function formatSqlWithParams(sql: string, params: unknown[]): string {
  let paramIndex = 0;
  let formatted = sql.replace(/\?/g, () => {
    if (paramIndex >= params.length) return "NULL";
    const val = params[paramIndex++];
    if (val === null || val === undefined) return "NULL";
    if (typeof val === "number") return String(val);
    if (typeof val === "boolean") return val ? "true" : "false";
    return `'${String(val).replace(/'/g, "''")}'`;
  });

  // Transform SQLite idioms to Postgres idioms
  formatted = formatted
    .replace(/\bactive\s*=\s*1\b/gi, "active = true")
    .replace(/\bactive\s*=\s*0\b/gi, "active = false")
    .replace(/\bactive\s*!=\s*0\b/gi, "active = true")
    .replace(/\bis_custom_order_link\s*=\s*1\b/gi, "is_custom_order_link = true")
    .replace(/\bis_custom_order_link\s*=\s*0\b/gi, "is_custom_order_link = false")
    .replace(/\bcustomer_arrived\s*=\s*1\b/gi, "customer_arrived = true")
    .replace(/\bcustomer_arrived\s*=\s*0\b/gi, "customer_arrived = false")
    .replace(/\bINSERT\s+OR\s+IGNORE\b/gi, "INSERT")
    .replace(/\bINSERT\s+OR\s+REPLACE\b/gi, "INSERT");

  return formatted;
}

export type PreparedRunner = D1PreparedStatement;

export interface DatabaseClient extends D1Database {
  insert(table: any): { values: (data: Record<string, any>) => Promise<{ success: boolean }> };
}

export class SupabaseDbWrapper implements DatabaseClient {
  private client = supabaseAdmin;

  prepare(query: string): PreparedRunner {
    const createRunner = (...params: unknown[]): PreparedRunner => {
      const runner: PreparedRunner = {
        all: async <T = unknown>(): Promise<D1Result<T>> => {
          const formatted = formatSqlWithParams(query, params);
          const { data, error } = await this.client.rpc("exec_sql", { query: formatted });
          if (error) throw new Error(`Supabase SQL query failed: ${error.message}`);
          if (data && typeof data === "object" && "error" in data) {
            throw new Error(`SQL error: ${(data as { error: string }).error}`);
          }
          return {
            results: (Array.isArray(data) ? data : []) as T[],
            success: true as const,
            meta: { changes: 1, served_by: "supabase", duration: 0 } as any,
          };
        },
        first: async <T = unknown>(colName?: string): Promise<T | null> => {
          const formatted = formatSqlWithParams(query, params);
          const { data, error } = await this.client.rpc("exec_sql", { query: formatted });
          if (error) throw new Error(`Supabase SQL query failed: ${error.message}`);
          if (data && typeof data === "object" && "error" in data) {
            throw new Error(`SQL error: ${(data as { error: string }).error}`);
          }
          const arr = (Array.isArray(data) ? data : []) as any[];
          if (!arr || arr.length === 0) return null;
          if (colName) return arr[0][colName] ?? null;
          return arr[0] as T;
        },
        run: async <T = unknown>(): Promise<D1Result<T>> => {
          const formatted = formatSqlWithParams(query, params);
          const { data, error } = await this.client.rpc("exec_dml", { statement: formatted });
          if (error) throw new Error(`Supabase SQL execution failed: ${error.message}`);
          if (data && typeof data === "object" && "error" in data) {
            throw new Error(`SQL error: ${(data as { error: string }).error}`);
          }
          return {
            success: true as const,
            meta: { changes: 1, served_by: "supabase", duration: 0 } as any,
            results: [] as T[],
          };
        },
        bind: (...newParams: unknown[]) => createRunner(...newParams),
        raw: (async <T = unknown>(options?: { columnNames?: boolean }): Promise<any> => {
          const res = await runner.all();
          return res.results as any;
        }) as D1PreparedStatement["raw"],
      };
      return runner;
    };

    return createRunner();
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    const results: D1Result<T>[] = [];
    for (const stmt of statements) {
      if (typeof (stmt as any)?.all === "function") {
        results.push(await (stmt as any).all());
      } else if (typeof stmt?.run === "function") {
        results.push(await stmt.run());
      } else {
        results.push({ success: true as const, meta: { changes: 1 } as any, results: [] });
      }
    }
    return results;
  }

  async exec(query: string): Promise<D1ExecResult> {
    const { error } = await this.client.rpc("exec_dml", { statement: query });
    if (error) throw new Error(`exec failed: ${error.message}`);
    return { count: 1, duration: 0 };
  }

  async dump(): Promise<ArrayBuffer> {
    throw new Error("dump() is not supported on SupabaseDbWrapper");
  }

  withSession(token?: string): any {
    return this;
  }

  insert(table: any) {
    return {
      values: async (data: Record<string, any>) => {
        const tableName = table?._?.name || table?.[Symbol.for("drizzle:Name")] || "kiosk_events";
        const snakeData: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) {
          const snakeKey = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          snakeData[snakeKey] = v;
        }
        const { error } = await this.client.from(tableName).insert(snakeData);
        if (error) throw new Error(`Supabase insert error: ${error.message}`);
        return { success: true };
      },
    };
  }
}

export const dbWrapper = new SupabaseDbWrapper();

export function getDb(): DatabaseClient {
  return dbWrapper;
}

