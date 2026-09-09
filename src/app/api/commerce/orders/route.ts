import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getCommerceContext } from "@/lib/commerce-server";
import { currencyCodeSchema } from "@/lib/commerce";

const blank = (value: unknown) => (typeof value === "string" && !value.trim() ? null : value);
const optionalNumber = z.preprocess(blank, z.coerce.number().finite().nonnegative().nullable().optional());
const optionalText = (max = 5000) => z.preprocess(blank, z.string().trim().max(max).nullable().optional());

const orderItemInputSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  product_name: z.string().trim().min(1).max(240),
  sku: optionalText(160),
  quantity: z.coerce.number().finite().positive(),
  unit_price: z.coerce.number().finite().nonnegative(),
  unit_cost: optionalNumber,
});

const commerceOrderCreateSchema = z.object({
  external_id: optionalText(160),
  customer_reference: optionalText(240),
  status: z
    .enum(["pending", "confirmed", "preparing", "shipped", "delivered", "canceled", "failed_payment", "cod_pending", "refunded"])
    .default("confirmed"),
  currency: currencyCodeSchema,
  shipping_cost: optionalNumber,
  payment_fee: optionalNumber,
  marketing_cost: optionalNumber,
  items: z.array(orderItemInputSchema).min(1),
});

export async function GET() {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ configured: false, orders: [] });
    }

    const { data: orders, error } = await supabase
      .from("commerce_orders")
      .select("*, commerce_order_items(*)")
      .eq("user_id", userId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({
      configured: true,
      orders: orders ?? [],
      count: (orders ?? []).length,
    });
  } catch (error) {
    return apiError(error, "Commerce sales orders could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId, companyId, isConfigured } = await getCommerceContext();
    if (!isConfigured || !companyId) {
      return NextResponse.json({ error: "Active company not configured." }, { status: 400 });
    }

    const input = commerceOrderCreateSchema.parse(await request.json());

    // Calculate total amount
    const itemsTotal = input.items.reduce((sum, it) => {
      return sum + Number(it.quantity) * Number(it.unit_price);
    }, 0);
    const shipping = Number(input.shipping_cost) || 0;
    const totalAmount = Number((itemsTotal + shipping).toFixed(2));

    const orderRow = {
      user_id: userId,
      company_id: companyId,
      external_id: input.external_id,
      customer_reference: input.customer_reference,
      status: input.status,
      currency: input.currency,
      total_amount: totalAmount,
      shipping_cost: input.shipping_cost || null,
      payment_fee: input.payment_fee || null,
      marketing_cost: input.marketing_cost || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const orderResult = await supabase
      .from("commerce_orders")
      .insert(orderRow as never)
      .select("*")
      .single();

    if (orderResult.error) throw orderResult.error;
    const order = orderResult.data;

    const lineRows = input.items.map((it) => ({
      user_id: userId,
      company_id: companyId,
      order_id: order.id,
      product_id: it.product_id || null,
      product_name: it.product_name,
      sku: it.sku || null,
      quantity: it.quantity,
      unit_price: it.unit_price,
      unit_cost: it.unit_cost || null,
      created_at: new Date().toISOString(),
    }));

    const linesResult = await supabase
      .from("commerce_order_items")
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
    return apiError(error, "Commerce sales order could not be created.");
  }
}
