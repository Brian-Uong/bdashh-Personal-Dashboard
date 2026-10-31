declare namespace Cloudflare {
  interface Env {
    DASHBOARD_OWNER_EMAIL?: string;
    DASHBOARD_SERVICE_TOKEN?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
