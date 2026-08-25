import type { OrderRecord } from "../components/types";

export type OrderQuery={q?:string;date?:string};

export async function fetchOrders(query:OrderQuery={}){
 const params=new URLSearchParams();
 if(query.q?.trim())params.set("q",query.q.trim());
 if(query.date?.trim())params.set("date",query.date.trim());
 const response=await fetch("/api/orders"+(params.size?`?${params.toString()}`:""),{cache:"no-store"}),data=await response.json() as {orders?:OrderRecord[];error?:string};
 if(!response.ok)throw new Error(data.error||"주문을 불러오지 못했습니다.");
 return data.orders??[];
}
