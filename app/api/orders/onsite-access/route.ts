import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isConfiguredOperator } from "../../../lib/operator-auth";

const runtimeEnv = env as typeof env & {
  OPERATOR_USER_IDS?: string;
  OPERATOR_EMAILS?: string;
};

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json(
      { error: "현장판매는 직원 로그인이 필요합니다.", requiresSignIn: true },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!isConfiguredOperator(user, {
    userIds: runtimeEnv.OPERATOR_USER_IDS,
    emails: runtimeEnv.OPERATOR_EMAILS,
  })) {
    return Response.json(
      { error: "현장판매를 기록할 운영자 권한이 없습니다." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { allowed: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
