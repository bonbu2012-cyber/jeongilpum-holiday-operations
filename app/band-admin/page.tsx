import BandAdminApp from "../components/BandAdminApp";
import PasscodeGate from "../components/PasscodeGate";
import { hasOperatorSession } from "../lib/operator-session";
import "../ui/band-reservation.css";
import "../ui/operator-fonts.css";

export const dynamic = "force-dynamic";

export default async function BandAdminPage() {
  if (!(await hasOperatorSession())) return <PasscodeGate />;
  return <BandAdminApp />;
}
