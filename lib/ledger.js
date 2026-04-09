function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sortByDate(a, b, key) {
  return String(a[key] || "").localeCompare(String(b[key] || ""));
}

export function monthKeyFromDate(value) {
  const date = value ? new Date(value) : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function buildDerivedState(state) {
  const unitsById = Object.fromEntries((state.units || []).map((unit) => [unit.id, unit]));
  const tenants = (state.tenants || []).map((tenant) => {
    const charges = (state.rentCharges || [])
      .filter((charge) => charge.tenantId === tenant.id)
      .sort((a, b) => sortByDate(a, b, "chargeMonth"))
      .map((charge) => ({
        ...charge,
        totalCharge: money(charge.totalCharge ?? money(charge.rentAmount) + money(charge.otherCharges)),
        appliedPayments: [],
        appliedAmount: 0,
        remainingBalance: 0,
        status: "Unpaid",
      }));

    const payments = (state.payments || [])
      .filter((payment) => payment.tenantId === tenant.id)
      .sort((a, b) => sortByDate(a, b, "paymentDate"));

    for (const payment of payments) {
      let available = money(payment.amount);
      for (const charge of charges) {
        const remaining = money(charge.totalCharge - charge.appliedAmount);
        if (available <= 0 || remaining <= 0) continue;
        const applied = Math.min(available, remaining);
        charge.appliedAmount = money(charge.appliedAmount + applied);
        charge.appliedPayments.push({
          paymentId: payment.id,
          paymentDate: payment.paymentDate,
          amount: applied,
        });
        available = money(available - applied);
      }
    }

    let outstandingBalance = 0;
    let currentStreak = [];
    const unpaidStreak = [];

    for (const charge of charges) {
      charge.remainingBalance = money(charge.totalCharge - charge.appliedAmount);
      charge.status =
        charge.remainingBalance <= 0 ? "Paid" : charge.appliedAmount > 0 ? "Partial" : "Unpaid";
      outstandingBalance = money(outstandingBalance + charge.remainingBalance);

      if (charge.remainingBalance > 0) {
        currentStreak.push(charge);
      } else {
        currentStreak = [];
      }

      if (currentStreak.length >= 3) {
        unpaidStreak.splice(0, unpaidStreak.length, ...currentStreak.slice(-3));
      }
    }

    const unit = unitsById[tenant.unitId] || null;

    return {
      ...tenant,
      unit,
      charges,
      payments,
      outstandingBalance,
      alert:
        unpaidStreak.length >= 3
          ? {
              tenantId: tenant.id,
              unpaidMonths: unpaidStreak.map((charge) => charge.chargeMonth),
              amountDue: money(unpaidStreak.reduce((sum, charge) => sum + charge.remainingBalance, 0)),
              unitNumber: unit?.unitNumber || "",
              parkingSpot: unit?.parkingSpot || "",
            }
          : null,
    };
  });

  const alerts = tenants.filter((tenant) => tenant.alert).map((tenant) => tenant.alert);
  const occupiedUnits = (state.units || []).filter((unit) => unit.status === "Occupied").length;
  const vacantUnits = (state.units || []).filter((unit) => unit.status !== "Occupied").length;
  const totalOutstanding = money(tenants.reduce((sum, tenant) => sum + tenant.outstandingBalance, 0));

  return {
    ...state,
    derivedTenants: tenants,
    alerts,
    dashboard: {
      occupiedUnits,
      vacantUnits,
      totalOutstanding,
      tenantsWithBalance: tenants.filter((tenant) => tenant.outstandingBalance > 0).length,
      arrearsCount: alerts.length,
    },
  };
}

export function upsertMonthlyCharges(state, chargeMonth = monthKeyFromDate()) {
  const existing = new Set((state.rentCharges || []).map((charge) => `${charge.tenantId}:${charge.chargeMonth}`));
  const nextCharges = [...(state.rentCharges || [])];

  for (const tenant of state.tenants || []) {
    if (tenant.status !== "Active") continue;
    const key = `${tenant.id}:${chargeMonth}`;
    if (existing.has(key)) continue;
    nextCharges.push({
      id: `charge-${tenant.id}-${chargeMonth}`,
      tenantId: tenant.id,
      chargeMonth,
      dueDate: `${chargeMonth}-${String(state.settings?.dueDay || 1).padStart(2, "0")}`,
      rentAmount: money(tenant.monthlyRent),
      otherCharges: 0,
      totalCharge: money(tenant.monthlyRent),
    });
  }

  return {
    ...state,
    rentCharges: nextCharges,
  };
}
