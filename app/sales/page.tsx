import { requireChatGPTUser } from "../chatgpt-auth";
import SalesApp from "../components/SalesApp";

export const dynamic = "force-dynamic";

export default async function SalesPage(){
 await requireChatGPTUser("/sales");
 return <SalesApp/>;
}
