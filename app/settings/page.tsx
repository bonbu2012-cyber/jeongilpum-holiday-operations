import SettingsApp from "../components/SettingsApp";
import PasscodeGate from "../components/PasscodeGate";
import { hasOperatorSession } from "../lib/operator-session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await hasOperatorSession())) return <PasscodeGate />;
  return <SettingsApp />;
}
