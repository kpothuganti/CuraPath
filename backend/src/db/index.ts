import { Pool } from 'pg';

// Railway and Render provide DATABASE_URL; fall back to individual vars for local dev
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 5432),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

export default pool;
