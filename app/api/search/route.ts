import { getSession, scopedDepartmentId } from '@/lib/auth';
import {
  connectMongo,
  serialiseVendorDocument,
  VendorReport,
  type VendorReportAttrs,
} from '@/lib/mongo';
import { embedText, toVectorLiteral } from '@/lib/embeddings';
import {
  getDepartments,
  isVectorReady,
  vectorSearchVendorReports,
} from '@/lib/queries';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import { escapeRegex, parseLimit, toInteger } from '@/lib/validation';
import type { SearchHit } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LeanVendor = VendorReportAttrs & {
  _id: unknown;
  score?: number;
  similarity?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

interface SearchBody {
  query?: unknown;
  mode?: unknown;
  dept_id?: unknown;
  limit?: unknown;
}

async function getDepartmentNames(): Promise<Map<number, string>> {
  try {
    const departments = await getDepartments();
    return new Map(
      departments.map((department) => [department.dept_id, department.name]),
    );
  } catch {
    return new Map();
  }
}

function toHits(
  documents: LeanVendor[],
  departmentNames: Map<number, string>,
): SearchHit[] {
  return documents.map((document) => ({
    ...serialiseVendorDocument(document),
    score: document.score,
    similarity: document.similarity,
    department:
      departmentNames.get(document.dept_id) ?? `Department ${document.dept_id}`,
  }));
}

async function textSearch(
  search: string,
  departmentId: number | null,
  limit: number,
): Promise<{ documents: LeanVendor[]; notice?: string }> {
  const baseFilter = departmentId ? { dept_id: departmentId } : {};

  try {
    const documents = await VendorReport.find(
      { ...baseFilter, $text: { $search: search } },
      { score: { $meta: 'textScore' } },
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<LeanVendor[]>();

    if (documents.length > 0) return { documents };
  } catch (error) {
    console.warn('[search] $text search failed, using regex fallback', error);
  }

  const pattern = new RegExp(escapeRegex(search), 'i');
  const documents = await VendorReport.find({
    ...baseFilter,
    $or: [
      { vendor_name: pattern },
      { raw_text: pattern },
      { compliance_tags: pattern },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<LeanVendor[]>();

  return {
    documents,
    notice:
      documents.length > 0
        ? 'Used pattern matching because the full-text index was unavailable for this query.'
        : undefined,
  };
}

async function semanticSearch(
  search: string,
  departmentId: number | null,
  limit: number,
): Promise<{ documents: LeanVendor[]; notice?: string }> {
  const ready = await isVectorReady();
  if (!ready) {
    const fallback = await textSearch(search, departmentId, limit);
    return {
      ...fallback,
      notice:
        'pgvector is not enabled, so MongoDB full-text search was used instead.',
    };
  }

  try {
    const literal = toVectorLiteral(embedText(search));
    const matches = await vectorSearchVendorReports({
      vectorLiteral: literal,
      departmentId,
      limit,
    });

    if (matches.length === 0) {
      return {
        documents: [],
        notice:
          'No vector matches. Upload vendor reports with pgvector enabled to populate embeddings.',
      };
    }

    const documents = await VendorReport.find({
      _id: { $in: matches.map((match) => match.mongo_doc_id) },
    }).lean<LeanVendor[]>();

    const byId = new Map(
      documents.map((document) => [String(document._id), document]),
    );

    const ranked: LeanVendor[] = [];
    for (const match of matches) {
      const document = byId.get(match.mongo_doc_id);
      if (document) {
        ranked.push({ ...document, similarity: match.similarity });
      }
    }

    return { documents: ranked };
  } catch (error) {
    console.warn('[search] vector query failed, falling back to text', error);
    const fallback = await textSearch(search, departmentId, limit);
    return {
      ...fallback,
      notice:
        'Vector search was unavailable, so MongoDB full-text search was used instead.',
    };
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return jsonError('Not authenticated.', 401);

  const { searchParams } = new URL(request.url);
  const requestedDepartment = toInteger(searchParams.get('dept_id'));
  const limit = parseLimit(searchParams.get('limit'), 6);
  const departmentId = scopedDepartmentId(session, requestedDepartment);

  try {
    await connectMongo();

    const filter = departmentId ? { dept_id: departmentId } : {};
    const [documents, total, departmentNames, vectorReady] = await Promise.all([
      VendorReport.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<LeanVendor[]>(),
      VendorReport.countDocuments(filter),
      getDepartmentNames(),
      isVectorReady(),
    ]);

    return jsonOk({
      query: '',
      mode_used: 'recent',
      vector_ready: vectorReady,
      total,
      results: toHits(documents, departmentNames),
      scope:
        session.role === 'dept_lead'
          ? `department:${session.deptId}`
          : 'all-departments',
    });
  } catch (error) {
    console.error('[api/search GET]', error);
    return jsonError(
      'Could not load vendor reports from MongoDB. Check MONGODB_URI.',
      503,
    );
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError('Not authenticated.', 401);

  const body = await readJson<SearchBody>(request);
  if (!body) return jsonError('Request body must be valid JSON.');

  const search =
    typeof body.query === 'string' ? body.query.trim().slice(0, 300) : '';
  const mode = body.mode === 'vector' ? 'vector' : 'text';
  const requestedDepartment = toInteger(body.dept_id);
  const limit = parseLimit(body.limit, 8);

  if (
    session.role === 'dept_lead' &&
    requestedDepartment !== null &&
    requestedDepartment !== session.deptId
  ) {
    return jsonError('You can only search your own department.', 403);
  }

  const departmentId = scopedDepartmentId(session, requestedDepartment);
  const startedAt = Date.now();

  try {
    await connectMongo();
    const departmentNames = await getDepartmentNames();

    if (!search) {
      const documents = await VendorReport.find(
        departmentId ? { dept_id: departmentId } : {},
      )
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<LeanVendor[]>();

      return jsonOk({
        query: '',
        mode_used: 'recent',
        vector_ready: await isVectorReady(),
        results: toHits(documents, departmentNames),
        took_ms: Date.now() - startedAt,
      });
    }

    const { documents, notice } =
      mode === 'vector'
        ? await semanticSearch(search, departmentId, limit)
        : await textSearch(search, departmentId, limit);

    return jsonOk({
      query: search,
      mode_used: mode,
      vector_ready: await isVectorReady(),
      notice,
      took_ms: Date.now() - startedAt,
      results: toHits(documents, departmentNames),
    });
  } catch (error) {
    console.error('[api/search POST]', error);
    return jsonError(
      'Search failed. Confirm that MongoDB is running and MONGODB_URI is correct.',
      503,
    );
  }
}
