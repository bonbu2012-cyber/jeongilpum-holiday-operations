import { requireChatGPTUser } from "../chatgpt-auth";
import WorkshopApp from "../components/WorkshopApp";
export const dynamic="force-dynamic";
export default async function WorkshopPage(){await requireChatGPTUser("/workshop");return <WorkshopApp/>}
