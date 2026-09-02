import ProductionApp from "../../components/ProductionApp";
import PasscodeGate from "../../components/PasscodeGate";
import { hasOperatorSession } from "../../lib/operator-session";

export const dynamic = "force-dynamic";
export default async function ProductionPage() {
  if (!(await hasOperatorSession())) return <PasscodeGate />;
  return <ProductionApp />;
}
