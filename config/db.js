import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log("SUPABASE_URL =", supabaseUrl);
console.log("SUPABASE_KEY =", supabaseKey ? "LOADED" : "MISSING");

if (!supabaseUrl || !supabaseKey) {
  throw new Error("ENV NOT LOADED: Supabase URL or Key missing");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
