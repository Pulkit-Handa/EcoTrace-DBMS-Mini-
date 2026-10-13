import { Pool, type PoolClient, type QueryResultRow } from 'pg';

const globalForPg = globalThis as unknown as {
  __ecotracePool?: Pool;
};

function createPool(): Pool {
  const connectionString = process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error(
      'POSTGRES_URL is not configured. Add it to .env.local (see .env.example).',
    );
  }

  const instance = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 6_000,
    application_name: 'ecotrace-web',
  });

  instance.on('error', (error) => {
    console.error('[postgres] idle client error', error);
  });

  return instance;
}

export const pool: Pool = globalForPg.__ecotracePool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalForPg.__ecotracePool = pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const started = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - started;

  if (process.env.NODE_ENV === 'development' && duration > 750) {
    console.warn(`[postgres] slow query (${duration}ms): ${text.slice(0, 90)}`);
  }

  return result.rows;
}

export async function one<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
