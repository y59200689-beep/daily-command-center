import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyOnce, resolveNotifications } from "@/lib/v4-notifications";
export async function emitWorkspaceNotifications(client:SupabaseClient,userId:string){const today=new Date().toISOString().slice(0,10);const soon=new Date(Date.now()+35*60_000).toISOString();const week=new Date(Date.now()+7*86400_000).toISOString().slice(0,10);const [tasks,events,threads,followups,invoices,subs,content,decisions,fitness,integrations,automations,conflicts]=await Promise.all([client.from("tasks").select("id,title,due_date,priority").eq("user_id",userId).is("deleted_at",null).in("status",["inbox","planned","in_progress"]).lte("due_date",week),client.from("calendar_events").select("id,title,starts_at").eq("user_id",userId).is("deleted_at",null).gte("starts_at",new Date().toISOString()).lte("starts_at",soon),client.from("email_threads").select("id,subject,reply_state,metadata").eq("user_id",userId).eq("reply_state","awaiting_user_reply"),client.from("followups").select("id,title,due_at").eq("user_id",userId).eq("status","open").lte("due_at",soon),client.from("invoices").select("id,invoice_number,due_date").eq("user_id",userId).is("deleted_at",null).in("status",["sent","partial"]).lt("due_date",today),client.from("subscriptions").select("id,name,next_billing_date").eq("user_id",userId).is("deleted_at",null).eq("status","active").lte("next_billing_date",week),client.from("content_items").select("id,title,due_date,approval_status").eq("user_id",userId).is("deleted_at",null).lte("due_date",week),client.from("decisions").select("id,title,review_date").eq("user_id",userId).is("deleted_at",null).in("status",["active","review_due"]).lte("review_date",today),client.from("fitness_targets").select("id,activity_type,target_value,period").eq("user_id",userId).eq("active",true).eq("period","week"),client.from("integrations").select("id,provider,status,last_error").eq("user_id",userId).in("status",["expired","error"]),client.from("automations").select("id,name,last_status").eq("user_id",userId).eq("last_status","error"),client.from("calendar_event_sync_state").select("calendar_event_id,conflict_type").eq("user_id",userId).not("conflict_type","is",null)]);const failed=[tasks,events,threads,followups,invoices,subs,content,decisions,fitness,integrations,automations,conflicts].find(x=>x.error);if(failed?.error)throw failed.error;
for(const task of tasks.data??[]){const overdue=task.due_date&&task.due_date<today;if(overdue&&["high","urgent"].includes(String(task.priority)))await notifyOnce(client,userId,{type:"tasks",title:"High-priority task overdue",body:String(task.title),entityType:"task",entityId:String(task.id),severity:"important",dedupeKey:`task:overdue:${task.id}`});else if(task.due_date===today)await notifyOnce(client,userId,{type:"tasks",title:"Task deadline today",body:String(task.title),entityType:"task",entityId:String(task.id),severity:"attention",dedupeKey:`task:today:${task.id}`})}
for(const event of events.data??[])await notifyOnce(client,userId,{type:"calendar",title:"Meeting starts soon",body:`${event.title} starts within 35 minutes.`,entityType:"calendar_event",entityId:String(event.id),severity:"important",dedupeKey:`meeting:${event.id}:${event.starts_at}`});
for(const thread of threads.data??[]){const metadata=thread.metadata as Record<string,unknown>|null;if(!metadata?.handled_at)await notifyOnce(client,userId,{type:"clients",title:"Client reply needs attention",body:String(thread.subject),entityType:"client",severity:"important",dedupeKey:`reply:${thread.id}:${metadata?.latest_message_id??"latest"}`})}
for(const followup of followups.data??[])await notifyOnce(client,userId,{type:"clients",title:"Follow-up due",body:String(followup.title),entityType:"followup",entityId:String(followup.id),severity:"important",dedupeKey:`followup:${followup.id}:${followup.due_at}`});
for(const invoice of invoices.data??[])await notifyOnce(client,userId,{type:"finance",title:"Invoice overdue",body:`${invoice.invoice_number??"Invoice"} is overdue.`,entityType:"invoice",entityId:String(invoice.id),severity:"important",dedupeKey:`invoice:overdue:${invoice.id}`});for(const sub of subs.data??[])await notifyOnce(client,userId,{type:"finance",title:"Subscription renewal soon",body:String(sub.name),entityType:"subscription",entityId:String(sub.id),severity:"attention",dedupeKey:`subscription:${sub.id}:${sub.next_billing_date}`});
for(const item of content.data??[]){if(item.approval_status==="pending"&&item.due_date&&item.due_date<today)await notifyOnce(client,userId,{type:"content",title:"Content approval overdue",body:String(item.title),entityType:"content",entityId:String(item.id),severity:"important",dedupeKey:`content:approval:${item.id}`});else if(item.due_date===today)await notifyOnce(client,userId,{type:"content",title:"Content deadline today",body:String(item.title),entityType:"content",entityId:String(item.id),severity:"attention",dedupeKey:`content:deadline:${item.id}:${item.due_date}`})}for(const decision of decisions.data??[])await notifyOnce(client,userId,{type:"decisions",title:"Decision review due",body:String(decision.title),entityType:"decision",entityId:String(decision.id),severity:"attention",dedupeKey:`decision:${decision.id}:${decision.review_date}`});for(const target of fitness.data??[])await notifyOnce(client,userId,{type:"fitness",title:"Weekly fitness target needs attention",body:String(target.activity_type),severity:"attention",dedupeKey:`fitness:${target.id}:${today.slice(0,7)}`});for(const item of integrations.data??[])await notifyOnce(client,userId,{type:"integrations",title:"Reconnect required",body:`${item.provider} needs attention.`,entityType:"integration",entityId:String(item.id),severity:"important",dedupeKey:`integration:${item.id}:${item.status}`});for(const item of automations.data??[])await notifyOnce(client,userId,{type:"automations",title:"Automation failed",body:String(item.name),entityType:"automation",entityId:String(item.id),severity:"important",dedupeKey:`automation:${item.id}:${item.last_status}`});for(const conflict of conflicts.data??[])await notifyOnce(client,userId,{type:"calendar",title:"Calendar conflict needs review",body:"A Calendar event changed and needs your decision.",entityType:"calendar_event",entityId:String(conflict.calendar_event_id),severity:"important",dedupeKey:`calendar-conflict:${conflict.calendar_event_id}:${conflict.conflict_type}`});await emitFounderOperationalHooks(client,userId,today);await emitLifeNotifications(client,userId,today);await emitKnowledgeNotifications(client,userId,today);await emitGrowthNotifications(client,userId,today);await emitOperationsNotifications(client,userId,today);await emitTeamNotifications(client,userId,today);await emitCustomerSuccessNotifications(client,userId,today);await emitCommerceNotifications(client,userId,today);await emitExecutiveNotifications(client,userId,today);
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

export async function emitOperationsNotifications(client: SupabaseClient, userId: string, today = new Date().toISOString().slice(0, 10)) {
  const [runsRes, sopsRes, incidentsRes, executionsRes, processesRes, failuresRes, tasksRes, systemsRes] = await Promise.all([
    client.from("process_runs").select("id,title,status,priority,due_at").eq("user_id", userId),
    client.from("operational_sops").select("id,title,status,next_review_at,review_cadence,criticality").eq("user_id", userId).neq("status", "archived"),
    client.from("quality_incidents").select("id,title,severity,status,corrective_task_id").eq("user_id", userId),
    client.from("quality_executions").select("id,status,run_id,quality_checks(name,severity_if_failed)").eq("user_id", userId).eq("status", "fail"),
    client.from("process_templates").select("id,name,default_frequency,status").eq("user_id", userId).eq("status", "active"),
    client.from("process_failures").select("id,run_id,failure_type,process_runs(process_template_id)").eq("user_id", userId),
    client.from("tasks").select("id,due_date,status").eq("user_id", userId).is("deleted_at", null),
    client.from("operational_systems").select("id,name,status,criticality").eq("user_id", userId),
  ]);

  const failed = [runsRes, sopsRes, incidentsRes, executionsRes, processesRes, failuresRes, tasksRes, systemsRes].find(r => r.error);
  if (failed?.error) return;

  const runs = (runsRes.data ?? []) as Array<{ id: string; title: string; status: string; priority: string; due_at?: string | null }>;
  const sops = (sopsRes.data ?? []) as Array<{ id: string; title: string; status: string; next_review_at?: string | null; review_cadence?: string | null; criticality: string }>;
  const incidents = (incidentsRes.data ?? []) as Array<{ id: string; title: string; severity: string; status: string; corrective_task_id?: string | null }>;
  const executions = (executionsRes.data ?? []) as unknown as Array<{ id: string; status: string; run_id: string; quality_checks?: { name: string; severity_if_failed?: string } | null }>;
  const processes = (processesRes.data ?? []) as Array<{ id: string; name: string; default_frequency?: string | null; status: string }>;
  const failures = (failuresRes.data ?? []) as Array<{ id: string; run_id: string; failure_type: string; process_runs?: { process_template_id?: string } | null }>;
  const tasks = (tasksRes.data ?? []) as Array<{ id: string; due_date?: string | null; status: string }>;
  const systems = (systemsRes.data ?? []) as Array<{ id: string; name: string; status: string; criticality: string }>;

  const activeOverdueRunIds = new Set<string>();
  const activeBlockedRunIds = new Set<string>();
  const activeFailedRunIds = new Set<string>();

  for (const run of runs) {
    if (run.status === "failed") {
      activeFailedRunIds.add(run.id);
      await notifyOnce(client, userId, {
        type: "automations",
        title: "Process run failed",
        body: `Run "${run.title}" encountered a failure.`,
        entityType: "process_run",
        entityId: run.id,
        severity: run.priority === "critical" ? "critical" : "important",
        dedupeKey: `operations:run-failed:${run.id}`,
        cooldownHours: 24,
      });
    } else if (run.status === "blocked") {
      activeBlockedRunIds.add(run.id);
      await notifyOnce(client, userId, {
        type: "automations",
        title: "Process run blocked",
        body: `Run "${run.title}" is currently blocked.`,
        entityType: "process_run",
        entityId: run.id,
        severity: run.priority === "critical" ? "critical" : "important",
        dedupeKey: `operations:run-blocked:${run.id}`,
        cooldownHours: 24,
      });
    } else if (["planned", "ready", "in_progress"].includes(run.status) && run.due_at && run.due_at.slice(0, 10) < today) {
      activeOverdueRunIds.add(run.id);
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Process run overdue",
        body: `Run "${run.title}" was due on ${run.due_at.slice(0, 10)}.`,
        entityType: "process_run",
        entityId: run.id,
        severity: run.priority === "critical" ? "critical" : "important",
        dedupeKey: `operations:run-overdue:${run.id}`,
        cooldownHours: 24,
      });
    }
  }

  for (const exec of executions) {
    const qc = exec.quality_checks;
    if (qc?.severity_if_failed === "critical" || qc?.severity_if_failed === "high") {
      await notifyOnce(client, userId, {
        type: "automations",
        title: "Critical quality check failed",
        body: `Quality check "${qc.name}" failed verification.`,
        entityType: "quality_execution",
        entityId: exec.id,
        severity: "critical",
        dedupeKey: `operations:quality-failed:${exec.id}`,
        cooldownHours: 24,
      });
    }
  }

  const activeIncidentIds = new Set<string>();
  for (const inc of incidents) {
    if (!["resolved", "archived"].includes(inc.status)) {
      activeIncidentIds.add(inc.id);
      await notifyOnce(client, userId, {
        type: "automations",
        title: "Quality incident open",
        body: `Incident "${inc.title}" is ${inc.status}.`,
        entityType: "quality_incident",
        entityId: inc.id,
        severity: inc.severity === "critical" ? "critical" : "important",
        dedupeKey: `operations:incident:${inc.id}`,
        cooldownHours: 24,
      });

      if (inc.corrective_task_id) {
        const linkedTask = tasks.find(t => t.id === inc.corrective_task_id);
        if (linkedTask && linkedTask.status !== "completed" && linkedTask.due_date && linkedTask.due_date < today) {
          await notifyOnce(client, userId, {
            type: "tasks",
            title: "Corrective action overdue",
            body: `Corrective task for incident "${inc.title}" is overdue.`,
            entityType: "task",
            entityId: linkedTask.id,
            severity: "important",
            dedupeKey: `operations:corrective-action:${inc.id}:${linkedTask.id}`,
            cooldownHours: 24,
          });
        }
      }
    }
  }

  const activeSopReviewIds = new Set<string>();
  for (const sop of sops) {
    if (sop.next_review_at && sop.next_review_at <= today && sop.review_cadence !== "none") {
      activeSopReviewIds.add(sop.id);
      await notifyOnce(client, userId, {
        type: "automations",
        title: "SOP review due",
        body: `SOP "${sop.title}" is due for scheduled review.`,
        entityType: "operational_sop",
        entityId: sop.id,
        severity: sop.criticality === "critical" ? "critical" : "attention",
        dedupeKey: `operations:sop-review:${sop.id}`,
        cooldownHours: 72,
      });
    }
  }

  const processFailureCounts = new Map<string, number>();
  for (const f of failures) {
    const pId = f.process_runs?.process_template_id;
    if (pId) {
      processFailureCounts.set(pId, (processFailureCounts.get(pId) ?? 0) + 1);
    }
  }
  for (const [pId, count] of processFailureCounts.entries()) {
    if (count >= 3) {
      const proc = processes.find(p => p.id === pId);
      await notifyOnce(client, userId, {
        type: "automations",
        title: "Process repeatedly failing",
        body: `Process "${proc?.name ?? "Template"}" has failed ${count} times recently.`,
        entityType: "process_template",
        entityId: pId,
        severity: "important",
        dedupeKey: `operations:repeated-failure:${pId}`,
        cooldownHours: 72,
      });
    }
  }

  for (const sys of systems) {
    if (sys.criticality === "critical" && (sys.status === "unavailable" || sys.status === "degraded")) {
      await notifyOnce(client, userId, {
        type: "automations",
        title: "Critical system unavailable",
        body: `System "${sys.name}" is marked as ${sys.status}.`,
        entityType: "operational_system",
        entityId: sys.id,
        severity: "critical",
        dedupeKey: `operations:system:${sys.id}`,
        cooldownHours: 24,
      });
    } else {
      await resolveNotifications(client, userId, `operations:system:${sys.id}`);
    }
  }

  for (const run of runs) {
    if (!activeFailedRunIds.has(run.id)) await resolveNotifications(client, userId, `operations:run-failed:${run.id}`);
    if (!activeBlockedRunIds.has(run.id)) await resolveNotifications(client, userId, `operations:run-blocked:${run.id}`);
    if (!activeOverdueRunIds.has(run.id)) await resolveNotifications(client, userId, `operations:run-overdue:${run.id}`);
  }
  for (const inc of incidents) {
    if (!activeIncidentIds.has(inc.id)) {
      await resolveNotifications(client, userId, `operations:incident:${inc.id}`);
      if (inc.corrective_task_id) {
        await resolveNotifications(client, userId, `operations:corrective-action:${inc.id}:${inc.corrective_task_id}`);
      }
    }
  }
  for (const sop of sops) {
    if (!activeSopReviewIds.has(sop.id)) await resolveNotifications(client, userId, `operations:sop-review:${sop.id}`);
  }
}

