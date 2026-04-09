"use client";

import { useEffect, useMemo, useState } from "react";
import { buildDerivedState } from "../lib/ledger";
import { seedState } from "../lib/seed";

const tabs = [
  { key: "dashboard", label: "Dashboard" },
  { key: "tenants", label: "Tenants" },
  { key: "units", label: "Units" },
  { key: "payments", label: "Payments" },
  { key: "documents", label: "Documents" },
  { key: "statements", label: "Statements" },
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
      </style>
    </head>
    <body>
      <h1>${escapeHtml(property.name)} Ledger Statement</h1>
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
      </style>
    </head>
    <body>
      <h1>${escapeHtml(property.name)} Rent Notice</h1>
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
      </style>
    </head>
    <body>
      <h1>${escapeHtml(property.name)}</h1>
      <p>${escapeHtml(longDate(new Date().toISOString()))}</p>
      <p>${escapeHtml(tenant.fullName)}<br />Unit ${escapeHtml(tenant.unit?.unitNumber || "—")}<br />Parking ${escapeHtml(tenant.unit?.parkingSpot || "—")}</p>
      <p>${escapeHtml(body).replaceAll("\n", "<br />")}</p>
      <p>Unpaid Months: ${escapeHtml((tenant.alert?.unpaidMonths || []).map(monthLabel).join(", "))}</p>
      <p>Total Past Due: <strong>${escapeHtml(money(tenant.alert?.amountDue || 0))}</strong></p>
      <p>Sincerely,<br />Laurel Woods Management</p>
    </body>
  </html>`;
}

const blankUnit = {
  unitNumber: "",
  parkingSpot: "",
  status: "Vacant",
  defaultMonthlyRent: "",
};

const blankTenant = {
  fullName: "",
  phone: "",
  email: "",
  unitId: "",
  monthlyRent: "",
  depositAmount: "",
  leaseStart: "",
  leaseEnd: "",
  status: "Active",
};

const blankPayment = {
  tenantId: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  amount: "",
  method: "Cash",
  reference: "",
  notes: "",
};

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState(null);
  const [unitForm, setUnitForm] = useState(blankUnit);
  const [tenantForm, setTenantForm] = useState(blankTenant);
  const [paymentForm, setPaymentForm] = useState(blankPayment);
  const [documentTenantId, setDocumentTenantId] = useState("");
  const [statementTenantId, setStatementTenantId] = useState("");
  const [letterTenantId, setLetterTenantId] = useState("");
  const [letterBody, setLetterBody] = useState("");
  const [busy, setBusy] = useState(false);

  const derivedTenants = state?.derivedTenants || [];
  const selectedStatementTenant = derivedTenants.find((tenant) => tenant.id === statementTenantId) || derivedTenants[0] || null;
  const selectedLetterTenant = derivedTenants.find((tenant) => tenant.id === letterTenantId) || derivedTenants.find((tenant) => tenant.alert) || null;

  function hydrateFallbackState(message) {
    const fallback = buildDerivedState(seedState);
    setState(fallback);
    setStatementTenantId(fallback.derivedTenants?.[0]?.id || "");
    const alertTenantId = fallback.derivedTenants?.find((tenant) => tenant.alert)?.id || "";
    setLetterTenantId(alertTenantId);
    setLetterBody(
      alertTenantId
        ? `${fallback.settings.warningTemplate}\n\nPlease contact the management office immediately to resolve your account.`
        : fallback.settings.warningTemplate
    );
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
        setStatementTenantId(nextState.derivedTenants?.[0]?.id || "");
        const alertTenantId = nextState.derivedTenants?.find((tenant) => tenant.alert)?.id || "";
        setLetterTenantId(alertTenantId);
        setLetterBody(
          alertTenantId
            ? `${nextState.settings.warningTemplate}\n\nPlease contact the management office immediately to resolve your account.`
            : nextState.settings.warningTemplate
        );
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
    if (!state || !selectedLetterTenant?.alert) return;
    setLetterBody(
      `${state.settings.warningTemplate}\n\nPlease contact the management office immediately to resolve your account.`
    );
  }, [state?.settings?.warningTemplate, selectedLetterTenant?.id]);

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
      const payload = await response.json();
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
      const payload = await response.json();
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

  async function addUnit() {
    if (!state || !unitForm.unitNumber.trim()) return;
    const nextState = {
      ...state,
      units: [
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
    if (!state || !tenantForm.fullName.trim() || !tenantForm.unitId) return;
    const selectedUnit = state.units.find((unit) => unit.id === tenantForm.unitId);
    const nextState = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === tenantForm.unitId ? { ...unit, status: "Occupied" } : unit
      ),
      tenants: [
        ...state.tenants,
        {
          id: `tenant-${Date.now()}`,
          propertyId: state.property.id,
          fullName: tenantForm.fullName.trim(),
          phone: tenantForm.phone.trim(),
          email: tenantForm.email.trim(),
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
    setStatementTenantId(saved.derivedTenants?.slice(-1)[0]?.id || "");
  }

  async function addPayment() {
    if (!state || !paymentForm.tenantId || !paymentForm.amount) return;
    const nextState = {
      ...state,
      payments: [
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

  if (loading) {
    return <div className="login-shell"><div className="login-card">Loading Laurel Woods Rental App...</div></div>;
  }

  if (!authenticated) {
    return (
      <div className="login-shell">
        <div className="login-card">
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
          <h1>Laurel Woods</h1>
          <p>Rental operations dashboard for units, payments, statements, and arrears management.</p>
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
                        {tenant.alert ? <span className="pill danger">3-Month Warning</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel stack">
                <div>
                  <h3 className="section-title">Arrears Warnings</h3>
                  <p className="section-subtitle">Tenants with three consecutive unpaid months.</p>
                </div>
                {state?.alerts?.length ? (
                  <div className="list">
                    {derivedTenants
                      .filter((tenant) => tenant.alert)
                      .map((tenant) => (
                        <div key={tenant.id} className="list-item alert">
                          <h4>{tenant.fullName}</h4>
                          <div className="meta">
                            Unpaid Months: {(tenant.alert.unpaidMonths || []).map(monthLabel).join(", ")}<br />
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
              <button className="action" onClick={addTenant} disabled={busy}>
                Add Tenant
              </button>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Current Tenants</h3>
                <p className="section-subtitle">Lease and balance overview.</p>
              </div>
              <div className="list">
                {derivedTenants.map((tenant) => (
                  <div key={tenant.id} className={`list-item ${tenant.alert ? "alert" : ""}`}>
                    <h3>{tenant.fullName}</h3>
                    <div className="meta">
                      Unit {tenant.unit?.unitNumber || "—"} · Parking {tenant.unit?.parkingSpot || "—"}<br />
                      Lease: {longDate(tenant.leaseStart)} to {longDate(tenant.leaseEnd)}<br />
                      Rent {money(tenant.monthlyRent)} · Deposit {money(tenant.depositAmount)}<br />
                      Balance {money(tenant.outstandingBalance)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "units" ? (
          <div className="two-column">
            <section className="panel stack">
              <div>
                <h3 className="section-title">Add Unit</h3>
                <p className="section-subtitle">Track unit number, parking, occupancy, and default rent.</p>
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
              <button className="action" onClick={addUnit} disabled={busy}>
                Add Unit
              </button>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Unit Inventory</h3>
                <p className="section-subtitle">Availability and assigned parking.</p>
              </div>
              <div className="list">
                {state.units.map((unit) => (
                  <div key={unit.id} className="list-item">
                    <h3>Unit {unit.unitNumber}</h3>
                    <div className="meta">
                      Parking Spot: {unit.parkingSpot || "—"}<br />
                      Status: {unit.status}<br />
                      Default Rent: {money(unit.defaultMonthlyRent)}
                    </div>
                  </div>
                ))}
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
                    <option value="">Select tenant</option>
                    {derivedTenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.fullName} · Unit {tenant.unit?.unitNumber || "—"}
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
              <button className="action" onClick={addPayment} disabled={busy}>
                Save Payment
              </button>
            </section>

            <section className="panel stack">
              <div>
                <h3 className="section-title">Ledger View</h3>
                <p className="section-subtitle">Rent charges, payment application, and remaining balances.</p>
              </div>
              <div className="list">
                {derivedTenants.map((tenant) => (
                  <div key={tenant.id} className="list-item">
                    <h3>{tenant.fullName}</h3>
                    <div className="meta" style={{ marginBottom: 10 }}>
                      Outstanding Balance: <strong>{money(tenant.outstandingBalance)}</strong>
                    </div>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Charge</th>
                          <th>Applied</th>
                          <th>Remaining</th>
                          <th>Status</th>
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
                  <option value="">Select tenant</option>
                  {derivedTenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.fullName} · Unit {tenant.unit?.unitNumber || "—"}
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
                  {derivedTenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.fullName} · Unit {tenant.unit?.unitNumber || "—"}
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

        {activeTab === "alerts" ? (
          <div className="two-column">
            <section className="panel stack">
              <div>
                <h3 className="section-title">Arrears Alerts</h3>
                <p className="section-subtitle">3 consecutive unpaid months create a warning state.</p>
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
                          Unpaid Months: {(tenant.alert.unpaidMonths || []).map(monthLabel).join(", ")}<br />
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
                <h3 className="section-title">Warning Letter Draft</h3>
                <p className="section-subtitle">Editable before printing.</p>
              </div>
              {selectedLetterTenant?.alert ? (
                <>
                  <div className="list-item">
                    <h3>{selectedLetterTenant.fullName}</h3>
                    <div className="meta">
                      Unit {selectedLetterTenant.unit?.unitNumber || "—"} · Parking {selectedLetterTenant.unit?.parkingSpot || "—"}<br />
                      Unpaid Months: {(selectedLetterTenant.alert.unpaidMonths || []).map(monthLabel).join(", ")}<br />
                      Past Due: <strong>{money(selectedLetterTenant.alert.amountDue)}</strong>
                    </div>
                  </div>
                  <div className="field">
                    <label>Letter body</label>
                    <textarea value={letterBody} onChange={(event) => setLetterBody(event.target.value)} />
                  </div>
                  <button
                    className="action warn"
                    onClick={() => openPrintWindow(warningLetterHtml(state.property, selectedLetterTenant, letterBody))}
                  >
                    Print Warning Letter
                  </button>
                </>
              ) : (
                <div className="empty">Select a flagged tenant to draft a warning letter.</div>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
