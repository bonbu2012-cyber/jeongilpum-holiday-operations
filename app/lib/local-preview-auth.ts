const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const LOCAL_PREVIEW_ACTOR_ID = "local-preview-operator";

export function isLocalDevelopmentRequest(requestUrl: string, development: boolean) {
  if (!development) return false;
  try {
    const url = new URL(requestUrl);
    return url.protocol === "http:" && loopbackHosts.has(url.hostname);
  } catch {
    return false;
  }
}
