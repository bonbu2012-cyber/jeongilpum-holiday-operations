import { requireChatGPTUser } from "../chatgpt-auth";
import AdminApp from "../components/AdminApp";
export const dynamic="force-dynamic";
export default async function AdminPage(){await requireChatGPTUser("/admin");return <AdminApp/>}
