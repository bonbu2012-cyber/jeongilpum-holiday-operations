import PackageApp from "../../../components/PackageApp";
import PasscodeGate from "../../../components/PasscodeGate";
import { hasOperatorSession } from "../../../lib/operator-session";

export const dynamic = "force-dynamic";

export default async function PackagePage({ params }: { params: Promise<{ packageCode: string }> }) {
  if (!(await hasOperatorSession())) return <PasscodeGate />;
  const { packageCode } = await params;
  const decoded = decodeURIComponent(packageCode);
  return <PackageApp packageCode={decoded} />;
}
