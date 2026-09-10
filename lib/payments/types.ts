export type PaymentProvider = "MPESA" | "STRIPE";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "TIMED_OUT";
export type ResourceType = "Exam" | "Notes" | "3D Pass" | "Subscription" | "AudioBooks" | "Immersive";

export type PaymentMetadata = {
  item?: string;
  grade_level?: string;
  subject_name?: string;
  resource_type?: ResourceType | string;
  country?: string;
  [key: string]: unknown;
};

export type Transaction = {
  id: string;
  user_id: string;
  reference_id: string;
  provider: PaymentProvider;
  provider_reference: string | null;
  mpesa_receipt_number: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  metadata: PaymentMetadata;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
};

export type InitiatePaymentInput = {
  method?: PaymentProvider;
  amount: number;
  currency?: string;
  country?: string;
  phone?: string;
  email?: string;
  user_id?: string;
  description?: string;
  metadata?: PaymentMetadata;
};

export function offeredMethods(currency = "KES", country = "KE"): {
  defaultMethod: PaymentProvider;
  methods: PaymentProvider[];
} {
  const kes = currency.toUpperCase() === "KES";
  const kenya = country.toUpperCase() === "KE";
  if (kes && kenya) return { defaultMethod: "MPESA", methods: ["MPESA", "STRIPE"] };
  return { defaultMethod: "STRIPE", methods: ["STRIPE"] };
}

export function resolveMethod(input: InitiatePaymentInput): PaymentProvider {
  const currency = (input.currency || "KES").toUpperCase();
  const country = (input.country || input.metadata?.country || "KE").toString().toUpperCase();
  const offered = offeredMethods(currency, country);
  const requested = input.method;
  if (requested && offered.methods.includes(requested)) return requested;
  return offered.defaultMethod;
}
