declare namespace Cloudflare {
  interface Env {
    DASHBOARD_OWNER_EMAIL?: string;
    DASHBOARD_SERVICE_TOKEN?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    AI_MAX_DAILY_RUNS?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
