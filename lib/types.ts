// Row shapes of the Supabase tables the app reads and writes.

export type ClassGroup = {
  id: string;
  day: string | null; // e.g. "ראשון"
  time: string | null; // e.g. "16:00"
  color: string | null;
};

export type Activity = {
  id: number;
  name: string | null;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null;
  color: string | null;
  default_price: number | null;
  morning_item_id: string | null;
  created_at?: string;
  activity_type: string | null; // "חוג" | "קייטנה"
  class_group_id: string | null;
};

export type Child = {
  id: string;
  first_name: string | null;
  family_name: string | null;
  gender: string | null;
  morning_customer_id: string | null;
  morning_customer_id_2: string | null;
  date_created?: string;
};

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export type ChildActivity = {
  id: number;
  child_id: string;
  activity_id: number;
  price: number | null; // overrides the activity price
  payment_status: PaymentStatus | string | null;
  created_at?: string;
  invoices: string[] | null;
  paid_amount: number | null; // added by migration 001
};

export type Payer = {
  morning_customer_id: string;
  name: string | null;
  phone: string | null; // נייד, falling back to טלפון
  email: string | null; // first address from "כתובות מייל"
};

export type Settings = {
  default_full_price: number | null;
  default_discount_price: number | null;
};

export type Alias = { id: string; payer_id: string; raw_name: string | null };

export type PaymentMethod = 'bit' | 'paybox' | 'bank' | 'cash' | 'credit' | 'other';

export type PaymentLog = {
  id: string;
  created_at: string;
  paid_at: string | null;
  payer_id: string | null;
  raw_name: string | null;
  amount: number;
  method: PaymentMethod | string | null;
  note: string | null;
  morning_document_id: string | null;
  morning_document_number: string | null;
  morning_document_url: string | null;
  allocations: { child_activity_id: number; amount: number }[] | null;
};
