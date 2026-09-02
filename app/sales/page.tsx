import SalesApp from "../components/SalesApp";
import PasscodeGate from "../components/PasscodeGate";
import { hasOperatorSession } from "../lib/operator-session";

export const dynamic = "force-dynamic";

export default async function SalesPage(){
 if (!(await hasOperatorSession())) return <PasscodeGate />;
 return <SalesApp/>;
}
