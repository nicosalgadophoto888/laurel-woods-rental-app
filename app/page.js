"use client";

import { useEffect, useMemo, useState } from "react";
import { buildDerivedState } from "../lib/ledger";
import { seedState } from "../lib/seed";
import { laurelWoodsUnitMaster } from "../lib/unitMaster";

const LOGO_SRC = "/laurelwoods-logo.jpg";

const tabs = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tenants", label: "Tenants" },
  { key: "units", label: "Units" },
  { key: "payments", label: "Payments" },
  { key: "documents", label: "Documents" },
  { key: "statements", label: "Statements" },
  { key: "reports", label: "Reports" },
  { key: "alerts", label: "Alerts" },
];

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function monthLabel(monthKey) {
  if (!monthKey) return "—";
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function longDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function openPrintWindow(html) {
  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
}

function openPreviewWindow(html) {
  const previewWindow = window.open("", "_blank", "width=1100,height=900");
  if (!previewWindow) return;
  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
  previewWindow.focus();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeUnitNumber(value) {
  return String(value || "").trim();
}

function unitSuffix(unitNumber) {
  const normalized = normalizeUnitNumber(unitNumber);
  return normalized.includes("-") ? normalized.split("-").pop() : normalized;
}

function unitSort(a, b) {
  return normalizeUnitNumber(a.unitNumber).localeCompare(normalizeUnitNumber(b.unitNumber), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function unitIdFromNumber(unitNumber) {
  return `unit-${normalizeUnitNumber(unitNumber)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")}`;
}

function legacyUnitIdForNumber(unitNumber) {
  const normalized = normalizeUnitNumber(unitNumber);
  if (!normalized.startsWith("1-")) return "";
  return `unit-${normalized.slice(2)}`;
}

function tenantUnitLabel(tenant) {
  return `Unit ${tenant.unit?.unitNumber || "—"} · ${tenant.fullName}`;
}

function statementHtml(property, tenant) {
  const rows = tenant.charges
    .map(
      (charge) => `
        <tr>
          <td>${escapeHtml(monthLabel(charge.chargeMonth))}</td>
          <td>${escapeHtml(longDate(charge.dueDate))}</td>
          <td>${escapeHtml(money(charge.totalCharge))}</td>
          <td>${escapeHtml(money(charge.appliedAmount))}</td>
          <td>${escapeHtml(money(charge.remainingBalance))}</td>
          <td>${escapeHtml(charge.status)}</td>
        </tr>
      `
    )
    .join("");

  const paymentRows = tenant.payments
    .map(
      (payment) => `
        <tr>
          <td>${escapeHtml(longDate(payment.paymentDate))}</td>
          <td>${escapeHtml(payment.method || "Manual")}</td>
          <td>${escapeHtml(payment.reference || "—")}</td>
          <td>${escapeHtml(money(payment.amount))}</td>
        </tr>
      `
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Monthly Statement</title>
      <style>
        body { font-family: Georgia, serif; color:#2e2418; padding:32px; }
        h1,h2,h3 { margin:0; }
        table { width:100%; border-collapse: collapse; margin-top:16px; }
        th,td { border-bottom:1px solid #d9cdb9; text-align:left; padding:10px 8px; font-size:14px; }
        .meta { color:#6f6557; font-size:14px; line-height:1.7; }
        .total { margin-top:18px; text-align:right; font-size:16px; font-weight:700; }
        .letterhead { display:flex; align-items:center; gap:18px; margin-bottom:18px; }
        .letterhead img { width:84px; height:84px; object-fit:cover; border-radius:50%; border:1px solid #d9cdb9; }
      </style>
    </head>
    <body>
      <div class="letterhead">
        <img src="${LOGO_SRC}" alt="Laurel Woods logo" />
        <div>
          <h1>${escapeHtml(property.name)} Ledger Statement</h1>
        </div>
      </div>
      <div class="meta">
        Tenant: ${escapeHtml(tenant.fullName)}<br />
        Unit: ${escapeHtml(tenant.unit?.unitNumber || "—")}<br />
        Parking: ${escapeHtml(tenant.unit?.parkingSpot || "—")}<br />
        Printed: ${escapeHtml(longDate(new Date().toISOString()))}
      </div>
      <h3 style="margin-top:24px;">Charge Ledger</h3>
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Due Date</th>
            <th>Charge</th>
            <th>Payments Applied</th>
            <th>Remaining</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <h3 style="margin-top:28px;">Payment History</h3>
      <table>
        <thead>
          <tr>
            <th>Payment Date</th>
            <th>Method</th>
            <th>Reference</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${paymentRows || '<tr><td colspan="4">No payments recorded.</td></tr>'}</tbody>
      </table>
      <div class="total">Outstanding Balance: ${escapeHtml(money(tenant.outstandingBalance))}</div>
    </body>
  </html>`;
}

function rentNoticeHtml(property, tenant) {
  const latestCharge = [...tenant.charges].sort((a, b) => String(b.chargeMonth).localeCompare(String(a.chargeMonth)))[0];
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Rent Notice</title>
      <style>
        body { font-family: Georgia, serif; color:#2e2418; padding:40px; line-height:1.7; }
        .box { border:1px solid #d9cdb9; border-radius:12px; padding:24px; }
        .letterhead { display:flex; align-items:center; gap:18px; margin-bottom:20px; }
        .letterhead img { width:84px; height:84px; object-fit:cover; border-radius:50%; border:1px solid #d9cdb9; }
      </style>
    </head>
    <body>
      <div class="letterhead">
        <img src="${LOGO_SRC}" alt="Laurel Woods logo" />
        <div>
          <h1>${escapeHtml(property.name)} Rent Notice</h1>
        </div>
      </div>
      <div class="box">
        <p>Tenant: <strong>${escapeHtml(tenant.fullName)}</strong></p>
        <p>Unit: <strong>${escapeHtml(tenant.unit?.unitNumber || "—")}</strong></p>
        <p>Parking Spot: <strong>${escapeHtml(tenant.unit?.parkingSpot || "—")}</strong></p>
        <p>Current Charge Month: <strong>${escapeHtml(monthLabel(latestCharge?.chargeMonth))}</strong></p>
        <p>Due Date: <strong>${escapeHtml(longDate(latestCharge?.dueDate))}</strong></p>
        <p>Current Amount Due: <strong>${escapeHtml(money(latestCharge?.remainingBalance ?? 0))}</strong></p>
        <p>Total Outstanding Balance: <strong>${escapeHtml(money(tenant.outstandingBalance))}</strong></p>
      </div>
    </body>
  </html>`;
}

function warningLetterHtml(property, tenant, body) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Warning Letter</title>
      <style>
        body { font-family: Georgia, serif; color:#2e2418; padding:40px; line-height:1.8; }
        .letterhead { display:flex; align-items:center; gap:18px; margin-bottom:20px; }
        .letterhead img { width:84px; height:84px; object-fit:cover; border-radius:50%; border:1px solid #d9cdb9; }
      </style>
    </head>
    <body>
      <div class="letterhead">
        <img src="${LOGO_SRC}" alt="Laurel Woods logo" />
        <div>
          <h1>${escapeHtml(property.name)}</h1>
        </div>
      </div>
      <p>${escapeHtml(longDate(new Date().toISOString()))}</p>
      <p>${escapeHtml(tenant.fullName)}<br />Unit ${escapeHtml(tenant.unit?.unitNumber || "—")}<br />Parking ${escapeHtml(tenant.unit?.parkingSpot || "—")}</p>
      <p>${escapeHtml(body).replaceAll("\n", "<br />")}</p>
      <p>Warning Reason: ${escapeHtml((tenant.alert?.reasons || []).join("; ") || "Past due balance")}</p>
      <p>Unpaid Months: ${escapeHtml((tenant.alert?.unpaidMonths || []).map(monthLabel).join(", ") || "—")}</p>
      <p>Total Past Due: <strong>${escapeHtml(money(tenant.alert?.amountDue || 0))}</strong></p>
      <p>Sincerely,<br />Laurel Woods Management</p>
    </body>
  </html>`;
}

function paymentReminderLetterHtml(property, tenant, body) {
  const currentMonthCharge = tenant.currentMonthAlert || tenant.charges.find((charge) => Number(charge.remainingBalance || 0) > 0);
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Payment Reminder</title>
      <style>
        body { font-family: Georgia, serif; color:#2e2418; padding:40px; line-height:1.8; }
        .letterhead { display:flex; align-items:center; gap:18px; margin-bottom:20px; }
        .letterhead img { width:84px; height:84px; object-fit:cover; border-radius:50%; border:1px solid #d9cdb9; }
      </style>
    </head>
    <body>
      <div class="letterhead">
        <img src="${LOGO_SRC}" alt="Laurel Woods logo" />
        <div>
          <h1>${escapeHtml(property.name)}</h1>
          <div>Payment Reminder</div>
        </div>
      </div>
      <p>${escapeHtml(longDate(new Date().toISOString()))}</p>
      <p>${escapeHtml(tenant.fullName)}<br />Unit ${escapeHtml(tenant.unit?.unitNumber || "—")}<br />Parking ${escapeHtml(tenant.unit?.parkingSpot || "—")}</p>
      <p>${escapeHtml(body).replaceAll("\n", "<br />")}</p>
      <p>Charge Month: <strong>${escapeHtml(monthLabel(currentMonthCharge?.chargeMonth))}</strong></p>
      <p>Due Date: <strong>${escapeHtml(longDate(currentMonthCharge?.dueDate))}</strong></p>
      <p>Current Amount Due: <strong>${escapeHtml(money(currentMonthCharge?.amountDue ?? currentMonthCharge?.remainingBalance ?? 0))}</strong></p>
      <p>Total Outstanding Balance: <strong>${escapeHtml(money(tenant.outstandingBalance || 0))}</strong></p>
      <p>Sincerely,<br />Laurel Woods Management</p>
    </body>
  </html>`;
}

function allStatementsHtml(property, tenants) {
  const sections = tenants
    .map(
      (tenant) => `
        <section style="page-break-after: always; margin-bottom: 40px;">
          <div style="display:flex; align-items:center; gap:18px; margin-bottom: 12px;">
            <img src="${LOGO_SRC}" alt="Laurel Woods logo" style="width:84px; height:84px; object-fit:cover; border-radius:50%; border:1px solid #d9cdb9;" />
            <h1 style="margin: 0;">${escapeHtml(property.name)} Ledger Statement</h1>
          </div>
          <div style="color:#6f6557; font-size:14px; line-height:1.7; margin-bottom: 14px;">
            Tenant: ${escapeHtml(tenant.fullName)}<br />
            Unit: ${escapeHtml(tenant.unit?.unitNumber || "—")}<br />
            Parking: ${escapeHtml(tenant.unit?.parkingSpot || "—")}<br />
            Outstanding Balance: <strong>${escapeHtml(money(tenant.outstandingBalance))}</strong>
          </div>
          <table style="width:100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="border-bottom:1px solid #d9cdb9; text-align:left; padding:10px 8px;">Month</th>
                <th style="border-bottom:1px solid #d9cdb9; text-align:left; padding:10px 8px;">Charge</th>
                <th style="border-bottom:1px solid #d9cdb9; text-align:left; padding:10px 8px;">Applied</th>
                <th style="border-bottom:1px solid #d9cdb9; text-align:left; padding:10px 8px;">Remaining</th>
                <th style="border-bottom:1px solid #d9cdb9; text-align:left; padding:10px 8px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${tenant.charges
                .map(
                  (charge) => `
                    <tr>
                      <td style="border-bottom:1px solid #d9cdb9; padding:10px 8px;">${escapeHtml(monthLabel(charge.chargeMonth))}</td>
                      <td style="border-bottom:1px solid #d9cdb9; padding:10px 8px;">${escapeHtml(money(charge.totalCharge))}</td>
                      <td style="border-bottom:1px solid #d9cdb9; padding:10px 8px;">${escapeHtml(money(charge.appliedAmount))}</td>
                      <td style="border-bottom:1px solid #d9cdb9; padding:10px 8px;">${escapeHtml(money(charge.remainingBalance))}</td>
                      <td style="border-bottom:1px solid #d9cdb9; padding:10px 8px;">${escapeHtml(charge.status)}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>All Tenant Statements</title>
      <style>
        body { font-family: Georgia, serif; color:#2e2418; padding:32px; }
      </style>
    </head>
    <body>${sections}</body>
  </html>`;
}

function paymentReceiptHtml(property, tenant, payment) {
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Payment Receipt</title>
      <style>
        body { font-family: Georgia, serif; color:#2e2418; padding:40px; line-height:1.8; }
        .shell { max-width: 760px; margin: 0 auto; }
        .letterhead { display:flex; align-items:center; gap:18px; margin-bottom:24px; border-bottom:1px solid #d9cdb9; padding-bottom:16px; }
        .letterhead img { width:84px; height:84px; object-fit:cover; border-radius:50%; border:1px solid #d9cdb9; }
        .box { border:1px solid #d9cdb9; border-radius:12px; padding:24px; margin-top:18px; }
        .label { color:#6f6557; }
      </style>
    </head>
    <body>
      <div class="shell">
        <div class="letterhead">
          <img src="${LOGO_SRC}" alt="Laurel Woods logo" />
          <div>
            <h1 style="margin:0;">${escapeHtml(property.name)} Payment Receipt</h1>
            <div class="label">${escapeHtml(property.address || "")}${property.city ? `, ${escapeHtml(property.city)}` : ""}${property.state ? `, ${escapeHtml(property.state)}` : ""}</div>
          </div>
        </div>
        <div class="box">
          <p><strong>Receipt Date:</strong> ${escapeHtml(longDate(payment.paymentDate))}</p>
          <p><strong>Tenant:</strong> ${escapeHtml(tenant.fullName)}</p>
          <p><strong>Unit:</strong> ${escapeHtml(tenant.unit?.unitNumber || "—")}</p>
          <p><strong>Parking Spot:</strong> ${escapeHtml(tenant.unit?.parkingSpot || "—")}</p>
          <p><strong>Amount Received:</strong> ${escapeHtml(money(payment.amount))}</p>
          <p><strong>Payment Method:</strong> ${escapeHtml(payment.method || "Manual")}</p>
          <p><strong>Reference:</strong> ${escapeHtml(payment.reference || "—")}</p>
          <p><strong>Notes:</strong> ${escapeHtml(payment.notes || "—")}</p>
        </div>
        <div class="box">
          <p>Thank you for your payment.</p>
          <p>We appreciate your prompt attention to your account and your residency at Laurel Woods.</p>
          <p>Please keep this receipt for your records. If you have any questions about your balance or payment history, contact the management office.</p>
          <p style="margin-top:24px;">Sincerely,<br />Laurel Woods Management</p>
        </div>
      </div>
    </body>
  </html>`;
}

const blankUnit = {
  id: "",
  unitNumber: "",
  parkingSpot: "",
  status: "Vacant",
  defaultMonthlyRent: "",
};

const blankTenant = {
  id: "",
  fullName: "",
  phone: "",
  email: "",
  memo: "",
  unitId: "",
  monthlyRent: "",
  depositAmount: "",
  leaseStart: "",
  leaseEnd: "",
  status: "Active",
};

const blankPayment = {
  id: "",
  tenantId: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  amount: "",
  method: "Cash",
  reference: "",
  notes: "",
};

const blankCharge = {
  id: "",
  tenantId: "",
  chargeMonth: new Date().toISOString().slice(0, 7),
  dueDate: new Date().toISOString().slice(0, 10),
  rentAmount: "",
  otherCharges: "0",
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState(null);
  const [unitForm, setUnitForm] = useState(blankUnit);
  const [unitSearch, setUnitSearch] = useState("");
  const [tenantForm, setTenantForm] = useState(blankTenant);
  const [paymentForm, setPaymentForm] = useState(blankPayment);
  const [chargeForm, setChargeForm] = useState(blankCharge);
  const [documentTenantId, setDocumentTenantId] = useState("");
  const [statementTenantId, setStatementTenantId] = useState("");
  const [letterTenantId, setLetterTenantId] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantStatusFilter, setTenantStatusFilter] = useState("Active");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [memoDraft, setMemoDraft] = useState("");
  const [editingMemoTenantId, setEditingMemoTenantId] = useState("");
  const [busy, setBusy] = useState(false);

  const derivedTenants = state?.derivedTenants || [];
  const currentMonthAlertTenants = derivedTenants.filter((tenant) => tenant.currentMonthAlert);
  const tenantsByUnit = useMemo(
    () =>
      [...derivedTenants].sort((a, b) => {
        const unitComparison = normalizeUnitNumber(a.unit?.unitNumber).localeCompare(
          normalizeUnitNumber(b.unit?.unitNumber),
          undefined,
          { numeric: true, sensitivity: "base" }
        );
        if (unitComparison !== 0) return unitComparison;
        return String(a.fullName || "").localeCompare(String(b.fullName || ""), undefined, {
          sensitivity: "base",
        });
      }),
    [derivedTenants]
  );
  const filteredTenants = derivedTenants.filter((tenant) => {
    if (tenantStatusFilter === "Active" && tenant.status !== "Active") return false;
    if (tenantStatusFilter === "Moved Out" && tenant.status !== "Moved Out") return false;
    const search = tenantSearch.trim().toLowerCase();
    if (!search) return true;
    return [
      tenant.fullName,
      tenant.email,
      tenant.phone,
      tenant.unit?.unitNumber,
      tenant.unit?.parkingSpot,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });
  const filteredUnits = (state?.units || []).filter((unit) => {
    const search = unitSearch.trim().toLowerCase();
    if (!search) return true;
    return [unit.unitNumber, unit.parkingSpot, unit.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });
  const selectedTenant =
    derivedTenants.find((tenant) => tenant.id === selectedTenantId) || filteredTenants[0] || derivedTenants[0] || null;
  const selectedStatementTenant = derivedTenants.find((tenant) => tenant.id === statementTenantId) || tenantsByUnit[0] || null;
  const selectedLetterTenant =
    derivedTenants.find((tenant) => tenant.id === letterTenantId) ||
    currentMonthAlertTenants[0] ||
    derivedTenants.find((tenant) => tenant.alert) ||
    null;

  function reminderBodyForTenant(tenant, settings) {
    if (tenant?.currentMonthAlert) {
      return [
        `This is a friendly reminder that your ${monthLabel(tenant.currentMonthAlert.chargeMonth)} rent payment is still outstanding.`,
        `Please submit ${money(tenant.currentMonthAlert.amountDue)} as soon as possible or contact management if you need assistance.`,
      ].join("\n\n");
    }

    return `${settings.warningTemplate}\n\nPlease contact the management office immediately to resolve your account.`;
  }

  async function safeJson(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  }

  function hydrateFallbackState(message) {
    const fallback = buildDerivedState(seedState);
    setState(fallback);
    setSelectedTenantId(fallback.derivedTenants?.[0]?.id || "");
    setStatementTenantId(fallback.derivedTenants?.[0]?.id || "");
    const alertTenantId =
      fallback.derivedTenants?.find((tenant) => tenant.currentMonthAlert)?.id ||
      fallback.derivedTenants?.find((tenant) => tenant.alert)?.id ||
      "";
    setLetterTenantId(alertTenantId);
    const defaultLetterTenant = fallback.derivedTenants?.find((tenant) => tenant.id === alertTenantId) || null;
    setLetterBody(defaultLetterTenant ? reminderBodyForTenant(defaultLetterTenant, fallback.settings) : fallback.settings.warningTemplate);
    setError(message || "Loaded fallback starter data.");
  }

  async function loadApp() {
    setLoading(true);
    setError("");
    let sessionAuthenticated = false;
    try {
      const sessionResponse = await fetch("/api/session", { cache: "no-store" });
      if (!sessionResponse.ok) {
        throw new Error("Unable to verify session");
      }
      const session = await sessionResponse.json();
      sessionAuthenticated = Boolean(session.authenticated);
      setAuthenticated(sessionAuthenticated);
      if (sessionAuthenticated) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const stateResponse = await fetch("/api/state", {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!stateResponse.ok) {
          const failedState = await stateResponse.json().catch(() => null);
          throw new Error(failedState?.error || "Unable to load property data");
        }
        const nextState = await stateResponse.json();
        setState(nextState);
        setSelectedTenantId(nextState.derivedTenants?.[0]?.id || "");
        setStatementTenantId(nextState.derivedTenants?.[0]?.id || "");
        const alertTenantId =
          nextState.derivedTenants?.find((tenant) => tenant.currentMonthAlert)?.id ||
          nextState.derivedTenants?.find((tenant) => tenant.alert)?.id ||
          "";
        setLetterTenantId(alertTenantId);
        const defaultLetterTenant = nextState.derivedTenants?.find((tenant) => tenant.id === alertTenantId) || null;
        setLetterBody(defaultLetterTenant ? reminderBodyForTenant(defaultLetterTenant, nextState.settings) : nextState.settings.warningTemplate);
      } else {
        setState(null);
      }
    } catch (fetchError) {
      if (sessionAuthenticated) {
        hydrateFallbackState("Live storage is not ready yet, so the app loaded starter data.");
      } else {
        setError(fetchError.message || "Failed to load app");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApp();
  }, []);

  useEffect(() => {
    if (!state || !selectedLetterTenant) return;
    setLetterBody(reminderBodyForTenant(selectedLetterTenant, state.settings));
  }, [state?.settings?.warningTemplate, selectedLetterTenant?.id]);

  useEffect(() => {
    if (!selectedTenant) {
      setEditingMemoTenantId("");
      setMemoDraft("");
      return;
    }
    setMemoDraft(selectedTenant.memo || "");
    setEditingMemoTenantId("");
  }, [selectedTenant?.id, selectedTenant?.memo]);

  const summary = useMemo(
    () => state?.dashboard || { occupiedUnits: 0, vacantUnits: 0, totalOutstanding: 0, tenantsWithBalance: 0, arrearsCount: 0 },
    [state]
  );

  async function login() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await safeJson(response);
      if (!response.ok) throw new Error(payload.error || "Login failed");
      setPassword("");
      await loadApp();
    } catch (loginError) {
      setError(loginError.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    setAuthenticated(false);
    setState(null);
  }

  async function persist(nextState, options = {}) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nextState, ...options }),
      });
      const payload = await safeJson(response);
      if (!response.ok) throw new Error(payload.error || "Save failed");
      setState(payload);
      return payload;
    } catch (saveError) {
      setError(saveError.message || "Save failed");
      throw saveError;
    } finally {
      setBusy(false);
    }
  }

  async function generateCurrentMonthCharges() {
    if (!state) return;
    const nextState = await persist(state, { generateCurrentMonth: true });
    setState(nextState);
  }

  async function importUnitMaster() {
    if (!state) return;

    const existingById = new Map(state.units.map((unit) => [unit.id, unit]));
    const existingByNumber = new Map(state.units.map((unit) => [normalizeUnitNumber(unit.unitNumber), unit]));
    const consumedIds = new Set();
    const idRemap = new Map();
    const canonicalUnits = [];
    let added = 0;
    let updated = 0;

    for (const importedUnit of laurelWoodsUnitMaster) {
      const importedNumber = normalizeUnitNumber(importedUnit.unitNumber);
      const importedParking = String(importedUnit.parkingSpot || "").trim();
      const desiredId = unitIdFromNumber(importedNumber);
      const legacyId = legacyUnitIdForNumber(importedNumber);
      const matchedExisting =
        (existingById.has(desiredId) && !consumedIds.has(desiredId) ? existingById.get(desiredId) : null) ||
        (existingByNumber.has(importedNumber) && !consumedIds.has(existingByNumber.get(importedNumber).id)
          ? existingByNumber.get(importedNumber)
          : null) ||
        (legacyId && existingById.has(legacyId) && !consumedIds.has(legacyId) ? existingById.get(legacyId) : null);

      if (matchedExisting) {
        consumedIds.add(matchedExisting.id);
        if (matchedExisting.id !== desiredId) {
          idRemap.set(matchedExisting.id, desiredId);
        }
        canonicalUnits.push({
          ...matchedExisting,
          id: desiredId,
          unitNumber: importedNumber,
          parkingSpot: importedParking,
        });
        updated += 1;
      } else {
        canonicalUnits.push({
          id: desiredId,
          propertyId: state.property.id,
          unitNumber: importedNumber,
          parkingSpot: importedParking,
          status: "Vacant",
          defaultMonthlyRent: 0,
        });
        added += 1;
      }
    }

    for (const unit of state.units) {
      if (consumedIds.has(unit.id)) continue;
      canonicalUnits.push(unit);
    }

    const nextUnits = canonicalUnits
      .filter(
        (unit, index, all) => all.findIndex((candidate) => normalizeUnitNumber(candidate.unitNumber) === normalizeUnitNumber(unit.unitNumber)) === index
      )
      .sort(unitSort);

    const nextTenants = state.tenants.map((tenant) => ({
      ...tenant,
      unitId: idRemap.get(tenant.unitId) || tenant.unitId,
    }));

    const saved = await persist({
      ...state,
      units: nextUnits,
      tenants: nextTenants,
    });

    window.alert(
      `Imported ${laurelWoodsUnitMaster.length} units. Updated ${updated} existing units and added ${added} new ones.`
    );
    setState(saved);
  }

  async function addUnit() {
    if (!state || !unitForm.unitNumber.trim()) return;
    const nextState = {
      ...state,
      units: unitForm.id
        ? state.units.map((unit) =>
            unit.id === unitForm.id
              ? {
                  ...unit,
                  unitNumber: unitForm.unitNumber.trim(),
                  parkingSpot: unitForm.parkingSpot.trim(),
                  status: unitForm.status,
                  defaultMonthlyRent: Number(unitForm.defaultMonthlyRent || 0),
                }
              : unit
          )
        : [
            ...state.units,
            {
              id: `unit-${Date.now()}`,
              propertyId: state.property.id,
              unitNumber: unitForm.unitNumber.trim(),
              parkingSpot: unitForm.parkingSpot.trim(),
              status: unitForm.status,
              defaultMonthlyRent: Number(unitForm.defaultMonthlyRent || 0),
            },
          ],
    };
    await persist(nextState);
    setUnitForm(blankUnit);
  }

  async function addTenant() {
    if (!state) return;
    if (!tenantForm.fullName.trim()) {
      setError("Enter the tenant's full name before saving.");
      return;
    }
    if (!tenantForm.unitId) {
      setError("Select a unit before saving the tenant.");
      return;
    }
    const selectedUnit = state.units.find((unit) => unit.id === tenantForm.unitId);
    const existingTenant = tenantForm.id ? state.tenants.find((tenant) => tenant.id === tenantForm.id) : null;
    const oldUnitId = existingTenant?.unitId || "";
    const nextState = {
      ...state,
      units: state.units.map((unit) => {
        const someoneElseStillInOldUnit = state.tenants.some(
          (tenant) => tenant.id !== tenantForm.id && tenant.unitId === oldUnitId && tenant.status === "Active"
        );
        if (unit.id === tenantForm.unitId) {
          return { ...unit, status: "Occupied" };
        }
        if (oldUnitId && unit.id === oldUnitId && oldUnitId !== tenantForm.unitId && !someoneElseStillInOldUnit) {
          return { ...unit, status: "Vacant" };
        }
        return unit;
      }),
      tenants: tenantForm.id
        ? state.tenants.map((tenant) =>
            tenant.id === tenantForm.id
              ? {
                  ...tenant,
                  fullName: tenantForm.fullName.trim(),
                  phone: tenantForm.phone.trim(),
                  email: tenantForm.email.trim(),
                  memo: tenantForm.memo.trim(),
                  unitId: tenantForm.unitId,
                  monthlyRent: Number(tenantForm.monthlyRent || selectedUnit?.defaultMonthlyRent || 0),
                  depositAmount: Number(tenantForm.depositAmount || 0),
                  leaseStart: tenantForm.leaseStart,
                  leaseEnd: tenantForm.leaseEnd,
                  status: tenantForm.status,
                }
              : tenant
          )
        : [
            ...state.tenants,
            {
              id: `tenant-${Date.now()}`,
              propertyId: state.property.id,
              fullName: tenantForm.fullName.trim(),
              phone: tenantForm.phone.trim(),
              email: tenantForm.email.trim(),
              memo: tenantForm.memo.trim(),
              unitId: tenantForm.unitId,
              monthlyRent: Number(tenantForm.monthlyRent || selectedUnit?.defaultMonthlyRent || 0),
              depositAmount: Number(tenantForm.depositAmount || 0),
              leaseStart: tenantForm.leaseStart,
              leaseEnd: tenantForm.leaseEnd,
              status: tenantForm.status,
            },
          ],
    };
    const saved = await persist(nextState);
    setTenantForm(blankTenant);
    setSelectedTenantId(saved.derivedTenants?.slice(-1)[0]?.id || "");
    setStatementTenantId(saved.derivedTenants?.slice(-1)[0]?.id || "");
  }

  async function addPayment() {
    if (!state) return;
    if (!paymentForm.tenantId) {
      setError("Select a tenant before saving the payment.");
      return;
    }
    if (!paymentForm.paymentDate) {
      setError("Enter the payment date before saving.");
      return;
    }
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setError("Enter a payment amount greater than 0 before saving.");
      return;
    }
    const nextState = {
      ...state,
      payments: paymentForm.id
        ? state.payments.map((payment) =>
            payment.id === paymentForm.id
              ? {
                  ...payment,
                  tenantId: paymentForm.tenantId,
                  paymentDate: paymentForm.paymentDate,
                  amount: Number(paymentForm.amount),
                  method: paymentForm.method,
                  reference: paymentForm.reference.trim(),
                  notes: paymentForm.notes.trim(),
                }
              : payment
          )
        : [
            ...state.payments,
            {
              id: `payment-${Date.now()}`,
              tenantId: paymentForm.tenantId,
              paymentDate: paymentForm.paymentDate,
              amount: Number(paymentForm.amount),
              method: paymentForm.method,
              reference: paymentForm.reference.trim(),
              notes: paymentForm.notes.trim(),
            },
          ],
    };
    await persist(nextState);
    setPaymentForm(blankPayment);
  }

  async function saveCharge() {
    if (!state) return;
    const tenantId = chargeForm.tenantId || selectedTenant?.id || "";
    if (!tenantId) {
      setError("Select a tenant before saving the charge.");
      return;
    }
    if (!chargeForm.chargeMonth) {
      setError("Enter the charge month before saving.");
      return;
    }
    if (!chargeForm.dueDate) {
      setError("Enter the due date before saving.");
      return;
    }
    const rentAmount = Number(chargeForm.rentAmount || 0);
    const otherCharges = Number(chargeForm.otherCharges || 0);
    if (rentAmount + otherCharges <= 0) {
      setError("Enter a charge amount greater than 0 before saving.");
      return;
    }

    const totalCharge = rentAmount + otherCharges;
    const nextCharge = {
      id: chargeForm.id || `charge-${tenantId}-${chargeForm.chargeMonth}-${Date.now()}`,
      tenantId,
      chargeMonth: chargeForm.chargeMonth,
      dueDate: chargeForm.dueDate,
      rentAmount,
      otherCharges,
      totalCharge,
    };

    const nextState = {
      ...state,
      rentCharges: chargeForm.id
        ? state.rentCharges.map((charge) => (charge.id === chargeForm.id ? nextCharge : charge))
        : [...state.rentCharges, nextCharge],
    };

    await persist(nextState);
    setChargeForm({
      ...blankCharge,
      tenantId,
      rentAmount: selectedTenant?.monthlyRent ? String(selectedTenant.monthlyRent) : "",
    });
  }

  async function uploadContract(event) {
    const file = event.target.files?.[0];
    if (!file || !state || !documentTenantId) return;
    const formData = new FormData();
    formData.append("file", file);
    setBusy(true);
    setError("");
    try {
      const uploadResponse = await fetch("/api/upload-contract", {
        method: "POST",
        body: formData,
      });
      const uploaded = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploaded.error || "Upload failed");

      const nextState = {
        ...state,
        tenantDocuments: [
          ...state.tenantDocuments,
          {
            id: `doc-${Date.now()}`,
            tenantId: documentTenantId,
            documentType: "Lease Contract",
            fileName: uploaded.fileName,
            filePath: uploaded.filePath,
            uploadedAt: new Date().toISOString(),
          },
        ],
      };
      await persist(nextState);
    } catch (uploadError) {
      setError(uploadError.message || "Upload failed");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function editTenant(tenant) {
    setTenantForm({
      id: tenant.id,
      fullName: tenant.fullName || "",
      phone: tenant.phone || "",
      email: tenant.email || "",
      memo: tenant.memo || "",
      unitId: tenant.unitId || "",
      monthlyRent: String(tenant.monthlyRent || ""),
      depositAmount: String(tenant.depositAmount || ""),
      leaseStart: tenant.leaseStart || "",
      leaseEnd: tenant.leaseEnd || "",
      status: tenant.status || "Active",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeTenant(tenant) {
    if (!state) return;
    if (
      !window.confirm(
        `Delete tenant ${tenant.fullName} permanently? This will also remove all charges, payments, and documents tied to this tenant.`
      )
    ) {
      return;
    }

    const nextState = {
      ...state,
      tenants: state.tenants.filter((item) => item.id !== tenant.id),
      payments: state.payments.filter((item) => item.tenantId !== tenant.id),
      rentCharges: state.rentCharges.filter((item) => item.tenantId !== tenant.id),
      tenantDocuments: state.tenantDocuments.filter((item) => item.tenantId !== tenant.id),
      units: state.units.map((unit) =>
        unit.id === tenant.unitId ? { ...unit, status: "Vacant" } : unit
      ),
    };
    const saved = await persist(nextState);
    setTenantForm(blankTenant);
    setChargeForm(blankCharge);
    setSelectedTenantId(saved.derivedTenants?.[0]?.id || "");
    setStatementTenantId(saved.derivedTenants?.[0]?.id || "");
  }

  function editUnit(unit) {
    setUnitForm({
      id: unit.id,
      unitNumber: unit.unitNumber || "",
      parkingSpot: unit.parkingSpot || "",
      status: unit.status || "Vacant",
      defaultMonthlyRent: String(unit.defaultMonthlyRent || ""),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeUnit(unit) {
    if (!state) return;
    if (state.tenants.some((tenant) => tenant.unitId === unit.id)) {
      setError("This unit is assigned to a tenant. Reassign or remove the tenant first.");
      return;
    }
    if (!window.confirm(`Delete unit ${unit.unitNumber}?`)) return;
    await persist({
      ...state,
      units: state.units.filter((item) => item.id !== unit.id),
    });
    setUnitForm(blankUnit);
  }

  function editPayment(payment) {
    setPaymentForm({
      id: payment.id,
      tenantId: payment.tenantId,
      paymentDate: payment.paymentDate,
      amount: String(payment.amount || ""),
      method: payment.method || "Cash",
      reference: payment.reference || "",
      notes: payment.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editCharge(charge) {
    setChargeForm({
      id: charge.id,
      tenantId: charge.tenantId,
      chargeMonth: charge.chargeMonth || "",
      dueDate: charge.dueDate || "",
      rentAmount: String(charge.rentAmount ?? charge.totalCharge ?? ""),
      otherCharges: String(charge.otherCharges ?? 0),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeCharge(charge) {
    if (!state) return;
    if (!window.confirm(`Delete the ${monthLabel(charge.chargeMonth)} charge for ${money(charge.totalCharge)}?`)) return;
    await persist({
      ...state,
      rentCharges: state.rentCharges.filter((item) => item.id !== charge.id),
    });
    if (chargeForm.id === charge.id) {
      setChargeForm(blankCharge);
    }
  }

  async function removePayment(payment) {
    if (!state) return;
    if (!window.confirm(`Delete payment for ${money(payment.amount)}?`)) return;
    await persist({
      ...state,
      payments: state.payments.filter((item) => item.id !== payment.id),
    });
    setPaymentForm(blankPayment);
  }

  async function removeDocument(document) {
    if (!state) return;
    if (!window.confirm(`Delete document ${document.fileName}?`)) return;
    await persist({
      ...state,
      tenantDocuments: state.tenantDocuments.filter((item) => item.id !== document.id),
    });
  }

  async function saveTenantMemo() {
    if (!state || !selectedTenant) return;
    const nextState = {
      ...state,
      tenants: state.tenants.map((tenant) =>
        tenant.id === selectedTenant.id
          ? {
              ...tenant,
              memo: memoDraft.trim(),
            }
          : tenant
      ),
    };
    await persist(nextState);
    setEditingMemoTenantId("");
  }

  function exportTenantList() {
    const rows = [
      [
        "Tenant Name",
        "Unit Number",
        "Parking Spot",
        "Phone",
        "Email",
        "Monthly Rent",
        "Deposit",
        "Lease Start",
        "Lease End",
        "Outstanding Balance",
        "Status",
      ],
      ...derivedTenants.map((tenant) => [
        tenant.fullName,
        tenant.unit?.unitNumber || "",
        tenant.unit?.parkingSpot || "",
        tenant.phone || "",
        tenant.email || "",
        tenant.monthlyRent || 0,
        tenant.depositAmount || 0,
        tenant.leaseStart || "",
        tenant.leaseEnd || "",
        tenant.outstandingBalance || 0,
        tenant.status || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laurel-woods-tenants-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportExecutiveReport() {
    const rows = [
      [
        "Tenant Name",
        "Unit Number",
        "Parking Spot",
        "Phone",
        "Email",
        "Lease Start",
        "Lease End",
        "Status",
        "Monthly Rent",
        "Deposit",
        "Outstanding Balance",
        "Last Payment Date",
        "Last Payment Amount",
        "Total Payments Recorded",
        "Open Charge Months",
        "3 Month Warning",
        "Warning Reason",
        "Warning Months",
      ],
      ...derivedTenants.map((tenant) => {
        const payments = [...tenant.payments].sort((a, b) =>
          String(b.paymentDate || "").localeCompare(String(a.paymentDate || ""))
        );
        const lastPayment = payments[0] || null;
        const unpaidMonths = tenant.charges
          .filter((charge) => Number(charge.remainingBalance || 0) > 0)
          .map((charge) => monthLabel(charge.chargeMonth))
          .join(" | ");

        return [
          tenant.fullName,
          tenant.unit?.unitNumber || "",
          tenant.unit?.parkingSpot || "",
          tenant.phone || "",
          tenant.email || "",
          tenant.leaseStart || "",
          tenant.leaseEnd || "",
          tenant.status || "",
          tenant.monthlyRent || 0,
          tenant.depositAmount || 0,
          tenant.outstandingBalance || 0,
          lastPayment?.paymentDate || "",
          lastPayment?.amount || 0,
          tenant.payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
          unpaidMonths,
          tenant.alert ? "Yes" : "No",
          (tenant.alert?.reasons || []).join(" | "),
          (tenant.alert?.unpaidMonths || []).map(monthLabel).join(" | "),
        ];
      }),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laurel-woods-executive-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportCurrentMonthUnpaidList() {
    const rows = [
      ["Tenant Name", "Unit Number", "Parking Spot", "Charge Month", "Due Date", "Current Amount Due", "Total Outstanding Balance", "Phone", "Email"],
      ...currentMonthAlertTenants.map((tenant) => [
        tenant.fullName,
        tenant.unit?.unitNumber || "",
        tenant.unit?.parkingSpot || "",
        tenant.currentMonthAlert?.chargeMonth || "",
        tenant.currentMonthAlert?.dueDate || "",
        tenant.currentMonthAlert?.amountDue || 0,
        tenant.outstandingBalance || 0,
        tenant.phone || "",
        tenant.email || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laurel-woods-current-month-unpaid-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportRedAlertReport() {
    const redAlertTenants = derivedTenants.filter((tenant) => tenant.alert);
    const rows = [
      [
        "Tenant Name",
        "Unit Number",
        "Parking Spot",
        "Phone",
        "Email",
        "Monthly Rent",
        "Outstanding Balance",
        "Warning Reason",
        "Unpaid Months",
        "Streak Amount Due",
        "Total Past Due",
        "Lease Start",
        "Lease End",
        "Status",
      ],
      ...redAlertTenants.map((tenant) => [
        tenant.fullName,
        tenant.unit?.unitNumber || "",
        tenant.unit?.parkingSpot || "",
        tenant.phone || "",
        tenant.email || "",
        tenant.monthlyRent || 0,
        tenant.outstandingBalance || 0,
        (tenant.alert?.reasons || []).join(" | "),
        (tenant.alert?.unpaidMonths || []).map(monthLabel).join(" | "),
        tenant.alert?.streakAmountDue || 0,
        tenant.alert?.amountDue || 0,
        tenant.leaseStart || "",
        tenant.leaseEnd || "",
        tenant.status || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laurel-woods-red-alert-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportBackup() {
    if (!state) return;
    const backup = {
      exportedAt: new Date().toISOString(),
      property: state.property,
      settings: state.settings,
      units: state.units,
      tenants: state.tenants,
      tenantDocuments: state.tenantDocuments,
      rentCharges: state.rentCharges,
      payments: state.payments,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laurel-woods-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function moveOutTenant(tenant) {
    if (!state) return;
    if (!window.confirm(`Mark ${tenant.fullName} as moved out and keep the history?`)) return;

    const nextState = {
      ...state,
      tenants: state.tenants.map((item) =>
        item.id === tenant.id
          ? {
              ...item,
              status: "Moved Out",
            }
          : item
      ),
      units: state.units.map((unit) =>
        unit.id === tenant.unitId
          ? {
              ...unit,
              status: "Vacant",
            }
          : unit
      ),
    };

    await persist(nextState);
    setTenantForm(blankTenant);
  }

  async function reactivateTenant(tenant) {
    if (!state) return;
    const nextState = {
      ...state,
      tenants: state.tenants.map((item) =>
        item.id === tenant.id
          ? {
              ...item,
              status: "Active",
            }
          : item
      ),
      units: state.units.map((unit) =>
        unit.id === tenant.unitId
          ? {
              ...unit,
              status: "Occupied",
            }
          : unit
      ),
    };
    await persist(nextState);
  }

  function printAllStatements() {
    if (!state || !derivedTenants.length) return;
    openPrintWindow(allStatementsHtml(state.property, derivedTenants));
  }

  useEffect(() => {
    if (!selectedTenant || chargeForm.id) return;
    setChargeForm((current) => ({
      ...current,
      tenantId: selectedTenant.id,
      rentAmount:
        current.tenantId !== selectedTenant.id
          ? String(selectedTenant.monthlyRent || "")
          : current.rentAmount || String(selectedTenant.monthlyRent || ""),
    }));
  }, [selectedTenant?.id, selectedTenant?.monthlyRent, chargeForm.id]);

  useEffect(() => {
    if (!selectedTenant || paymentForm.id) return;
    setPaymentForm((current) => ({
      ...current,
      tenantId: selectedTenant.id,
    }));
  }, [selectedTenant?.id, paymentForm.id]);

  if (loading) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <img className="login-logo" src={LOGO_SRC} alt="Laurel Woods logo" />
          Loading Laurel Woods Rental App...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <img className="login-logo" src={LOGO_SRC} alt="Laurel Woods logo" />
          <h1 style={{ marginTop: 0 }}>Laurel Woods Rental App</h1>
          <p className="fine-print">
            Admin-only access for tenant records, rent statements, payments, lease files, and arrears letters.
          </p>
          <div className="field">
            <label>Admin password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") login();
              }}
              placeholder="Default password: laurelwoods"
            />
          </div>
          {error ? <p style={{ color: "#af4a3a" }}>{error}</p> : null}
          <button className="action" onClick={login} disabled={busy}>
            {busy ? "Signing In..." : "Sign In"}
          </button>
          <p className="fine-print" style={{ marginTop: 18 }}>
            Change the default password with the `LAUREL_WOODS_ADMIN_PASSWORD` environment variable.
          </p>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <img className="login-logo" src={LOGO_SRC} alt="Laurel Woods logo" />
          <h1 style={{ marginTop: 0 }}>Laurel Woods Rental App</h1>
          <p className="fine-print">{error || "Loading your property dashboard..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <img className="brand-logo" src={LOGO_SRC} alt="Laurel Woods logo" />
            <h1>Laurel Woods</h1>
          </div>
        </div>
        <div className="nav-list">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`nav-button ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <div className="toolbar">
          <div>
            <h2>{tabs.find((tab) => tab.key === activeTab)?.label}</h2>
            <p>Standalone property management app for Laurel Woods.</p>
          </div>
          <div className="button-row">
            <button className="action secondary" onClick={generateCurrentMonthCharges} disabled={busy}>
              Generate Current Month Charges
            </button>
            <button className="action secondary" onClick={logout}>
              Sign Out
            </button>
          </div>
        </div>

        {error ? <div className="panel" style={{ marginBottom: 20, color: "#af4a3a" }}>{error}</div> : null}

        {activeTab === "dashboard" ? (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Occupied Units</div>
                <div className="stat-value">{summary.occupiedUnits}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Vacant Units</div>
                <div className="stat-value">{summary.vacantUnits}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Balances Due</div>
                <div className="stat-value">{summary.tenantsWithBalance}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Outstanding Balance</div>
                <div className="stat-value">{money(summary.totalOutstanding)}</div>
              </div>
            </div>
            <div className="panel-grid">
              <section className="panel stack">
                <div>
                  <h3 className="section-title">Tenant Snapshot</h3>
                  <p className="section-subtitle">Live ledger status across all active tenants.</p>
                </div>
                <div className="list">
                  {derivedTenants.map((tenant) => (
                    <div key={tenant.id} className={`list-item ${tenant.alert ? "alert" : ""}`}>
                      <h3>{tenant.fullName}</h3>
                      <div className="meta">
                        Unit {tenant.unit?.unitNumber || "—"} · Parking {tenant.unit?.parkingSpot || "—"}<br />
                        Rent {money(tenant.monthlyRent)} · Deposit {money(tenant.depositAmount)}<br />
                        Outstanding Balance: <strong>{money(tenant.outstandingBalance)}</strong>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <span className={`pill ${tenant.outstandingBalance > 0 ? "warn" : ""}`}>
                          {tenant.outstandingBalance > 0 ? "Balance Due" : "Current"}
                        </span>
                        {tenant.alert ? <span className="pill danger">Red Flag</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel stack">
                <div>
                  <h3 className="section-title">Arrears Warnings</h3>
                  <p className="section-subtitle">Flags tenants with 3 unpaid months in a row or arrears equal to 3 months of rent.</p>
                </div>
                {state?.alerts?.length ? (
                  <div className="list">
                    {derivedTenants
                      .filter((tenant) => tenant.alert)
                      .map((tenant) => (
                        <div key={tenant.id} className="list-item alert">
                          <h4>{tenant.fullName}</h4>
                          <div className="meta">
                            Warning Reason: {(tenant.alert.reasons || []).join("; ")}<br />
                            Unpaid Months: {(tenant.alert.unpaidMonths || []).map(monthLabel).join(", ") || "—"}<br />
                            Amount Due: <strong>{money(tenant.alert.amountDue)}</strong>
                          </div>
                          <button
                            className="action warn"
                            style={{ marginTop: 12 }}
                            onClick={() => {
                              setActiveTab("alerts");
                              setLetterTenantId(tenant.id);
                            }}
                          >
                            Create Letter
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="empty">No tenants have hit the 3-month warning threshold.</div>
                )}
              </section>
            </div>
          </>
        ) : null}

        {activeTab === "tenants" ? (
          <div className="two-column">
            <section className="panel stack">
              <div>
                <h3 className="section-title">Add Tenant</h3>
                <p className="section-subtitle">Assign a tenant to a unit and track rent plus deposit.</p>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Full name</label>
                  <input value={tenantForm.fullName} onChange={(event) => setTenantForm((current) => ({ ...current, fullName: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input value={tenantForm.email} onChange={(event) => setTenantForm((current) => ({ ...current, email: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input value={tenantForm.phone} onChange={(event) => setTenantForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Memo</label>
                  <textarea
                    value={tenantForm.memo}
                    onChange={(event) => setTenantForm((current) => ({ ...current, memo: event.target.value }))}
                    placeholder="Add tenant notes, reminders, or special instructions"
                  />
                </div>
                <div className="field">
                  <label>Unit</label>
                  <select value={tenantForm.unitId} onChange={(event) => setTenantForm((current) => ({ ...current, unitId: event.target.value }))}>
                    <option value="">Select unit</option>
                    {state.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        Unit {unit.unitNumber} · {unit.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Monthly rent</label>
                  <input type="number" value={tenantForm.monthlyRent} onChange={(event) => setTenantForm((current) => ({ ...current, monthlyRent: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Deposit</label>
                  <input type="number" value={tenantForm.depositAmount} onChange={(event) => setTenantForm((current) => ({ ...current, depositAmount: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Lease start</label>
                  <input type="date" value={tenantForm.leaseStart} onChange={(event) => setTenantForm((current) => ({ ...current, leaseStart: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Lease end</label>
                  <input type="date" value={tenantForm.leaseEnd} onChange={(event) => setTenantForm((current) => ({ ...current, leaseEnd: event.target.value }))} />
                </div>
              </div>
              <div className="button-row" style={{ justifyContent: "start" }}>
                <button className="action" onClick={addTenant} disabled={busy}>
                  {tenantForm.id ? "Save Tenant Changes" : "Add Tenant"}
                </button>
                {tenantForm.id ? (
                  <button className="action secondary" onClick={() => setTenantForm(blankTenant)} disabled={busy}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Current Tenants</h3>
                <p className="section-subtitle">Search, click, and review a tenant record instantly.</p>
              </div>
              <div className="field">
                <label>Search tenant or unit</label>
                <input
                  value={tenantSearch}
                  onChange={(event) => setTenantSearch(event.target.value)}
                  placeholder="Search by name, unit, parking, phone, or email"
                />
              </div>
              <div className="field">
                <label>Tenant status</label>
                <select value={tenantStatusFilter} onChange={(event) => setTenantStatusFilter(event.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Moved Out">Moved Out</option>
                  <option value="All">All</option>
                </select>
              </div>
              <div className="list">
                {filteredTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    className={`list-item ${tenant.alert ? "alert" : ""}`}
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      background: selectedTenant?.id === tenant.id ? "var(--panel-strong)" : undefined,
                    }}
                    onClick={() => setSelectedTenantId(tenant.id)}
                  >
                    <h3>{tenant.fullName}</h3>
                    <div className="meta">
                      Unit {tenant.unit?.unitNumber || "—"} · Parking {tenant.unit?.parkingSpot || "—"}<br />
                      Lease: {longDate(tenant.leaseStart)} to {longDate(tenant.leaseEnd)}<br />
                      Rent {money(tenant.monthlyRent)} · Deposit {money(tenant.depositAmount)}<br />
                      Status {tenant.status} · Balance {money(tenant.outstandingBalance)}
                    </div>
                  </button>
                ))}
                {!filteredTenants.length ? <div className="empty">No tenant matched your search.</div> : null}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "tenants" ? (
          selectedTenant ? (
            <section className="panel stack" style={{ marginTop: 20 }}>
              <div>
                <h3 className="section-title">Tenant Record</h3>
                <p className="section-subtitle">Quick access to balance, payment history, and ledger details.</p>
              </div>
              <div className="two-column">
                <div className="list-item">
                  <h3>{selectedTenant.fullName}</h3>
                  <div className="meta">
                    Unit {selectedTenant.unit?.unitNumber || "—"} · Parking {selectedTenant.unit?.parkingSpot || "—"}<br />
                    Phone: {selectedTenant.phone || "—"}<br />
                    Email: {selectedTenant.email || "—"}<br />
                    Lease: {longDate(selectedTenant.leaseStart)} to {longDate(selectedTenant.leaseEnd)}<br />
                    Monthly Rent: <strong>{money(selectedTenant.monthlyRent)}</strong><br />
                    Deposit: <strong>{money(selectedTenant.depositAmount)}</strong><br />
                    Current Balance: <strong>{money(selectedTenant.outstandingBalance)}</strong><br />
                    Credit on Account: <strong>{money(selectedTenant.creditBalance || 0)}</strong>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <strong>Memo</strong>
                    {editingMemoTenantId === selectedTenant.id ? (
                      <>
                        <div className="field" style={{ marginTop: 10 }}>
                          <textarea
                            value={memoDraft}
                            onChange={(event) => setMemoDraft(event.target.value)}
                            placeholder="Add tenant notes, reminders, or special instructions"
                          />
                        </div>
                        <div className="button-row" style={{ justifyContent: "start" }}>
                          <button className="action secondary" onClick={saveTenantMemo} disabled={busy}>
                            Save Memo
                          </button>
                          <button
                            className="action secondary"
                            onClick={() => {
                              setEditingMemoTenantId("");
                              setMemoDraft(selectedTenant.memo || "");
                            }}
                            disabled={busy}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="meta" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                          {selectedTenant.memo || "No memo yet."}
                        </div>
                        <div className="button-row" style={{ justifyContent: "start", marginTop: 10 }}>
                          <button
                            className="action secondary"
                            onClick={() => {
                              setEditingMemoTenantId(selectedTenant.id);
                              setMemoDraft(selectedTenant.memo || "");
                            }}
                          >
                            Edit Memo
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <span className={`pill ${selectedTenant.outstandingBalance > 0 ? "warn" : ""}`}>
                      {selectedTenant.outstandingBalance > 0 ? "Balance Due" : "Current"}
                    </span>
                    {selectedTenant.creditBalance > 0 ? <span className="pill">Credit Available</span> : null}
                    <span className="pill">{selectedTenant.status}</span>
                    {selectedTenant.alert ? <span className="pill danger">Red Flag</span> : null}
                  </div>
                  <div className="button-row" style={{ justifyContent: "start", marginTop: 16 }}>
                    <button className="action secondary" onClick={() => editTenant(selectedTenant)}>
                      Edit Tenant
                    </button>
                    {selectedTenant.status !== "Moved Out" ? (
                      <button className="action warn" onClick={() => moveOutTenant(selectedTenant)}>
                        Move Out / Archive
                      </button>
                    ) : (
                      <button className="action secondary" onClick={() => reactivateTenant(selectedTenant)}>
                        Reactivate
                      </button>
                    )}
                    <button className="action danger" onClick={() => removeTenant(selectedTenant)}>
                      Delete Permanently
                    </button>
                  </div>
                </div>
                <div className="list-item">
                  <h3>Recent Payments</h3>
                  {selectedTenant.payments.length ? (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Method</th>
                          <th>Reference</th>
                          <th>Amount</th>
                          <th>Credit</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTenant.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td>{longDate(payment.paymentDate)}</td>
                            <td>{payment.method}</td>
                            <td>{payment.reference || "—"}</td>
                            <td>{money(payment.amount)}</td>
                            <td>{payment.unappliedAmount > 0 ? money(payment.unappliedAmount) : "—"}</td>
                            <td>
                              <div className="button-row" style={{ justifyContent: "start" }}>
                                <button
                                  className="action secondary"
                                  onClick={() => openPrintWindow(paymentReceiptHtml(state.property, selectedTenant, payment))}
                                >
                                  Print
                                </button>
                                <button className="action secondary" onClick={() => editPayment(payment)}>
                                  Edit
                                </button>
                                <button className="action danger" onClick={() => removePayment(payment)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="empty">No payments recorded for this tenant yet.</div>
                  )}
                </div>
              </div>
              <div className="list-item">
                <h3>Ledger Details</h3>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <div className="field">
                    <label>Charge month</label>
                    <input
                      type="month"
                      value={chargeForm.chargeMonth}
                      onChange={(event) => setChargeForm((current) => ({ ...current, chargeMonth: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Due date</label>
                    <input
                      type="date"
                      value={chargeForm.dueDate}
                      onChange={(event) => setChargeForm((current) => ({ ...current, dueDate: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Rent amount</label>
                    <input
                      type="number"
                      value={chargeForm.rentAmount}
                      onChange={(event) => setChargeForm((current) => ({ ...current, rentAmount: event.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Other charges</label>
                    <input
                      type="number"
                      value={chargeForm.otherCharges}
                      onChange={(event) => setChargeForm((current) => ({ ...current, otherCharges: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="button-row" style={{ justifyContent: "start", marginBottom: 16 }}>
                  <button className="action" onClick={saveCharge} disabled={busy}>
                    {chargeForm.id ? "Save Charge Changes" : "Add Charge"}
                  </button>
                  {chargeForm.id ? (
                    <button className="action secondary" onClick={() => setChargeForm(blankCharge)} disabled={busy}>
                      Cancel Charge Edit
                    </button>
                  ) : null}
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Charge</th>
                      <th>Applied</th>
                      <th>Remaining</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTenant.charges.map((charge) => (
                      <tr key={charge.id}>
                        <td>{monthLabel(charge.chargeMonth)}</td>
                        <td>{money(charge.totalCharge)}</td>
                        <td>{money(charge.appliedAmount)}</td>
                        <td>{money(charge.remainingBalance)}</td>
                        <td>{charge.status}</td>
                        <td>
                          <div className="button-row" style={{ justifyContent: "start" }}>
                            <button className="action secondary" onClick={() => editCharge(charge)}>
                              Edit
                            </button>
                            <button className="action danger" onClick={() => removeCharge(charge)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="panel stack" style={{ marginTop: 20 }}>
              <div className="empty">Select a tenant to view the full record.</div>
            </section>
          )
        ) : null}

        {activeTab === "units" ? (
          <div className="two-column">
            <section className="panel stack">
              <div>
                <h3 className="section-title">Add Unit</h3>
                <p className="section-subtitle">Track unit number, parking, occupancy, and default rent.</p>
              </div>
              <div className="inline-actions">
                <button className="action secondary" onClick={importUnitMaster} disabled={busy}>
                  Import Apartment + Townhome Units
                </button>
                <div className="fine-print">
                  Imports the apartment list from your spreadsheet and keeps existing occupied units intact.
                </div>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Unit number</label>
                  <input value={unitForm.unitNumber} onChange={(event) => setUnitForm((current) => ({ ...current, unitNumber: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Parking spot</label>
                  <input value={unitForm.parkingSpot} onChange={(event) => setUnitForm((current) => ({ ...current, parkingSpot: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select value={unitForm.status} onChange={(event) => setUnitForm((current) => ({ ...current, status: event.target.value }))}>
                    <option>Vacant</option>
                    <option>Occupied</option>
                    <option>Maintenance</option>
                  </select>
                </div>
                <div className="field">
                  <label>Default monthly rent</label>
                  <input type="number" value={unitForm.defaultMonthlyRent} onChange={(event) => setUnitForm((current) => ({ ...current, defaultMonthlyRent: event.target.value }))} />
                </div>
              </div>
              <div className="button-row" style={{ justifyContent: "start" }}>
                <button className="action" onClick={addUnit} disabled={busy}>
                  {unitForm.id ? "Save Unit Changes" : "Add Unit"}
                </button>
                {unitForm.id ? (
                  <button className="action secondary" onClick={() => setUnitForm(blankUnit)} disabled={busy}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Unit Inventory</h3>
                <p className="section-subtitle">Availability and assigned parking. Showing {filteredUnits.length} of {state.units.length} units.</p>
              </div>
              <div className="field">
                <label>Search unit or car park</label>
                <input
                  value={unitSearch}
                  onChange={(event) => setUnitSearch(event.target.value)}
                  placeholder="Search by unit number, car park, or status"
                />
              </div>
              <div className="list">
                {filteredUnits.map((unit) => (
                  <div key={unit.id} className="list-item">
                    <h3>Unit {unit.unitNumber}</h3>
                    <div className="meta">
                      Parking Spot: {unit.parkingSpot || "—"}<br />
                      Status: {unit.status}<br />
                      Default Rent: {money(unit.defaultMonthlyRent)}
                    </div>
                    <div className="button-row" style={{ justifyContent: "start", marginTop: 14 }}>
                      <button className="action secondary" onClick={() => editUnit(unit)}>
                        Edit Unit
                      </button>
                      <button className="action danger" onClick={() => removeUnit(unit)}>
                        Delete Unit
                      </button>
                    </div>
                  </div>
                ))}
                {!filteredUnits.length ? <div className="empty">No units matched that search.</div> : null}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "payments" ? (
          <div className="two-column">
            <section className="panel stack">
              <div>
                <h3 className="section-title">Record Payment</h3>
                <p className="section-subtitle">Payments are credited to the oldest unpaid balances first.</p>
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Tenant</label>
                  <select value={paymentForm.tenantId} onChange={(event) => setPaymentForm((current) => ({ ...current, tenantId: event.target.value }))}>
                    <option value="">Select unit / tenant</option>
                    {tenantsByUnit.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenantUnitLabel(tenant)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Payment date</label>
                  <input type="date" value={paymentForm.paymentDate} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentDate: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Amount</label>
                  <input type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Method</label>
                  <select value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}>
                    <option>Cash</option>
                    <option>Check</option>
                    <option>Money Order</option>
                    <option>Bank Transfer</option>
                    <option>Zelle</option>
                  </select>
                </div>
                <div className="field">
                  <label>Reference</label>
                  <input value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} />
                </div>
                <div className="field">
                  <label>Notes</label>
                  <input value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} />
                </div>
              </div>
              <div className="button-row" style={{ justifyContent: "start" }}>
                <button className="action" onClick={addPayment} disabled={busy}>
                  {paymentForm.id ? "Save Payment Changes" : "Save Payment"}
                </button>
                {paymentForm.id ? (
                  <button className="action secondary" onClick={() => setPaymentForm(blankPayment)} disabled={busy}>
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Ledger View</h3>
                <p className="section-subtitle">Rent charges, payment application, remaining balances, and printable receipts.</p>
              </div>
              <div className="list">
                {derivedTenants.map((tenant) => (
                  <div key={tenant.id} className="list-item">
                    <h3>{tenant.fullName}</h3>
                    <div className="meta" style={{ marginBottom: 10 }}>
                      Unit {tenant.unit?.unitNumber || "—"} · Outstanding Balance: <strong>{money(tenant.outstandingBalance)}</strong>
                    </div>
                    {tenant.payments.length ? (
                      <>
                        <h4 style={{ marginBottom: 10 }}>Payments</h4>
                        <table className="table" style={{ marginBottom: 18 }}>
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Method</th>
                              <th>Reference</th>
                              <th>Amount</th>
                              <th>Receipt</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tenant.payments.map((payment) => (
                              <tr key={payment.id}>
                                <td>{longDate(payment.paymentDate)}</td>
                                <td>{payment.method}</td>
                                <td>{payment.reference || "—"}</td>
                                <td>{money(payment.amount)}</td>
                                <td>
                                  <div className="button-row" style={{ justifyContent: "start" }}>
                                    <button
                                      className="action secondary"
                                      onClick={() => openPreviewWindow(paymentReceiptHtml(state.property, tenant, payment))}
                                    >
                                      Preview Receipt
                                    </button>
                                    <button
                                      className="action secondary"
                                      onClick={() => openPrintWindow(paymentReceiptHtml(state.property, tenant, payment))}
                                    >
                                      Print Receipt
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    ) : null}
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Charge</th>
                          <th>Applied</th>
                          <th>Remaining</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tenant.charges.map((charge) => (
                          <tr key={charge.id}>
                            <td>{monthLabel(charge.chargeMonth)}</td>
                            <td>{money(charge.totalCharge)}</td>
                            <td>{money(charge.appliedAmount)}</td>
                            <td>{money(charge.remainingBalance)}</td>
                            <td>{charge.status}</td>
                            <td>
                              <div className="button-row" style={{ justifyContent: "start" }}>
                                <button className="action secondary" onClick={() => editCharge(charge)}>
                                  Edit
                                </button>
                                <button className="action danger" onClick={() => removeCharge(charge)}>
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "documents" ? (
          <div className="two-column">
            <section className="panel stack">
              <div>
                <h3 className="section-title">Upload Lease Contract</h3>
                <p className="section-subtitle">Store lease files by tenant.</p>
              </div>
              <div className="field">
                <label>Tenant</label>
                <select value={documentTenantId} onChange={(event) => setDocumentTenantId(event.target.value)}>
                  <option value="">Select unit / tenant</option>
                  {tenantsByUnit.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenantUnitLabel(tenant)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Lease file</label>
                <input type="file" onChange={uploadContract} disabled={!documentTenantId || busy} />
              </div>
              <div className="fine-print">Uploaded contracts are stored locally in this app’s `public/uploads` folder.</div>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Stored Documents</h3>
                <p className="section-subtitle">Lease files available for viewing or download.</p>
              </div>
              <div className="list">
                {state.tenantDocuments.map((document) => {
                  const tenant = derivedTenants.find((item) => item.id === document.tenantId);
                  return (
                    <div key={document.id} className="list-item">
                      <h3>{document.fileName}</h3>
                      <div className="meta">
                        Tenant: {tenant?.fullName || "Unknown"}<br />
                        Type: {document.documentType}<br />
                        Uploaded: {longDate(document.uploadedAt)}
                      </div>
                      {document.filePath ? (
                        <a href={document.filePath} target="_blank" rel="noreferrer">
                          Open File
                        </a>
                      ) : (
                        <div className="fine-print">Seeded sample without a local file path.</div>
                      )}
                      <div className="button-row" style={{ justifyContent: "start", marginTop: 14 }}>
                        <button className="action danger" onClick={() => removeDocument(document)}>
                          Delete Document
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "statements" ? (
          <div className="two-column">
            <section className="panel stack">
              <div>
                <h3 className="section-title">Print Statements</h3>
                <p className="section-subtitle">Generate a full ledger statement or a current rent notice.</p>
              </div>
              <div className="field">
                <label>Tenant</label>
                <select value={statementTenantId} onChange={(event) => setStatementTenantId(event.target.value)}>
                  {tenantsByUnit.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenantUnitLabel(tenant)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="button-row" style={{ justifyContent: "start" }}>
                <button
                  className="action"
                  onClick={() => selectedStatementTenant && openPrintWindow(statementHtml(state.property, selectedStatementTenant))}
                >
                  Print Ledger Statement
                </button>
                <button className="action secondary" onClick={printAllStatements}>
                  Print All Renter Statements
                </button>
                <button
                  className="action secondary"
                  onClick={() => selectedStatementTenant && openPrintWindow(rentNoticeHtml(state.property, selectedStatementTenant))}
                >
                  Print Rent Notice
                </button>
              </div>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Statement Preview Data</h3>
                <p className="section-subtitle">Latest balance snapshot before printing.</p>
              </div>
              {selectedStatementTenant ? (
                <div className="list-item">
                  <h3>{selectedStatementTenant.fullName}</h3>
                  <div className="meta">
                    Unit {selectedStatementTenant.unit?.unitNumber || "—"} · Parking {selectedStatementTenant.unit?.parkingSpot || "—"}<br />
                    Outstanding Balance: <strong>{money(selectedStatementTenant.outstandingBalance)}</strong><br />
                    Deposit Held: <strong>{money(selectedStatementTenant.depositAmount)}</strong>
                  </div>
                </div>
              ) : (
                <div className="empty">No tenant available.</div>
              )}
            </section>
          </div>
        ) : null}

        {activeTab === "reports" ? (
          <div className="panel-grid">
            <section className="panel stack">
              <div>
                <h3 className="section-title">Property Reports</h3>
                <p className="section-subtitle">Export portfolio snapshots, tenant lists, and full property backups.</p>
              </div>
              <div className="button-row" style={{ justifyContent: "start" }}>
                <button className="action secondary" onClick={exportExecutiveReport}>
                  Export Executive Report
                </button>
                <button className="action secondary" onClick={exportTenantList}>
                  Export Tenant List
                </button>
                <button className="action secondary" onClick={exportBackup}>
                  Export Backup
                </button>
              </div>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Print Reports</h3>
                <p className="section-subtitle">Print ledger statements and rent statements for management files.</p>
              </div>
              <div className="button-row" style={{ justifyContent: "start" }}>
                <button className="action secondary" onClick={printAllStatements}>
                  Print All Statements
                </button>
              </div>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Collections Reports</h3>
                <p className="section-subtitle">Exports for current unpaid tenants and red-alert arrears cases.</p>
              </div>
              <div className="button-row" style={{ justifyContent: "start" }}>
                <button className="action secondary" onClick={exportCurrentMonthUnpaidList} disabled={!currentMonthAlertTenants.length}>
                  Export Current Month List
                </button>
                <button
                  className="action secondary"
                  onClick={exportRedAlertReport}
                  disabled={!derivedTenants.filter((tenant) => tenant.alert).length}
                >
                  Export Red Alert Report
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "alerts" ? (
          <div className="two-column">
            <section className="panel stack">
              <div>
                <h3 className="section-title">Rent Alerts</h3>
                <p className="section-subtitle">Track current-month unpaid tenants after the 5th and keep the 3-month arrears warning list below.</p>
              </div>
              <div>
                <h4 className="section-title" style={{ fontSize: "1.1rem" }}>Current Month Unpaid After 5th</h4>
                <p className="section-subtitle">Tenants with a remaining balance for the current month once the 5th has passed.</p>
              </div>
              <div className="list">
                {currentMonthAlertTenants.length ? (
                  currentMonthAlertTenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      className="list-item alert"
                      style={{ textAlign: "left", cursor: "pointer" }}
                      onClick={() => setLetterTenantId(tenant.id)}
                    >
                      <h3>{tenant.fullName}</h3>
                      <div className="meta">
                        Unit {tenant.unit?.unitNumber || "—"} · Parking {tenant.unit?.parkingSpot || "—"}<br />
                        Charge Month: {monthLabel(tenant.currentMonthAlert?.chargeMonth)}<br />
                        Due Date: {longDate(tenant.currentMonthAlert?.dueDate)}<br />
                        Current Amount Due: <strong>{money(tenant.currentMonthAlert?.amountDue || 0)}</strong><br />
                        Total Outstanding Balance: <strong>{money(tenant.outstandingBalance)}</strong>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="empty">No current-month reminder letters are required right now.</div>
                )}
              </div>
              <div>
                <h4 className="section-title" style={{ fontSize: "1.1rem" }}>3-Month Arrears Warnings</h4>
                <p className="section-subtitle">Red flags show 3 consecutive unpaid months or total arrears equal to 3 months of rent.</p>
              </div>
              <div className="list">
                {derivedTenants.filter((tenant) => tenant.alert).length ? (
                  derivedTenants
                    .filter((tenant) => tenant.alert)
                    .map((tenant) => (
                      <button
                        key={tenant.id}
                        className="list-item alert"
                        style={{ textAlign: "left", cursor: "pointer" }}
                        onClick={() => setLetterTenantId(tenant.id)}
                      >
                        <h3>{tenant.fullName}</h3>
                        <div className="meta">
                          Unit {tenant.unit?.unitNumber || "—"} · Parking {tenant.unit?.parkingSpot || "—"}<br />
                          Warning Reason: {(tenant.alert.reasons || []).join("; ")}<br />
                          Unpaid Months: {(tenant.alert.unpaidMonths || []).map(monthLabel).join(", ") || "—"}<br />
                          Amount Due: <strong>{money(tenant.alert.amountDue)}</strong>
                        </div>
                      </button>
                    ))
                ) : (
                  <div className="empty">No warning letters required right now.</div>
                )}
              </div>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Reminder / Warning Letter Draft</h3>
                <p className="section-subtitle">Editable before printing or saving as PDF.</p>
              </div>
              {selectedLetterTenant ? (
                <>
                  <div className="list-item">
                    <h3>{selectedLetterTenant.fullName}</h3>
                    <div className="meta">
                      Unit {selectedLetterTenant.unit?.unitNumber || "—"} · Parking {selectedLetterTenant.unit?.parkingSpot || "—"}<br />
                      {selectedLetterTenant.currentMonthAlert ? (
                        <>
                          Reminder Type: Current Month Unpaid After 5th<br />
                          Charge Month: {monthLabel(selectedLetterTenant.currentMonthAlert.chargeMonth)}<br />
                          Due Date: {longDate(selectedLetterTenant.currentMonthAlert.dueDate)}<br />
                          Current Amount Due: <strong>{money(selectedLetterTenant.currentMonthAlert.amountDue)}</strong><br />
                        </>
                      ) : null}
                      {selectedLetterTenant.alert ? (
                        <>
                          Warning Reason: {(selectedLetterTenant.alert.reasons || []).join("; ")}<br />
                          Unpaid Months: {(selectedLetterTenant.alert.unpaidMonths || []).map(monthLabel).join(", ") || "—"}<br />
                          Past Due: <strong>{money(selectedLetterTenant.alert.amountDue)}</strong><br />
                        </>
                      ) : null}
                      Total Outstanding Balance: <strong>{money(selectedLetterTenant.outstandingBalance)}</strong>
                    </div>
                  </div>
                  <div className="field">
                    <label>Letter body</label>
                    <textarea value={letterBody} onChange={(event) => setLetterBody(event.target.value)} />
                  </div>
                  <div className="button-row" style={{ justifyContent: "start" }}>
                    {selectedLetterTenant.currentMonthAlert ? (
                      <button
                        className="action"
                        onClick={() => openPrintWindow(paymentReminderLetterHtml(state.property, selectedLetterTenant, letterBody))}
                      >
                        Print Payment Reminder
                      </button>
                    ) : null}
                    {selectedLetterTenant.alert ? (
                      <button
                        className="action warn"
                        onClick={() => openPrintWindow(warningLetterHtml(state.property, selectedLetterTenant, letterBody))}
                      >
                        Print Warning Letter
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="empty">Select a tenant from one of the alert lists to draft a reminder letter.</div>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
