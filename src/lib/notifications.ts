import { supabase } from "./supabase";

export type EmailResult = { sent: boolean; error?: string };

export async function sendStatusChangeEmail(params: {
  to: string;
  tracking_code: string;
  receiver_name: string;
  old_status: string;
  new_status: string;
  origin: string;
  destination: string;
}): Promise<EmailResult> {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: { type: "status_change", ...params },
  });
  if (error) return { sent: false, error: error.message };
  return (data as EmailResult) ?? { sent: false, error: "No response" };
}

export async function sendDelayEmail(params: {
  to: string;
  tracking_code: string;
  receiver_name: string;
  reason: string;
  new_eta: string;
  origin: string;
  destination: string;
}): Promise<EmailResult> {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: { type: "delay", ...params },
  });
  if (error) return { sent: false, error: error.message };
  return (data as EmailResult) ?? { sent: false, error: "No response" };
}

export async function sendContactInquiryEmail(params: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  origin: string;
  destination: string;
  details: string;
}): Promise<EmailResult> {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: { type: "contact_inquiry", ...params },
  });
  if (error) return { sent: false, error: error.message };
  return (data as EmailResult) ?? { sent: false, error: "No response" };
}
