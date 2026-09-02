import WorkshopApp from "../components/WorkshopApp";
import PasscodeGate from "../components/PasscodeGate";
import { hasOperatorSession } from "../lib/operator-session";
export const dynamic="force-dynamic";
export default async function WorkshopPage(){if (!(await hasOperatorSession())) return <PasscodeGate />;return <WorkshopApp/>}
