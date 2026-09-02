import { env } from "cloudflare:workers";
import { DEFAULT_KIOSK_HEADLINE, parseStoredSetting } from "../../lib/app-settings";
import { OPERATOR_ACTOR, requireOperatorApi } from "../../lib/operator-session";

type ProductRow = {
  id:string; category:string; code:string; name:string; subtitle:string; description:string;
  price:number; customer_display_weight:string|null; image_url:string|null; badge:string|null;
  display_order:number; active:number; version:number; updated_at:string|null;
};
type SeasonRow = {
  id:string; name:string; holiday_date:string; sales_start_date:string; sales_end_date:string;
  active:number; version:number; updated_at:string|null;
};
type AppSettingRow = { id:string; after_data:string|null; created_at:string };
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
type Payload = ProductPayload | SeasonPayload | AppSettingPayload;

const runtimeEnv=env as typeof env&{DB:D1Database};
function product(row:ProductRow){return{id:row.id,category:row.category,code:row.code,name:row.name,subtitle:row.subtitle,description:row.description,price:row.price,customerDisplayWeight:row.customer_display_weight,imageUrl:row.image_url,badge:row.badge,displayOrder:row.display_order,active:Boolean(row.active),version:row.version,updatedAt:row.updated_at}}
function season(row:SeasonRow){return{id:row.id,name:row.name,holidayDate:row.holiday_date,salesStartDate:row.sales_start_date,salesEndDate:row.sales_end_date,active:Boolean(row.active),version:row.version,updatedAt:row.updated_at}}

async function authorize(){
  const denied=await requireOperatorApi();
  if(denied)return{error:denied};
  return{};
}

export async function GET(){
  const auth=await authorize();
  if("error" in auth)return auth.error;
  try{
    const[products,seasons,headline]=await Promise.all([
      runtimeEnv.DB.prepare("SELECT id,category,code,name,subtitle,description,price,customer_display_weight,image_url,badge,display_order,active,version,updated_at FROM products ORDER BY display_order,id").all<ProductRow>(),
      runtimeEnv.DB.prepare("SELECT id,name,holiday_date,sales_start_date,sales_end_date,active,version,updated_at FROM sales_seasons ORDER BY sales_start_date DESC").all<SeasonRow>(),
      runtimeEnv.DB.prepare("SELECT id,after_data,created_at FROM configuration_events WHERE entity_type='app_setting' AND entity_id='kiosk_headline' ORDER BY created_at DESC,id DESC LIMIT 1").first<AppSettingRow>(),
    ]);
    return Response.json({products:products.results.map(product),seasons:seasons.results.map(season),appSettings:{kioskHeadline:{value:parseStoredSetting(headline?.after_data,DEFAULT_KIOSK_HEADLINE),version:headline?.id??"",updatedAt:headline?.created_at??null}}},{headers:{"Cache-Control":"no-store"}});
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
      const result=await runtimeEnv.DB.prepare("INSERT INTO configuration_events(id,entity_type,entity_id,before_data,after_data,actor_id,created_at) SELECT ?,'app_setting','kiosk_headline',?,?,?,? WHERE COALESCE((SELECT id FROM configuration_events WHERE entity_type='app_setting' AND entity_id='kiosk_headline' ORDER BY created_at DESC,id DESC LIMIT 1),'')=?").bind(id,JSON.stringify(before),JSON.stringify(after),OPERATOR_ACTOR,now,payload.expectedVersion).run();
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
        runtimeEnv.DB.prepare("INSERT INTO configuration_events(id,entity_type,entity_id,before_data,after_data,actor_id,created_at) VALUES(?,'product',?,?,?,?,?)").bind(crypto.randomUUID(),payload.id,JSON.stringify(product(current)),JSON.stringify(after),OPERATOR_ACTOR,now),
      ]);
      return Response.json({ok:true,version:current.version+1,updatedAt:now});
    }
    if(payload.type==="season"){
      const current=await runtimeEnv.DB.prepare("SELECT id,name,holiday_date,sales_start_date,sales_end_date,active,version,updated_at FROM sales_seasons WHERE id=?").bind(payload.id).first<SeasonRow>();
      if(!current)return Response.json({error:"판매시즌을 찾을 수 없습니다."},{status:404});
      if(current.version!==payload.expectedVersion)return Response.json({error:"다른 화면에서 먼저 수정했습니다. 새로고침 후 다시 시도해주세요."},{status:409});
      if(!payload.name?.trim()||!payload.holidayDate||!payload.salesStartDate||!payload.salesEndDate)return Response.json({error:"시즌명과 판매 일정을 확인해주세요."},{status:400});
      const after={name:payload.name.trim(),holidayDate:payload.holidayDate,salesStartDate:payload.salesStartDate,salesEndDate:payload.salesEndDate,active:Boolean(payload.active)};
      await runtimeEnv.DB.batch([
        runtimeEnv.DB.prepare("UPDATE sales_seasons SET name=?,holiday_date=?,sales_start_date=?,sales_end_date=?,active=?,version=version+1,updated_at=? WHERE id=? AND version=?").bind(after.name,after.holidayDate,after.salesStartDate,after.salesEndDate,after.active?1:0,now,payload.id,payload.expectedVersion),
        runtimeEnv.DB.prepare("INSERT INTO configuration_events(id,entity_type,entity_id,before_data,after_data,actor_id,created_at) VALUES(?,'season',?,?,?,?,?)").bind(crypto.randomUUID(),payload.id,JSON.stringify(season(current)),JSON.stringify(after),OPERATOR_ACTOR,now),
      ]);
      return Response.json({ok:true,version:current.version+1,updatedAt:now});
    }
    return Response.json({error:"지원하지 않는 설정입니다."},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"설정을 저장하지 못했습니다."},{status:500})}
}
