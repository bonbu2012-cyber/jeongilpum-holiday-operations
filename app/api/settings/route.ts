import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { DEFAULT_KIOSK_HEADLINE, parseStoredSetting } from "../../lib/app-settings";
import { latestProductAvailability, parseProductSoldOut } from "../../lib/product-availability";

type ProductRow = {
  id:string; category:string; code:string; name:string; subtitle:string; description:string;
  price:number; customer_display_weight:string|null; image_url:string|null; badge:string|null;
  display_order:number; active:number; version:number; updated_at:string|null;
};
type DailyLimitRow = {
  product_id:string; product_code:string; product_name:string; daily_limit:number|null;
  schedule_basis:string|null; active:number|null; version:number|null; updated_at:string|null;
  reserved_quantity:number|null;
};
type SeasonRow = {
  id:string; name:string; holiday_date:string; sales_start_date:string; sales_end_date:string;
  active:number; version:number; updated_at:string|null;
};
type AppSettingRow = { id:string; after_data:string|null; created_at:string };
type ProductAvailabilityRow = { id:string; entity_id:string; after_data:string|null; created_at:string };
type ProductPayload = {
  type:"product"; id:string; expectedVersion:number; category:string; name:string; subtitle:string;
  description:string; price:number; customerDisplayWeight?:string; imageUrl?:string; badge?:string;
  displayOrder:number; active:boolean;
};
type SeasonPayload = {
  type:"season"; id:string; expectedVersion:number; name:string; holidayDate:string;
  salesStartDate:string; salesEndDate:string; active:boolean;
};
type AppSettingPayload = { type:"app_setting"; key:"kiosk_headline"; value:string; expectedVersion:string };
type DailyLimitPayload = { type:"daily_limit"; productId:string; dailyLimit:number; expectedVersion:number|null };
type ProductAvailabilityPayload = { type:"product_availability"; productId:string; soldOut:boolean; expectedVersion:string };
type Payload = ProductPayload | SeasonPayload | AppSettingPayload | DailyLimitPayload | ProductAvailabilityPayload;

