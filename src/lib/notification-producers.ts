import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyOnce, resolveNotifications } from "@/lib/v4-notifications";
export async function emitWorkspaceNotifications(client:SupabaseClient,userId:string){const today=new Date().toISOString().slice(0,10);const soon=new Date(Date.now()+35*60_000).toISOString();const week=new Date(Date.now()+7*86400_000).toISOString().slice(0,10);const [tasks,events,threads,followups,invoices,subs,content,decisions,fitness,integrations,automations,conflicts]=await Promise.all([client.from("tasks").select("id,title,due_date,priority").eq("user_id",userId).is("deleted_at",null).in("status",["inbox","planned","in_progress"]).lte("due_date",week),client.from("calendar_events").select("id,title,starts_at").eq("user_id",userId).is("deleted_at",null).gte("starts_at",new Date().toISOString()).lte("starts_at",soon),client.from("email_threads").select("id,subject,reply_state,metadata").eq("user_id",userId).eq("reply_state","awaiting_user_reply"),client.from("followups").select("id,title,due_at").eq("user_id",userId).eq("status","open").lte("due_at",soon),client.from("invoices").select("id,invoice_number,due_date").eq("user_id",userId).is("deleted_at",null).in("status",["sent","partial"]).lt("due_date",today),client.from("subscriptions").select("id,name,next_billing_date").eq("user_id",userId).is("deleted_at",null).eq("status","active").lte("next_billing_date",week),client.from("content_items").select("id,title,due_date,approval_status").eq("user_id",userId).is("deleted_at",null).lte("due_date",week),client.from("decisions").select("id,title,review_date").eq("user_id",userId).is("deleted_at",null).in("status",["active","review_due"]).lte("review_date",today),client.from("fitness_targets").select("id,activity_type,target_value,period").eq("user_id",userId).eq("active",true).eq("period","week"),client.from("integrations").select("id,provider,status,last_error").eq("user_id",userId).in("status",["expired","error"]),client.from("automations").select("id,name,last_status").eq("user_id",userId).eq("last_status","error"),client.from("calendar_event_sync_state").select("calendar_event_id,conflict_type").eq("user_id",userId).not("conflict_type","is",null)]);const failed=[tasks,events,threads,followups,invoices,subs,content,decisions,fitness,integrations,automations,conflicts].find(x=>x.error);if(failed?.error)throw failed.error;
for(const task of tasks.data??[]){const overdue=task.due_date&&task.due_date<today;if(overdue&&["high","urgent"].includes(String(task.priority)))await notifyOnce(client,userId,{type:"tasks",title:"High-priority task overdue",body:String(task.title),entityType:"task",entityId:String(task.id),severity:"important",dedupeKey:`task:overdue:${task.id}`});else if(task.due_date===today)await notifyOnce(client,userId,{type:"tasks",title:"Task deadline today",body:String(task.title),entityType:"task",entityId:String(task.id),severity:"attention",dedupeKey:`task:today:${task.id}`})}
for(const event of events.data??[])await notifyOnce(client,userId,{type:"calendar",title:"Meeting starts soon",body:`${event.title} starts within 35 minutes.`,entityType:"calendar_event",entityId:String(event.id),severity:"important",dedupeKey:`meeting:${event.id}:${event.starts_at}`});
for(const thread of threads.data??[]){const metadata=thread.metadata as Record<string,unknown>|null;if(!metadata?.handled_at)await notifyOnce(client,userId,{type:"clients",title:"Client reply needs attention",body:String(thread.subject),entityType:"client",severity:"important",dedupeKey:`reply:${thread.id}:${metadata?.latest_message_id??"latest"}`})}
for(const followup of followups.data??[])await notifyOnce(client,userId,{type:"clients",title:"Follow-up due",body:String(followup.title),entityType:"followup",entityId:String(followup.id),severity:"important",dedupeKey:`followup:${followup.id}:${followup.due_at}`});
for(const invoice of invoices.data??[])await notifyOnce(client,userId,{type:"finance",title:"Invoice overdue",body:`${invoice.invoice_number??"Invoice"} is overdue.`,entityType:"invoice",entityId:String(invoice.id),severity:"important",dedupeKey:`invoice:overdue:${invoice.id}`});for(const sub of subs.data??[])await notifyOnce(client,userId,{type:"finance",title:"Subscription renewal soon",body:String(sub.name),entityType:"subscription",entityId:String(sub.id),severity:"attention",dedupeKey:`subscription:${sub.id}:${sub.next_billing_date}`});
for(const item of content.data??[]){if(item.approval_status==="pending"&&item.due_date&&item.due_date<today)await notifyOnce(client,userId,{type:"content",title:"Content approval overdue",body:String(item.title),entityType:"content",entityId:String(item.id),severity:"important",dedupeKey:`content:approval:${item.id}`});else if(item.due_date===today)await notifyOnce(client,userId,{type:"content",title:"Content deadline today",body:String(item.title),entityType:"content",entityId:String(item.id),severity:"attention",dedupeKey:`content:deadline:${item.id}:${item.due_date}`})}for(const decision of decisions.data??[])await notifyOnce(client,userId,{type:"decisions",title:"Decision review due",body:String(decision.title),entityType:"decision",entityId:String(decision.id),severity:"attention",dedupeKey:`decision:${decision.id}:${decision.review_date}`});for(const target of fitness.data??[])await notifyOnce(client,userId,{type:"fitness",title:"Weekly fitness target needs attention",body:String(target.activity_type),severity:"attention",dedupeKey:`fitness:${target.id}:${today.slice(0,7)}`});for(const item of integrations.data??[])await notifyOnce(client,userId,{type:"integrations",title:"Reconnect required",body:`${item.provider} needs attention.`,entityType:"integration",entityId:String(item.id),severity:"important",dedupeKey:`integration:${item.id}:${item.status}`});for(const item of automations.data??[])await notifyOnce(client,userId,{type:"automations",title:"Automation failed",body:String(item.name),entityType:"automation",entityId:String(item.id),severity:"important",dedupeKey:`automation:${item.id}:${item.last_status}`});for(const conflict of conflicts.data??[])await notifyOnce(client,userId,{type:"calendar",title:"Calendar conflict needs review",body:"A Calendar event changed and needs your decision.",entityType:"calendar_event",entityId:String(conflict.calendar_event_id),severity:"important",dedupeKey:`calendar-conflict:${conflict.calendar_event_id}:${conflict.conflict_type}`});await emitFounderOperationalHooks(client,userId,today);await emitLifeNotifications(client,userId,today);await emitKnowledgeNotifications(client,userId,today);await emitGrowthNotifications(client,userId,today);
}