export async function emitTeamNotifications(client: SupabaseClient, userId: string, today = new Date().toISOString().slice(0, 10)) {
  const [delsRes, respsRes, escsRes, handoffsRes] = await Promise.all([
    client.from("team_delegations").select("id,title,priority,status,due_at,review_at,blocked_reason").eq("user_id", userId),
    client.from("team_responsibilities").select("id,name,criticality,status,primary_owner_id,backup_owner_id").eq("user_id", userId).neq("status", "archived"),
    client.from("team_escalations").select("id,reason,severity,status").eq("user_id", userId),
    client.from("operational_handoffs").select("id,accepted,expected_handoff_time,handoff_description").eq("user_id", userId),
  ]);

  const delegations = delsRes.data ?? [];
  const responsibilities = respsRes.data ?? [];
  const escalations = escsRes.data ?? [];
  const handoffs = handoffsRes.data ?? [];

  const activeOverdueDelIds = new Set<string>();
  const activeBlockedDelIds = new Set<string>();
  const activeReviewDueDelIds = new Set<string>();
  const activeOwnerGapIds = new Set<string>();
  const activeBackupGapIds = new Set<string>();
  const activeEscalationIds = new Set<string>();
  const activeHandoffOverdueIds = new Set<string>();

  // 1. Delegations
  for (const d of delegations) {
    const isCompleted = ["completed", "cancelled"].includes(d.status);

    if (!isCompleted && d.due_at && d.due_at.slice(0, 10) < today) {
      activeOverdueDelIds.add(d.id);
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Delegation overdue",
        body: `Delegated outcome "${d.title}" missed target due date (${d.due_at.slice(0, 10)}).`,
        entityType: "team_delegation",
        entityId: d.id,
        severity: d.priority === "critical" ? "critical" : "important",
        dedupeKey: `team:delegation-overdue:${d.id}`,
        cooldownHours: 24,
      });
    }

    if (!isCompleted && d.status === "blocked") {
      activeBlockedDelIds.add(d.id);
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Delegation blocked",
        body: `Delegation "${d.title}" is blocked: ${d.blocked_reason || "needs unblocking"}.`,
        entityType: "team_delegation",
        entityId: d.id,
        severity: "critical",
        dedupeKey: `team:delegation-blocked:${d.id}`,
        cooldownHours: 12,
      });
    }

    if (!isCompleted && d.review_at && d.review_at.slice(0, 10) <= today) {
      activeReviewDueDelIds.add(d.id);
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Delegation review due",
        body: `Scheduled review date reached for "${d.title}".`,
        entityType: "team_delegation",
        entityId: d.id,
        severity: "attention",
        dedupeKey: `team:delegation-review:${d.id}`,
        cooldownHours: 24,
      });
    }
  }

  // 2. Responsibilities
  for (const r of responsibilities) {
    if (!r.primary_owner_id || r.status === "needs_owner") {
      activeOwnerGapIds.add(r.id);
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Responsibility has no primary owner",
        body: `Area "${r.name}" is active without an accountable owner.`,
        entityType: "team_responsibility",
        entityId: r.id,
        severity: r.criticality === "critical" ? "critical" : "important",
        dedupeKey: `team:owner-gap:${r.id}`,
        cooldownHours: 48,
      });
    }

    if ((r.criticality === "critical" || r.criticality === "high") && (!r.backup_owner_id || r.backup_owner_id === r.primary_owner_id)) {
      activeBackupGapIds.add(r.id);
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Single-owner dependency",
        body: `Critical area "${r.name}" has no backup owner.`,
        entityType: "team_responsibility",
        entityId: r.id,
        severity: "attention",
        dedupeKey: `team:backup-gap:${r.id}`,
        cooldownHours: 72,
      });
    }
  }

  // 3. Escalations
  for (const e of escalations) {
    if (e.status === "open") {
      activeEscalationIds.add(e.id);
      await notifyOnce(client, userId, {
        type: "automations",
        title: "Team escalation open",
        body: e.reason,
        entityType: "team_escalation",
        entityId: e.id,
        severity: e.severity === "critical" ? "critical" : "important",
        dedupeKey: `team:escalation:${e.id}`,
        cooldownHours: 12,
      });
    }
  }

  // 4. Overdue Handoffs
  for (const h of handoffs) {
    if (!h.accepted && h.expected_handoff_time && h.expected_handoff_time < new Date().toISOString()) {
      activeHandoffOverdueIds.add(h.id);
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Operational handoff overdue",
        body: `Handoff "${h.handoff_description || "transfer"}" is pending acceptance.`,
        entityType: "operational_handoff",
        entityId: h.id,
        severity: "important",
        dedupeKey: `team:handoff-overdue:${h.id}`,
        cooldownHours: 24,
      });
    }
  }

  // Clear resolved notifications
  for (const d of delegations) {
    if (!activeOverdueDelIds.has(d.id)) await resolveNotifications(client, userId, `team:delegation-overdue:${d.id}`);
    if (!activeBlockedDelIds.has(d.id)) await resolveNotifications(client, userId, `team:delegation-blocked:${d.id}`);
    if (!activeReviewDueDelIds.has(d.id)) await resolveNotifications(client, userId, `team:delegation-review:${d.id}`);
  }
  for (const r of responsibilities) {
    if (!activeOwnerGapIds.has(r.id)) await resolveNotifications(client, userId, `team:owner-gap:${r.id}`);
    if (!activeBackupGapIds.has(r.id)) await resolveNotifications(client, userId, `team:backup-gap:${r.id}`);
  }
  for (const e of escalations) {
    if (!activeEscalationIds.has(e.id)) await resolveNotifications(client, userId, `team:escalation:${e.id}`);
  }
  for (const h of handoffs) {
    if (!activeHandoffOverdueIds.has(h.id)) await resolveNotifications(client, userId, `team:handoff-overdue:${h.id}`);
  }
}

