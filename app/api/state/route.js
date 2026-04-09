import { NextResponse } from "next/server";
import { isAuthenticated } from "../../../lib/auth";
import { buildDerivedState, upsertMonthlyCharges } from "../../../lib/ledger";
import { readState, writeState } from "../../../lib/store";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  try {
    if (!isAuthenticated()) return unauthorized();
    const state = buildDerivedState(await readState());
    return NextResponse.json(state);
  } catch (error) {
    console.error("GET /api/state failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load property state" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    if (!isAuthenticated()) return unauthorized();
    const payload = await request.json();

    let nextState = {
      property: payload.property,
      settings: payload.settings,
      units: payload.units || [],
      tenants: payload.tenants || [],
      tenantDocuments: payload.tenantDocuments || [],
      rentCharges: payload.rentCharges || [],
      payments: payload.payments || [],
    };

    if (payload.generateCurrentMonth) {
      nextState = upsertMonthlyCharges(nextState);
    }

    await writeState(nextState);
    return NextResponse.json(buildDerivedState(nextState));
  } catch (error) {
    console.error("POST /api/state failed:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save property state" },
      { status: 500 }
    );
  }
}