export async function emitLifeNotifications(client: SupabaseClient, userId: string, today = new Date().toISOString().slice(0, 10)) {
  const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const [trips, visas, documents, renewals, admin] = await Promise.all([
    client.from("trips").select("id,title,start_date,status,updated_at").eq("user_id", userId).is("archived_at", null).not("status", "in", "(completed,canceled)").lte("start_date", week),
    client.from("visa_applications").select("id,country,status,appointment_date,updated_at").eq("user_id", userId).in("status", ["preparing", "appointment_booked", "submitted", "additional_documents_requested"]),
    client.from("personal_documents").select("id,label,expires_at").eq("user_id", userId).is("archived_at", null).not("expires_at", "is", null).lte("expires_at", week),
    client.from("personal_renewals").select("id,title,due_date,lead_time_days,status").eq("user_id", userId).not("status", "in", "(renewed,canceled)"),
    client.from("personal_admin_items").select("id,title,due_date,status").eq("user_id", userId).not("status", "in", "(completed,canceled)").lt("due_date", today),
  ]); const failed = [trips, visas, documents, renewals, admin].find((result) => result.error); if (failed?.error) throw failed.error;
  for (const trip of trips.data ?? []) await notifyOnce(client, userId, { type: "calendar", title: "Trip approaching", body: `${trip.title} starts ${trip.start_date}.`, entityType: "trip", entityId: trip.id, severity: "attention", dedupeKey: `life:trip:${trip.id}:${trip.start_date}`, cooldownHours: 168 });
  for (const visa of visas.data ?? []) if (visa.appointment_date && visa.appointment_date <= week) await notifyOnce(client, userId, { type: "calendar", title: "Visa appointment needs preparation", body: `${visa.country} appointment is ${visa.appointment_date}.`, entityType: "visa", entityId: visa.id, severity: "important", dedupeKey: `life:visa:${visa.id}:${visa.appointment_date}:${visa.status}`, cooldownHours: 72 });
  for (const document of documents.data ?? []) await notifyOnce(client, userId, { type: "calendar", title: "Personal document expires soon", body: `${document.label} expires ${document.expires_at}.`, entityType: "personal_document", entityId: document.id, severity: "important", dedupeKey: `life:document:${document.id}:${document.expires_at}`, cooldownHours: 168 });
  for (const renewal of renewals.data ?? []) if (renewal.due_date && renewal.due_date <= new Date(Date.now() + Number(renewal.lead_time_days ?? 30) * 86_400_000).toISOString().slice(0, 10)) await notifyOnce(client, userId, { type: "calendar", title: "Personal renewal needs attention", body: `${renewal.title} is due ${renewal.due_date}.`, entityType: "renewal", entityId: renewal.id, severity: "attention", dedupeKey: `life:renewal:${renewal.id}:${renewal.due_date}`, cooldownHours: 168 });
  for (const item of admin.data ?? []) await notifyOnce(client, userId, { type: "tasks", title: "Personal admin is overdue", body: item.title, entityType: "personal_admin", entityId: item.id, severity: "important", dedupeKey: `life:admin:${item.id}:${item.due_date}`, cooldownHours: 72 });
  const [canceledTrips, closedRenewals, closedAdmin] = await Promise.all([
    client.from("trips").select("id").eq("user_id", userId).eq("status", "canceled"),
    client.from("personal_renewals").select("id").eq("user_id", userId).in("status", ["renewed", "canceled"]),
    client.from("personal_admin_items").select("id").eq("user_id", userId).in("status", ["completed", "canceled"]),
  ]);
  const resolutionFailure = [canceledTrips, closedRenewals, closedAdmin].find((result) => result.error); if (resolutionFailure?.error) throw resolutionFailure.error;
  for (const trip of canceledTrips.data ?? []) await resolveNotifications(client, userId, `life:trip:${trip.id}:`);
  for (const renewal of closedRenewals.data ?? []) await resolveNotifications(client, userId, `life:renewal:${renewal.id}:`);
  for (const item of closedAdmin.data ?? []) await resolveNotifications(client, userId, `life:admin:${item.id}:`);
}

