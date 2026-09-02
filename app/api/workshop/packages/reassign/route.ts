import { env } from "cloudflare:workers";
import { OPERATOR_ACTOR, requireOperatorApi } from "../../../../lib/operator-session";

type Payload = {
  packageId?: string;
  targetWorkItemId?: string;
  idempotencyKey?: string;
};
type PackageRow = {
  id: string;
  work_item_id: string | null;
  package_sequence: number | null;
};
type WorkItemRow = {
  id: string;
  order_id: string;
};

const runtimeEnv = env as typeof env & { DB: D1Database };

export async function POST(request: Request) {
  const denied = await requireOperatorApi();
  if (denied) return denied;

  try {
    const payload = await request.json() as Payload;
    const packageId = payload.packageId?.trim() ?? "";
    const targetWorkItemId = payload.targetWorkItemId?.trim() ?? "";
    const idempotencyKey = payload.idempotencyKey?.trim() ?? "";
    if (!packageId || !targetWorkItemId || !idempotencyKey) {
      return Response.json({ error: "패키지·대상 작업·중복방지 키를 확인해주세요." }, { status: 400 });
    }

    const packageRow = await runtimeEnv.DB.prepare(`
      SELECT id,work_item_id,package_sequence
      FROM packages
      WHERE id=?
    `).bind(packageId).first<PackageRow>();
    const target = await runtimeEnv.DB.prepare(`
      SELECT id,order_id
      FROM work_items
      WHERE id=?
    `).bind(targetWorkItemId).first<WorkItemRow>();
    if (!packageRow || !target) return Response.json({ error: "패키지 또는 대상 작업을 찾을 수 없습니다." }, { status: 404 });
    if (packageRow.work_item_id === target.id) return Response.json({ ok: true, alreadyApplied: true });

    const eventType = `package_reassigned:${idempotencyKey}`;
    const prior = await runtimeEnv.DB.prepare(`
      SELECT id
      FROM work_item_events
      WHERE work_item_id=? AND event_type=?
      LIMIT 1
    `).bind(target.id, eventType).first<{ id: string }>();
    if (prior) return Response.json({ ok: true, alreadyApplied: true });

    const sequence = await runtimeEnv.DB.prepare(`
      SELECT COALESCE(MAX(package_sequence),0)+1 AS sequence
      FROM packages
      WHERE work_item_id=?
    `).bind(target.id).first<{ sequence: number }>();
    const now = new Date().toISOString();
    const source = packageRow.work_item_id
      ? await runtimeEnv.DB.prepare(`
        SELECT id,order_id
        FROM work_items
        WHERE id=?
      `).bind(packageRow.work_item_id).first<WorkItemRow>()
      : null;
    const results = await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(`
        UPDATE packages
        SET work_item_id=?,package_sequence=?,updated_at=?
        WHERE id=? AND work_item_id IS ?
      `).bind(target.id, Number(sequence?.sequence ?? 1), now, packageRow.id, packageRow.work_item_id),
      runtimeEnv.DB.prepare(`
        INSERT INTO work_item_events(
          id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
        )
        SELECT ?,?,?,?,?,?,?,?
        WHERE EXISTS(
          SELECT 1
          FROM packages
          WHERE id=? AND work_item_id=?
        )
        AND NOT EXISTS(
          SELECT 1
          FROM work_item_events
          WHERE work_item_id=? AND event_type=?
        )
      `).bind(
        crypto.randomUUID(),
        target.id,
        target.order_id,
        eventType,
        JSON.stringify({ packageId: packageRow.id, workItemId: packageRow.work_item_id }),
        JSON.stringify({ packageId: packageRow.id, workItemId: target.id }),
        OPERATOR_ACTOR,
        now,
        packageRow.id,
        target.id,
        target.id,
        eventType,
      ),
      ...(source
        ? [runtimeEnv.DB.prepare(`
          INSERT INTO work_item_events(
            id,work_item_id,order_id,event_type,from_value,to_value,actor,created_at
          )
          SELECT ?,?,?,?,?,?,?,?
          WHERE EXISTS(
            SELECT 1
            FROM packages
            WHERE id=? AND work_item_id=?
          )
          AND NOT EXISTS(
            SELECT 1
            FROM work_item_events
            WHERE work_item_id=? AND event_type=?
          )
        `).bind(
          crypto.randomUUID(),
          source.id,
          source.order_id,
          eventType,
          JSON.stringify({ packageId: packageRow.id, workItemId: source.id }),
          JSON.stringify({ packageId: packageRow.id, workItemId: target.id }),
          OPERATOR_ACTOR,
          now,
          packageRow.id,
          target.id,
          source.id,
          eventType,
        )]
        : []),
    ]);

    if (!results[0].meta.changes) {
      const applied = await runtimeEnv.DB.prepare(`
        SELECT id
        FROM work_item_events
        WHERE work_item_id=? AND event_type=?
        LIMIT 1
      `).bind(target.id, eventType).first<{ id: string }>();
      if (applied) return Response.json({ ok: true, alreadyApplied: true });
      return Response.json({ error: "패키지 연결이 변경되었습니다. 최신 내용을 다시 확인해주세요." }, { status: 409 });
    }
    return Response.json({ ok: true, packageId: packageRow.id, targetWorkItemId: target.id });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "패키지 연결을 변경하지 못했습니다." },
      { status: 500 },
    );
  }
}
