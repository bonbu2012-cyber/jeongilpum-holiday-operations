import { requireChatGPTUser } from "../chatgpt-auth";
import AdminApp from "../components/AdminApp";

export default async function SalesPage(){
 await requireChatGPTUser("/sales");
 return <AdminApp/>;
}