const runtimeEnv=env as typeof env&{DB:D1Database;OPERATOR_USER_IDS?:string;OPERATOR_EMAILS?:string};
function configured(value:string|undefined){return(value??"").split(",").map(item=>item.trim()).filter(Boolean)}
function isOperator(user:{userId:string;email:string}){return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId)||configured(runtimeEnv.OPERATOR_EMAILS).map(value=>value.toLowerCase()).includes(user.email.toLowerCase())}
function todayInSeoul(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function product(row:ProductRow){return{id:row.id,category:row.category,code:row.code,name:row.name,subtitle:row.subtitle,description:row.description,price:row.price,customerDisplayWeight:row.customer_display_weight,imageUrl:row.image_url,badge:row.badge,displayOrder:row.display_order,active:Boolean(row.active),version:row.version,updatedAt:row.updated_at}}
function season(row:SeasonRow){return{id:row.id,name:row.name,holidayDate:row.holiday_date,salesStartDate:row.sales_start_date,salesEndDate:row.sales_end_date,active:Boolean(row.active),version:row.version,updatedAt:row.updated_at}}

async function authorize(){
  const user=await getChatGPTUser();
  if(!user)return{error:Response.json({error:"로그인이 필요합니다."},{status:401})};
  if(!isOperator(user))return{error:Response.json({error:"설정 권한이 없습니다."},{status:403})};
  return{user};
}

export async function GET(){
  const auth=await authorize();
  if("error" in auth)return auth.error;
  try{
    const today=todayInSeoul();
    const[products,seasons,headline,dailyLimits,availabilityEvents]=await Promise.all([
      runtimeEnv.DB.prepare("SELECT id,category,code,name,subtitle,description,price,customer_display_weight,image_url,badge,display_order,active,version,updated_at FROM products ORDER BY display_order,id").all<ProductRow>(),
      runtimeEnv.DB.prepare("SELECT id,name,holiday_date,sales_start_date,sales_end_date,active,version,updated_at FROM sales_seasons ORDER BY sales_start_date DESC").all<SeasonRow>(),
      runtimeEnv.DB.prepare("SELECT id,after_data,created_at FROM configuration_events WHERE entity_type='app_setting' AND entity_id='kiosk_headline' ORDER BY created_at DESC,id DESC LIMIT 1").first<AppSettingRow>(),
      runtimeEnv.DB.prepare("SELECT p.id AS product_id,p.code AS product_code,p.name AS product_name,l.daily_limit,l.schedule_basis,l.active,l.version,l.updated_at,COALESCE((SELECT SUM(r.quantity) FROM product_daily_reservations r WHERE r.product_id=p.id AND r.reserve_date=? AND r.status='active'),0) AS reserved_quantity FROM products p LEFT JOIN product_daily_limits l ON l.product_id=p.id WHERE p.category='프리미엄' ORDER BY p.display_order,p.id").bind(today).all<DailyLimitRow>(),
      runtimeEnv.DB.prepare("SELECT id,entity_id,after_data,created_at FROM configuration_events WHERE entity_type='product_availability' ORDER BY created_at DESC,id DESC").all<ProductAvailabilityRow>(),
    ]);
    const availabilityByProduct=latestProductAvailability(availabilityEvents.results.map(row=>({id:row.id,entityId:row.entity_id,afterData:row.after_data})));
    return Response.json({products:products.results.map(row=>{const availability=availabilityByProduct.get(row.id);return{...product(row),soldOut:availability?.soldOut??false,availabilityVersion:availability?.version??""}}),seasons:seasons.results.map(season),dailyLimits:dailyLimits.results.map(row=>{const dailyLimit=row.daily_limit??1,active=Boolean(row.active),reservedQuantity=active?row.reserved_quantity??0:0,remainingQuantity=active?Math.max(0,dailyLimit-reservedQuantity):null;return{productId:row.product_id,productCode:row.product_code,productName:row.product_name,dailyLimit,active,reservedQuantity,remainingQuantity,autoSoldOut:active&&remainingQuantity===0,availabilityDate:today,version:row.version,updatedAt:row.updated_at}}),appSettings:{kioskHeadline:{value:parseStoredSetting(headline?.after_data,DEFAULT_KIOSK_HEADLINE),version:headline?.id??"",updatedAt:headline?.created_at??null}}},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"설정을 불러오지 못했습니다."},{status:500})}
}

