import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CompanyInfo = {
  company_name: string;
  legal_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  license_number: string | null;
  estimator_name: string | null;
  logo_path: string | null;
  default_report_notes: string | null;
};

export const DEFAULT_COMPANY: CompanyInfo = {
  company_name: "AWM LLC",
  legal_name: "American Windows Manufacturer LLC",
  address: null,
  phone: null,
  email: null,
  website: null,
  license_number: null,
  estimator_name: null,
  logo_path: null,
  default_report_notes: null,
};

const COLUMNS =
  "company_name,legal_name,address,phone,email,website,license_number,estimator_name,logo_path,default_report_notes";

/** Reads the signed-in user's report/company defaults, falling back to AWM values. */
export async function fetchCompanySettings(): Promise<CompanyInfo> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return DEFAULT_COMPANY;
  const { data } = await supabase
    .from("company_settings")
    .select(COLUMNS)
    .eq("user_id", uid)
    .maybeSingle();
  if (!data) return DEFAULT_COMPANY;
  return { ...DEFAULT_COMPANY, ...(data as Partial<CompanyInfo>) };
}

export function useCompanySettings() {
  return useQuery({ queryKey: ["company-settings"], queryFn: fetchCompanySettings });
}

export async function saveCompanySettings(patch: Partial<CompanyInfo>) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("You must be signed in to save report settings.");
  const { error } = await supabase
    .from("company_settings")
    .upsert({ user_id: uid, ...patch } as never, { onConflict: "user_id" });
  if (error) throw error;
}

/** Single-line company footer used on generated documents. */
export function companyContactLine(company: CompanyInfo) {
  return [company.address, company.phone, company.email, company.website]
    .filter(Boolean)
    .join(" · ");
}
