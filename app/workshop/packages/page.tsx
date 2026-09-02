import PackageListApp from "../../components/PackageListApp";
import PasscodeGate from "../../components/PasscodeGate";
import { hasOperatorSession } from "../../lib/operator-session";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  if (!(await hasOperatorSession())) return <PasscodeGate />;
  return <PackageListApp />;
}
