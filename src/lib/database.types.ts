/**
 * Database types matching supabase/migrations/*.sql.
 *
 * Written in the same shape that `supabase gen types typescript` produces, so
 * you can regenerate it later with:
 *   npx supabase gen types typescript --project-id <project-ref> --schema public > src/lib/database.types.ts
 * (Keep the helper aliases at the bottom of this file if you regenerate.)
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12.2.3" };
  public: {
    Tables: {
      profiles: {
        Row: { id: string; full_name: string; role: "owner" | "staff"; is_active: boolean } & Timestamps;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      gym_settings: {
        Row: {
          id: number;
          gym_name: string;
          contact_phone: string | null;
          email: string | null;
          address: string | null;
          currency: string;
          timezone: string;
          expiry_warning_days: number;
          receipt_footer: string | null;
          logo_path: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never;
        Update: {
          gym_name?: string;
          contact_phone?: string | null;
          email?: string | null;
          address?: string | null;
          currency?: string;
          timezone?: string;
          expiry_warning_days?: number;
          receipt_footer?: string | null;
          logo_path?: string | null;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      packages: {
        Row: {
          id: string;
          name: string;
          duration_value: number;
          duration_unit: "days" | "months";
          price: number;
          description: string | null;
          is_active: boolean;
        } & Timestamps;
        Insert: {
          name: string;
          duration_value: number;
          duration_unit: "days" | "months";
          price: number;
          description?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          duration_value?: number;
          duration_unit?: "days" | "months";
          price?: number;
          description?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      trainers: {
        Row: {
          id: string;
          trainer_code: string;
          full_name: string;
          phone: string;
          email: string | null;
          specialization: string | null;
          joining_date: string;
          is_active: boolean;
          notes: string | null;
        } & Timestamps;
        Insert: {
          full_name: string;
          phone: string;
          email?: string | null;
          specialization?: string | null;
          joining_date?: string;
          is_active?: boolean;
          notes?: string | null;
        };
        Update: {
          full_name?: string;
          phone?: string;
          email?: string | null;
          specialization?: string | null;
          joining_date?: string;
          is_active?: boolean;
          notes?: string | null;
        };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          member_code: string;
          full_name: string;
          phone: string;
          email: string | null;
          joining_date: string;
          notes: string | null;
          is_active: boolean;
          deactivated_at: string | null;
          deactivation_reason: string | null;
          created_by: string | null;
        } & Timestamps;
        Insert: never;
        Update: {
          member_code?: string;
          full_name?: string;
          phone?: string;
          email?: string | null;
          joining_date?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          member_id: string;
          package_id: string | null;
          package_name: string;
          duration_value: number;
          duration_unit: "days" | "months";
          start_date: string;
          end_date: string;
          price: number;
          status: "active" | "cancelled";
          cancelled_at: string | null;
          cancel_reason: string | null;
          notes: string | null;
          created_by: string | null;
        } & Timestamps;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      fee_invoices: {
        Row: {
          id: string;
          invoice_no: string;
          member_id: string;
          membership_id: string | null;
          description: string;
          amount_due: number;
          amount_paid: number;
          balance: number;
          due_date: string;
          status: InvoiceStatus;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
          created_by: string | null;
        } & Timestamps;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          receipt_no: string;
          invoice_id: string;
          member_id: string;
          amount: number;
          method: PaymentMethod;
          payment_date: string;
          reference: string | null;
          notes: string | null;
          idempotency_key: string;
          is_void: boolean;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      attendance: {
        Row: {
          id: string;
          member_id: string;
          attendance_date: string;
          check_in_at: string;
          check_out_at: string | null;
          is_override: boolean;
          override_reason: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      member_overview: {
        Row: {
          id: string;
          member_code: string;
          full_name: string;
          phone: string;
          email: string | null;
          joining_date: string;
          notes: string | null;
          is_active: boolean;
          deactivated_at: string | null;
          deactivation_reason: string | null;
          created_at: string;
          updated_at: string;
          current_membership_id: string | null;
          current_package_id: string | null;
          current_package_name: string | null;
          current_start_date: string | null;
          current_end_date: string | null;
          valid_until: string | null;
          next_start: string | null;
          membership_status: MembershipStatus;
          days_remaining: number | null;
          expiring_soon: boolean;
          outstanding_balance: number;
        };
        Relationships: [];
      };
      invoice_overview: {
        Row: {
          id: string;
          invoice_no: string;
          member_id: string;
          membership_id: string | null;
          description: string;
          amount_due: number;
          amount_paid: number;
          balance: number;
          due_date: string;
          status: InvoiceStatus;
          void_reason: string | null;
          voided_at: string | null;
          created_at: string;
          updated_at: string;
          member_name: string;
          member_code: string;
          member_phone: string;
          is_overdue: boolean;
        };
        Relationships: [];
      };
      payment_overview: {
        Row: {
          id: string;
          receipt_no: string;
          invoice_id: string;
          member_id: string;
          amount: number;
          method: PaymentMethod;
          payment_date: string;
          reference: string | null;
          notes: string | null;
          is_void: boolean;
          void_reason: string | null;
          voided_at: string | null;
          created_at: string;
          member_name: string;
          member_code: string;
          member_phone: string;
          invoice_no: string;
          invoice_description: string;
        };
        Relationships: [];
      };
      attendance_overview: {
        Row: {
          id: string;
          member_id: string;
          attendance_date: string;
          check_in_at: string;
          check_out_at: string | null;
          is_override: boolean;
          override_reason: string | null;
          created_at: string;
          member_name: string;
          member_code: string;
          member_phone: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_gym_role: { Args: Record<PropertyKey, never>; Returns: string | null };
      is_gym_user: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_gym_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      gym_today: { Args: Record<PropertyKey, never>; Returns: string };
      compute_end_date: { Args: { p_start: string; p_value: number; p_unit: string }; Returns: string };
      assign_membership: {
        Args: { p_member_id: string; p_package_id: string; p_start_date: string; p_price?: number | null; p_notes?: string | null };
        Returns: string;
      };
      cancel_membership: { Args: { p_membership_id: string; p_reason: string }; Returns: undefined };
      create_member: {
        Args: {
          p_full_name: string;
          p_phone: string;
          p_email: string | null;
          p_joining_date: string;
          p_notes: string | null;
          p_member_code?: string | null;
          p_package_id?: string | null;
          p_start_date?: string | null;
          p_price?: number | null;
        };
        Returns: string;
      };
      set_member_active: { Args: { p_member_id: string; p_active: boolean; p_reason?: string | null }; Returns: undefined };
      delete_member: { Args: { p_member_id: string }; Returns: undefined };
      create_invoice: {
        Args: { p_member_id: string; p_description: string; p_amount: number; p_due_date: string };
        Returns: string;
      };
      void_invoice: { Args: { p_invoice_id: string; p_reason: string }; Returns: undefined };
      record_payment: {
        Args: {
          p_invoice_id: string;
          p_amount: number;
          p_method: string;
          p_payment_date: string | null;
          p_reference: string | null;
          p_notes: string | null;
          p_idempotency_key: string;
        };
        Returns: string;
      };
      void_payment: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined };
      check_in_member: {
        Args: { p_member_id: string; p_override?: boolean; p_override_reason?: string | null };
        Returns: string;
      };
      check_out_attendance: { Args: { p_attendance_id: string }; Returns: undefined };
      undo_check_in: { Args: { p_attendance_id: string; p_reason: string }; Returns: undefined };
      dashboard_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      dashboard_trends: { Args: { p_months?: number; p_days?: number }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type InvoiceStatus = "unpaid" | "partially_paid" | "paid" | "void";
export type PaymentMethod = "cash" | "bank_transfer" | "easypaisa" | "jazzcash" | "other";
export type MembershipStatus = "active" | "expired" | "inactive" | "upcoming" | "no_membership";

type PublicSchema = Database["public"];
export type TableRow<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type ViewRow<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];

export type Profile = TableRow<"profiles">;
export type GymSettings = TableRow<"gym_settings">;
export type Package = TableRow<"packages">;
export type Trainer = TableRow<"trainers">;
export type Member = TableRow<"members">;
export type Membership = TableRow<"memberships">;
export type FeeInvoice = TableRow<"fee_invoices">;
export type Payment = TableRow<"payments">;
export type Attendance = TableRow<"attendance">;
export type MemberOverview = ViewRow<"member_overview">;
export type InvoiceOverview = ViewRow<"invoice_overview">;
export type PaymentOverview = ViewRow<"payment_overview">;
export type AttendanceOverview = ViewRow<"attendance_overview">;
