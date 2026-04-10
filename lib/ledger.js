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
  const today = new Date();
  const currentMonth = monthKeyFromDate(today);
  const currentDayOfMonth = today.getDate();
  const reminderDay = Number(state.settings?.reminderDay || 5);
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
      payment.unappliedAmount = available;
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
    const creditBalance = money(payments.reduce((sum, payment) => sum + money(payment.unappliedAmount), 0));
    const currentMonthCharge = charges.find((charge) => charge.chargeMonth === currentMonth) || null;
    const hasCurrentMonthUnpaidRent =
      tenant.status === "Active" &&
      currentDayOfMonth >= reminderDay &&
      currentMonthCharge &&
      money(currentMonthCharge.remainingBalance) > 0;
    const threeMonthsRentThreshold = money((tenant.monthlyRent || 0) * 3);
    const hasConsecutiveUnpaidMonths = unpaidStreak.length >= 3;
    const hasThreeMonthsEquivalentArrears =
      threeMonthsRentThreshold > 0 && outstandingBalance >= threeMonthsRentThreshold;
    const warningReasons = [
      ...(hasConsecutiveUnpaidMonths ? ["3 consecutive unpaid months"] : []),
      ...(hasThreeMonthsEquivalentArrears ? ["arrears equal to at least 3 months of rent"] : []),
    ];

    return {
      ...tenant,
      unit,
      charges,
      payments,
      outstandingBalance,
      creditBalance,
      netBalance: money(outstandingBalance - creditBalance),
      currentMonthAlert: hasCurrentMonthUnpaidRent
        ? {
            tenantId: tenant.id,
            chargeMonth: currentMonthCharge.chargeMonth,
            dueDate: currentMonthCharge.dueDate,
            amountDue: money(currentMonthCharge.remainingBalance),
            totalOutstandingBalance: outstandingBalance,
            reminderDay,
            unitNumber: unit?.unitNumber || "",
            parkingSpot: unit?.parkingSpot || "",
          }
        : null,
      alert:
        hasConsecutiveUnpaidMonths || hasThreeMonthsEquivalentArrears
          ? {
              tenantId: tenant.id,
              unpaidMonths: unpaidStreak.map((charge) => charge.chargeMonth),
              streakAmountDue: money(unpaidStreak.reduce((sum, charge) => sum + charge.remainingBalance, 0)),
              amountDue: outstandingBalance,
              thresholdAmount: threeMonthsRentThreshold,
              reasons: warningReasons,
              hasConsecutiveUnpaidMonths,
              hasThreeMonthsEquivalentArrears,
              unitNumber: unit?.unitNumber || "",
              parkingSpot: unit?.parkingSpot || "",
            }
          : null,
    };
  });

  const currentMonthAlerts = tenants
    .filter((tenant) => tenant.currentMonthAlert)
    .map((tenant) => tenant.currentMonthAlert);
  const alerts = tenants.filter((tenant) => tenant.alert).map((tenant) => tenant.alert);
  const occupiedUnits = (state.units || []).filter((unit) => unit.status === "Occupied").length;
  const vacantUnits = (state.units || []).filter((unit) => unit.status !== "Occupied").length;
  const totalOutstanding = money(tenants.reduce((sum, tenant) => sum + tenant.outstandingBalance, 0));

  return {
    ...state,
    derivedTenants: tenants,
    alerts,
    currentMonthAlerts,
    dashboard: {
      occupiedUnits,
      vacantUnits,
      totalOutstanding,
      tenantsWithBalance: tenants.filter((tenant) => tenant.outstandingBalance > 0).length,
      arrearsCount: alerts.length,
      currentMonthUnpaidCount: currentMonthAlerts.length,
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
