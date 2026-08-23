// Supabase 원격 프로젝트 연결 후 CLI 생성 타입으로 교체합니다.
export type Json=string|number|boolean|null|{[key:string]:Json|undefined}|Json[];
export type Database={public:{Tables:{
 products:{Row:{id:string;category:string;code:string;name:string;subtitle:string;description:string;price:number;customer_display_weight:string|null;image_url:string|null;sale_status:string;badge:string|null;display_order:number;active:boolean;created_at:string;updated_at:string}};
 orders:{Row:{id:string;order_no:string;season_id:string;buyer_name_snapshot:string;buyer_phone_snapshot:string;order_status:string;fulfillment_type:string;schedule_label:string;total_amount:number;idempotency_key:string;version:number;submitted_at:string;created_at:string;updated_at:string}};
 order_items:{Row:{id:string;order_id:string;product_id:string;product_name_snapshot:string;list_price_snapshot:number;sale_unit_price:number;quantity:number;line_total:number;created_at:string}};
 packages:{Row:{id:string;order_id:string;package_code:string;product_id:string;product_name_snapshot:string;package_status:string;created_at:string;updated_at:string}};
 user_profiles:{Row:{id:string;auth_user_id:string;name:string;role:"sales"|"admin"|"superadmin"|"workshop";active:boolean;created_at:string}};
};Views:Record<string,never>;Functions:{create_order_transaction:{Args:{payload:Json};Returns:Json}};Enums:{user_role:"sales"|"admin"|"superadmin"|"workshop";order_status:"submitted"|"confirmed"|"in_progress"|"ready"|"fulfilled"|"cancelled"}}};
