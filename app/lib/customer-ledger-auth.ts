import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../chatgpt-auth";
import { isConfiguredOperator } from "./operator-auth";

const COOKIE_NAME = "jeongilpum_customer_ledger";
const SESSION_SECONDS = 5 * 60;

export type CustomerLedgerRuntimeEnv = typeof env & {
  DB: D1Database;
  OPERATOR_USER_IDS?: string;
  OPERATOR_EMAILS?: string;
  CUSTOMER_LEDGER_EMPLOYEE_PASSWORD?: string;
  CUSTOMER_LEDGER_ADMIN_PASSWORD?: string;
  CUSTOMER_LEDGER_SESSION_SECRET?: string;
};

export const customerLedgerEnv = env as CustomerLedgerRuntimeEnv;

function base64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padding = (4 - value.length % 4) % 4;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(padding);
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function cookieValue(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const part of cookies.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return "";
}

export async function requireCustomerLedgerOperator() {
  const user = await getChatGPTUser();
  if (!user) return { response: Response.json({ error: "로그인이 필요합니다." }, { status: 401 }) } as const;
  const allowed = isConfiguredOperator(user, {
    userIds: customerLedgerEnv.OPERATOR_USER_IDS,
    emails: customerLedgerEnv.OPERATOR_EMAILS,
  });
  if (!allowed) return { response: Response.json({ error: "운영자 권한이 없습니다." }, { status: 403 }) } as const;
  return { user } as const;
}

async function verifyConfiguredPassword(password: string, configured: string) {
  if (!configured) return { ok: false, configurationMissing: true };
  const [providedDigest, configuredDigest] = await Promise.all([digest(password), digest(configured)]);
  return { ok: equalBytes(providedDigest, configuredDigest), configurationMissing: false };
}

export function verifyCustomerLedgerEmployeePassword(password: string) {
  return verifyConfiguredPassword(password, customerLedgerEnv.CUSTOMER_LEDGER_EMPLOYEE_PASSWORD ?? "");
}

export function verifyCustomerLedgerAdminPassword(password: string) {
  return verifyConfiguredPassword(password, customerLedgerEnv.CUSTOMER_LEDGER_ADMIN_PASSWORD ?? "");
}

export async function createCustomerLedgerSession(userId: string) {
  const secret = customerLedgerEnv.CUSTOMER_LEDGER_SESSION_SECRET ?? "";
  if (!secret) throw new Error("고객 장부 세션 설정이 필요합니다.");
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({ userId, expiresAt: Date.now() + SESSION_SECONDS * 1000 })));
  const signature = base64Url(await hmac(payload, secret));
  return `${payload}.${signature}`;
}

export async function hasCustomerLedgerSession(request: Request, userId: string) {
  const secret = customerLedgerEnv.CUSTOMER_LEDGER_SESSION_SECRET ?? "";
  const token = cookieValue(request);
  if (!secret || !token) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = await hmac(payload, secret);
  let provided: Uint8Array;
  try {
    provided = decodeBase64Url(signature);
  } catch {
    return false;
  }
  if (!equalBytes(expected, provided)) return false;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { userId?: string; expiresAt?: number };
    return parsed.userId === userId && Number(parsed.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

export async function withCustomerLedgerSession(response: Response, userId: string) {
  const token = await createCustomerLedgerSession(userId);
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Max-Age=${SESSION_SECONDS}; Path=/api/customer-ledger; HttpOnly; Secure; SameSite=Strict`,
  );
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export function clearCustomerLedgerSession(response: Response) {
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=; Max-Age=0; Path=/api/customer-ledger; HttpOnly; Secure; SameSite=Strict`,
  );
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export async function requireCustomerLedgerSession(request: Request) {
  const operator = await requireCustomerLedgerOperator();
  if ("response" in operator) return operator;
  if (!await hasCustomerLedgerSession(request, operator.user.userId)) {
    return { response: Response.json({ error: "고객 장부가 잠겼습니다.", locked: true }, { status: 401 }) } as const;
  }
  return operator;
}
