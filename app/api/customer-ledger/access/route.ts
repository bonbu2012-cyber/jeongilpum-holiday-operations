import {
  clearCustomerLedgerSession,
  hasCustomerLedgerSession,
  requireCustomerLedgerOperator,
  verifyCustomerLedgerEmployeePassword,
  withCustomerLedgerSession,
} from "../../../lib/customer-ledger-auth";

type AccessPayload = { password?: string };

export async function GET(request: Request) {
  const operator = await requireCustomerLedgerOperator();
  if ("response" in operator) return operator.response;
  if (!await hasCustomerLedgerSession(request, operator.user.userId)) {
    return Response.json({ unlocked: false }, { status: 401 });
  }
  return withCustomerLedgerSession(Response.json({ unlocked: true }), operator.user.userId);
}

export async function POST(request: Request) {
  const operator = await requireCustomerLedgerOperator();
  if ("response" in operator) return operator.response;
  const payload = await request.json() as AccessPayload;
  const verified = await verifyCustomerLedgerEmployeePassword(payload.password?.trim() ?? "");
  if (verified.configurationMissing) {
    return Response.json({ error: "고객 장부 직원 패스워드 설정이 필요합니다." }, { status: 503 });
  }
  if (!verified.ok) {
    return Response.json({ error: "직원 패스워드가 올바르지 않습니다." }, { status: 403 });
  }
  return withCustomerLedgerSession(Response.json({ unlocked: true }), operator.user.userId);
}

export async function DELETE() {
  const operator = await requireCustomerLedgerOperator();
  if ("response" in operator) return operator.response;
  return clearCustomerLedgerSession(Response.json({ unlocked: false }));
}