export async function emitCustomerSuccessNotifications(client: SupabaseClient, userId: string, today = new Date().toISOString().slice(0, 10)) {
  const thirtyDaysOut = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [risksRes, renewalsRes, commitmentsRes, issuesRes] = await Promise.all([
    client.from("client_risks").select("id, client_id, risk_type, severity, description, status").eq("user_id", userId).in("status", ["open", "mitigating"]).in("severity", ["critical", "high"]),
    client.from("client_renewals").select("id, client_id, renewal_date, status, preparation_state, forecast_category").eq("user_id", userId).in("status", ["upcoming", "preparing"]).lte("renewal_date", thirtyDaysOut),
    client.from("client_commitments").select("id, client_id, direction, statement, due_at, status").eq("user_id", userId).eq("status", "open").eq("direction", "we_owe_client").lt("due_at", today),
    client.from("client_issues").select("id, client_id, title, severity, status").eq("user_id", userId).in("status", ["open", "investigating", "waiting_on_us"]).eq("severity", "critical"),
  ]);

  const failure = [risksRes, renewalsRes, commitmentsRes, issuesRes].find((r) => r.error);
  if (failure?.error) throw failure.error;

  const risks = risksRes.data ?? [];
  const renewals = renewalsRes.data ?? [];
  const commitments = commitmentsRes.data ?? [];
  const issues = issuesRes.data ?? [];

  const activeRiskIds = new Set<string>();
  const activeRenewalIds = new Set<string>();
  const activeCommitmentIds = new Set<string>();
  const activeIssueIds = new Set<string>();

  // 1. Critical and high client risks
  for (const r of risks) {
    activeRiskIds.add(r.id);
    await notifyOnce(client, userId, {
      type: "clients",
      title: `${r.severity === "critical" ? "Critical" : "High"} client risk`,
      body: r.description,
      entityType: "client_risk",
      entityId: r.id,
      severity: r.severity === "critical" ? "critical" : "important",
      dedupeKey: `success:risk:${r.id}`,
      cooldownHours: 24,
    });
  }

  // 2. Upcoming renewals needing preparation
  for (const ren of renewals) {
    if (ren.preparation_state === "not_started") {
      activeRenewalIds.add(ren.id);
      await notifyOnce(client, userId, {
        type: "clients",
        title: "Client renewal approaching",
        body: `Renewal due ${ren.renewal_date} has not started preparation.`,
        entityType: "client_renewal",
        entityId: ren.id,
        severity: "important",
        dedupeKey: `success:renewal:${ren.id}`,
        cooldownHours: 72,
      });
    }
  }

  // 3. Overdue commitments owed to clients
  for (const c of commitments) {
    activeCommitmentIds.add(c.id);
    await notifyOnce(client, userId, {
      type: "tasks",
      title: "Client commitment overdue",
      body: `Overdue promise owed to client: ${c.statement}`,
      entityType: "client_commitment",
      entityId: c.id,
      severity: "important",
      dedupeKey: `success:commitment-overdue:${c.id}`,
      cooldownHours: 24,
    });
  }

  // 4. Critical client issues
  for (const issue of issues) {
    activeIssueIds.add(issue.id);
    await notifyOnce(client, userId, {
      type: "clients",
      title: "Critical client issue open",
      body: issue.title,
      entityType: "client_issue",
      entityId: issue.id,
      severity: "critical",
      dedupeKey: `success:issue-critical:${issue.id}`,
      cooldownHours: 12,
    });
  }

  // Clear resolved
  for (const r of risks) {
    if (!activeRiskIds.has(r.id)) await resolveNotifications(client, userId, `success:risk:${r.id}`);
  }
  for (const ren of renewals) {
    if (!activeRenewalIds.has(ren.id)) await resolveNotifications(client, userId, `success:renewal:${ren.id}`);
  }
  for (const c of commitments) {
    if (!activeCommitmentIds.has(c.id)) await resolveNotifications(client, userId, `success:commitment-overdue:${c.id}`);
  }
  for (const issue of issues) {
    if (!activeIssueIds.has(issue.id)) await resolveNotifications(client, userId, `success:issue-critical:${issue.id}`);
  }
}

