const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const LOCAL_PREVIEW_ACTOR_ID = "local-preview-operator";
export const LOCAL_PREVIEW_ACTOR_EMAIL = "local-preview@localhost.invalid";

export function isLocalDevelopmentRequest(requestUrl: string, development: boolean) {
  if (!development) return false;
  try {
    const url = new URL(requestUrl);
    return url.protocol === "http:" && loopbackHosts.has(url.hostname);
  } catch {
    return false;
  }
}

export function isLocalDevelopmentHost(host: string | null, development: boolean) {
  if (!development || !host) return false;
  const firstHost = host.split(",", 1)[0]?.trim();
  return Boolean(firstHost) && isLocalDevelopmentRequest(`http://${firstHost}/`, true);
}

export function isLocalPreviewActor(userId: string, requestUrl: string, development: boolean) {
  return userId === LOCAL_PREVIEW_ACTOR_ID
    && isLocalDevelopmentRequest(requestUrl, development);
}
