import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,root),"utf8");

test("portrait kiosk keeps the product surface and uses the recovered flow",async()=>{
 const [tsx,css]=await Promise.all([read("app/components/KioskApp.tsx"),read("app/globals.css")]);
 for(const category of ["진공세트","프리미엄","LA갈비","뼈세트","O'meat"])assert.match(tsx,new RegExp(category.replace("'","\\'")));
 for(const step of ["products","cart","fulfillment","pickup-info","pickup-date","pickup-time","shipping-sender","shipping-recipient","shipping-address","shipping-date","review","done"])assert.match(tsx,new RegExp('"'+step+'"'));
 assert.match(tsx,/AnimatePresence/);
 assert.match(tsx,/product-modal/);
 assert.match(tsx,/idempotencyKey/);
 assert.match(css,/grid-template-columns:repeat\(2/);
 assert.match(css,/position:fixed/);
});

test("Step2 is text-only and pickup scheduling uses calendar plus 30-minute slots",async()=>{
 const [tsx,flowCss]=await Promise.all([read("app/components/KioskApp.tsx"),read("app/kiosk-flow.css")]);
 const fulfillment=tsx.slice(tsx.indexOf("function Fulfillment"),tsx.indexOf("function InfoStep"));
 assert.doesNotMatch(fulfillment,/⌂|▣|<i>|<span>/);
 assert.match(fulfillment,/fulfillment-text-buttons/);
 assert.match(flowCss,/font:800 34px/);
 assert.match(tsx,/function Calendar/);
 assert.match(tsx,/pickupTimes=Array\.from\(\{length:27\}/);
 assert.match(tsx,/8\*60\+index\*30/);
 assert.match(tsx,/pickup-date/);
 assert.match(tsx,/pickup-time/);
 assert.match(flowCss,/pickup-time-grid\{display:grid;grid-template-columns:repeat\(2/);
});

test("shipping stores separated Kakao address fields and requires a shipping date",async()=>{
 const [tsx,api,types]=await Promise.all([read("app/components/KioskApp.tsx"),read("app/api/orders/route.ts"),read("app/components/types.ts")]);
 for(const field of ["roadAddr","roadAddrReference","jibunAddr","postalCode","detailAddr","shipDate"])assert.match(types,new RegExp(field));
 assert.match(tsx,/postcode\.v2\.js/);
 assert.match(tsx,/data\.zonecode/);
 assert.match(tsx,/data\.roadAddress/);
 assert.match(tsx,/data\.jibunAddress/);
 assert.match(tsx,/주소를 직접 입력할게요/);
 assert.match(tsx,/직접 입력한 주소입니다/);
 assert.doesNotMatch(tsx,/정일동/);
 assert.match(api,/payload\.shipDate/);
 assert.match(api,/ship_date/);
 assert.match(api,/발송 예정/);
});

test("operator APIs enforce identity and role and create an atomic D1 fulfillment",async()=>{
 const [orders,status]=await Promise.all([read("app/api/orders/route.ts"),read("app/api/orders/status/route.ts")]);
 for(const source of [orders,status]){assert.match(source,/getChatGPTUser/);assert.match(source,/OPERATOR_USER_IDS/);assert.match(source,/status:\s*403/)}
 assert.match(orders,/idempotency_key/);
 assert.match(orders,/runtimeEnv\.DB\.batch/);
 assert.match(orders,/INSERT INTO fulfillments/);
 assert.match(orders,/INSERT INTO fulfillment_items/);
 assert.match(status,/expectedVersion/);
 assert.match(status,/version=version\+1/);
});

test("sales and workshop surfaces are task-first and free of static customer alerts",async()=>{
 const [admin,workshop]=await Promise.all([read("app/components/AdminApp.tsx"),read("app/components/WorkshopApp.tsx")]);
 for(const label of ["주문 찾기","주문 받기","상품 찾아가기","보낼 상품"])assert.match(admin,new RegExp(label));
 assert.doesNotMatch(admin,/주문변경 <b>2|고객도착 <b>1|주소 미입력 배송 3건/);
 assert.doesNotMatch(workshop,/김철수|주문변경 <em>2|라벨조치 <em>1/);
 assert.match(workshop,/customerArrived/);
});

test("database migrations include safeguards and the new fulfillment tables",async()=>{
 const [d1,supabase,fulfillment]=await Promise.all([read("drizzle/0000_charming_bishop.sql"),read("supabase/migrations/202608230001_v2_phase1.sql"),read("drizzle/0002_deep_giant_girl.sql")]);
 assert.match(d1,/orders_no_hard_delete/);
 assert.match(d1,/idx_orders_idempotency/);
 assert.match(supabase,/create_order_transaction/);
 assert.match(supabase,/enable row level security/g);
 assert.match(supabase,/revoke all on function/);
 assert.match(supabase,/prevent_order_delete/);
 assert.match(fulfillment,/CREATE TABLE `fulfillments`/);
 assert.match(fulfillment,/CREATE TABLE `fulfillment_items`/);
 assert.match(fulfillment,/idx_fulfillments_pickup_at/);
 assert.match(fulfillment,/idx_fulfillments_ship_date/);
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

test("custom order and settings workflows stay durable",async()=>{
 const [kiosk,nav,custom,customApi,settings,settingsApi,d1]=await Promise.all([read("app/components/KioskApp.tsx"),read("app/components/AppNav.tsx"),read("app/components/CustomOrderApp.tsx"),read("app/api/custom-orders/route.ts"),read("app/components/SettingsApp.tsx"),read("app/api/settings/route.ts"),read("drizzle/0001_confused_swarm.sql")]);
 for(const route of ["/admin","/workshop","/settings"])assert.match(nav,new RegExp(route.replaceAll("/","\\/")));
 assert.match(kiosk,/\/kiosk\/custom/);
 assert.match(kiosk,/category-name omeat/);
 assert.match(custom,/idempotencyKey/);
 assert.match(customApi,/custom_order_events/);
 assert.match(settings,/제품 사진 URL/);
 assert.match(settingsApi,/OPERATOR_USER_IDS/);
 assert.match(settingsApi,/configuration_events/);
 assert.match(d1,/custom_orders_no_hard_delete/);
});

test("all operating surfaces share navigation and sales has an alias route",async()=>{
 const [nav,kiosk,admin,workshop,settings,css,sales]=await Promise.all([read("app/components/AppNav.tsx"),read("app/components/KioskApp.tsx"),read("app/components/AdminApp.tsx"),read("app/components/WorkshopApp.tsx"),read("app/components/SettingsApp.tsx"),read("app/globals.css"),read("app/sales/page.tsx")]);
 for(const href of ["/kiosk","/admin","/workshop","/settings"])assert.match(nav,new RegExp('href: "'+href.replaceAll("/","\\/")+'"'));
 assert.match(nav,/aria-current/);
 assert.match(kiosk,/AppNav current="kiosk"/);
 assert.match(admin,/AppNav current="admin"/);
 assert.match(workshop,/AppNav current="workshop"/);
 assert.match(settings,/AppNav current="settings"/);
 assert.match(sales,/AdminApp/);
 assert.match(css,/\.category-rail\{[^}]*position:sticky;top:92px;height:calc\(100vh - 92px\)/);
});

test("sales and workshop refetch within three seconds and recover on focus and online",async()=>{
 const [admin,workshop,client]=await Promise.all([read("app/components/AdminApp.tsx"),read("app/components/WorkshopApp.tsx"),read("app/lib/orders-client.ts")]);
 for(const source of [admin,workshop]){
  assert.match(source,/setInterval\([\s\S]{0,100}2500\)/);
  assert.match(source,/addEventListener\("focus"/);
  assert.match(source,/addEventListener\("online"/);
 }
 assert.match(admin,/지금 새로고침/);
 assert.match(admin,/selectedDate/);
 assert.match(client,/date/);
});

test("custom order validates, preserves, and joins the main kiosk order",async()=>{
 const [custom,kiosk,ordersApi]=await Promise.all([read("app/components/CustomOrderApp.tsx"),read("app/components/KioskApp.tsx"),read("app/api/orders/route.ts")]);
 assert.match(custom,/onSubmit=\{complete\}/);
 assert.match(custom,/orderDraft\.customItem/);
 assert.match(custom,/customStorageKey/);
 assert.match(custom,/sessionStorage\.setItem/);
 assert.match(custom,/맞춤주문은 20만원부터 가능합니다/);
 assert.match(custom,/type="submit"/);
 assert.match(kiosk,/custom-review-item/);
 assert.match(custom,/\/kiosk\?resume=cart/);
 assert.match(kiosk,/draftHydrated&&step!=="done"/);
 assert.match(ordersApi,/order_item_customizations/);
});

test("sales date views exclude cancelled orders while search keeps history",async()=>{
 const [admin,ordersApi]=await Promise.all([read("app/components/AdminApp.tsx"),read("app/api/orders/route.ts")]);
 assert.match(admin,/order\.status !== "cancelled"/);
 assert.match(ordersApi,/o\.order_status!='cancelled'/);
 assert.match(ordersApi,/else if \(q\)[\s\S]*SELECT \* FROM orders WHERE order_no LIKE/);
});

test("P0 sales auth accepts configured user IDs or operator emails and disables response caches",async()=>{
 const [orders,status,fulfillment,settings,client]=await Promise.all([read("app/api/orders/route.ts"),read("app/api/orders/status/route.ts"),read("app/api/orders/fulfillment/route.ts"),read("app/api/settings/route.ts"),read("app/lib/orders-client.ts")]);
 for(const source of [orders,status,fulfillment,settings]){
  assert.match(source,/OPERATOR_USER_IDS/);
  assert.match(source,/OPERATOR_EMAILS/);
  assert.match(source,/user\.email\.toLowerCase\(\)/);
  assert.match(source,/isOperator\(user\)/);
 }
 assert.match(client,/cache:"no-store"/);
 assert.match(orders,/no-store, no-cache, must-revalidate/);
 assert.match(orders,/f\.fulfillment_type='pickup'/);
 assert.match(orders,/f\.ship_date=\?/);
 assert.match(orders,/ORDER BY o\.created_at DESC/);
});
