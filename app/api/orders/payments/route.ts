import { requireCustomerLedgerOperator } from "../../../lib/customer-ledger-auth";

export async function POST() {
  const operator = await requireCustomerLedgerOperator();
  if ("response" in operator) return operator.response;
  return Response.json(
    { error: "결제는 판매장의 고객 결제·미수 장부에서 관리자 비밀번호를 확인한 뒤 등록해주세요." },
    { status: 410 },
  );
}