export async function emitCommerceNotifications(client: SupabaseClient, userId: string, today = new Date().toISOString().slice(0, 10)) {
  const company = await client.from("companies").select("id").eq("user_id", userId).eq("active", true).maybeSingle();
  if (company.error || !company.data) return;
  const companyId = company.data.id;

  const [productsRes, snapshotsRes, supplierOrdersRes, discrepanciesRes] = await Promise.all([
    client.from("product_catalog_refs").select("id, name, sku, unit_cost, currency").eq("user_id", userId).eq("company_id", companyId).eq("active", true),
    client.from("inventory_snapshots").select("product_id, available_stock, captured_at").eq("user_id", userId).eq("company_id", companyId).order("captured_at", { ascending: false }).limit(200),
    client.from("supplier_orders").select("id, reference, expected_at, status").eq("user_id", userId).eq("company_id", companyId).in("status", ["ordered", "partially_received"]),
    client.from("inventory_discrepancies").select("id, product_id, discrepancy_units, cost_impact, currency, status").eq("user_id", userId).eq("company_id", companyId).eq("status", "investigating"),
  ]);

  if (productsRes.error || snapshotsRes.error || supplierOrdersRes.error || discrepanciesRes.error) return;

  const latestStock = new Map<string, number>();
  for (const s of snapshotsRes.data ?? []) {
    if (!latestStock.has(s.product_id)) latestStock.set(s.product_id, Number(s.available_stock) || 0);
  }

  // 1. Critical out of stock
  for (const p of productsRes.data ?? []) {
    const stock = latestStock.get(p.id) ?? 0;
    if (stock === 0) {
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Critical Stockout: Out of Stock",
        body: `${p.name} has 0 units available on hand. Immediate replenishment required.`,
        entityType: "product",
        entityId: p.id,
        severity: "critical",
        dedupeKey: `commerce:stockout:${p.id}`,
        cooldownHours: 24,
      });
    }
  }

  // 2. Late supplier orders
  const nowMs = new Date(today).getTime();
  for (const po of supplierOrdersRes.data ?? []) {
    if (po.expected_at) {
      const expMs = new Date(po.expected_at).getTime();
      if (!Number.isNaN(expMs) && nowMs > expMs) {
        const days = Math.max(1, Math.floor((nowMs - expMs) / 86400000));
        await notifyOnce(client, userId, {
          type: "tasks",
          title: "Late Supplier Purchase Order",
          body: `${po.reference || "PO #" + po.id.slice(0, 8)} is ${days} days overdue.`,
          entityType: "supplier_order",
          entityId: po.id,
          severity: "important",
          dedupeKey: `commerce:late-po:${po.id}`,
          cooldownHours: 24,
        });
      }
    }
  }

  // 3. Open count discrepancies
  for (const disc of discrepanciesRes.data ?? []) {
    if (disc.discrepancy_units !== 0) {
      await notifyOnce(client, userId, {
        type: "tasks",
        title: "Inventory Discrepancy Open",
        body: `Count variance of ${disc.discrepancy_units} units requires investigation.`,
        entityType: "inventory_discrepancy",
        entityId: disc.id,
        severity: "attention",
        dedupeKey: `commerce:discrepancy:${disc.id}`,
        cooldownHours: 48,
      });
    }
  }
}