export async function PATCH(request:Request){
  const auth=await authorize();
  if("error" in auth)return auth.error;
  try{
    const payload=await request.json() as Payload;
    const now=new Date().toISOString();
    if(payload.type==="app_setting"){
      const value=payload.value?.trim();
      if(payload.key!=="kiosk_headline"||!value)return Response.json({error:"키오스크 상단 문구를 입력해주세요."},{status:400});
      const current=await runtimeEnv.DB.prepare("SELECT id,after_data,created_at FROM configuration_events WHERE entity_type='app_setting' AND entity_id='kiosk_headline' ORDER BY created_at DESC,id DESC LIMIT 1").first<AppSettingRow>();
      const currentVersion=current?.id??"";
      if(currentVersion!==payload.expectedVersion)return Response.json({error:"다른 화면에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요."},{status:409});
      const id=crypto.randomUUID(),before={value:parseStoredSetting(current?.after_data,DEFAULT_KIOSK_HEADLINE)},after={value};
      const result=await runtimeEnv.DB.prepare("INSERT INTO configuration_events(id,entity_type,entity_id,before_data,after_data,actor_id,created_at) SELECT ?,'app_setting','kiosk_headline',?,?,?,? WHERE COALESCE((SELECT id FROM configuration_events WHERE entity_type='app_setting' AND entity_id='kiosk_headline' ORDER BY created_at DESC,id DESC LIMIT 1),'')=?").bind(id,JSON.stringify(before),JSON.stringify(after),auth.user.userId,now,payload.expectedVersion).run();
      if(!result.meta.changes)return Response.json({error:"다른 화면에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요."},{status:409});
      return Response.json({ok:true,version:id,updatedAt:now,value});
    }
    if(payload.type==="product"){
      const current=await runtimeEnv.DB.prepare("SELECT id,category,code,name,subtitle,description,price,customer_display_weight,image_url,badge,display_order,active,version,updated_at FROM products WHERE id=?").bind(payload.id).first<ProductRow>();
      if(!current)return Response.json({error:"상품을 찾을 수 없습니다."},{status:404});
      if(current.version!==payload.expectedVersion)return Response.json({error:"다른 화면에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요."},{status:409});
      const price=Number(payload.price),displayOrder=Number(payload.displayOrder);
      if(!payload.name?.trim()||!payload.category?.trim()||!Number.isInteger(price)||price<1||!Number.isInteger(displayOrder))return Response.json({error:"상품명·분류·가격·노출순서를 확인해주세요."},{status:400});
      const after={category:payload.category.trim(),name:payload.name.trim(),subtitle:payload.subtitle?.trim()??"",description:payload.description?.trim()??"",price,customerDisplayWeight:payload.customerDisplayWeight?.trim()||null,imageUrl:payload.imageUrl?.trim()||null,badge:payload.badge?.trim()||null,displayOrder,active:Boolean(payload.active)};
      await runtimeEnv.DB.batch([
        runtimeEnv.DB.prepare("UPDATE products SET category=?,name=?,subtitle=?,description=?,price=?,customer_display_weight=?,image_url=?,badge=?,display_order=?,active=?,version=version+1,updated_at=? WHERE id=? AND version=?").bind(after.category,after.name,after.subtitle,after.description,after.price,after.customerDisplayWeight,after.imageUrl,after.badge,after.displayOrder,after.active?1:0,now,payload.id,payload.expectedVersion),
        runtimeEnv.DB.prepare("INSERT INTO configuration_events(id,entity_type,entity_id,before_data,after_data,actor_id,created_at) VALUES(?,'product',?,?,?,?,?)").bind(crypto.randomUUID(),payload.id,JSON.stringify(product(current)),JSON.stringify(after),auth.user.userId,now),
      ]);
      return Response.json({ok:true,version:current.version+1,updatedAt:now});
    }
    if(payload.type==="product_availability"){
      const target=await runtimeEnv.DB.prepare("SELECT id,name FROM products WHERE id=?").bind(payload.productId).first<{id:string;name:string}>();
      if(!target)return Response.json({error:"상품을 찾을 수 없습니다."},{status:404});
      const current=await runtimeEnv.DB.prepare("SELECT id,entity_id,after_data,created_at FROM configuration_events WHERE entity_type='product_availability' AND entity_id=? ORDER BY created_at DESC,id DESC LIMIT 1").bind(payload.productId).first<ProductAvailabilityRow>();
      const currentVersion=current?.id??"";
      if(currentVersion!==payload.expectedVersion)return Response.json({error:"다른 화면에서 먼저 품절 상태를 수정했습니다. 새로고침 후 다시 시도해주세요."},{status:409});
      const soldOut=payload.soldOut===true;
      const before={soldOut:parseProductSoldOut(current?.after_data)};
      if(before.soldOut===soldOut)return Response.json({ok:true,version:currentVersion,updatedAt:current?.created_at??null,soldOut});
      const id=crypto.randomUUID(),after={soldOut};
      const result=await runtimeEnv.DB.prepare("INSERT INTO configuration_events(id,entity_type,entity_id,before_data,after_data,actor_id,created_at) SELECT ?,'product_availability',?,?,?,?,? WHERE COALESCE((SELECT id FROM configuration_events WHERE entity_type='product_availability' AND entity_id=? ORDER BY created_at DESC,id DESC LIMIT 1),'')=?").bind(id,payload.productId,JSON.stringify(before),JSON.stringify(after),auth.user.userId,now,payload.productId,payload.expectedVersion).run();
      if(!result.meta.changes)return Response.json({error:"다른 화면에서 먼저 품절 상태를 수정했습니다. 새로고침 후 다시 시도해주세요."},{status:409});
      return Response.json({ok:true,version:id,updatedAt:now,soldOut});
    }
    if(payload.type==="daily_limit"){
      const dailyLimit=Number(payload.dailyLimit);
      if(!Number.isInteger(dailyLimit)||dailyLimit<1)return Response.json({error:"한정 판매량은 1세트 이상의 정수로 입력해주세요."},{status:400});
      const premium=await runtimeEnv.DB.prepare("SELECT id,name FROM products WHERE id=? AND category='프리미엄'").bind(payload.productId).first<{id:string;name:string}>();
      if(!premium)return Response.json({error:"프리미엄 상품을 찾을 수 없습니다."},{status:404});
      const current=await runtimeEnv.DB.prepare("SELECT product_id,daily_limit,schedule_basis,active,version,updated_at FROM product_daily_limits WHERE product_id=?").bind(payload.productId).first<{product_id:string;daily_limit:number;schedule_basis:string;active:number;version:number;updated_at:string}>();
      const after={dailyLimit,scheduleBasis:current?.schedule_basis??"fulfillment_date",active:true};
      if(current){
        if(current.version!==payload.expectedVersion)return Response.json({error:"다른 화면에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요."},{status:409});
        await runtimeEnv.DB.batch([
          runtimeEnv.DB.prepare("UPDATE product_daily_limits SET daily_limit=?,active=1,version=version+1,updated_at=? WHERE product_id=? AND version=?").bind(dailyLimit,now,payload.productId,payload.expectedVersion),
          runtimeEnv.DB.prepare("INSERT INTO configuration_events(id,entity_type,entity_id,before_data,after_data,actor_id,created_at) VALUES(?,'product_daily_limit',?,?,?,?,?)").bind(crypto.randomUUID(),payload.productId,JSON.stringify({dailyLimit:current.daily_limit,scheduleBasis:current.schedule_basis,active:Boolean(current.active)}),JSON.stringify(after),auth.user.userId,now),
        ]);
        return Response.json({ok:true,version:current.version+1,updatedAt:now,dailyLimit});
      }
      if(payload.expectedVersion!==null)return Response.json({error:"다른 화면에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요."},{status:409});
      await runtimeEnv.DB.batch([
        runtimeEnv.DB.prepare("INSERT INTO product_daily_limits(product_id,daily_limit,schedule_basis,active,version,updated_at) VALUES(?,?,'fulfillment_date',1,1,?)").bind(payload.productId,dailyLimit,now),
        runtimeEnv.DB.prepare("INSERT INTO configuration_events(id,entity_type,entity_id,before_data,after_data,actor_id,created_at) VALUES(?,'product_daily_limit',?,NULL,?,?,?)").bind(crypto.randomUUID(),payload.productId,JSON.stringify(after),auth.user.userId,now),
      ]);
      return Response.json({ok:true,version:1,updatedAt:now,dailyLimit});
    }
    if(payload.type==="season"){
      const current=await runtimeEnv.DB.prepare("SELECT id,name,holiday_date,sales_start_date,sales_end_date,active,version,updated_at FROM sales_seasons WHERE id=?").bind(payload.id).first<SeasonRow>();
      if(!current)return Response.json({error:"판매시즌을 찾을 수 없습니다."},{status:404});
      if(current.version!==payload.expectedVersion)return Response.json({error:"다른 화면에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요."},{status:409});
      if(!payload.name?.trim()||!payload.holidayDate||!payload.salesStartDate||!payload.salesEndDate)return Response.json({error:"시즌명과 판매 일정을 확인해주세요."},{status:400});
      const after={name:payload.name.trim(),holidayDate:payload.holidayDate,salesStartDate:payload.salesStartDate,salesEndDate:payload.salesEndDate,active:Boolean(payload.active)};
      await runtimeEnv.DB.batch([
        runtimeEnv.DB.prepare("UPDATE sales_seasons SET name=?,holiday_date=?,sales_start_date=?,sales_end_date=?,active=?,version=version+1,updated_at=? WHERE id=? AND version=?").bind(after.name,after.holidayDate,after.salesStartDate,after.salesEndDate,after.active?1:0,now,payload.id,payload.expectedVersion),
        runtimeEnv.DB.prepare("INSERT INTO configuration_events(id,entity_type,entity_id,before_data,after_data,actor_id,created_at) VALUES(?,'season',?,?,?,?,?)").bind(crypto.randomUUID(),payload.id,JSON.stringify(season(current)),JSON.stringify(after),auth.user.userId,now),
      ]);
      return Response.json({ok:true,version:current.version+1,updatedAt:now});
    }
    return Response.json({error:"지원하지 않는 설정입니다."},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"설정을 저장하지 못했습니다."},{status:500})}
}
