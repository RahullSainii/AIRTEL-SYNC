export type Segment = 'micro' | 'prof' | 'multi' | 'mfg';

export type Product = {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  priceMin: number;
  priceMax: number;
  setupFee: number;
  minContractMonths: number;
  tiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGstin: boolean;
  requiresOneOf: string[];
  installDays: number;
  segments: string[];
};

export const NEEDS = [
  'internet', 'mobile', 'cctv', 'pos', 'whatsapp', 'sms', 'email', 'backup', 'website', 'security',
  'firewall', 'wifi', 'failover', 'sdwan', 'static_ip', 'telephony', 'tollfree', 'iot', 'fleet', 'dedicated',
] as const;
export type Need = (typeof NEEDS)[number];

export type Quantities = Partial<{
  mobileLines: number; cameras: number; posCounters: number; emailUsers: number; devices: number;
  vehicles: number; machines: number; voiceChannels: number;
}>;

export type Profile = {
  businessName?: string | null;
  businessType?: string | null;
  segment?: Segment | null;
  employees?: number | null;
  sites?: number | null;
  city?: string | null;
  cityTier?: 1 | 2 | null;
  tierEstimated?: boolean;
  hasGstin?: boolean | null;
  currentInternet?: string | null;
  monthlySpend?: number | null;
  noFibre?: boolean;
  needs?: Need[];
  quantities?: Quantities;
  requestedProducts?: string[];
  declinedProducts?: string[];
};

export type LineReason = { text: string };

export type BundleLine = {
  productId: string;
  qty: number;
  reason: string;
  autoAdded?: boolean;
};

export type Exclusion = { productId: string; reason: string; alternative?: string };

export type Quote = {
  lines: (BundleLine & { product: Product; monthly: number; setup: number })[];
  monthly: number;
  setup: number;
  contractMonths: number;
  maxInstallDays: number;
};

export type Language = 'en' | 'hi' | 'mr' | 'ta' | 'te' | 'kn' | 'bn' | 'gu' | 'pa' | 'ml';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type GstinRecord = {
  gstin: string; legalName: string; tradeName: string; constitution: string; address: string;
  state: string; registrationDate: string; status: 'Active' | 'Cancelled' | 'Suspended' | string;
};

export type UdyamRecord = {
  udyamNumber: string; enterpriseName: string; enterpriseType: string; majorActivity: string;
  nicDescription: string; state: string; city: string; registrationDate: string;
};

export type DocType = 'gst_certificate' | 'udyam_certificate' | 'signatory_id' | 'address_proof';

export type ExtractedField = { value: string | null; confidence: number; note?: string };
export type ExtractedDoc = {
  type: DocType;
  ocrConfidence: number;
  fields: Record<string, ExtractedField>;
  ms?: number;
};

export type CheckResult = 'pass' | 'flag' | 'review' | 'missing' | 'info';
export type KycCheck = {
  id: string;
  label: string;
  doc: DocType | 'registry';
  result: CheckResult;
  read?: string | null;
  expected?: string | null;
  why?: string;
  fix?: string;
};
export type KycVerdict = {
  status: 'verified' | 'flagged' | 'review';
  checks: KycCheck[];
  summary: string;
  registry: { gstin?: GstinRecord | null; udyam?: UdyamRecord | null; adapter: string };
  gstinUsed?: string | null;
  ms: number;
};
