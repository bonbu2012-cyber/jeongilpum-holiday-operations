import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

type StatusPayload={orderId?:string;status?:"confirmed"|"in_progress"|"ready"|"fulfilled"|"cancelled";expectedVersion?:number};
type Current={id:string;order_no:string;order_status:string;version:number};
type Item={product_id:string;product_name_snapshot:string;quantity:number;code:string};
const runtimeEnv=env as typeof env&{DB:D1Database;OPERATOR_USER_IDS?:string;OPERATOR_EMAILS?:string};
const allowed:Record<string,string[]>={submitted:["confirmed","cancelled"],confirmed:["in_progress","cancelled"],in_progress:["ready","cancelled"],ready:["fulfilled","cancelled"]};
function configured(value:string|undefined){return(value??"").split(",").map(item=>item.trim()).filter(Boolean)}
function isOperator(user:{userId:string;email:string}){return configured(runtimeEnv.OPERATOR_USER_IDS).includes(user.userId)||configured(runtimeEnv.OPERATOR_EMAILS).map(value=>value.toLowerCase()).includes(user.email.toLowerCase())}
function slug(code:string){return code.replace(/[^A-Z0-9]/gi,"").slice(0,3).toUpperCase()||"PKG"}

export async function PATCH(request:Request){
 const user=await getChatGPTUser();
 if(!user)return Response.json({error:"로그인이 필요합니다."},{status:401});
 if(!isOperator(user))return Response.json({error:"운영자 권한이 없습니다."},{status:403});
 try{
  const x=await request.json() as StatusPayload;
  if(!x.orderId||!x.status||!Number.isInteger(x.expectedVersion))return Response.json({error:"상태 변경 정보가 올바르지 않습니다."},{status:400});
  const current=await runtimeEnv.DB.prepare("SELECT id,order_no,order_status,version FROM orders WHERE id=?").bind(x.orderId).first<Current>();
  if(!current)return Response.json({error:"주문을 찾을 수 없습니다."},{status:404});
  if(current.version!==x.expectedVersion)return Response.json({error:"다른 직원이 먼저 수정했습니다. 최신 내용을 다시 확인해주세요.",latestVersion:current.version},{status:409});
  if(!allowed[current.order_status]?.includes(x.status))return Response.json({error:"현재 단계에서 허용되지 않는 변경입니다."},{status:409});
  const now=new Date().toISOString();
  const statements=[
   runtimeEnv.DB.prepare("UPDATE orders SET order_status=?,version=version+1,updated_at=? WHERE id=? AND version=? AND order_status=?").bind(x.status,now,x.orderId,x.expectedVersion,current.order_status),
   runtimeEnv.DB.prepare("INSERT INTO order_events(id,order_id,event_type,before_data,after_data,actor_id,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),x.orderId,"status_changed",JSON.stringify({status:current.order_status}),JSON.stringify({status:x.status}),user.userId,now)
  ];
  if(x.status==="confirmed"){
   const items=await runtimeEnv.DB.prepare("SELECT oi.product_id,oi.product_name_snapshot,oi.quantity,p.code FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=?").bind(x.orderId).all<Item>();
   let sequence=1;
   for(const item of items.results)for(let i=0;i<item.quantity;i++){const code=`${slug(item.code)}-${current.order_no.slice(-4)}-${String(sequence++).padStart(2,"0")}`;statements.push(runtimeEnv.DB.prepare("INSERT INTO packages(id,order_id,package_code,product_id,product_name_snapshot,package_status,created_at,updated_at) VALUES(?,?,?,?,?,'queued',?,?)").bind(crypto.randomUUID(),x.orderId,code,item.product_id,item.product_name_snapshot,now,now))}
  }
  if(x.status==="in_progress")statements.push(runtimeEnv.DB.prepare("UPDATE packages SET package_status='in_progress',updated_at=? WHERE order_id=? AND package_status='queued'").bind(now,x.orderId));
  if(x.status==="ready")statements.push(runtimeEnv.DB.prepare("UPDATE packages SET package_status='completed',updated_at=? WHERE order_id=? AND package_status='in_progress'").bind(now,x.orderId));
  if(x.status==="fulfilled")statements.push(runtimeEnv.DB.prepare("UPDATE packages SET package_status='handed_over',updated_at=? WHERE order_id=? AND package_status='completed'").bind(now,x.orderId));
  if(x.status==="cancelled"){
   statements.push(runtimeEnv.DB.prepare("UPDATE product_daily_reservations SET status='released',released_at=? WHERE order_id=? AND status='active'").bind(now,x.orderId));
   statements.push(runtimeEnv.DB.prepare("UPDATE packages SET package_status='voided',updated_at=? WHERE order_id=? AND package_status!='handed_over'").bind(now,x.orderId));
  }
  const result=await runtimeEnv.DB.batch(statements);
  if(!result[0].meta.changes)return Response.json({error:"상태가 이미 변경되었습니다. 최신 내용을 다시 확인해주세요."},{status:409});
  return Response.json({ok:true,status:x.status,version:current.version+1});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"상태를 변경하지 못했습니다."},{status:500})}
}
