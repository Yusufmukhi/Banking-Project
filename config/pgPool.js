console.log("DATABASE_URL =", process.env.DATABASE_URL);

import pg from "pg";
const { Pool } = pg;

const isSupabase = process.env.DATABASE_URL?.includes("supabase.co");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isSupabase
    ? { rejectUnauthorized: false }
    : false
});

export default pool;
