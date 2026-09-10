import SalesApp from "../components/SalesApp";
import SalesFloorOverview from "../components/SalesFloorOverview";
import PasscodeGate from "../components/PasscodeGate";
import { hasOperatorSession } from "../lib/operator-session";
import "../ui/operator-fonts.css";

export const dynamic = "force-dynamic";

export default async function SalesPage(){
 if (!(await hasOperatorSession())) return <PasscodeGate />;
 return <div className="ops-shell sales-floor-shell"><SalesApp /><SalesFloorOverview /></div>;
}
