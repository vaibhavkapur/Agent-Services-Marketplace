export type AssetCode = "USDC";

export type SettlementMode = "simulated" | "testnet";
export type SettlementKind = "simulated" | "network";

export type ProtocolName = "x402" | "mpp";
export type PaymentProfile = "x402-exact" | "mpp-charge" | "mpp-session";

export type TaskStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type InvocationState =
  | "created"
  | "quoted"
  | "budget_reserved"
  | "authorizing"
  | "requesting"
  | "completed"
  | "recovery_required"
  | "rejected";

export type PaymentState =
  | "not_started"
  | "authorized"
  | "settlement_pending"
  | "settled"
  | "failed"
  | "outcome_unknown";

export type DeliveryState =
  | "not_started"
  | "processing"
  | "available"
  | "retrieved"
  | "failed"
  | "outcome_unknown";

export type BudgetEntryType = "reserve" | "commit" | "release" | "adjust";

export type SessionCloseState =
  | "open"
  | "closing"
  | "closed"
  | "close_interrupted"
  | "reconciled";

export type UnusedFundsState =
  | "not_applicable"
  | "held"
  | "returned"
  | "unknown";

export type Money = {
  asset: AssetCode;
  amount_atomic: string;
  decimals: number;
};

export type AdvertisedPrice = Money & {
  freshness: string;
};

export type ServiceRecord = {
  service_id: string;
  operator_id: string;
  description: string;
  capability: string;
  endpoint: string;
  payment_profiles: PaymentProfile[];
  advertised_price: AdvertisedPrice;
  input_schema_ref: string;
  output_schema_ref: string;
  expected_result_format: string;
  data_provenance: string;
  usage_restrictions: string;
  availability?: { measured_at: string; up: boolean };
};

export type TaskBudget = {
  asset: AssetCode;
  amount_atomic: string;
  decimals: number;
  scope: "service_charges";
};

export type CreateTaskRequest = {
  goal: string;
  supplier_ids: string[];
  budget: TaskBudget;
  allowed_services?: string[];
  preferred_lookup_protocol?: ProtocolName;
};

export type BudgetSnapshot = {
  asset: AssetCode;
  decimals: number;
  scope: "service_charges";
  valuation_note: string;
  budget_atomic: string;
  completed_spend_atomic: string;
  reserved_atomic: string;
  session_locked_atomic: string;
  session_consumed_atomic: string;
  available_atomic: string;
  network_fee_allowance_atomic: string;
  network_fee_spent_atomic: string;
};

export type FaultName =
  | "none"
  | "drop-after-payment"
  | "higher-price"
  | "expired-terms"
  | "unsupported-asset"
  | "interrupt-session"
  | "duplicate-usage";

export type PolicyDecision =
  | { ok: true }
  | { ok: false; reason: string; code: string };
