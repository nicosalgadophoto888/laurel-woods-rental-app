import { promises as fs } from "fs";
import path from "path";
import { seedState } from "./seed";
import { getSupabaseServerClient } from "./supabase";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "app-state.json");
const settingsRowId = "default";

function isReadOnlyFsError(error) {
  return error?.code === "EROFS" || error?.code === "EPERM" || error?.code === "EACCES" || error?.code === "ENOENT";
}

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readFileState() {
  try {
    await ensureDir();
    const content = await fs.readFile(dataFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT" || isReadOnlyFsError(error)) {
      return seedState;
    }
    throw error;
  }
}

async function writeFileState(state) {
  try {
    await ensureDir();
    await fs.writeFile(dataFile, JSON.stringify(state, null, 2), "utf8");
  } catch (error) {
    if (!isReadOnlyFsError(error)) throw error;
  }
  return state;
}

function toPlainState(state) {
  return {
    property: state.property,
    settings: state.settings,
    units: state.units || [],
    tenants: state.tenants || [],
    tenantDocuments: state.tenantDocuments || [],
    rentCharges: state.rentCharges || [],
    payments: state.payments || [],
  };
}

async function ensureSupabaseSeeded(client) {
  const { count, error } = await client
    .from("properties")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  if ((count || 0) > 0) return;

  const state = seedState;

  await client.from("properties").insert(state.property);
  await client.from("app_settings").insert({
    id: settingsRowId,
    due_day: state.settings.dueDay,
    warning_template: state.settings.warningTemplate,
  });
  if (state.units.length) await client.from("units").insert(state.units.map((unit) => ({
    id: unit.id,
    property_id: unit.propertyId,
    unit_number: unit.unitNumber,
    parking_spot: unit.parkingSpot,
    status: unit.status,
    default_monthly_rent: unit.defaultMonthlyRent,
  })));
  if (state.tenants.length) await client.from("tenants").insert(state.tenants.map((tenant) => ({
    id: tenant.id,
    property_id: tenant.propertyId,
    unit_id: tenant.unitId,
    full_name: tenant.fullName,
    phone: tenant.phone,
    email: tenant.email,
    memo: tenant.memo,
    monthly_rent: tenant.monthlyRent,
    deposit_amount: tenant.depositAmount,
    lease_start: tenant.leaseStart,
    lease_end: tenant.leaseEnd,
    status: tenant.status,
  })));
  if (state.tenantDocuments.length) await client.from("tenant_documents").insert(state.tenantDocuments.map((document) => ({
    id: document.id,
    tenant_id: document.tenantId,
    document_type: document.documentType,
    file_name: document.fileName,
    file_path: document.filePath,
    uploaded_at: document.uploadedAt,
  })));
  if (state.rentCharges.length) await client.from("rent_charges").insert(state.rentCharges.map((charge) => ({
    id: charge.id,
    tenant_id: charge.tenantId,
    charge_month: charge.chargeMonth,
    due_date: charge.dueDate,
    rent_amount: charge.rentAmount,
    other_charges: charge.otherCharges,
    total_charge: charge.totalCharge,
  })));
  if (state.payments.length) await client.from("payments").insert(state.payments.map((payment) => ({
    id: payment.id,
    tenant_id: payment.tenantId,
    payment_date: payment.paymentDate,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    notes: payment.notes,
  })));
}

function mapSupabaseState({ property, settings, units, tenants, tenantDocuments, rentCharges, payments }) {
  return {
    property: property || seedState.property,
    settings: settings || seedState.settings,
    units: (units || []).map((unit) => ({
      id: unit.id,
      propertyId: unit.property_id,
      unitNumber: unit.unit_number,
      parkingSpot: unit.parking_spot,
      status: unit.status,
      defaultMonthlyRent: Number(unit.default_monthly_rent || 0),
    })),
    tenants: (tenants || []).map((tenant) => ({
      id: tenant.id,
      propertyId: tenant.property_id,
      unitId: tenant.unit_id,
      fullName: tenant.full_name,
      phone: tenant.phone,
      email: tenant.email,
      memo: tenant.memo,
      monthlyRent: Number(tenant.monthly_rent || 0),
      depositAmount: Number(tenant.deposit_amount || 0),
      leaseStart: tenant.lease_start,
      leaseEnd: tenant.lease_end,
      status: tenant.status,
    })),
    tenantDocuments: (tenantDocuments || []).map((document) => ({
      id: document.id,
      tenantId: document.tenant_id,
      documentType: document.document_type,
      fileName: document.file_name,
      filePath: document.file_path,
      uploadedAt: document.uploaded_at,
    })),
    rentCharges: (rentCharges || []).map((charge) => ({
      id: charge.id,
      tenantId: charge.tenant_id,
      chargeMonth: charge.charge_month,
      dueDate: charge.due_date,
      rentAmount: Number(charge.rent_amount || 0),
      otherCharges: Number(charge.other_charges || 0),
      totalCharge: Number(charge.total_charge || 0),
    })),
    payments: (payments || []).map((payment) => ({
      id: payment.id,
      tenantId: payment.tenant_id,
      paymentDate: payment.payment_date,
      amount: Number(payment.amount || 0),
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
    })),
  };
}

