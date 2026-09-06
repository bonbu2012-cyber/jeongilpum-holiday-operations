import BulkOrderUploadApp from "../components/BulkOrderUploadApp";
import PasscodeGate from "../components/PasscodeGate";
import { hasOperatorSession } from "../lib/operator-session";
import "../ui/operator-fonts.css";
import "../bulk-order-flow.css";

export const dynamic = "force-dynamic";

export default async function BulkOrdersPage() {
  if (!(await hasOperatorSession())) return <PasscodeGate />;
  return <div className="ops-shell"><BulkOrderUploadApp /></div>;
}
