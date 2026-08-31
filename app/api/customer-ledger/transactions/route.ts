import {
  customerLedgerEnv,
  requireCustomerLedgerSession,
  verifyCustomerLedgerPassword,
  withCustomerLedgerSession,
} from "../../../lib/customer-ledger-auth";
import { normalizeCustomerPhone } from "../../../lib/customer-ledger-domain";

type PaymentInput = {
  method?: "card" | "cash" | "bank_transfer";
  amount?: number;
  paidAt?: string;
  payerName?: string;
  payerPhone?: string;
  payerRelation?: string;
  memo?: string;
};

type Payload = PaymentInput & {
  action?: "payment" | "correction";
  customerAccountId?: string;
  originalTransactionId?: string;
  reason?: string;
  replacement?: PaymentInput | null;
  adminPassword?: string;
  idempotencyKey?: string;
};

type TransactionRow = {
  id: string;
  customer_account_id: string;
  type: string;
  method: "card" | "cash" | "bank_transfer" | null;
  amount: number;
  transacted_at: string;
};

const clean = (value: string | undefined) => value?.trim() ?? "";

function validatedPayment(input: PaymentInput) {
  const amount = Number(input.amount);
  const paidAt = clean(input.paidAt) || new Date().toISOString();
  if (!input.method || !["card", "cash", "bank_transfer"].includes(input.method)) {
    return { error: "결제수단을 선택해주세요." } as const;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "결제금액을 1원 이상 입력해주세요." } as const;
  }
  if (Number.isNaN(Date.parse(paidAt))) {
    return { error: "결제일시를 확인해주세요." } as const;
  }
  return {
    value: {
      method: input.method,
      amount,
      paidAt: new Date(paidAt).toISOString(),
      payerName: clean(input.payerName) || null,
      payerPhone: normalizeCustomerPhone(input.payerPhone ?? "") || null,
      payerRelation: clean(input.payerRelation) || null,
      memo: clean(input.memo),
    },
  } as const;
}

async function accountExists(customerAccountId: string) {
  return Boolean(await customerLedgerEnv.DB
    .prepare("SELECT id FROM customer_accounts WHERE id=?")
    .bind(customerAccountId)
    .first<{ id: string }>());
}