async function syncTable(client, tableName, rows, mapRow) {
  const ids = rows.map((row) => row.id);
  const { data: existingRows, error: selectError } = await client.from(tableName).select("id");
  if (selectError) throw selectError;

  if (rows.length) {
    const { error: upsertError } = await client
      .from(tableName)
      .upsert(rows.map(mapRow), { onConflict: "id" });
    if (upsertError) throw upsertError;
  }

  const existingIds = (existingRows || []).map((row) => row.id);
  const idsToDelete = existingIds.filter((id) => !ids.includes(id));

  if (idsToDelete.length) {
    const { error: deleteError } = await client.from(tableName).delete().in("id", idsToDelete);
    if (deleteError) throw deleteError;
  }
}

async function readSupabaseState(client) {
  await ensureSupabaseSeeded(client);

  const [
    propertyResult,
    settingsResult,
    unitsResult,
    tenantsResult,
    documentsResult,
    chargesResult,
    paymentsResult,
  ] = await Promise.all([
    client.from("properties").select("*").limit(1).maybeSingle(),
    client.from("app_settings").select("*").eq("id", settingsRowId).maybeSingle(),
    client.from("units").select("*").order("unit_number"),
    client.from("tenants").select("*").order("full_name"),
    client.from("tenant_documents").select("*").order("uploaded_at", { ascending: false }),
    client.from("rent_charges").select("*").order("charge_month"),
    client.from("payments").select("*").order("payment_date", { ascending: false }),
  ]);

  for (const result of [
    propertyResult,
    settingsResult,
    unitsResult,
    tenantsResult,
    documentsResult,
    chargesResult,
    paymentsResult,
  ]) {
    if (result.error) throw result.error;
  }

  return mapSupabaseState({
    property: propertyResult.data,
    settings: settingsResult.data
      ? {
          dueDay: settingsResult.data.due_day,
          warningTemplate: settingsResult.data.warning_template,
        }
      : null,
    units: unitsResult.data,
    tenants: tenantsResult.data,
    tenantDocuments: documentsResult.data,
    rentCharges: chargesResult.data,
    payments: paymentsResult.data,
  });
}

async function writeSupabaseState(client, state) {
  const plain = toPlainState(state);

  const { error: propertyError } = await client.from("properties").upsert({
    id: plain.property.id,
    name: plain.property.name,
    address: plain.property.address,
    city: plain.property.city,
    state: plain.property.state,
  });
  if (propertyError) throw propertyError;

  const { error: settingsError } = await client.from("app_settings").upsert({
    id: settingsRowId,
    due_day: plain.settings.dueDay,
    warning_template: plain.settings.warningTemplate,
  });
  if (settingsError) throw settingsError;

  await syncTable(client, "units", plain.units, (unit) => ({
    id: unit.id,
    property_id: unit.propertyId,
    unit_number: unit.unitNumber,
    parking_spot: unit.parkingSpot,
    status: unit.status,
    default_monthly_rent: unit.defaultMonthlyRent,
  }));

  await syncTable(client, "tenants", plain.tenants, (tenant) => ({
    id: tenant.id,
    property_id: tenant.propertyId,
    unit_id: tenant.unitId,
    full_name: tenant.fullName,
    phone: tenant.phone,
    email: tenant.email,
    memo: tenant.memo,
    monthly_rent: tenant.monthlyRent,
    deposit_amount: tenant.depositAmount,
    lease_start: tenant.leaseStart,
    lease_end: tenant.leaseEnd,
    status: tenant.status,
  }));

  await syncTable(client, "tenant_documents", plain.tenantDocuments, (document) => ({
    id: document.id,
    tenant_id: document.tenantId,
    document_type: document.documentType,
    file_name: document.fileName,
    file_path: document.filePath,
    uploaded_at: document.uploadedAt,
  }));

  await syncTable(client, "rent_charges", plain.rentCharges, (charge) => ({
    id: charge.id,
    tenant_id: charge.tenantId,
    charge_month: charge.chargeMonth,
    due_date: charge.dueDate,
    rent_amount: charge.rentAmount,
    other_charges: charge.otherCharges,
    total_charge: charge.totalCharge,
  }));

  await syncTable(client, "payments", plain.payments, (payment) => ({
    id: payment.id,
    tenant_id: payment.tenantId,
    payment_date: payment.paymentDate,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    notes: payment.notes,
  }));

  return plain;
}

export async function readState() {
  const client = getSupabaseServerClient();
  if (client) {
    try {
      return await readSupabaseState(client);
    } catch (error) {
      console.error("Supabase read failed, falling back to file/seed state:", error);
    }
  }

  try {
    return await readFileState();
  } catch (error) {
    if (error.code === "ENOENT") {
      return seedState;
    }

    if (isReadOnlyFsError(error)) {
      return seedState;
    }

    throw error;
  }
}

export async function writeState(state) {
  const client = getSupabaseServerClient();
  if (client) {
    try {
      return await writeSupabaseState(client, state);
    } catch (error) {
      console.error("Supabase write failed, falling back to file state:", error);
    }
  }

  return writeFileState(toPlainState(state));
}
