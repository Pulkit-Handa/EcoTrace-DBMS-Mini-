import {
  assertDepartmentAccess,
  getSession,
} from '@/lib/auth';
import {
  buildDocumentEmbedding,
  toVectorLiteral,
} from '@/lib/embeddings';
import {
  connectMongo,
  serialiseVendorDocument,
  VendorReport,
} from '@/lib/mongo';
import { attachVendorEmbedding, insertVendorReportLink } from '@/lib/queries';
import { jsonError, jsonOk, readJson } from '@/lib/http';
import {
  cleanString,
  parseTags,
  toInteger,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

interface UploadBody {
  vendor_name?: unknown;
  dept_id?: unknown;
  raw_text?: unknown;
  compliance_tags?: unknown;
  reporting_year?: unknown;
  pages?: unknown;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError('Not authenticated.', 401);

  const body = await readJson<UploadBody>(request);
  if (!body) return jsonError('Request body must be valid JSON.');

  const vendorName = cleanString(body.vendor_name, 150);
  const rawText = cleanString(body.raw_text, 20_000);
  const tags = parseTags(body.compliance_tags);
  const requestedDepartment = toInteger(body.dept_id);
  const departmentId =
    session.role === 'dept_lead' ? session.deptId : requestedDepartment;
  const currentYear = new Date().getFullYear();
  const reportingYear = toInteger(body.reporting_year) ?? currentYear;
  const pages = toInteger(body.pages);

  if (!vendorName || vendorName.length < 2) {
    return jsonError('Vendor name must be at least 2 characters.');
  }

  if (!departmentId) {
    return jsonError('dept_id is required.');
  }

  if (!assertDepartmentAccess(session, departmentId)) {
    return jsonError('You can only upload reports for your own department.', 403);
  }

  if (!rawText || rawText.length < 20) {
    return jsonError('Report text must be at least 20 characters.');
  }

  if (
    !Number.isInteger(reportingYear) ||
    reportingYear < 2000 ||
    reportingYear > currentYear + 1
  ) {
    return jsonError(`reporting_year must be between 2000 and ${currentYear + 1}.`);
  }

  if (pages !== null && (pages < 1 || pages > 5000)) {
    return jsonError('pages must be between 1 and 5000.');
  }

  let mongoDocId: string | null = null;

  try {
    await connectMongo();

    const document = await VendorReport.create({
      vendor_name: vendorName,
      dept_id: departmentId,
      raw_text: rawText,
      compliance_tags: tags,
      reporting_year: reportingYear,
      metadata: {
        pages: pages ?? undefined,
        uploader_id: session.userId,
        uploaded_by: session.name,
        source: 'web',
      },
    });

    mongoDocId = String(document._id);

    let reportId: number;
    try {
      reportId = await insertVendorReportLink({
        vendorName,
        departmentId,
        mongoDocId,
      });
    } catch (error) {
      // Compensating action: do not leave an orphaned MongoDB document when
      // the relational bridge insert fails.
      await VendorReport.findByIdAndDelete(document._id).catch(() => undefined);
      throw error;
    }

    let vectorStored = false;
    try {
      const embedding = buildDocumentEmbedding({
        vendor_name: vendorName,
        raw_text: rawText,
        compliance_tags: tags,
        reporting_year: reportingYear,
      });
      await attachVendorEmbedding(reportId, toVectorLiteral(embedding));
      vectorStored = true;
    } catch (error) {
      console.warn(
        '[api/upload] pgvector unavailable; document stored without embedding',
        error,
      );
    }

    return jsonOk(
      {
        message: vectorStored
          ? 'Report stored in MongoDB, linked in PostgreSQL and embedded with pgvector.'
          : 'Report stored in MongoDB and linked in PostgreSQL. Vector embedding was skipped.',
        report_id: reportId,
        mongo_doc_id: mongoDocId,
        vector_stored: vectorStored,
        document: serialiseVendorDocument(document),
      },
      201,
    );
  } catch (error) {
    console.error('[api/upload]', error);
    return jsonError(
      'Upload failed. Confirm MongoDB and PostgreSQL are running, then try again.',
      500,
      { mongo_doc_id_rolled_back: mongoDocId !== null },
    );
  }
}
