import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type OrderRow = { id:string; order_no:string; buyer_name_snapshot:string; buyer_phone_snapshot:string; order_status:string; fulfillment_type:string; schedule_label:string; recipient_name:string|null; recipient_phone:string|null; road_address:string|null; detail_address:string|null; customer_note:string; total_amount:number; version:number; submitted_at:string };
type ItemRow = { id:string; order_id:string; product_id:string; product_name_snapshot:string; quantity:number; sale_unit_price:number };
type PackageRow = { order_id:string; package_code:string };
type ProductRow = { id:string; name:string; price:number; active:number };
type CreatePayload = { idempotencyKey?:string; buyerName?:string; buyerPhone?:string; fulfillmentType?:"pickup"|"shipping"; scheduleLabel?:string; recipientName?:string; recipientPhone?:string; roadAddress?:string; detailAddress?:string; note?:string; items?:{productId?:string;quantity?:number}[] };
const runtimeEnv = env as typeof env & { DB: D1Database; OPERATOR_USER_IDS?: string };

function isOperator(userId:string){return (runtimeEnv.OPERATOR_USER_IDS??"").split(",").map(v=>v.trim()).filter(Boolean).includes(userId)}
function normalizePhone(value:string){return value.replace(/\D/g,"")}
function createOrderNo(){const n=new Date(),d=[String(n.getFullYear()).slice(-2),String(n.getMonth()+1).padStart(2,"0"),String(n.getDate()).padStart(2,"0")].join("");return `JI-${d}-${String(Math.floor(1000+Math.random()*9000))}`}

async function serializeOrders(rows:OrderRow[]){
 if(!rows.length)return [];
 const ids=rows.map(r=>r.id),p=ids.map(()=>"?").join(",");
 const [ir,pr]=await Promise.all([
  runtimeEnv.DB.prepare(`SELECT id,order_id,product_id,product_name_snapshot,quantity,sale_unit_price FROM order_items WHERE order_id IN (${p})`).bind(...ids).all<ItemRow>(),
  runtimeEnv.DB.prepare(`SELECT order_id,package_code FROM packages WHERE order_id IN (${p}) AND package_status!='voided'`).bind(...ids).all<PackageRow>()
 ]);
 return rows.map(r=>({id:r.id,orderNo:r.order_no,buyerName:r.buyer_name_snapshot,buyerPhone:r.buyer_phone_snapshot,status:r.order_status,fulfillmentType:r.fulfillment_type,scheduleLabel:r.schedule_label,recipientName:r.recipient_name,recipientPhone:r.recipient_phone,roadAddress:r.road_address,detailAddress:r.detail_address,note:r.customer_note,totalAmount:r.total_amount,version:r.version,submittedAt:r.submitted_at,items:ir.results.filter(i=>i.order_id===r.id).map(i=>({id:i.id,productId:i.product_id,name:i.product_name_snapshot,quantity:i.quantity,unitPrice:i.sale_unit_price})),packageCodes:pr.results.filter(i=>i.order_id===r.id).map(i=>i.package_code)}));
}

export async function GET(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:"로그인이 필요합니다."},{status:401});
 if(!isOperator(user.userId))return Response.json({error:"운영자 권한이 없습니다."},{status:403});
 try{
  const q=new URL(request.url).searchParams.get("q")?.trim()??"",like=`%${q}%`;
  const result=q?await runtimeEnv.DB.prepare(`SELECT * FROM orders WHERE order_no LIKE ? OR buyer_name_snapshot LIKE ? OR buyer_phone_snapshot LIKE ? OR recipient_name LIKE ? ORDER BY created_at DESC LIMIT 100`).bind(like,like,like,like).all<OrderRow>():await runtimeEnv.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100").all<OrderRow>();
  return Response.json({orders:await serializeOrders(result.results)},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"주문을 불러오지 못했습니다."},{status:500})}
}

export async function POST(request:Request){
 try{
  const x=await request.json() as CreatePayload,key=x.idempotencyKey?.trim()??"",buyer=x.buyerName?.trim()??"",phone=normalizePhone(x.buyerPhone??"");
  const items=(x.items??[]).filter(i=>i.productId&&Number.isInteger(i.quantity)&&(i.quantity??0)>0);
  if(!key||!buyer||phone.length<10||!x.fulfillmentType||!x.scheduleLabel||!items.length)return Response.json({error:"필수 주문정보를 확인해주세요."},{status:400});
  if(x.fulfillmentType==="shipping"&&(!x.recipientName?.trim()||normalizePhone(x.recipientPhone??"").length<10||!x.roadAddress?.trim()))return Response.json({error:"받는 분과 배송 주소를 확인해주세요."},{status:400});
  const existing=await runtimeEnv.DB.prepare("SELECT * FROM orders WHERE idempotency_key=?").bind(key).first<OrderRow>();
  if(existing){const [order]=await serializeOrders([existing]);return Response.json({order,duplicate:true})}
  const ids=items.map(i=>i.productId as string),p=ids.map(()=>"?").join(",");
  const products=await runtimeEnv.DB.prepare(`SELECT id,name,price,active FROM products WHERE id IN (${p})`).bind(...ids).all<ProductRow>();
  if(products.results.length!==ids.length||products.results.some(v=>!v.active))return Response.json({error:"현재 주문할 수 없는 상품이 포함되어 있습니다."},{status:409});
  const id=crypto.randomUUID(),number=createOrderNo(),now=new Date().toISOString();
  const priced=items.map(i=>{const product=products.results.find(v=>v.id===i.productId)!;return {...i,product,lineTotal:product.price*(i.quantity as number)}}),total=priced.reduce((s,i)=>s+i.lineTotal,0);
  await runtimeEnv.DB.batch([
   runtimeEnv.DB.prepare(`INSERT INTO orders(id,order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,order_status,fulfillment_type,schedule_label,recipient_name,recipient_phone,road_address,detail_address,customer_note,total_amount,idempotency_key,version,submitted_at,created_at,updated_at) VALUES(?,?,'season-2026-chuseok',?,?,'submitted',?,?,?,?,?,?,?,?,?,1,?,?,?)`).bind(id,number,buyer,phone,x.fulfillmentType,x.scheduleLabel,x.recipientName?.trim()||null,normalizePhone(x.recipientPhone??"")||null,x.roadAddress?.trim()||null,x.detailAddress?.trim()||null,x.note?.trim()||"",total,key,now,now,now),
   ...priced.map(i=>runtimeEnv.DB.prepare(`INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,list_price_snapshot,sale_unit_price,quantity,line_total,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),id,i.product.id,i.product.name,i.product.price,i.product.price,i.quantity,i.lineTotal,now)),
   runtimeEnv.DB.prepare(`INSERT INTO order_events(id,order_id,event_type,after_data,created_at) VALUES(?,?,'order_submitted',?,?)`).bind(crypto.randomUUID(),id,JSON.stringify({fulfillmentType:x.fulfillmentType,totalAmount:total}),now)
  ]);
  const created=await runtimeEnv.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first<OrderRow>(),[order]=await serializeOrders(created?[created]:[]);
  return Response.json({order},{status:201});
 }catch(error){const m=error instanceof Error?error.message:"주문을 접수하지 못했습니다.";if(m.includes("UNIQUE")||m.includes("idempotency"))return Response.json({error:"같은 주문을 확인하고 있습니다. 잠시 후 다시 시도해주세요."},{status:409});return Response.json({error:m},{status:500})}
}
