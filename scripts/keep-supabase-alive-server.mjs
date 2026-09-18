import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function ping() {
  const now = new Date().toISOString();
  try {
    const { error } = await supabase.from("licenses").select("id").limit(1);
    if (error) throw error;
    console.log(`✅ [${now}] Supabase ping OK`);
  } catch (err) {
    console.error(`❌ [${now}] Ping failed:`, err.message || err);
  }
}

console.log("🔄 Supabase keep-alive started");
console.log(`   URL: ${SUPABASE_URL}`);
console.log(`   Interval: every ${PING_INTERVAL / 1000 / 60} minutes`);
console.log(`   Press Ctrl+C to stop\n`);

ping();
setInterval(ping, PING_INTERVAL);
