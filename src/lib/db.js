import { supabase, isOnline } from "./supabase";

// ============================================================
// LEADS
// ============================================================

export async function fetchLeads() {
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from("leads")
    .select("*, lead_notes(*)")
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchLeads:", error); return []; }
  return data;
}

export async function createLead(lead) {
  if (!isOnline()) return null;
  const { data, error } = await supabase
    .from("leads")
    .insert([{
      name: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      address: lead.address || "",
      service_type: lead.serviceType || lead.service || "",
      frequency: lead.frequency || "",
      lot_size: lead.lotSize || "",
      notes: lead.notes || lead.message || "",
      heard_from: lead.heardFrom || "",
      referral_code: lead.referralCode || "",
      source: lead.source || "website",
      status: "new",
    }]);
  if (error) { console.error("createLead:", error); return null; }
  return data;
}

export async function updateLead(id, updates) {
  if (!isOnline()) return null;
  // Map frontend field names to DB columns
  const dbUpdates = {};
  const fieldMap = {
    name: "name", email: "email", phone: "phone", address: "address",
    serviceType: "service_type", service_type: "service_type",
    frequency: "frequency", lotSize: "lot_size", lot_size: "lot_size",
    notes: "notes", status: "status", price: "price",
  };
  for (const [key, val] of Object.entries(updates)) {
    const dbKey = fieldMap[key] || key;
    dbUpdates[dbKey] = val;
  }
  const { data, error } = await supabase
    .from("leads")
    .update(dbUpdates)
    .eq("id", id)
    .select()
    .single();
  if (error) { console.error("updateLead:", error); return null; }
  return data;
}

export async function archiveLead(id) {
  return updateLead(id, { status: "archived" });
}

export async function convertLeadToCustomer(leadId) {
  if (!isOnline()) return null;
  // Fetch the lead
  const { data: lead, error: fetchErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (fetchErr || !lead) { console.error("convertLead fetch:", fetchErr); return null; }

  // Generate token and referral code
  const tokenBase = (lead.name || "xx").toLowerCase().replace(/[^a-z]/g, "").slice(0, 2) + Math.random().toString(36).slice(2, 8);
  const refCode = (lead.name || "NEW").split(" ")[0].toUpperCase().slice(0, 4) + "2026";

  // Insert as customer
  const { data: customer, error: insertErr } = await supabase
    .from("customers")
    .insert([{
      name: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      address: lead.address || "",
      service: lead.service_type || "Mowing",
      price: lead.price || 0,
      frequency: lead.frequency || "Weekly",
      status: "Active",
      balance: 0,
      referral_code: refCode,
      token: tokenBase,
      converted_from_lead_id: leadId,
    }])
    .select()
    .single();
  if (insertErr) { console.error("convertLead insert:", insertErr); return null; }

  // Mark lead as converted
  await supabase.from("leads").update({ status: "converted", converted_customer_id: customer.id }).eq("id", leadId);

  // Add a note to the lead
  await addLeadNote(leadId, `Converted to active customer #${customer.id}`);

  return customer;
}

// ============================================================
// LEAD NOTES / ACTIVITY LOG
// ============================================================

export async function addLeadNote(leadId, content, type = "note") {
  if (!isOnline()) return null;
  const { data, error } = await supabase
    .from("lead_notes")
    .insert([{ lead_id: leadId, content, note_type: type }])
    .select()
    .single();
  if (error) { console.error("addLeadNote:", error); return null; }
  return data;
}

export async function fetchLeadNotes(leadId) {
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from("lead_notes")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchLeadNotes:", error); return []; }
  return data;
}

// ============================================================
// CUSTOMERS
// ============================================================

export async function fetchCustomers() {
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error("fetchCustomers:", error); return []; }
  return data;
}

export async function updateCustomer(id, updates) {
  if (!isOnline()) return null;
  const { data, error } = await supabase
    .from("customers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) { console.error("updateCustomer:", error); return null; }
  return data;
}

export async function createCustomer(customer) {
  if (!isOnline()) return null;
  const { data, error } = await supabase
    .from("customers")
    .insert([customer])
    .select()
    .single();
  if (error) { console.error("createCustomer:", error); return null; }
  return data;
}

// ============================================================
// ESTIMATES (for Phase 2 — AI estimate storage)
// ============================================================

export async function saveEstimate(leadId, estimateData) {
  if (!isOnline()) return null;
  const { data, error } = await supabase
    .from("estimates")
    .insert([{
      lead_id: leadId,
      base_price: estimateData.basePrice,
      monthly_estimate: estimateData.monthlyEstimate,
      annual_estimate: estimateData.annualEstimate,
      line_items: estimateData.lineItems,
      recommendation: estimateData.recommendation,
      profit_margin: estimateData.profitMargin,
      competitive_note: estimateData.competitiveNote,
    }])
    .select()
    .single();
  if (error) { console.error("saveEstimate:", error); return null; }

  // Update lead status
  await updateLead(leadId, { status: "estimate_sent" });
  await addLeadNote(leadId, `AI estimate generated: $${estimateData.basePrice}/visit, $${estimateData.monthlyEstimate}/mo`, "estimate");

  return data;
}

// ============================================================
// EXPENSES
// ============================================================

export async function fetchExpenses() {
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });
  if (error) { console.error("fetchExpenses:", error); return []; }
  return data;
}

export async function createExpense(expense) {
  if (!isOnline()) return null;
  const { data, error } = await supabase
    .from("expenses")
    .insert([{
      date: expense.date,
      category: expense.category,
      description: expense.description || "",
      amount: Number(expense.amount),
    }])
    .select()
    .single();
  if (error) { console.error("createExpense:", error); return null; }
  return data;
}

export async function deleteExpense(id) {
  if (!isOnline()) return null;
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id);
  if (error) { console.error("deleteExpense:", error); return null; }
  return true;
}
