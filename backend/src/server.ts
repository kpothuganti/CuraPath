import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { runMigrations } from './db/migrate';

const PORT = process.env.PORT ?? 3000;

runMigrations()
  .catch((err) => {
    console.error('Migration failed', err);
    process.exit(1);
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ReCharge API running on port ${PORT} [${process.env.NODE_ENV}]`);
    });
  });
