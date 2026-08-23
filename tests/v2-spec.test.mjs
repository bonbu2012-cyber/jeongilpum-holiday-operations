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

test("customer info validation remains actionable",async()=>{
 const tsx=await read("app/components/KioskApp.tsx");
 assert.match(tsx,/flow-back-bottom/);
 assert.match(tsx,/aria-label="이전 단계"/);
 assert.match(tsx,/buyerName\.trim\(\)\.length>0/);
 assert.match(tsx,/attempted&&!phoneValid/);
 assert.doesNotMatch(tsx,/InfoStep[\s\S]{0,2500}disabled=\{!valid\}/);
});

test("category rail uses Korean-first hierarchy",async()=>{
 const [tsx,css]=await Promise.all([read("app/components/KioskApp.tsx"),read("app/globals.css")]);
 for(const assist of ["VACUUM","PREMIUM","LA"])assert.match(tsx,new RegExp(assist));
 assert.match(tsx,/category-name/);
 assert.match(tsx,/category-assist/);
 assert.match(css,/button\.single \.category-name/);
 assert.doesNotMatch(tsx,/🦴|category-symbol/);
});
test("custom order and settings workflows are durable",async()=>{
 const [kiosk,nav,custom,customApi,settings,settingsApi,d1]=await Promise.all([
  read("app/components/KioskApp.tsx"),
  read("app/components/AppNav.tsx"),
  read("app/components/CustomOrderApp.tsx"),
  read("app/api/custom-orders/route.ts"),
  read("app/components/SettingsApp.tsx"),
  read("app/api/settings/route.ts"),
  read("drizzle/0001_confused_swarm.sql"),
 ]);
 for(const route of ["/admin","/workshop","/settings"])assert.match(nav,new RegExp(route.replaceAll("/","\\/")));
 assert.match(kiosk,/\/kiosk\/custom/);
 assert.match(kiosk,/category-name omeat/);
 assert.match(kiosk,/category-name omeat/);
 assert.match(custom,/idempotencyKey/);
 assert.match(customApi,/custom_order_events/);
 assert.match(settings,/제품 사진 URL/);
 assert.match(settingsApi,/OPERATOR_USER_IDS/);
 assert.match(settingsApi,/configuration_events/);
 assert.match(d1,/custom_orders_no_hard_delete/);
});

test("all operating surfaces share navigation and the kiosk rail stays sticky",async()=>{
 const [nav,kiosk,admin,workshop,settings,css]=await Promise.all([
  read("app/components/AppNav.tsx"),
  read("app/components/KioskApp.tsx"),
  read("app/components/AdminApp.tsx"),
  read("app/components/WorkshopApp.tsx"),
  read("app/components/SettingsApp.tsx"),
  read("app/globals.css"),
 ]);
 for(const href of ["/kiosk","/admin","/workshop","/settings"])assert.match(nav,new RegExp('href: "'+href.replaceAll("/","\\/")+'"'));
 assert.match(nav,/aria-current/);
 assert.match(kiosk,/AppNav current="kiosk"/);
 assert.match(admin,/AppNav current="admin"/);
 assert.match(workshop,/AppNav current="workshop"/);
 assert.match(settings,/AppNav current="settings"/);
 assert.match(css,/\.category-rail\{[^}]*position:sticky;top:92px;height:calc\(100vh - 92px\)/);
 assert.match(css,/\.category-rail\{padding:10px 6px 94px;top:116px;height:calc\(100vh - 116px\)/);
});