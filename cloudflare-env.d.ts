declare module "cloudflare:workers" {
  interface Env {
    DB: D1Database;
    OPERATOR_PASSCODE?: string;
  }
}
