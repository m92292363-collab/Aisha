import { neon } from '@neondatabase/serverless';

// This connects to your Neon database for FREE
const sql = neon(process.env.DATABASE_URL);

export { sql };