export async function POST(request: Request) {
  const access = await requireCustomerLedgerSession(request);
  if ("response" in access) return access.response;
  try {
    const payload = await request.json() as Payload;
    const customerAccountId = clean(payload.customerAccountId);
    const idempotencyKey = clean(payload.idempotencyKey);
    if (!customerAccountId || !idempotencyKey || !await accountExists(customerAccountId)) {
      return Response.json({ error: "고객 장부와 중복방지 정보를 확인해주세요." }, { status: 400 });
    }
    const password = await verifyCustomerLedgerPassword(clean(payload.adminPassword));
    if (password.configurationMissing) {
      return Response.json({ error: "고객 장부 관리자 비밀번호 설정이 필요합니다." }, { status: 503 });
    }
    if (!password.ok) {
      return Response.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 403 });
    }

    const now = new Date().toISOString();
    if (payload.action === "payment") {
      const checked = validatedPayment(payload);
      if ("error" in checked) return Response.json({ error: checked.error }, { status: 400 });
      const paymentId = crypto.randomUUID();
      await customerLedgerEnv.DB.batch([
        customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_ledger_transactions(
            id,customer_account_id,type,method,amount,transacted_at,payer_name,payer_phone,
            payer_relation,memo,idempotency_key,recorded_by,created_at
          ) VALUES(?,?,'payment',?,?,?,?,?,?,?,?,?,?)
        `).bind(
          paymentId,
          customerAccountId,
          checked.value.method,
          checked.value.amount,
          checked.value.paidAt,
          checked.value.payerName,
          checked.value.payerPhone,
          checked.value.payerRelation,
          checked.value.memo,
          idempotencyKey,
          access.user.userId,
          now,
        ),
        customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_ledger_events(id,customer_account_id,event_type,after_data,actor_id,created_at)
          VALUES(?,?,'payment_recorded',?,?,?)
        `).bind(
          crypto.randomUUID(),
          customerAccountId,
          JSON.stringify({ paymentId, method: checked.value.method, amount: checked.value.amount }),
          access.user.userId,
          now,
        ),
      ]);
      return withCustomerLedgerSession(Response.json({ ok: true, paymentId }, { status: 201 }), access.user.userId);
    }

    if (payload.action === "correction") {
      const originalTransactionId = clean(payload.originalTransactionId);
      const reason = clean(payload.reason);
      if (!originalTransactionId || !reason) {
        return Response.json({ error: "정정할 결제와 정정 사유를 입력해주세요." }, { status: 400 });
      }
      const original = await customerLedgerEnv.DB.prepare(`
        SELECT id,customer_account_id,type,method,amount,transacted_at
        FROM customer_ledger_transactions
        WHERE id=? AND customer_account_id=?
      `).bind(originalTransactionId, customerAccountId).first<TransactionRow>();
      if (!original || original.type !== "payment") {
        return Response.json({ error: "정정할 수 있는 원본 결제를 찾을 수 없습니다." }, { status: 404 });
      }
      const existingReversal = await customerLedgerEnv.DB
        .prepare("SELECT id FROM customer_ledger_transactions WHERE type='reversal' AND related_transaction_id=?")
        .bind(original.id)
        .first<{ id: string }>();
      if (existingReversal) {
        return Response.json({ error: "이미 정정된 결제입니다." }, { status: 409 });
      }
      const replacement = payload.replacement ? validatedPayment(payload.replacement) : null;
      if (replacement && "error" in replacement) {
        return Response.json({ error: replacement.error }, { status: 400 });
      }
      const reversalId = crypto.randomUUID();
      const replacementId = replacement ? crypto.randomUUID() : null;
      const statements: D1PreparedStatement[] = [
        customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_ledger_transactions(
            id,customer_account_id,type,method,amount,transacted_at,memo,related_transaction_id,
            idempotency_key,recorded_by,created_at
          ) VALUES(?,?,'reversal',NULL,?,?,?,?,?,?,?)
        `).bind(
          reversalId,
          customerAccountId,
          original.amount,
          now,
          reason,
          original.id,
          `${idempotencyKey}:reversal`,
          access.user.userId,
          now,
        ),
      ];
      if (replacement && "value" in replacement && replacementId) {
        statements.push(customerLedgerEnv.DB.prepare(`
          INSERT INTO customer_ledger_transactions(
            id,customer_account_id,type,method,amount,transacted_at,payer_name,payer_phone,
            payer_relation,memo,related_transaction_id,idempotency_key,recorded_by,created_at
          ) VALUES(?,?,'payment',?,?,?,?,?,?,?,?,?,?,?)
        `).bind(
          replacementId,
          customerAccountId,
          replacement.value.method,
          replacement.value.amount,
          replacement.value.paidAt,
          replacement.value.payerName,
          replacement.value.payerPhone,
          replacement.value.payerRelation,
          replacement.value.memo,
          original.id,
          `${idempotencyKey}:replacement`,
          access.user.userId,
          now,
        ));
      }
      statements.push(customerLedgerEnv.DB.prepare(`
        INSERT INTO customer_ledger_events(id,customer_account_id,event_type,before_data,after_data,reason,actor_id,created_at)
        VALUES(?,?,'payment_corrected',?,?,?,?,?)
      `).bind(
        crypto.randomUUID(),
        customerAccountId,
        JSON.stringify({ paymentId: original.id, method: original.method, amount: original.amount }),
        JSON.stringify({ reversalId, replacementId }),
        reason,
        access.user.userId,
        now,
      ));
      await customerLedgerEnv.DB.batch(statements);
      return withCustomerLedgerSession(Response.json({ ok: true, reversalId, replacementId }, { status: 201 }), access.user.userId);
    }

    return Response.json({ error: "결제 처리 종류를 확인해주세요." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("idx_customer_ledger_transactions_idempotency") || message.includes("UNIQUE")) {
      return withCustomerLedgerSession(Response.json({ ok: true, duplicate: true }), access.user.userId);
    }
    return Response.json({ error: "결제정보를 저장하지 못했습니다." }, { status: 500 });
  }
}
