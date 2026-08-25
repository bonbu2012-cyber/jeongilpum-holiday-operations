INSERT INTO order_events(
  id,
  order_id,
  event_type,
  before_data,
  after_data,
  reason,
  actor_id,
  created_at
)
SELECT
  'prod-smoke-cancel-' || id,
  id,
  'status_changed',
  '{"status":"submitted"}',
  '{"status":"cancelled","test":true}',
  'Production smoke test completed',
  'codex-production-smoke',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM orders
WHERE order_status = 'submitted'
  AND idempotency_key IN (
    'a8250001-0001-4001-8001-202608250001',
    'a8250002-0002-4002-8002-202608250002',
    'a8250003-0003-4003-8003-202608250003'
  );
--> statement-breakpoint
UPDATE fulfillments
SET status = 'cancelled',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE order_id IN (
  SELECT id
  FROM orders
  WHERE order_status = 'submitted'
    AND idempotency_key IN (
      'a8250001-0001-4001-8001-202608250001',
      'a8250002-0002-4002-8002-202608250002',
      'a8250003-0003-4003-8003-202608250003'
    )
);
--> statement-breakpoint
UPDATE orders
SET order_status = 'cancelled',
    version = version + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE order_status = 'submitted'
  AND idempotency_key IN (
    'a8250001-0001-4001-8001-202608250001',
    'a8250002-0002-4002-8002-202608250002',
    'a8250003-0003-4003-8003-202608250003'
  );
--> statement-breakpoint
PRAGMA optimize;
