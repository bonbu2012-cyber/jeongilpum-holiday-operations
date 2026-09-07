import { COOKIE_NAME, verifyPasscode } from "../../lib/operator-session";

type Payload = { passcode?: string };

function cookie(value: string, request: Request, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as Payload;
  const token = await verifyPasscode(typeof payload.passcode === "string" ? payload.passcode : "");
  if (!token) return Response.json({ error: "암호가 올바르지 않습니다." }, { status: 401 });
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", cookie(token, request, 2592000));
  return response;
}

export async function DELETE(request: Request) {
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", cookie("", request, 0));
  return response;
}
