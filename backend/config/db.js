import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on("error", (error) => {
  // eslint-disable-next-line no-console
  console.error("Unexpected PostgreSQL error", error);
});

export default pool;
