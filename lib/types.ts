export type Role = 'auditor' | 'dept_lead';

export interface SessionUser {
  userId: number;
  name: string;
  email: string;
  role: Role;
  deptId: number | null;
  deptName: string | null;
}

export interface Department {
  dept_id: number;
  name: string;
  emission_cap: number;
}

export interface ComplianceRow {
  dept_id: number;
  department: string;
  emission_cap: number;
  ytd_emissions: number;
  remaining_kg: number;
  utilisation_pct: number;
  status: 'Compliant' | 'Non-Compliant';
}

export interface ScopeSummaryRow {
  dept_id: number;
  department: string;
  scope: number;
  record_count: number;
  avg_emission_kg: number;
  total_emission_kg: number;
}

export interface TopEmitterRow {
  dept_id: number;
  department: string;
  total_emission_kg: number;
  records: number;
}

export interface CapBreachRow {
  dept_id: number;
  department: string;
  emission_cap: number;
  ytd_emissions: number;
  overage_kg: number;
}

export interface ScopeBreakdownRow {
  dept_id: number;
  department: string;
  cap: number;
  scope1: number;
  scope2: number;
  scope3: number;
}

export interface RecentEmission {
  record_id: number;
  department: string;
  user_name: string;
  scope: number;
  value_kgco2: number;
  description: string | null;
  recorded_at: string;
}

export interface CreditTotals {
  transactions: number;
  bought: number;
  sold: number;
  offset: number;
}

export interface DashboardData {
  compliance: ComplianceRow[];
  scopeBreakdown: ScopeBreakdownRow[];
  recent: RecentEmission[];
  credits: CreditTotals;
  departments: Department[];
}

export interface ReportBundle {
  generated_at: string;
  scope_label: string;
  threshold: number;
  scope_breakdown: ScopeSummaryRow[];
  compliance: ComplianceRow[];
  top_emitters: TopEmitterRow[];
  cap_breaches: CapBreachRow[];
}

export interface VendorDocument {
  _id: string;
  vendor_name: string;
  dept_id: number;
  raw_text: string;
  compliance_tags: string[];
  reporting_year: number;
  metadata?: {
    pages?: number;
    uploader_id?: number;
    uploaded_by?: string;
    source?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface SearchHit extends VendorDocument {
  score?: number;
  similarity?: number;
  department?: string;
}

export interface VectorMatch {
  report_id: number;
  mongo_doc_id: string;
  vendor_name: string;
  dept_id: number;
  similarity: number;
}
