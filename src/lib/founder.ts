export type FounderOrder = { id: string; status: string; currency: string; total_amount: number | string; created_at: string; shipping_cost?: number | string | null; payment_fee?: number | string | null; marketing_cost?: number | string | null };
export type FounderOrderItem = { order_id?: string; product_id?: string | null; product_name: string; quantity: number | string; unit_price: number | string; unit_cost?: number | string | null };

export function byCurrency<T extends { currency?: string | null }>(rows: T[], value: (row: T) => number) {
  return rows.reduce<Record<string, number>>((result, row) => { const currency = String(row.currency ?? "MAD"); result[currency] = (result[currency] ?? 0) + value(row); return result; }, {});
}

export function commerceSummary(orders: FounderOrder[]) {
  const successful = orders.filter((order) => !["canceled", "failed_payment", "refunded"].includes(order.status));
  const revenue = byCurrency(successful, (order) => Number(order.total_amount));
  const count = successful.length;
  const aov = Object.fromEntries(Object.entries(revenue).map(([currency, amount]) => [currency, count ? amount / count : null]));
  const states = orders.reduce<Record<string, number>>((result, order) => { result[order.status] = (result[order.status] ?? 0) + 1; return result; }, {});
  return { orderCount: count, revenue, averageOrderValue: aov, states, cancellationRate: orders.length ? (states.canceled ?? 0) / orders.length : null };
}

export function productPerformance(items: FounderOrderItem[]) {
  const byProduct = new Map<string, { id: string; name: string; units: number; revenue: number; cogs: number | null; orders: Set<string> }>();
  for (const [index, item] of items.entries()) { const id = item.product_id ?? `unknown:${item.product_name}:${index}`; const current = byProduct.get(id) ?? { id, name: item.product_name, units: 0, revenue: 0, cogs: 0, orders: new Set<string>() }; const units = Number(item.quantity); current.units += units; current.revenue += units * Number(item.unit_price); current.cogs = item.unit_cost == null || current.cogs == null ? null : current.cogs + units * Number(item.unit_cost); if (item.order_id) current.orders.add(item.order_id); byProduct.set(id, current); }
  return [...byProduct.values()].map((item) => ({ ...item, orders: item.orders.size, grossProfit: item.cogs == null ? null : item.revenue - item.cogs, grossMargin: item.cogs == null || !item.revenue ? null : (item.revenue - item.cogs) / item.revenue })).sort((a, b) => b.revenue - a.revenue);
}

export function inventoryRisk(stock: { available_stock?: number | string | null; reorder_level?: number | string | null }, averageDailyUnits: number | null) {
  const available = stock.available_stock == null ? null : Number(stock.available_stock); if (available == null) return { state: "unavailable" as const, daysOfStock: null };
  const daysOfStock = averageDailyUnits && averageDailyUnits > 0 ? available / averageDailyUnits : null;
  if (available === 0) return { state: "out_of_stock" as const, daysOfStock };
  if (stock.reorder_level != null && available <= Number(stock.reorder_level)) return { state: "low_stock" as const, daysOfStock };
  if (daysOfStock != null && daysOfStock <= 10) return { state: "stockout_risk" as const, daysOfStock };
  return { state: "healthy" as const, daysOfStock };
}

export function unitEconomics(order: FounderOrder, items: FounderOrderItem[]) {
  const revenue = Number(order.total_amount); const cogs = items.some((item) => item.unit_cost == null) ? null : items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_cost), 0);
  const costs = cogs == null ? null : cogs + Number(order.shipping_cost ?? 0) + Number(order.payment_fee ?? 0) + Number(order.marketing_cost ?? 0);
  return { revenue, cogs, grossProfit: cogs == null ? null : revenue - cogs, grossMargin: cogs == null || !revenue ? null : (revenue - cogs) / revenue, contributionMargin: costs == null ? null : revenue - costs };
}

export function founderAttention(input: { incidents: Array<{ id: string; title: string; severity: string }>; deployments: Array<{ id: string; status: string; environment: string }>; inventory: Array<{ id: string; name: string; state: string }>; supportOpen: number }) {
  const items = [
    ...input.incidents.filter((item) => item.severity === "critical" && item).map((item) => ({ key: `incident:${item.id}`, priority: 100, title: item.title, reason: "Critical production incident needs founder attention.", route: "/founder?section=incidents" })),
    ...input.deployments.filter((item) => item.environment === "production" && item.status === "failed").map((item) => ({ key: `deployment:${item.id}`, priority: 90, title: "Production deployment failed", reason: "Review the latest production deployment before further release work.", route: "/founder?section=development" })),
    ...input.inventory.filter((item) => ["out_of_stock", "stockout_risk"].includes(item.state)).map((item) => ({ key: `inventory:${item.id}`, priority: item.state === "out_of_stock" ? 88 : 72, title: `${item.name} needs stock attention`, reason: item.state === "out_of_stock" ? "This product is out of stock." : "Recent sales indicate a potential stockout.", route: "/founder?section=operations" })),
    ...(input.supportOpen >= 5 ? [{ key: "support:volume", priority: 60, title: "Support volume needs review", reason: `${input.supportOpen} support cases remain open.`, route: "/founder?section=support" }] : []),
  ]; return items.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

export function growthFunnel(snapshot: { sessions?: number | null; product_views?: number | null; add_to_cart?: number | null; checkout_started?: number | null; orders_created?: number | null; orders_confirmed?: number | null } | null) {
  if (!snapshot) return null;
  const rate = (value: number | null | undefined, base: number | null | undefined) => value == null || base == null || base <= 0 ? null : value / base;
  return { sessions: snapshot.sessions ?? null, productViews: snapshot.product_views ?? null, addToCart: snapshot.add_to_cart ?? null, checkoutStarted: snapshot.checkout_started ?? null, ordersCreated: snapshot.orders_created ?? null, ordersConfirmed: snapshot.orders_confirmed ?? null, productViewRate: rate(snapshot.product_views, snapshot.sessions), addToCartRate: rate(snapshot.add_to_cart, snapshot.product_views), checkoutRate: rate(snapshot.checkout_started, snapshot.add_to_cart), checkoutToOrderRate: rate(snapshot.orders_confirmed ?? snapshot.orders_created, snapshot.checkout_started), overallConversion: rate(snapshot.orders_confirmed ?? snapshot.orders_created, snapshot.sessions) };
}

export function supportSummary(cases: Array<{ category: string; status: string; created_at: string; resolved_at?: string | null }>, now = new Date()) {
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const open = cases.filter((item) => ["open", "investigating"].includes(item.status));
  const createdThisWeek = cases.filter((item) => new Date(item.created_at).getTime() >= weekAgo);
  const categoryCounts = cases.reduce<Record<string, number>>((result, item) => { result[item.category] = (result[item.category] ?? 0) + 1; return result; }, {});
  const topCategory = Object.entries(categoryCounts).sort(([, first], [, second]) => second - first)[0] ?? null;
  const resolvedHours = cases.flatMap((item) => item.resolved_at ? [(new Date(item.resolved_at).getTime() - new Date(item.created_at).getTime()) / 3_600_000] : []);
  return { open: open.length, createdThisWeek: createdThisWeek.length, topCategory: topCategory && topCategory[1] >= 3 ? { category: topCategory[0], count: topCategory[1] } : null, averageResolutionHours: resolvedHours.length >= 3 ? resolvedHours.reduce((sum, value) => sum + value, 0) / resolvedHours.length : null };
}
