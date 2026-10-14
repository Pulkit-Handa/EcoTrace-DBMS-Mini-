import { getDatabaseHealth } from '@/lib/queries';
import { connectMongo, VendorReport } from '@/lib/mongo';
import { jsonOk } from '@/lib/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const postgres = await getDatabaseHealth();

  let mongodb: {
    connected: boolean;
    documents?: number;
    error?: string;
  } = { connected: false };

  try {
    await connectMongo();
    const documents = await VendorReport.estimatedDocumentCount();
    mongodb = { connected: true, documents };
  } catch (error) {
    mongodb = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown MongoDB error',
    };
  }

  const healthy = postgres.connected && mongodb.connected;

  return jsonOk(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'ecotrace',
      timestamp: new Date().toISOString(),
      postgres,
      mongodb,
    },
    healthy ? 200 : 503,
  );
}
