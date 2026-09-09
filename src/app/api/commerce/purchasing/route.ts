import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getCommerceContext, loadFullCommerceState } from "@/lib/commerce-server";
import { currencyCodeSchema, validateForeignOwnership } from "@/lib/commerce";

const blank = (value: unknown) => (typeof value === "string" && !value.trim() ? null : value);
const optionalNumber = z.preprocess(blank, z.coerce.number().finite().nonnegative().nullable().optional());
const optionalDate = z.preprocess(blank, z.string().datetime().nullable().optional());
const optionalText = (max = 5000) => z.preprocess(blank, z.string().trim().max(max).nullable().optional());

const orderItemInputSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  product_name: z.string().trim().min(1).max(240),
  quantity: z.coerce.number().finite().positive(),
  unit_cost: optionalNumber,
});

const purchaseOrderCreateSchema = z.object({
  supplier_id: z.string().uuid(),
  reference: optionalText(120),
  expected_at: optionalDate,
  currency: currencyCodeSchema,
  notes: optionalText(5000),
  items: z.array(orderItemInputSchema).min(1),
});

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, orders: [] });
    }

    const state = await loadFullCommerceState(supabase, userId, companyId);
    return NextResponse.json({
      configured: true,
      orders: state.supplierOrders,
      count: state.supplierOrders.length,
    });
  } catch (error) {
    return apiError(error, "Purchase orders could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = purchaseOrderCreateSchema.parse(await request.json());

    // Validate supplier foreign ownership
    const supCheck = await validateForeignOwnership(supabase, userId, companyId, {
      supplierId: input.supplier_id,
    });
    if (!supCheck.valid) {
      return NextResponse.json({ error: supCheck.error }, { status: 403 });
    }

    // Calculate total value
    const totalValue = input.items.reduce((sum, it) => {
      const lineCost = (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0);
      return sum + lineCost;
    }, 0);

    const orderRow = {
      user_id: userId,
      company_id: companyId,
      supplier_id: input.supplier_id,
      status: "ordered",
      reference: input.reference,
      ordered_at: new Date().toISOString(),
      expected_at: input.expected_at || null,
      total_value: totalValue > 0 ? Number(totalValue.toFixed(2)) : null,
      currency: input.currency,
      notes: input.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const orderResult = await supabase
      .from("supplier_orders")
      .insert(orderRow as never)
      .select("*")
      .single();

    if (orderResult.error) throw orderResult.error;
    const order = orderResult.data;

    // Insert line items
    const lineRows = input.items.map((it) => ({
      user_id: userId,
      company_id: companyId,
      supplier_order_id: order.id,
      product_id: it.product_id || null,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_cost: it.unit_cost || null,
      quantity_received: 0,
      created_at: new Date().toISOString(),
    }));

    const linesResult = await supabase
      .from("supplier_order_items")
      .insert(lineRows as never)
      .select("*");

    if (linesResult.error) throw linesResult.error;

    return NextResponse.json({
      order: {
        ...order,
        items: linesResult.data ?? [],
      },
    }, { status: 201 });
  } catch (error) {
    return apiError(error, "Purchase order could not be created.");
  }
}
