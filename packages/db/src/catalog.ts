import type { ServiceRecord } from "@asm/shared";

export const LOOKUP_PRICE = "20000";
export const DILIGENCE_PRICE = "1950000";
export const PAGE_PRICE = "10000";

export function catalogServices(endpoints: {
  lookup: string;
  extraction: string;
}): ServiceRecord[] {
  const freshness = "2026-09-25T00:00:00.000Z";
  return [
    {
      service_id: "supplier_lookup",
      operator_id: "asm-owned",
      description: "Return a structured supplier profile from the demo dataset",
      capability: "supplier.lookup",
      endpoint: `${endpoints.lookup}/v1/suppliers/{supplier_id}`,
      payment_profiles: ["x402-exact", "mpp-charge"],
      advertised_price: {
        asset: "USDC",
        amount_atomic: LOOKUP_PRICE,
        decimals: 6,
        freshness,
      },
      input_schema_ref: "supplier-lookup-v1",
      output_schema_ref: "supplier-profile-v1",
      expected_result_format: "application/json",
      data_provenance: "Project-owned demo fixture. Not real supplier personal data.",
      usage_restrictions: "Demo use only. Do not treat as production diligence.",
      availability: { measured_at: freshness, up: true },
    },
    {
      service_id: "document_extraction",
      operator_id: "asm-owned",
      description: "Extract pages from a supplier document and bill per accepted page",
      capability: "document.extract",
      endpoint: `${endpoints.extraction}/v1/documents/{document_id}/pages`,
      payment_profiles: ["mpp-session"],
      advertised_price: {
        asset: "USDC",
        amount_atomic: PAGE_PRICE,
        decimals: 6,
        freshness,
      },
      input_schema_ref: "document-extract-v1",
      output_schema_ref: "extracted-pages-v1",
      expected_result_format: "application/json",
      data_provenance: "Project-owned demo documents.",
      usage_restrictions: "Metered per page. Unused session deposit is returned on close.",
      availability: { measured_at: freshness, up: true },
    },
    {
      service_id: "supplier_diligence",
      operator_id: "asm-owned",
      description: "Premium diligence memo that often exceeds a tight remaining budget",
      capability: "supplier.diligence",
      endpoint: `${endpoints.lookup}/v1/diligence/{supplier_id}`,
      payment_profiles: ["x402-exact"],
      advertised_price: {
        asset: "USDC",
        amount_atomic: DILIGENCE_PRICE,
        decimals: 6,
        freshness,
      },
      input_schema_ref: "supplier-diligence-v1",
      output_schema_ref: "diligence-memo-v1",
      expected_result_format: "application/json",
      data_provenance: "Project-owned premium fixture.",
      usage_restrictions: "Used to demonstrate budget refusal.",
      availability: { measured_at: freshness, up: true },
    },
  ];
}
