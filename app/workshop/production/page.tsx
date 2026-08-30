import { requireChatGPTUser } from "../../chatgpt-auth";
import ProductionApp from "../../components/ProductionApp";

export const dynamic = "force-dynamic";
export default async function ProductionPage() {
  await requireChatGPTUser("/workshop/production");
  return <ProductionApp />;
}