export async function emitExecutiveNotifications(
  client: SupabaseClient,
  userId: string,
  today = new Date().toISOString().slice(0, 10)
) {
  // Critical overdue invoices signal
  const invoicesRes = await client
    .from("invoices")
    .select("id,invoice_number,amount_remaining,total_amount,due_date,currency")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["sent", "partial"])
    .lt("due_date", today)
    .limit(10);

  let totalOverdue = 0;
  for (const inv of invoicesRes.data ?? []) {
    const remaining = Number(inv.amount_remaining ?? inv.total_amount ?? 0);
    if (remaining > 0) totalOverdue += remaining;
  }

  if (totalOverdue > 50000) {
    await notifyOnce(client, userId, {
      type: "finance",
      title: "Executive Alert: High Overdue Receivables",
      body: `${totalOverdue.toLocaleString()} MAD in overdue invoices. Immediate follow-up required.`,
      entityType: "executive_signal",
      severity: "important",
      dedupeKey: `executive:overdue-receivables:${today}`,
      cooldownHours: 24,
    });
  }

  // Critical client risks
  const csRisksRes = await client
    .from("client_risks")
    .select("id,description,severity")
    .eq("user_id", userId)
    .eq("severity", "critical")
    .in("status", ["open", "mitigating"])
    .limit(5);

  for (const cr of csRisksRes.data ?? []) {
    await notifyOnce(client, userId, {
      type: "clients",
      title: "Executive Alert: Critical Client Risk",
      body: cr.description.slice(0, 80),
      entityType: "executive_signal",
      entityId: cr.id,
      severity: "important",
      dedupeKey: `executive:client-risk:${cr.id}:${today}`,
      cooldownHours: 48,
    });
  }

  // Team escalations
  const teamEscsRes = await client
    .from("team_escalations")
    .select("id,reason,severity")
    .eq("user_id", userId)
    .eq("severity", "critical")
    .in("status", ["open", "in_review"])
    .limit(5);

  for (const te of teamEscsRes.data ?? []) {
    await notifyOnce(client, userId, {
      type: "tasks",
      title: "Executive Alert: Critical Team Escalation",
      body: te.reason.slice(0, 80),
      entityType: "executive_signal",
      entityId: te.id,
      severity: "important",
      dedupeKey: `executive:team-escalation:${te.id}:${today}`,
      cooldownHours: 24,
    });
  }
}
