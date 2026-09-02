import { env } from "cloudflare:workers";
import { headers } from "next/headers";

export const COOKIE_NAME = "jip_operator";
export const OPERATOR_ACTOR = "operator";

const runtimeEnv = env as typeof env & { OPERATOR_PASSCODE?: string };
const encoder = new TextEncoder();
const salt = encoder.encode("jeongilpum-operator");

async function tokenFor(passcode: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 100000,
    },
    key,
    256,
  );
  return Array.from(new Uint8Array(bits), (value) => value.toString(16).padStart(2, "0")).join("");
}

function equalToken(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function sessionCookie(value: string | null) {
  if (!value) return null;
  for (const part of value.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

export async function expectedToken(): Promise<string | null> {
  const passcode = runtimeEnv.OPERATOR_PASSCODE;
  if (!passcode) return null;
  return tokenFor(passcode);
}

export async function verifyPasscode(passcode: string): Promise<string | null> {
  const expected = await expectedToken();
  if (!expected) return null;
  const provided = await tokenFor(passcode);
  return equalToken(provided, expected) ? expected : null;
}

export async function hasOperatorSession(): Promise<boolean> {
  const [expected, requestHeaders] = await Promise.all([expectedToken(), headers()]);
  const provided = sessionCookie(requestHeaders.get("cookie"));
  return Boolean(expected && provided && equalToken(provided, expected));
}

export async function requireOperatorApi(): Promise<Response | null> {
  if (await hasOperatorSession()) return null;
  return Response.json({ error: "운영 화면 암호가 필요합니다." }, { status: 401 });
}
