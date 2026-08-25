import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type OrderRow = { id:string; order_no:string; buyer_name_snapshot:string; buyer_phone_snapshot:string; order_status:string; fulfillment_type:string; schedule_label:string; recipient_name:string|null; recipient_phone:string|null; road_address:string|null; detail_address:string|null; customer_note:string; total_amount:number; version:number; submitted_at:string };
type ItemRow = { id:string; order_id:string; product_id:string; product_name_snapshot:string; quantity:number; sale_unit_price:number };
type PackageRow = { order_id:string; package_code:string };
type ProductRow = { id:string; name:string; price:number; active:number };
type SeasonRow = { id:string; sales_start_date:string; sales_end_date:string; active:number };
type FulfillmentRow = { id:string; order_id:string; fulfillment_type:"pickup"|"shipping"; pickup_at:string|null; ship_date:string|null; recipient_name:string|null; recipient_phone:string|null; postal_code:string|null; road_addr:string|null; road_addr_reference:string|null; jibun_addr:string|null; detail_addr:string|null; customer_arrived:number; note:string };
type CreatePayload = {
  idempotencyKey?:string; buyerName?:string; buyerPhone?:string;
  fulfillmentType?:"pickup"|"shipping"; pickupDate?:string; pickupTime?:string; shipDate?:string;
  recipientName?:string; recipientPhone?:string; postalCode?:string; roadAddr?:string;
  roadAddrReference?:string; jibunAddr?:string; detailAddr?:string; note?:string;
  items?:{productId?:string;quantity?:number}[];
};

const runtimeEnv = env as typeof env & { DB:D1Database; OPERATOR_USER_IDS?:string; OPERATOR_EMAILS?:string };
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function configured(value:string|undefined){return(value??"").split(",").map(item=>item.trim()).filter(Boolean)}
function isOperator(user:{userId:string;email:string}){return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId)||configured(runtimeEnv.OPERATOR_EMAILS).map(value=>value.toLowerCase()).includes(user.email.toLowerCase())}
function normalizePhone(value:string){return value.replace(/\D/g,"")}
function todayInSeoul(){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const value=(type:string)=>parts.find(part=>part.type===type)?.value??"";return `${value("year")}-${value("month")}-${value("day")}`}
function validIsoDate(value:string){if(!isoDatePattern.test(value))return false;const [year,month,day]=value.split("-").map(Number),date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day}
function validPickupTime(value:string){const match=/^(\d{2}):(00|30)$/.exec(value);if(!match)return false;const hour=Number(match[1]);return hour>=8&&hour<=21&&(hour<21||match[2]==="00")}
function koreanDate(value:string){const [year,month,day]=value.split("-").map(Number),date=new Date(Date.UTC(year,month-1,day)),weekdays=["일","월","화","수","목","금","토"];return `${month}월 ${day}일 (${weekdays[date.getUTCDay()]})`}
function createOrderNo(){const date=todayInSeoul().replaceAll("-","").slice(2);return `JI-${date}-${String(Math.floor(1000+Math.random()*9000))}`}
function fulfillmentScheduleLabel(fulfillment:FulfillmentRow){if(fulfillment.pickup_at){const [date,timePart]=fulfillment.pickup_at.split("T");return `${koreanDate(date)} · ${timePart.slice(0,5)}`}if(fulfillment.ship_date)return `${koreanDate(fulfillment.ship_date)} 발송 예정`;return "일정 미지정"}

async function serializeOrders(rows:OrderRow[]){
  if(!rows.length)return [];
  const ids=rows.map(r=>r.id),placeholders=ids.map(()=>"?").join(",");
  const [itemResult,packageResult,fulfillmentResult]=await Promise.all([
    runtimeEnv.DB.prepare(`SELECT id,order_id,product_id,product_name_snapshot,quantity,sale_unit_price FROM order_items WHERE order_id IN (${placeholders})`).bind(...ids).all<ItemRow>(),
    runtimeEnv.DB.prepare(`SELECT order_id,package_code FROM packages WHERE order_id IN (${placeholders}) AND package_status!='voided'`).bind(...ids).all<PackageRow>(),
    runtimeEnv.DB.prepare(`SELECT id,order_id,fulfillment_type,pickup_at,ship_date,recipient_name,recipient_phone,postal_code,road_addr,road_addr_reference,jibun_addr,detail_addr,customer_arrived,note FROM fulfillments WHERE order_id IN (${placeholders})`).bind(...ids).all<FulfillmentRow>()
  ]);
  return rows.map(row=>{
    const fulfillment=fulfillmentResult.results.find(item=>item.order_id===row.id);
    return {
      id:row.id,orderNo:row.order_no,buyerName:row.buyer_name_snapshot,buyerPhone:row.buyer_phone_snapshot,status:row.order_status,
      fulfillmentType:fulfillment?.fulfillment_type??row.fulfillment_type,
      scheduleLabel:fulfillment?fulfillmentScheduleLabel(fulfillment):"일정 미지정 · 기존 주문",
      fulfillmentId:fulfillment?.id??null,pickupAt:fulfillment?.pickup_at??null,shipDate:fulfillment?.ship_date??null,
      recipientName:fulfillment?.recipient_name??row.recipient_name,recipientPhone:fulfillment?.recipient_phone??row.recipient_phone,
      postalCode:fulfillment?.postal_code??null,roadAddress:fulfillment?.road_addr??row.road_address,
      roadAddrReference:fulfillment?.road_addr_reference??null,jibunAddr:fulfillment?.jibun_addr??null,
      detailAddress:fulfillment?.detail_addr??row.detail_address,customerArrived:Boolean(fulfillment?.customer_arrived),
      note:fulfillment?.note??row.customer_note,totalAmount:row.total_amount,version:row.version,submittedAt:row.submitted_at,
      items:itemResult.results.filter(item=>item.order_id===row.id).map(item=>({id:item.id,productId:item.product_id,name:item.product_name_snapshot,quantity:item.quantity,unitPrice:item.sale_unit_price})),
      packageCodes:packageResult.results.filter(item=>item.order_id===row.id).map(item=>item.package_code)
    };
  });
}

