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

  // Normalize service and frequency from lead data
  const rawService = (lead.service_type || "Mowing").toLowerCase();
  let normalizedService = "Mowing";
  let normalizedFrequency = lead.frequency || "Weekly";

  // Map ad-hoc / one-time mowing variants → Mowing + Occasional
  if (rawService.includes("ad-hoc") || rawService.includes("ad hoc") || rawService.includes("one-time") || rawService.includes("one time")) {
    normalizedService = "Mowing";
    normalizedFrequency = "Occasional";
  } else if (rawService.includes("weekly mow") || rawService.includes("lawn mow") || rawService === "mowing") {
    normalizedService = "Mowing";
  } else if (rawService.includes("bi-weekly") || rawService.includes("biweekly")) {
    normalizedService = "Mowing";
    normalizedFrequency = "Biweekly";
  } else if (rawService.includes("landscap")) {
    normalizedService = "Landscaping";
  } else if (rawService.includes("aerat")) {
    normalizedService = "Aeration & Seeding";
  } else if (rawService.includes("treatment") || rawService.includes("pre-emergent")) {
    normalizedService = "Lawn Treatment";
  } else if (rawService.includes("mulch")) {
    normalizedService = "Mulch Application";
  } else if (rawService.includes("brush") || rawService.includes("clearing")) {
    normalizedService = "Brush Clearing";
  } else if (rawService.includes("fall clean") || rawService.includes("cleanup")) {
    normalizedService = "Fall Clean-Up";
  } else {
    normalizedService = lead.service_type || "Mowing";
  }

  // Insert as customer
  const { data: customer, error: insertErr } = await supabase
    .from("customers")
    .insert([{
      name: lead.name,
      email: lead.email || "",
      phone: lead.phone || "",
      address: lead.address || "",
      service: normalizedService,
      price: lead.price || 0,
      frequency: normalizedFrequency,
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

  // ── Referral credit: if this lead has a referral code, credit the referrer ──
  if (lead.referral_code) {
    const { data: referrer } = await supabase
      .from("customers")
      .select("id, name, balance, referral_code")
      .eq("referral_code", lead.referral_code)
      .single();
    if (referrer) {
      // $50 for ongoing (Weekly/Biweekly/Monthly), $25 for one-off (Occasional or non-mowing)
      const isOngoing = ["Weekly", "Biweekly", "Monthly"].includes(normalizedFrequency) && normalizedService === "Mowing";
      const creditAmount = isOngoing ? 50 : 25;
      const newBalance = Number(referrer.balance || 0) - creditAmount; // negative balance = credit owed
      await supabase.from("customers").update({ balance: newBalance }).eq("id", referrer.id);
      await addLeadNote(leadId, `Referral credit of $${creditAmount} applied to ${referrer.name} (${isOngoing ? "ongoing mowing" : "one-time/other service"})`);
    }
  }

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

export async function deleteCustomer(id) {
  if (!isOnline()) return null;
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id);
  if (error) { console.error("deleteCustomer:", error); return null; }
  return true;
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

// ============================================================
// SERVICE VISITS — actual completed/scheduled work
// ============================================================

export async function fetchServiceVisits() {
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from("service_visits")
    .select("*, customers(name)")
    .order("date", { ascending: false });
  if (error) { console.error("fetchServiceVisits:", error); return []; }
  return data;
}

export async function createServiceVisit(visit) {
  if (!isOnline()) return null;
  const insertData = {
    customer_id: visit.customer_id,
    date: visit.date,
    service: visit.service || "Mowing",
    amount: Number(visit.amount),
    status: visit.status || "completed",
    notes: visit.notes || "",
  };
  if (visit.duration_minutes) insertData.duration_minutes = Number(visit.duration_minutes);
  const { data, error } = await supabase
    .from("service_visits")
    .insert([insertData])
    .select("*, customers(name)")
    .single();
  if (error) { console.error("createServiceVisit:", error); return null; }
  return data;
}

export async function updateServiceVisit(id, updates) {
  if (!isOnline()) return null;
  const { data, error } = await supabase
    .from("service_visits")
    .update(updates)
    .eq("id", id)
    .select("*, customers(name)")
    .single();
  if (error) { console.error("updateServiceVisit:", error); return null; }
  return data;
}

export async function deleteServiceVisit(id) {
  if (!isOnline()) return null;
  const { error } = await supabase
    .from("service_visits")
    .delete()
    .eq("id", id);
  if (error) { console.error("deleteServiceVisit:", error); return null; }
  return true;
}

// ============================================================
// INVOICES — generated from service visits
// ============================================================

export async function fetchInvoices() {
  if (!isOnline()) return [];
  const { data, error } = await supabase
    .from("invoices")
    .select("*, customers(name, email, phone, address)")
    .order("created_at", { ascending: false });
  if (error) { console.error("fetchInvoices:", error); return []; }
  return data;
}

export async function createInvoice(invoice) {
  if (!isOnline()) return null;
  const { data, error } = await supabase
    .from("invoices")
    .insert([{
      invoice_number: invoice.invoice_number,
      customer_id: invoice.customer_id,
      date_issued: invoice.date_issued,
      date_due: invoice.date_due,
      line_items: invoice.line_items,
      subtotal: invoice.subtotal,
      total: invoice.total,
      status: invoice.status || "unpaid",
      notes: invoice.notes || "",
      visit_ids: invoice.visit_ids || [],
    }])
    .select("*, customers(name, email, phone, address)")
    .single();
  if (error) { console.error("createInvoice:", error); return null; }
  return data;
}

export async function updateInvoice(id, updates) {
  if (!isOnline()) return null;
  const { data, error } = await supabase
    .from("invoices")
    .update(updates)
    .eq("id", id)
    .select("*, customers(name, email, phone, address)")
    .single();
  if (error) { console.error("updateInvoice:", error); return null; }
  return data;
}

export async function deleteInvoice(id) {
  if (!isOnline()) return null;
  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id);
  if (error) { console.error("deleteInvoice:", error); return null; }
  return true;
}

export async function getNextInvoiceNumber() {
  if (!isOnline()) return `INV-${Date.now()}`;
  const { data, error } = await supabase.rpc("nextval", { seq_name: "invoice_number_seq" });
  if (error) {
    // Fallback: count existing invoices
    const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
    return `INV-${String((count || 0) + 100).padStart(4, "0")}`;
  }
  return `INV-${String(data).padStart(4, "0")}`;
}
