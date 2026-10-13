import mongoose, { Schema, type Model } from 'mongoose';

const globalForMongo = globalThis as unknown as {
  __ecotraceMongo?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

const cached =
  globalForMongo.__ecotraceMongo ?? { conn: null, promise: null };

if (!globalForMongo.__ecotraceMongo) {
  globalForMongo.__ecotraceMongo = cached;
}

export interface VendorReportAttrs {
  vendor_name: string;
  dept_id: number;
  raw_text: string;
  compliance_tags: string[];
  reporting_year: number;
  metadata: {
    pages?: number;
    uploader_id?: number;
    uploaded_by?: string;
    source?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const VendorReportSchema = new Schema<VendorReportAttrs>(
  {
    vendor_name: { type: String, required: true, trim: true, maxlength: 150 },
    dept_id: { type: Number, required: true, index: true },
    raw_text: { type: String, required: true },
    compliance_tags: { type: [String], default: [] },
    reporting_year: { type: Number, required: true },
    metadata: {
      pages: { type: Number },
      uploader_id: { type: Number },
      uploaded_by: { type: String },
      source: { type: String },
    },
  },
  {
    timestamps: true,
    collection: 'vendor_reports',
    versionKey: false,
  },
);

VendorReportSchema.index(
  { vendor_name: 'text', raw_text: 'text', compliance_tags: 'text' },
  {
    name: 'vendor_reports_text_idx',
    weights: { vendor_name: 5, compliance_tags: 3, raw_text: 1 },
  },
);

VendorReportSchema.index({ dept_id: 1, reporting_year: -1 });

export const VendorReport: Model<VendorReportAttrs> =
  (mongoose.models.VendorReport as Model<VendorReportAttrs> | undefined) ??
  mongoose.model<VendorReportAttrs>('VendorReport', VendorReportSchema);

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

export async function connectMongo(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not configured. Add it to .env.local (see .env.example).',
    );
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 6_000,
        maxPoolSize: 10,
        bufferCommands: false,
      })
      .then(async (connection) => {
        // Build the MongoDB text index once per process. A failure here should
        // not take the whole app down; regex search still works as fallback.
        try {
          await VendorReport.init();
        } catch (error) {
          console.warn('[mongo] could not ensure indexes', error);
        }
        return connection;
      })
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export function serialiseVendorDocument(document: {
  _id: unknown;
  vendor_name: string;
  dept_id: number;
  raw_text: string;
  compliance_tags?: string[];
  reporting_year: number;
  metadata?: VendorReportAttrs['metadata'];
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    _id: String(document._id),
    vendor_name: document.vendor_name,
    dept_id: document.dept_id,
    raw_text: document.raw_text,
    compliance_tags: document.compliance_tags ?? [],
    reporting_year: document.reporting_year,
    metadata: document.metadata ?? {},
    createdAt: document.createdAt?.toISOString(),
    updatedAt: document.updatedAt?.toISOString(),
  };
}
