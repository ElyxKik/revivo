import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function ping() {
  const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  try {
    const { data, error } = await supabase
      .from("licenses")
      .select("id")
      .limit(1);

    if (error) throw error;
    console.log(`✅ [${now}] Supabase ping OK — project active`);
  } catch (err) {
    console.error(`❌ [${now}] Ping failed:`, err.message || err);
  }
}

console.log("🔄 Supabase keep-alive started");
console.log(`   URL: ${supabaseUrl}`);
console.log(`   Interval: every 10 minutes`);
console.log(`   Press Ctrl+C to stop\n`);

ping();
setInterval(ping, 10 * 60 * 1000);
