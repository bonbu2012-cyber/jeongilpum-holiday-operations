import { customerLedgerEnv } from "../../lib/customer-ledger-db";
import { customerBalances } from "../../lib/customer-ledger-domain";
import { requireOperatorApi } from "../../lib/operator-session";

type AccountSummaryRow = {
  id: string;
  display_name: string;
  display_phone: string;
  ledger_label: string;
  total_ordered: number;
  order_count: number;
  net_received: number;
  oldest_due_date: string | null;
  last_payment_at: string | null;
  last_payment_method: "card" | "cash" | "bank_transfer" | null;
  pending_consultations: number;
};

type AccountRow = {
  id: string;
  normalized_name: string;
  normalized_phone: string;
  display_name: string;
  display_phone: string;
  ledger_sequence: number;
  ledger_label: string;
};

type OrderRow = {
  id: string;
  order_no: string;
  order_status: string;
  total_amount: number;
  submitted_at: string;
  fulfillment_type: "pickup" | "shipping";
  pickup_at: string | null;
  ship_date: string | null;
};

type ItemRow = {
  order_id: string;
  id: string;
  product_name_snapshot: string;
  quantity: number;
  line_total: number;
};

type TransactionRow = {
  id: string;
  type: "payment" | "reversal" | "adjustment" | "transfer_in" | "transfer_out";
  method: "card" | "cash" | "bank_transfer" | null;
  amount: number;
  transacted_at: string;
  payer_name: string | null;
  payer_phone: string | null;
  payer_relation: string | null;
  memo: string;
  related_transaction_id: string | null;
  consultation_id: string | null;
  recorded_by: string;
  created_at: string;
};

type ConsultationRow = {
  id: string;
  note: string;
  status: "pending" | "applied";
  created_at: string;
  applied_at: string | null;
  target_customer_account_id: string | null;
  transfer_amount: number;
  application_memo: string;
};

const netAmount = (transaction: TransactionRow) => {
  if (transaction.type === "reversal" || transaction.type === "transfer_out") return -transaction.amount;
  return transaction.amount;
};

const dueDate = (order: OrderRow) => order.fulfillment_type === "pickup"
  ? order.pickup_at?.slice(0, 10) ?? null
  : order.ship_date;

async function listAccounts(query: string) {
  const like = `%${query}%`;
  const result = await customerLedgerEnv.DB.prepare(`
    WITH charges AS (
      SELECT
        oca.customer_account_id,
        COALESCE(SUM(CASE WHEN o.order_status!='cancelled' THEN o.total_amount ELSE 0 END),0) AS total_ordered,
        COUNT(CASE WHEN o.order_status!='cancelled' THEN 1 END) AS order_count,
        MIN(CASE WHEN o.order_status!='cancelled' THEN
          CASE WHEN COALESCE(f.fulfillment_type,o.fulfillment_type)='pickup'
            THEN substr(f.pickup_at,1,10)
            ELSE f.ship_date
          END
        END) AS oldest_due_date
      FROM order_customer_accounts oca
      JOIN orders o ON o.id=oca.order_id
      LEFT JOIN fulfillments f ON f.order_id=o.id
      GROUP BY oca.customer_account_id
    ), receipts AS (
      SELECT
        customer_account_id,
        COALESCE(SUM(CASE
          WHEN type IN ('reversal','transfer_out') THEN -amount
          ELSE amount
        END),0) AS net_received,
        MAX(CASE WHEN type='payment' THEN transacted_at END) AS last_payment_at
      FROM customer_ledger_transactions
      GROUP BY customer_account_id
    ), consultations AS (
      SELECT customer_account_id,COUNT(*) AS pending_consultations
      FROM customer_ledger_consultations
      WHERE status='pending'
      GROUP BY customer_account_id
    )
    SELECT
      ca.id,ca.display_name,ca.display_phone,ca.ledger_label,
      COALESCE(ch.total_ordered,0) AS total_ordered,
      COALESCE(ch.order_count,0) AS order_count,
      COALESCE(r.net_received,0) AS net_received,
      ch.oldest_due_date,
      r.last_payment_at,
      (
        SELECT t.method FROM customer_ledger_transactions t
        WHERE t.customer_account_id=ca.id AND t.type='payment'
        ORDER BY t.transacted_at DESC,t.id DESC LIMIT 1
      ) AS last_payment_method,
      COALESCE(c.pending_consultations,0) AS pending_consultations
    FROM customer_accounts ca
    LEFT JOIN charges ch ON ch.customer_account_id=ca.id
    LEFT JOIN receipts r ON r.customer_account_id=ca.id
    LEFT JOIN consultations c ON c.customer_account_id=ca.id
    WHERE (?='' OR ca.display_name LIKE ? OR ca.display_phone LIKE ? OR ca.ledger_label LIKE ?)
      AND (COALESCE(ch.order_count,0)>0 OR r.customer_account_id IS NOT NULL OR COALESCE(c.pending_consultations,0)>0)
    ORDER BY
      CASE WHEN COALESCE(ch.total_ordered,0)-COALESCE(r.net_received,0)>0 THEN 0 ELSE 1 END,
      ch.oldest_due_date,
      ca.display_name
    LIMIT 500
  `).bind(query, like, like, like).all<AccountSummaryRow>();

  return result.results.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    displayPhone: row.display_phone,
    ledgerLabel: row.ledger_label,
    totalOrdered: row.total_ordered,
    netReceived: row.net_received,
    orderCount: row.order_count,
    oldestDueDate: row.oldest_due_date,
    lastPaymentAt: row.last_payment_at,
    lastPaymentMethod: row.last_payment_method,
    pendingConsultations: row.pending_consultations,
    ...customerBalances(row.total_ordered, row.net_received),
  }));
}

