import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root=new URL("../",import.meta.url);
const read=(p)=>readFile(new URL(p,root),"utf8");

test("portrait kiosk follows v2.1 flow",async()=>{
 const [tsx,css]=await Promise.all([read("app/components/KioskApp.tsx"),read("app/globals.css")]);
 for(const category of ["진공세트","프리미엄","LA갈비","뼈세트","O'meat"])assert.match(tsx,new RegExp(category.replace("'","\\'")));
 for(const step of ["products","cart","fulfillment","pickup-info","pickup-time","shipping-sender","shipping-recipient","shipping-address","review","done"])assert.match(tsx,new RegExp('"'+step+'"'));
 assert.match(tsx,/AnimatePresence/);
 assert.match(tsx,/product-modal/);
 assert.match(tsx,/idempotencyKey/);
 assert.match(css,/grid-template-columns:repeat\(2/);
 assert.match(css,/position:fixed/);
});

test("operator APIs enforce identity and role",async()=>{
 const [orders,status]=await Promise.all([read("app/api/orders/route.ts"),read("app/api/orders/status/route.ts")]);
 for(const source of [orders,status]){assert.match(source,/getChatGPTUser/);assert.match(source,/OPERATOR_USER_IDS/);assert.match(source,/status:403/)}
 assert.match(orders,/idempotency_key/);
 assert.match(status,/expectedVersion/);
 assert.match(status,/version=version\+1/);
});

test("sales and workshop surfaces are task-first",async()=>{
 const [admin,workshop]=await Promise.all([read("app/components/AdminApp.tsx"),read("app/components/WorkshopApp.tsx")]);
 for(const label of ["주문 찾기","주문 받기","상품 찾아가기","오늘 보낼 상품"])assert.match(admin,new RegExp(label));
 assert.doesNotMatch(admin,/metric|완료율|미수금/i);
 assert.match(workshop,/고객도착/);
 assert.match(workshop,/주문변경/);
 assert.match(workshop,/라벨조치/);
 assert.doesNotMatch(workshop,/결제금액|결제수단|잔액/);
});

test("database migrations include P0 safeguards",async()=>{
 const [d1,supabase]=await Promise.all([read("drizzle/0000_charming_bishop.sql"),read("supabase/migrations/202608230001_v2_phase1.sql")]);
 assert.match(d1,/orders_no_hard_delete/);
 assert.match(d1,/idx_orders_idempotency/);
 assert.match(supabase,/create_order_transaction/);
 assert.match(supabase,/enable row level security/g);
 assert.match(supabase,/revoke all on function/);
 assert.match(supabase,/prevent_order_delete/);
});
