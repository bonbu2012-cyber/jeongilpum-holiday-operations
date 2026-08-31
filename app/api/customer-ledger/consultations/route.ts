import {
  customerLedgerEnv,
  requireCustomerLedgerSession,
  verifyCustomerLedgerPassword,
  withCustomerLedgerSession,
} from "../../../lib/customer-ledger-auth";

type Payload = {
  action?: "note" | "apply";
  customerAccountId?: string;
  consultationId?: string;
  note?: string;
  orderIds?: string[];
  transferAmount?: number;
  applicationMemo?: string;
  ledgerLabel?: string;
  adminPassword?: string;
};

type AccountRow = {
  id: string;
  normalized_name: string;
  normalized_phone: string;
  display_name: string;
  display_phone: string;
  ledger_sequence: number;
};

const clean = (value: string | undefined) => value?.trim() ?? "";

async function accountOrders(customerAccountId: string, orderIds: string[]) {
  if (!orderIds.length) return [];
  const placeholders = orderIds.map(() => "?").join(",");
  const result = await customerLedgerEnv.DB.prepare(`
    SELECT order_id FROM order_customer_accounts
    WHERE customer_account_id=? AND order_id IN (${placeholders})
  `).bind(customerAccountId, ...orderIds).all<{ order_id: string }>();
  return result.results.map((row) => row.order_id);
}