async function accountDetail(customerAccountId: string) {
  const account = await customerLedgerEnv.DB
    .prepare("SELECT id,normalized_name,normalized_phone,display_name,display_phone,ledger_sequence,ledger_label FROM customer_accounts WHERE id=?")
    .bind(customerAccountId)
    .first<AccountRow>();
  if (!account) return null;

  const [ordersResult, itemsResult, transactionsResult, consultationsResult, consultationOrdersResult] = await Promise.all([
    customerLedgerEnv.DB.prepare(`
      SELECT o.id,o.order_no,o.order_status,o.total_amount,o.submitted_at,
        COALESCE(f.fulfillment_type,o.fulfillment_type) AS fulfillment_type,
        f.pickup_at,f.ship_date
      FROM order_customer_accounts oca
      JOIN orders o ON o.id=oca.order_id
      LEFT JOIN fulfillments f ON f.order_id=o.id
      WHERE oca.customer_account_id=?
      ORDER BY o.submitted_at DESC,o.id DESC
    `).bind(customerAccountId).all<OrderRow>(),
    customerLedgerEnv.DB.prepare(`
      SELECT i.order_id,i.id,i.product_name_snapshot,i.quantity,i.line_total
      FROM order_items i
      JOIN order_customer_accounts oca ON oca.order_id=i.order_id
      WHERE oca.customer_account_id=?
      ORDER BY i.created_at,i.id
    `).bind(customerAccountId).all<ItemRow>(),
    customerLedgerEnv.DB.prepare(`
      SELECT id,type,method,amount,transacted_at,payer_name,payer_phone,payer_relation,memo,
        related_transaction_id,consultation_id,recorded_by,created_at
      FROM customer_ledger_transactions
      WHERE customer_account_id=?
      ORDER BY transacted_at DESC,id DESC
    `).bind(customerAccountId).all<TransactionRow>(),
    customerLedgerEnv.DB.prepare(`
      SELECT id,note,status,created_at,applied_at,target_customer_account_id,transfer_amount,application_memo
      FROM customer_ledger_consultations
      WHERE customer_account_id=?
      ORDER BY created_at DESC,id DESC
    `).bind(customerAccountId).all<ConsultationRow>(),
    customerLedgerEnv.DB.prepare(`
      SELECT co.consultation_id,co.order_id
      FROM customer_ledger_consultation_orders co
      JOIN customer_ledger_consultations c ON c.id=co.consultation_id
      WHERE c.customer_account_id=?
    `).bind(customerAccountId).all<{ consultation_id: string; order_id: string }>(),
  ]);

  const orders = ordersResult.results.map((order) => ({
    id: order.id,
    orderNo: order.order_no,
    status: order.order_status,
    totalAmount: order.total_amount,
    submittedAt: order.submitted_at,
    fulfillmentType: order.fulfillment_type,
    dueDate: dueDate(order),
    items: itemsResult.results.filter((item) => item.order_id === order.id).map((item) => ({
      id: item.id,
      name: item.product_name_snapshot,
      quantity: item.quantity,
      lineTotal: item.line_total,
    })),
  }));
  const transactions = transactionsResult.results.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    method: transaction.method,
    amount: transaction.amount,
    netAmount: netAmount(transaction),
    transactedAt: transaction.transacted_at,
    payerName: transaction.payer_name,
    payerPhone: transaction.payer_phone,
    payerRelation: transaction.payer_relation,
    memo: transaction.memo,
    relatedTransactionId: transaction.related_transaction_id,
    consultationId: transaction.consultation_id,
  }));
  const totalOrdered = orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.totalAmount, 0);
  const netReceived = transactions.reduce((sum, transaction) => sum + transaction.netAmount, 0);

  return {
    account: {
      id: account.id,
      displayName: account.display_name,
      displayPhone: account.display_phone,
      ledgerSequence: account.ledger_sequence,
      ledgerLabel: account.ledger_label,
    },
    summary: { totalOrdered, netReceived, ...customerBalances(totalOrdered, netReceived) },
    orders,
    transactions,
    consultations: consultationsResult.results.map((consultation) => ({
      id: consultation.id,
      note: consultation.note,
      status: consultation.status,
      createdAt: consultation.created_at,
      appliedAt: consultation.applied_at,
      targetCustomerAccountId: consultation.target_customer_account_id,
      transferAmount: consultation.transfer_amount,
      applicationMemo: consultation.application_memo,
      orderIds: consultationOrdersResult.results
        .filter((item) => item.consultation_id === consultation.id)
        .map((item) => item.order_id),
    })),
  };
}

export async function GET(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const customerAccountId = params.get("customerId")?.trim() ?? "";
    const response = customerAccountId
      ? await accountDetail(customerAccountId)
      : { customers: await listAccounts(params.get("q")?.trim() ?? "") };
    if (!response) return Response.json({ error: "고객 장부를 찾을 수 없습니다." }, { status: 404 });
    return Response.json(response, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch {
    return Response.json({ error: "고객 장부를 불러오지 못했습니다." }, { status: 500 });
  }
}
