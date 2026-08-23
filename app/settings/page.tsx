import { requireChatGPTUser } from "../chatgpt-auth";
import SettingsApp from "../components/SettingsApp";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireChatGPTUser("/settings");
  return <SettingsApp />;
}