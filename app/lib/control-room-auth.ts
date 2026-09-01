import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "../chatgpt-auth";
import {
  isLocalPreviewActor,
  LOCAL_PREVIEW_ACTOR_ID,
} from "./local-preview-auth";
import { isConfiguredOperator } from "./operator-auth";

export type ControlRoomRuntimeEnv = typeof env & {
  DB: D1Database;
  OPERATOR_USER_IDS?: string;
  OPERATOR_EMAILS?: string;
  CONTROL_ROOM_ADMIN_USER_IDS?: string;
  CONTROL_ROOM_ADMIN_EMAILS?: string;
};

export const controlRoomEnv = env as ControlRoomRuntimeEnv;

type AllowlistValues = {
  operatorUserIds?: string;
  operatorEmails?: string;
  adminUserIds?: string;
  adminEmails?: string;
};

export function hasControlRoomAccess(user: Pick<ChatGPTUser, "userId" | "email">, values: AllowlistValues) {
  const operator = isConfiguredOperator(user, {
    userIds: values.operatorUserIds,
    emails: values.operatorEmails,
  });
  const administrator = isConfiguredOperator(user, {
    userIds: values.adminUserIds,
    emails: values.adminEmails,
  });
  return operator && administrator;
}

function configuredAccess(user: Pick<ChatGPTUser, "userId" | "email">) {
  return hasControlRoomAccess(user, {
    operatorUserIds: controlRoomEnv.OPERATOR_USER_IDS,
    operatorEmails: controlRoomEnv.OPERATOR_EMAILS,
    adminUserIds: controlRoomEnv.CONTROL_ROOM_ADMIN_USER_IDS,
    adminEmails: controlRoomEnv.CONTROL_ROOM_ADMIN_EMAILS,
  });
}

export function hasControlRoomPageAccess(user: Pick<ChatGPTUser, "userId" | "email">) {
  if (import.meta.env.DEV && user.userId === LOCAL_PREVIEW_ACTOR_ID) return true;
  return configuredAccess(user);
}

export async function requireControlRoomApiAccess(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return { response: Response.json({ error: "로그인이 필요합니다." }, { status: 401 }) } as const;
  }
  if (isLocalPreviewActor(user.userId, request.url, import.meta.env.DEV)) return { user } as const;
  if (!configuredAccess(user)) {
    return { response: Response.json({ error: "종합통제실 관리자 권한이 없습니다." }, { status: 403 }) } as const;
  }
  return { user } as const;
}

export const controlRoomNoStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

