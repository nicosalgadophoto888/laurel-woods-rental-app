export const seedState = {
  property: {
    id: "property-laurel-woods",
    name: "Laurel Woods",
    address: "Laurel Woods Apartments",
    city: "Detroit",
    state: "MI",
  },
  settings: {
    dueDay: 1,
    warningTemplate:
      "This letter serves as formal notice that your account is past due. Our records show three consecutive months with unpaid rent charges. Please remit the overdue amount immediately or contact management to discuss your balance.",
  },
  units: [
    {
      id: "unit-101",
      propertyId: "property-laurel-woods",
      unitNumber: "101",
      parkingSpot: "P-12",
      status: "Occupied",
      defaultMonthlyRent: 1250,
    },
    {
      id: "unit-102",
      propertyId: "property-laurel-woods",
      unitNumber: "102",
      parkingSpot: "P-14",
      status: "Occupied",
      defaultMonthlyRent: 1325,
    },
    {
      id: "unit-103",
      propertyId: "property-laurel-woods",
      unitNumber: "103",
      parkingSpot: "P-16",
      status: "Vacant",
      defaultMonthlyRent: 1350,
    }
  ],
  tenants: [
    {
      id: "tenant-ava-johnson",
      propertyId: "property-laurel-woods",
      unitId: "unit-101",
      fullName: "Ava Johnson",
      phone: "(313) 555-0101",
      email: "ava.johnson@example.com",
      memo: "",
      monthlyRent: 1250,
      depositAmount: 1250,
      leaseStart: "2025-01-01",
      leaseEnd: "2025-12-31",
      status: "Active",
    },
    {
      id: "tenant-marcus-lee",
      propertyId: "property-laurel-woods",
      unitId: "unit-102",
      fullName: "Marcus Lee",
      phone: "(313) 555-0102",
      email: "marcus.lee@example.com",
      memo: "",
      monthlyRent: 1325,
      depositAmount: 1325,
      leaseStart: "2025-03-01",
      leaseEnd: "2026-02-28",
      status: "Active",
    }
  ],
  tenantDocuments: [
    {
      id: "doc-ava-lease",
      tenantId: "tenant-ava-johnson",
      documentType: "Lease Contract",
      fileName: "ava-johnson-lease.pdf",
      filePath: "",
      uploadedAt: "2026-01-15T12:00:00.000Z",
    }
  ],
  rentCharges: [
    {
      id: "charge-ava-2026-01",
      tenantId: "tenant-ava-johnson",
      chargeMonth: "2026-01",
      dueDate: "2026-01-01",
      rentAmount: 1250,
      otherCharges: 0,
      totalCharge: 1250,
    },
    {
      id: "charge-ava-2026-02",
      tenantId: "tenant-ava-johnson",
      chargeMonth: "2026-02",
      dueDate: "2026-02-01",
      rentAmount: 1250,
      otherCharges: 0,
      totalCharge: 1250,
    },
    {
      id: "charge-ava-2026-03",
      tenantId: "tenant-ava-johnson",
      chargeMonth: "2026-03",
      dueDate: "2026-03-01",
      rentAmount: 1250,
      otherCharges: 0,
      totalCharge: 1250,
    },
    {
      id: "charge-marcus-2026-03",
      tenantId: "tenant-marcus-lee",
      chargeMonth: "2026-03",
      dueDate: "2026-03-01",
      rentAmount: 1325,
      otherCharges: 0,
      totalCharge: 1325,
    },
    {
      id: "charge-marcus-2026-04",
      tenantId: "tenant-marcus-lee",
      chargeMonth: "2026-04",
      dueDate: "2026-04-01",
      rentAmount: 1325,
      otherCharges: 0,
      totalCharge: 1325,
    }
  ],
  payments: [
    {
      id: "payment-ava-jan",
      tenantId: "tenant-ava-johnson",
      paymentDate: "2026-01-05",
      amount: 1250,
      method: "Bank Transfer",
      reference: "JAN-PAID",
      notes: "January rent",
    },
    {
      id: "payment-marcus-apr",
      tenantId: "tenant-marcus-lee",
      paymentDate: "2026-04-05",
      amount: 700,
      method: "Money Order",
      reference: "APR-PARTIAL",
      notes: "Partial April payment",
    }
  ]
};
