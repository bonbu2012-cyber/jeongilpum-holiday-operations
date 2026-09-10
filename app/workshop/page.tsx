import WorkshopApp from "../components/WorkshopApp";
import WorkshopDailyPrepBoard from "../components/WorkshopDailyPrepBoard";
import PasscodeGate from "../components/PasscodeGate";
import { hasOperatorSession } from "../lib/operator-session";
import "../ui/operator-fonts.css";
export const dynamic="force-dynamic";
export default async function WorkshopPage(){if (!(await hasOperatorSession())) return <PasscodeGate />;return <div className="ops-shell workshop-page-shell"><WorkshopApp /><WorkshopDailyPrepBoard /></div>}
