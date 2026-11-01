import { createPool, type Pool, type PoolConnection } from 'mysql2/promise';

const globalForMysql = globalThis as unknown as {
  __ecotraceMysql?: Pool;
};

let poolInstance: Pool | null = null;

function createMysqlPool(): Pool {
  const connectionString = process.env.MYSQL_URL;

  if (!connectionString) {
    throw new Error(
      'MYSQL_URL is not configured. Add it to .env.local (see .env.example).',
    );
  }

  // Parse mysql://user:pass@host:port/db into connection options.
  const url = new URL(connectionString);
  const instance = createPool({
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.replace(/^\//, ''),
    multipleStatements: true,
    connectionLimit: 10,
  });

  instance.on('connection', (connection: PoolConnection) => {
    connection.on('error', (error: Error) => {
      console.error('[mysql] connection error', error);
    });
  });

  return instance;
}

function getPool(): Pool {
  if (!poolInstance) {
    poolInstance = globalForMysql.__ecotraceMysql ?? createMysqlPool();
    if (process.env.NODE_ENV !== 'production') {
      globalForMysql.__ecotraceMysql = poolInstance;
    }
  }
  return poolInstance;
}

export { getPool };
export async function query<T = unknown>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  const started = Date.now();
  const [rows] = await pool.query(text, params);
  const duration = Date.now() - started;

  if (process.env.NODE_ENV === 'development' && duration > 750) {
    console.warn(`[mysql] slow query (${duration}ms): ${text.slice(0, 90)}`);
  }

  return rows as T[];
}

export async function one<T = unknown>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}
