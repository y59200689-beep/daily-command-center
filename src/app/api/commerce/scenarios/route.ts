import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";
import { savedScenarioSchema, evaluateStockoutRisk } from "@/lib/commerce";

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, scenarios: [] });
    }

    const { data, error } = await supabase
      .from("saved_inventory_scenarios")
      .select("*")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      configured: true,
      scenarios: data ?? [],
      count: (data ?? []).length,
    });
  } catch (error) {
    return apiError(error, "Scenarios could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = savedScenarioSchema.parse(await request.json());
    const state = await loadFullCommerceState(supabase, userId, companyId);

    // Scenario parameters:
    // demandMultiplier: number (e.g. 1.25 for +25% demand)
    // leadTimeDelayDays: number (e.g. 7 extra days)
    const demandMultiplier = Math.max(0.1, Number(input.parameters.demandMultiplier) || 1.0);
    const leadTimeDelayDays = Math.max(0, Number(input.parameters.leadTimeDelayDays) || 0);

    const simulationResults = state.products.map((p) => {
      const simulatedVelocity = p.dailyVelocity !== null ? p.dailyVelocity * demandMultiplier : null;
      const simulatedLeadTime = p.leadTimeDays + leadTimeDelayDays;
      const simulatedRisk = evaluateStockoutRisk({
        availableStock: p.availableStock,
        dailyVelocity: simulatedVelocity,
        leadTimeDays: simulatedLeadTime,
        safetyStockUnits: (p.policy?.safety_stock_units as number | undefined) ?? 0,
      });

      return {
        productId: p.id,
        productName: p.name,
        currentStock: p.availableStock,
        originalState: p.stockout.state,
        simulatedState: simulatedRisk.state,
        simulatedCoverageDays: simulatedRisk.coverageDays,
        simulatedRunoutDate: simulatedRisk.runoutDate,
      };
    });

    const newlyCritical = simulationResults.filter(
      (r) => r.simulatedState === "critical" && r.originalState !== "critical"
    ).length;

    const results = {
      demandMultiplier,
      leadTimeDelayDays,
      simulatedProductsCount: simulationResults.length,
      newlyCriticalCount: newlyCritical,
      productDetails: simulationResults,
    };

    const row = {
      name: input.name,
      description: input.description,
      parameters: input.parameters,
      results,
      user_id: userId,
      company_id: companyId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await supabase
      .from("saved_inventory_scenarios")
      .insert(row as never)
      .select("*")
      .single();

    if (result.error) throw result.error;

    return NextResponse.json({ scenario: result.data }, { status: 201 });
  } catch (error) {
    return apiError(error, "Scenario could not be run or saved.");
  }
}
