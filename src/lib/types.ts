export type LeadStatus =
  | "new"
  | "contacted"
  | "test_drive"
  | "negotiation"
  | "order_placed"
  | "delivered"
  | "lost";

export type LeadSource =
  | "walk_in"
  | "website"
  | "referral"
  | "social_media"
  | "phone_enquiry"
  | "auto_expo";

export interface Branch {
  id: string;
  name: string;
  city: string;
}

export interface SalesRep {
  id: string;
  name: string;
  branch_id: string;
  role: "branch_manager" | "sales_officer";
  joined: string;
}

export interface StatusEvent {
  status: LeadStatus;
  timestamp: string;
  note: string;
}

export interface Lead {
  id: string;
  customer_name: string;
  phone: string;
  source: LeadSource;
  model_interested: string;
  status: LeadStatus;
  assigned_to: string;
  branch_id: string;
  created_at: string;
  last_activity_at: string;
  status_history: StatusEvent[];
  expected_close_date: string;
  deal_value: number;
  lost_reason?: string | null;
}

export interface Target {
  branch_id: string;
  month: string; // YYYY-MM
  target_units: number;
  target_revenue: number;
}

export interface Delivery {
  lead_id: string;
  order_date: string;
  delivery_date: string;
  days_to_deliver: number;
  delay_reason: string | null;
}

export interface DealershipData {
  metadata: { generated_at: string; description: string; date_range: string; notes: string };
  branches: Branch[];
  sales_reps: SalesRep[];
  leads: Lead[];
  targets: Target[];
  deliveries: Delivery[];
}

/** Everything the UI needs, indexed for O(1) lookups. */
export interface Dataset extends DealershipData {
  branchById: Map<string, Branch>;
  repById: Map<string, SalesRep>;
  leadById: Map<string, Lead>;
  deliveryByLeadId: Map<string, Delivery>;
  repsByBranch: Map<string, SalesRep[]>;
  /** Latest timestamp present in the data — treated as "today" throughout the app. */
  asOf: Date;
  months: string[];
}

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
  /** Preset key, or "custom" */
  key: string;
  shortLabel?: string;
}