export async function GET(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"로그인이 필요합니다."},{status:401});
  if(!isOperator(user))return Response.json({error:"운영자 권한이 없습니다."},{status:403});
  try{
    const params=new URL(request.url).searchParams,q=params.get("q")?.trim()??"",date=params.get("date")?.trim()??"",like=`%${q}%`;
    if(date&&!validIsoDate(date))return Response.json({error:"조회 날짜 형식을 확인해주세요."},{status:400});
    let result:D1Result<OrderRow>;
    if(q&&date){
      result=await runtimeEnv.DB.prepare(`SELECT o.* FROM orders o LEFT JOIN fulfillments f ON f.order_id=o.id WHERE (((f.fulfillment_type='pickup' AND substr(f.pickup_at,1,10)=?) OR (f.fulfillment_type='shipping' AND f.ship_date=?)) OR f.id IS NULL) AND (o.order_no LIKE ? OR o.buyer_name_snapshot LIKE ? OR o.buyer_phone_snapshot LIKE ? OR f.recipient_name LIKE ?) ORDER BY o.created_at DESC LIMIT 100`).bind(date,date,like,like,like,like).all<OrderRow>();
    }else if(date){
      result=await runtimeEnv.DB.prepare(`SELECT o.* FROM orders o LEFT JOIN fulfillments f ON f.order_id=o.id WHERE (f.fulfillment_type='pickup' AND substr(f.pickup_at,1,10)=?) OR (f.fulfillment_type='shipping' AND f.ship_date=?) OR f.id IS NULL ORDER BY o.created_at DESC LIMIT 100`).bind(date,date).all<OrderRow>();
    }else if(q){
      result=await runtimeEnv.DB.prepare(`SELECT * FROM orders WHERE order_no LIKE ? OR buyer_name_snapshot LIKE ? OR buyer_phone_snapshot LIKE ? OR recipient_name LIKE ? ORDER BY created_at DESC LIMIT 100`).bind(like,like,like,like).all<OrderRow>();
    }else{
      result=await runtimeEnv.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100").all<OrderRow>();
    }
    return Response.json({orders:await serializeOrders(result.results)},{headers:{"Cache-Control":"no-store, no-cache, must-revalidate","Pragma":"no-cache","Expires":"0"}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"주문을 불러오지 못했습니다."},{status:500})}
}

