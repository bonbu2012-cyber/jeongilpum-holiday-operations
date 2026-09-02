import SettingsApp from "../components/SettingsApp";
import PasscodeGate from "../components/PasscodeGate";
import { hasOperatorSession } from "../lib/operator-session";
import "../ui/operator-fonts.css";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await hasOperatorSession())) return <PasscodeGate />;
  return <div className="ops-shell"><SettingsApp /></div>;
}