export async function POST(request: Request) {
  const access = await requireCustomerLedgerSession(request);
  if ("response" in access) return access.response;
  try {
    const payload = await request.json() as Payload;
    const customerAccountId = clean(payload.customerAccountId);
    if (!customerAccountId) return Response.json({ error: "고객 장부를 선택해주세요." }, { status: 400 });
    const account = await customerLedgerEnv.DB.prepare(`
      SELECT id,normalized_name,normalized_phone,display_name,display_phone,ledger_sequence
      FROM customer_accounts WHERE id=?
    `).bind(customerAccountId).first<AccountRow>();
    if (!account) return Response.json({ error: "고객 장부를 찾을 수 없습니다." }, { status: 404 });
    const now = new Date().toISOString();

    if (payload.action === "note") {
      const note = clean(payload.note);
      const orderIds = [...new Set((payload.orderIds ?? []).map((value) => value.trim()).filter(Boolean))];
      if (!note) return Response.json({ error: "상담 내용을 입력해주세요." }, { status: 400 });
      const ownedOrderIds = await accountOrders(customerAccountId, orderIds);
      if (ownedOrderIds.length !== orderIds.length) {
        return Response.json({ error: "상담 대상 주문을 다시 확인해주세요." }, { status: 400 });
      }
      const consultationId = crypto.randomUUID();
      await customerLedgerEnv.DB.batch([
        customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_ledger_consultations(id,customer_account_id,note,status,created_by,created_at)
          VALUES(?,? ,?,'pending',?,?)
        `).bind(consultationId, customerAccountId, note, access.user.userId, now),
        ...orderIds.map((orderId) => customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_ledger_consultation_orders(id,consultation_id,order_id,created_at)
          VALUES(?,?,?,?)
        `).bind(crypto.randomUUID(), consultationId, orderId, now)),
        customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_ledger_events(id,customer_account_id,event_type,after_data,actor_id,created_at)
          VALUES(?,?,'consultation_recorded',?,?,?)
        `).bind(
          crypto.randomUUID(),
          customerAccountId,
          JSON.stringify({ consultationId, orderIds }),
          access.user.userId,
          now,
        ),
      ]);
      return withCustomerLedgerSession(Response.json({ ok: true, consultationId }, { status: 201 }), access.user.userId);
    }

    if (payload.action === "apply") {
      const consultationId = clean(payload.consultationId);
      const applicationMemo = clean(payload.applicationMemo);
      const transferAmount = Number(payload.transferAmount ?? 0);
      if (!consultationId || !applicationMemo || !Number.isInteger(transferAmount) || transferAmount < 0) {
        return Response.json({ error: "분리 적용 내용과 이관금액을 확인해주세요." }, { status: 400 });
      }
      const password = await verifyCustomerLedgerPassword(clean(payload.adminPassword));
      if (password.configurationMissing) {
        return Response.json({ error: "고객 장부 관리자 비밀번호 설정이 필요합니다." }, { status: 503 });
      }
      if (!password.ok) {
        return Response.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 403 });
      }
      const consultation = await customerLedgerEnv.DB.prepare(`
        SELECT id,status FROM customer_ledger_consultations
        WHERE id=? AND customer_account_id=?
      `).bind(consultationId, customerAccountId).first<{ id: string; status: string }>();
      if (!consultation) return Response.json({ error: "상담 메모를 찾을 수 없습니다." }, { status: 404 });
      if (consultation.status !== "pending") return Response.json({ error: "이미 적용된 상담 메모입니다." }, { status: 409 });
      const orderResult = await customerLedgerEnv.DB.prepare(`
        SELECT co.order_id
        FROM customer_ledger_consultation_orders co
        JOIN order_customer_accounts oca ON oca.order_id=co.order_id
        WHERE co.consultation_id=? AND oca.customer_account_id=?
      `).bind(consultationId, customerAccountId).all<{ order_id: string }>();
      const orderIds = orderResult.results.map((row) => row.order_id);
      if (!orderIds.length) {
        return Response.json({ error: "분리할 주문이 상담 메모에 지정되지 않았습니다." }, { status: 400 });
      }
      const netResult = await customerLedgerEnv.DB.prepare(`
        SELECT COALESCE(SUM(CASE WHEN type IN ('reversal','transfer_out') THEN -amount ELSE amount END),0) AS net_received
        FROM customer_ledger_transactions WHERE customer_account_id=?
      `).bind(customerAccountId).first<{ net_received: number }>();
      if (transferAmount > Math.max(0, netResult?.net_received ?? 0)) {
        return Response.json({ error: "이관금액이 현재 고객의 순입금액보다 큽니다." }, { status: 400 });
      }
      const sequenceResult = await customerLedgerEnv.DB.prepare(`
        SELECT COALESCE(MAX(ledger_sequence),0) AS max_sequence
        FROM customer_accounts WHERE normalized_name=? AND normalized_phone=?
      `).bind(account.normalized_name, account.normalized_phone).first<{ max_sequence: number }>();
      const nextSequence = (sequenceResult?.max_sequence ?? account.ledger_sequence) + 1;
      const targetCustomerAccountId = crypto.randomUUID();
      const ledgerLabel = clean(payload.ledgerLabel) || `분리 장부 ${nextSequence}`;
      const placeholders = orderIds.map(() => "?").join(",");
      const statements: D1PreparedStatement[] = [
        customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_accounts(
            id,normalized_name,normalized_phone,display_name,display_phone,ledger_sequence,
            ledger_label,is_primary,created_at,updated_at
          ) VALUES(?,?,?,?,?,?,?,0,?,?)
        `).bind(
          targetCustomerAccountId,
          account.normalized_name,
          account.normalized_phone,
          account.display_name,
          account.display_phone,
          nextSequence,
          ledgerLabel,
          now,
          now,
        ),
        customerLedgerEnv.DB.prepare(`
          UPDATE order_customer_accounts
          SET customer_account_id=?,linked_at=?,linked_by=?,link_reason='consultation_split'
          WHERE customer_account_id=? AND order_id IN (${placeholders})
        `).bind(targetCustomerAccountId, now, access.user.userId, customerAccountId, ...orderIds),
        customerLedgerEnv.DB.prepare(`
          UPDATE customer_ledger_consultations
          SET status='applied',applied_by=?,applied_at=?,target_customer_account_id=?,transfer_amount=?,application_memo=?
          WHERE id=? AND status='pending'
        `).bind(
          access.user.userId,
          now,
          targetCustomerAccountId,
          transferAmount,
          applicationMemo,
          consultationId,
        ),
      ];
      if (transferAmount > 0) {
        statements.push(
          customerLedgerEnv.DB.prepare(`
            INSERT INTO customer_ledger_transactions(
              id,customer_account_id,type,amount,transacted_at,memo,consultation_id,idempotency_key,recorded_by,created_at
            ) VALUES(?,?,'transfer_out',?,?,?,?,?,?,?)
          `).bind(
            crypto.randomUUID(),
            customerAccountId,
            transferAmount,
            now,
            applicationMemo,
            consultationId,
            `split:${consultationId}:out`,
            access.user.userId,
            now,
          ),
          customerLedgerEnv.DB.prepare(`
            INSERT INTO customer_ledger_transactions(
              id,customer_account_id,type,amount,transacted_at,memo,consultation_id,idempotency_key,recorded_by,created_at
            ) VALUES(?,?,'transfer_in',?,?,?,?,?,?,?)
          `).bind(
            crypto.randomUUID(),
            targetCustomerAccountId,
            transferAmount,
            now,
            applicationMemo,
            consultationId,
            `split:${consultationId}:in`,
            access.user.userId,
            now,
          ),
        );
      }
      statements.push(
        customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_ledger_events(id,customer_account_id,event_type,after_data,reason,actor_id,created_at)
          VALUES(?,?,'ledger_split_applied',?,?,?,?)
        `).bind(
          crypto.randomUUID(),
          customerAccountId,
          JSON.stringify({ consultationId, targetCustomerAccountId, orderIds, transferAmount }),
          applicationMemo,
          access.user.userId,
          now,
        ),
        customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_ledger_events(id,customer_account_id,event_type,after_data,reason,actor_id,created_at)
          VALUES(?,?,'ledger_split_received',?,?,?,?)
        `).bind(
          crypto.randomUUID(),
          targetCustomerAccountId,
          JSON.stringify({ consultationId, sourceCustomerAccountId: customerAccountId, orderIds, transferAmount }),
          applicationMemo,
          access.user.userId,
          now,
        ),
      );
      await customerLedgerEnv.DB.batch(statements);
      return withCustomerLedgerSession(Response.json({ ok: true, targetCustomerAccountId }, { status: 201 }), access.user.userId);
    }

    return Response.json({ error: "상담 처리 종류를 확인해주세요." }, { status: 400 });
  } catch {
    return Response.json({ error: "상담 내용을 저장하지 못했습니다." }, { status: 500 });
  }
}