export async function emitFounderOperationalHooks(client: SupabaseClient, userId: string, today = new Date().toISOString().slice(0, 10)) {
  const company = await client.from("companies").select("id").eq("user_id", userId).eq("active", true).maybeSingle();
  if (company.error) throw company.error;
  if (!company.data) return;
  const companyId = company.data.id;
  const [products, inventory, deployments, incidents, supplierOrders, currentOrders, previousOrders] = await Promise.all([
    client.from("product_catalog_refs").select("id,name").eq("user_id", userId).eq("company_id", companyId).eq("active", true),
    client.from("inventory_snapshots").select("id,product_id,available_stock,reorder_level,captured_at").eq("user_id", userId).eq("company_id", companyId).order("captured_at", { ascending: false }).limit(500),
    client.from("deployment_records").select("id,status,environment,completed_at,external_id").eq("user_id", userId).eq("company_id", companyId).eq("environment", "production").order("completed_at", { ascending: false }).limit(30),
    client.from("incidents").select("id,title,severity,status,updated_at").eq("user_id", userId).eq("company_id", companyId).in("severity", ["major", "critical"]).neq("status", "resolved"),
    client.from("supplier_orders").select("id,reference,status,expected_at,updated_at").eq("user_id", userId).eq("company_id", companyId).in("status", ["ordered", "partially_received"]).lt("expected_at", today),
    client.from("commerce_orders").select("id,status").eq("user_id", userId).eq("company_id", companyId).gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
    client.from("commerce_orders").select("id,status").eq("user_id", userId).eq("company_id", companyId).gte("created_at", new Date(Date.now() - 14 * 86_400_000).toISOString()).lt("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
  ]);
  const failed = [products, inventory, deployments, incidents, supplierOrders, currentOrders, previousOrders].find((result) => result.error);
  if (failed?.error) throw failed.error;
  const latest = new Map<string, { id: string; available_stock: number | string | null; reorder_level: number | string | null; captured_at: string }>();
  for (const row of inventory.data ?? []) if (!latest.has(row.product_id)) latest.set(row.product_id, row);
  const productsById = new Map((products.data ?? []).map((product) => [product.id, product]));
  const lowProductIds = new Set<string>();
  for (const [productId, snapshot] of latest) {
    if (snapshot.available_stock == null || snapshot.reorder_level == null || Number(snapshot.available_stock) > Number(snapshot.reorder_level)) continue;
    const key = `founder:low-stock:${productId}:${snapshot.id}`; lowProductIds.add(productId);
    await notifyOnce(client, userId, { type: "automations", title: "Low stock needs attention", body: `${productsById.get(productId)?.name ?? "Product"} is at or below its reorder level.`, entityType: "product", entityId: productId, severity: "important", dedupeKey: key, cooldownHours: 168 });
  }
  for (const productId of productsById.keys()) if (!lowProductIds.has(productId)) await resolveNotifications(client, userId, `founder:low-stock:${productId}:`);
  const failedDeploymentIds = new Set<string>();
  for (const deployment of deployments.data ?? []) {
    if (deployment.status !== "failed") continue;
    failedDeploymentIds.add(deployment.id);
    await notifyOnce(client, userId, { type: "automations", title: "Production deployment failed", body: "A production deployment needs founder review.", entityType: "deployment", entityId: deployment.id, severity: "critical", dedupeKey: `founder:deployment:${deployment.id}:${deployment.external_id ?? deployment.status}`, cooldownHours: 168 });
  }
  for (const deployment of deployments.data ?? []) if (!failedDeploymentIds.has(deployment.id)) await resolveNotifications(client, userId, `founder:deployment:${deployment.id}:`);
  for (const incident of incidents.data ?? []) await notifyOnce(client, userId, { type: "automations", title: `${incident.severity === "critical" ? "Critical" : "Major"} incident is active`, body: incident.title, entityType: "incident", entityId: incident.id, severity: incident.severity === "critical" ? "critical" : "important", dedupeKey: `founder:incident:${incident.id}:${incident.updated_at}`, cooldownHours: 24 });
  for (const order of supplierOrders.data ?? []) await notifyOnce(client, userId, { type: "automations", title: "Supplier delivery overdue", body: order.reference ?? "A supplier order is past its expected date.", entityType: "supplier_order", entityId: order.id, severity: "important", dedupeKey: `founder:supplier-overdue:${order.id}:${order.expected_at}`, cooldownHours: 72 });
  const cancellationRate = (orders: Array<{ status: string }>) => orders.length ? orders.filter((order) => order.status === "canceled").length / orders.length : 0;
  const current = currentOrders.data ?? []; const previous = previousOrders.data ?? [];
  if (current.length >= 10 && cancellationRate(current) >= 0.25 && cancellationRate(current) >= cancellationRate(previous) + 0.15) await notifyOnce(client, userId, { type: "automations", title: "Commerce cancellation rate changed", body: "Recent confirmed commerce data shows a meaningful cancellation increase.", severity: "important", dedupeKey: `founder:commerce-anomaly:${today}`, cooldownHours: 168 });
}

export async function emitKnowledgeNotifications(client: SupabaseClient, userId: string, today = new Date().toISOString().slice(0, 10)) {
  const [topics, sources, watches] = await Promise.all([
    client.from("research_topics").select("id,title,next_review_at,status").eq("user_id", userId).neq("status", "archived").not("next_review_at", "is", null).lte("next_review_at", today),
    client.from("knowledge_sources").select("id,title,freshness_expires_at").eq("user_id", userId).not("freshness_expires_at", "is", null).lt("freshness_expires_at", today),
    client.from("watch_entities").select("id,name,next_check_at,status").eq("user_id", userId).eq("status", "active").not("next_check_at", "is", null).lte("next_check_at", today),
  ]);
  const failed = [topics, sources, watches].find((result) => result.error);
  if (failed?.error) throw failed.error;

  for (const topic of topics.data ?? []) {
    await notifyOnce(client, userId, {
      type: "decisions",
      title: "Research topic review due",
      body: `${topic.title} is scheduled for review.`,
      entityType: "research_topic",
      entityId: topic.id,
      severity: "attention",
      dedupeKey: `knowledge:topic-review:${topic.id}:${topic.next_review_at}`,
      cooldownHours: 72,
    });
  }

  for (const source of sources.data ?? []) {
    await notifyOnce(client, userId, {
      type: "decisions",
      title: "Knowledge source needs review",
      body: `${source.title} freshness has expired.`,
      entityType: "knowledge_source",
      entityId: source.id,
      severity: "attention",
      dedupeKey: `knowledge:source-stale:${source.id}:${source.freshness_expires_at}`,
      cooldownHours: 72,
    });
  }

  for (const watch of watches.data ?? []) {
    await notifyOnce(client, userId, {
      type: "automations",
      title: "Watchlist item review due",
      body: `${watch.name} is due for scheduled check.`,
      entityType: "watch_entity",
      entityId: watch.id,
      severity: "attention",
      dedupeKey: `knowledge:watch-due:${watch.id}:${watch.next_check_at}`,
      cooldownHours: 72,
    });
  }

  const [resolvedTopics, renewedSources, checkedWatches] = await Promise.all([
    client.from("research_topics").select("id,next_review_at").eq("user_id", userId).or(`next_review_at.gt.${today},status.eq.archived`),
    client.from("knowledge_sources").select("id,freshness_expires_at").eq("user_id", userId).gte("freshness_expires_at", today),
    client.from("watch_entities").select("id,next_check_at").eq("user_id", userId).or(`next_check_at.gt.${today},status.neq.active`),
  ]);
  const resFailed = [resolvedTopics, renewedSources, checkedWatches].find((result) => result.error);
  if (resFailed?.error) throw resFailed.error;

  for (const t of resolvedTopics.data ?? []) await resolveNotifications(client, userId, `knowledge:topic-review:${t.id}:`);
  for (const s of renewedSources.data ?? []) await resolveNotifications(client, userId, `knowledge:source-stale:${s.id}:`);
  for (const w of checkedWatches.data ?? []) await resolveNotifications(client, userId, `knowledge:watch-due:${w.id}:`);
}

export async function emitGrowthNotifications(client: SupabaseClient, userId: string, today = new Date().toISOString().slice(0, 10)) {
  const [oppsRes, proposalsRes, leadsRes, targetsRes, experimentsRes, playbooksRes] = await Promise.all([
    client.from("opportunities").select("id,title,stage,estimated_value,currency,expected_close_date,next_action,updated_at").eq("user_id", userId).is("archived_at", null).not("stage", "in", '("won","lost")'),
    client.from("proposals").select("id,title,valid_until,status,sent_at,total,currency").eq("user_id", userId).is("archived_at", null).eq("status", "sent"),
    client.from("leads").select("id,name,status,next_follow_up_at,potential_value,currency").eq("user_id", userId).is("archived_at", null),
    client.from("sales_targets").select("id,metric_type,target_value,current_value,period_end").eq("user_id", userId).gte("period_end", today),
    client.from("growth_experiments").select("id,name,end_date,status").eq("user_id", userId).eq("status", "running").not("end_date", "is", null).lte("end_date", today),
    client.from("playbook_runs").select("id,current_step,step_states,status").eq("user_id", userId).eq("status", "active"),
  ]);

  const failed = [oppsRes, proposalsRes, leadsRes, targetsRes, experimentsRes, playbooksRes].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const activeOppIdsWithNoAction = new Set<string>();
  const activeOppIdsAtRisk = new Set<string>();
  for (const opp of oppsRes.data ?? []) {
    const val = Number(opp.estimated_value ?? 0);
    if (!opp.next_action || !opp.next_action.trim()) {
      activeOppIdsWithNoAction.add(opp.id);
      await notifyOnce(client, userId, {
        type: "clients",
        title: "Opportunity has no next action",
        body: `${opp.title} (${val} ${opp.currency ?? "MAD"}) has no scheduled next sales action.`,
        entityType: "opportunity",
        entityId: opp.id,
        severity: val >= 20000 ? "important" : "attention",
        dedupeKey: `growth:no-next-action:${opp.id}`,
        cooldownHours: 72,
      });
    }

    const updated = opp.updated_at ? opp.updated_at.slice(0, 10) : today;
    const days = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${updated}T00:00:00Z`)) / 86400000);
    const overdueClose = opp.expected_close_date && opp.expected_close_date < today;
    if (overdueClose || days >= 30) {
      activeOppIdsAtRisk.add(opp.id);
      await notifyOnce(client, userId, {
        type: "clients",
        title: "High-value deal at risk",
        body: `${opp.title} (${val} ${opp.currency ?? "MAD"}) is stalled or past its close date.`,
        entityType: "opportunity",
        entityId: opp.id,
        severity: "important",
        dedupeKey: `growth:deal-risk:${opp.id}`,
        cooldownHours: 72,
      });
    }
  }

  const activeOverdueProposalIds = new Set<string>();
  for (const prop of proposalsRes.data ?? []) {
    if (prop.valid_until && prop.valid_until <= today) {
      activeOverdueProposalIds.add(prop.id);
      await notifyOnce(client, userId, {
        type: "finance",
        title: "Proposal follow-up overdue",
        body: `${prop.title} reached validity deadline without a confirmed client decision.`,
        entityType: "proposal",
        entityId: prop.id,
        severity: "important",
        dedupeKey: `growth:proposal-followup:${prop.id}`,
        cooldownHours: 72,
      });
    }
  }

  const activeOverdueLeadIds = new Set<string>();
  for (const lead of leadsRes.data ?? []) {
    if (lead.next_follow_up_at && lead.next_follow_up_at.slice(0, 10) < today && !["lost", "unqualified", "converted"].includes(lead.status)) {
      activeOverdueLeadIds.add(lead.id);
      await notifyOnce(client, userId, {
        type: "clients",
        title: "Lead follow-up overdue",
        body: `${lead.name} follow-up was scheduled for ${lead.next_follow_up_at.slice(0, 10)}.`,
        entityType: "lead",
        entityId: lead.id,
        severity: "attention",
        dedupeKey: `growth:lead-followup:${lead.id}`,
        cooldownHours: 72,
      });
    }
  }

  for (const exp of experimentsRes.data ?? []) {
    await notifyOnce(client, userId, {
      type: "automations",
      title: "Sales experiment ending",
      body: `${exp.name} reached its end date. Record results and learnings.`,
      entityType: "growth_experiment",
      entityId: exp.id,
      severity: "attention",
      dedupeKey: `growth:experiment-ending:${exp.id}`,
      cooldownHours: 72,
    });
  }

  for (const run of playbooksRes.data ?? []) {
    const states = (run.step_states as Array<Record<string, unknown>>) ?? [];
    const step = states[run.current_step];
    if (step && step.status === "active") {
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Playbook step pending",
        body: `Step ${run.current_step + 1}: ${step.title ?? "Action required"}`,
        entityType: "playbook_run",
        entityId: run.id,
        severity: "attention",
        dedupeKey: `growth:playbook-step:${run.id}:${run.current_step}`,
        cooldownHours: 48,
      });
    }
  }

  // Clear resolved notifications
  for (const opp of oppsRes.data ?? []) {
    if (!activeOppIdsWithNoAction.has(opp.id)) {
      await resolveNotifications(client, userId, `growth:no-next-action:${opp.id}`);
    }
    if (!activeOppIdsAtRisk.has(opp.id)) {
      await resolveNotifications(client, userId, `growth:deal-risk:${opp.id}`);
    }
  }
  for (const prop of proposalsRes.data ?? []) {
    if (!activeOverdueProposalIds.has(prop.id)) {
      await resolveNotifications(client, userId, `growth:proposal-followup:${prop.id}`);
    }
  }
  for (const lead of leadsRes.data ?? []) {
    if (!activeOverdueLeadIds.has(lead.id)) {
      await resolveNotifications(client, userId, `growth:lead-followup:${lead.id}`);
    }
  }
}