export async function POST(request:Request){
  let idempotencyKey="";
  try{
    const payload=await request.json() as CreatePayload;
    idempotencyKey=payload.idempotencyKey?.trim()??"";
    const buyer=payload.buyerName?.trim()??"",phone=normalizePhone(payload.buyerPhone??""),items=(payload.items??[]).filter(item=>item.productId&&Number.isInteger(item.quantity)&&(item.quantity??0)>0);
    if(!idempotencyKey||!buyer||phone.length<10||!payload.fulfillmentType||!items.length)return Response.json({error:"주문자와 상품 정보를 확인해주세요."},{status:400});
    const existing=await runtimeEnv.DB.prepare("SELECT * FROM orders WHERE idempotency_key=?").bind(idempotencyKey).first<OrderRow>();
    if(existing){const [order]=await serializeOrders([existing]);return Response.json({order,duplicate:true})}

    const season=await runtimeEnv.DB.prepare("SELECT id,sales_start_date,sales_end_date,active FROM sales_seasons WHERE active=1 ORDER BY sales_start_date DESC LIMIT 1").first<SeasonRow>();
    if(!season)return Response.json({error:"현재 예약 가능한 판매 시즌이 없습니다."},{status:409});
    const today=todayInSeoul(),scheduleDate=payload.fulfillmentType==="pickup"?(payload.pickupDate?.trim()??""):(payload.shipDate?.trim()??"");
    if(!validIsoDate(scheduleDate)||scheduleDate<today||scheduleDate<season.sales_start_date||scheduleDate>season.sales_end_date)return Response.json({error:"예약 가능한 날짜를 다시 선택해주세요."},{status:400});
    if(payload.fulfillmentType==="pickup"&&!validPickupTime(payload.pickupTime?.trim()??""))return Response.json({error:"방문 시간을 08:00부터 21:00 사이에서 선택해주세요."},{status:400});
    const recipientName=payload.recipientName?.trim()??"",recipientPhone=normalizePhone(payload.recipientPhone??""),postalCode=(payload.postalCode??"").replace(/\D/g,""),roadAddr=payload.roadAddr?.trim()??"",detailAddr=payload.detailAddr?.trim()??"";
    if(payload.fulfillmentType==="shipping"&&(!recipientName||recipientPhone.length<10||postalCode.length!==5||roadAddr.length<5||!detailAddr))return Response.json({error:"받는 분, 우편번호, 배송주소와 상세주소를 확인해주세요."},{status:400});

    const productIds=items.map(item=>item.productId as string),productPlaceholders=productIds.map(()=>"?").join(","),productResult=await runtimeEnv.DB.prepare(`SELECT id,name,price,active FROM products WHERE id IN (${productPlaceholders})`).bind(...productIds).all<ProductRow>();
    if(productResult.results.length!==productIds.length||productResult.results.some(product=>!product.active))return Response.json({error:"현재 주문할 수 없는 상품이 포함되어 있습니다."},{status:409});

    const orderId=crypto.randomUUID(),fulfillmentId=crypto.randomUUID(),orderNo=createOrderNo(),now=new Date().toISOString(),pickupTime=payload.pickupTime?.trim()??"";
    const pickupAt=payload.fulfillmentType==="pickup"?`${scheduleDate}T${pickupTime}:00+09:00`:null,shipDate=payload.fulfillmentType==="shipping"?scheduleDate:null,scheduleLabel=payload.fulfillmentType==="pickup"?`${koreanDate(scheduleDate)} · ${pickupTime}`:`${koreanDate(scheduleDate)} 발송 예정`;
    const pricedItems=items.map(item=>{const product=productResult.results.find(value=>value.id===item.productId)!;return {...item,id:crypto.randomUUID(),product,lineTotal:product.price*(item.quantity as number)}}),total=pricedItems.reduce((sum,item)=>sum+item.lineTotal,0);
    await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(`INSERT INTO orders(id,order_no,season_id,buyer_name_snapshot,buyer_phone_snapshot,order_status,fulfillment_type,schedule_label,recipient_name,recipient_phone,road_address,detail_address,customer_note,total_amount,idempotency_key,version,submitted_at,created_at,updated_at) VALUES(?,?,?,?,?,'submitted',?,?,?,?,?,?,?,?,?,1,?,?,?)`).bind(orderId,orderNo,season.id,buyer,phone,payload.fulfillmentType,scheduleLabel,recipientName||null,recipientPhone||null,roadAddr||null,detailAddr||null,payload.note?.trim()||"",total,idempotencyKey,now,now,now),
      ...pricedItems.map(item=>runtimeEnv.DB.prepare(`INSERT INTO order_items(id,order_id,product_id,product_name_snapshot,list_price_snapshot,sale_unit_price,quantity,line_total,created_at) VALUES(?,?,?,?,?,?,?,?,?)`).bind(item.id,orderId,item.product.id,item.product.name,item.product.price,item.product.price,item.quantity,item.lineTotal,now)),
      runtimeEnv.DB.prepare(`INSERT INTO fulfillments(id,order_id,fulfillment_type,pickup_at,ship_date,recipient_name,recipient_phone,postal_code,road_addr,road_addr_reference,jibun_addr,detail_addr,status,customer_arrived,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'scheduled',0,?,?,?)`).bind(fulfillmentId,orderId,payload.fulfillmentType,pickupAt,shipDate,recipientName||null,recipientPhone||null,postalCode||null,roadAddr||null,payload.roadAddrReference?.trim()||null,payload.jibunAddr?.trim()||null,detailAddr||null,payload.note?.trim()||"",now,now),
      ...pricedItems.map(item=>runtimeEnv.DB.prepare(`INSERT INTO fulfillment_items(id,fulfillment_id,order_item_id,quantity,created_at) VALUES(?,?,?,?,?)`).bind(crypto.randomUUID(),fulfillmentId,item.id,item.quantity,now)),
      runtimeEnv.DB.prepare(`INSERT INTO order_events(id,order_id,event_type,after_data,created_at) VALUES(?,?,'order_submitted',?,?)`).bind(crypto.randomUUID(),orderId,JSON.stringify({fulfillmentType:payload.fulfillmentType,totalAmount:total,pickupAt,shipDate}),now)
    ]);
    const created=await runtimeEnv.DB.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first<OrderRow>(),[order]=await serializeOrders(created?[created]:[]);
    return Response.json({order},{status:201});
  }catch(error){
    const message=error instanceof Error?error.message:"주문을 접수하지 못했습니다.";
    if((message.includes("UNIQUE")||message.includes("idempotency"))&&idempotencyKey){const existing=await runtimeEnv.DB.prepare("SELECT * FROM orders WHERE idempotency_key=?").bind(idempotencyKey).first<OrderRow>();if(existing){const [order]=await serializeOrders([existing]);return Response.json({order,duplicate:true})}}
    return Response.json({error:message},{status:500});
  }
}
