import type { SupabaseClient } from "@supabase/supabase-js";
import { validProviderToken } from "@/lib/integrations/tokens";
import { inferConservativeReplyState, normalizeEmail, normalizeParticipants, shouldReactivateHandled, stravaActivityType } from "@/lib/v4";
import type { Provider } from "@/lib/integrations/provider-registry";

async function request(url: string, token: string) { const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }); if (!response.ok) throw new Error("Provider sync could not be completed."); return response.json() as Promise<Record<string, unknown>>; }

export async function syncProvider(client: SupabaseClient, userId: string, provider: Exclude<Provider, "google">) {
  const { data: connection, error } = await client.from("integrations").select("id,provider_metadata,provider_email").eq("user_id", userId).eq("provider", provider).eq("status", "connected").maybeSingle();
  if (error) throw error; if (!connection) throw new Error("Connection needs attention.");
  await client.from("integrations").update({ sync_status: "syncing", last_error: null }).eq("id", connection.id).eq("user_id", userId);
  try { const token = await validProviderToken(client, userId, provider); let affected = 0;
    if (provider === "gmail") { const listing = await request("https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=50", token) as { threads?: Array<{ id: string; snippet?: string; historyId?: string }> }; for (const item of listing.threads ?? []) { const detail = await request(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(item.id)}?format=metadata`, token) as { snippet?: string; messages?: Array<{ id: string; internalDate?: string; payload?: { headers?: Array<{ name?: string; value?: string }> } }> }; const messages = detail.messages ?? []; const last = messages.at(-1); const headers = last?.payload?.headers ?? []; const headerValues = (message: typeof messages[number], name: string) => (message.payload?.headers ?? []).filter((header) => header.name?.toLowerCase() === name).map((header) => header.value ?? ""); const subject = headers.find((header) => header.name?.toLowerCase() === "subject")?.value ?? "Untitled thread"; const fromValues = messages.flatMap((message) => headerValues(message, "from")); const toValues = messages.flatMap((message) => headerValues(message, "to")); const ccValues = messages.flatMap((message) => headerValues(message, "cc")); const participants = normalizeParticipants([...fromValues, ...toValues, ...ccValues]); const latestFrom = headers.find((header) => header.name?.toLowerCase() === "from")?.value ?? ""; const latestSender = normalizeEmail(latestFrom); const userAddresses = normalizeParticipants([String(connection.provider_email ?? "")]); const automated = /(?:no-?reply|mailer-daemon|notification)@/i.test(latestSender ?? ""); const { data: existing } = await client.from("email_threads").select("metadata").eq("user_id", userId).eq("integration_id", connection.id).eq("provider_thread_id", item.id).maybeSingle(); const oldMetadata = (existing?.metadata as Record<string, unknown> | undefined) ?? {}; const replyState = inferConservativeReplyState({ latestFrom, userAddresses, participants, automated, ambiguous: !userAddresses.length }); const reactivate = shouldReactivateHandled({ handledMessageId: String(oldMetadata.handled_at_message_id ?? "") || null, latestMessageId: last?.id ?? null, latestFrom, userAddresses, automated }); const metadata = { ...oldMetadata, history_id: item.historyId ?? null, normalized_from: normalizeParticipants(fromValues), normalized_to: normalizeParticipants(toValues), normalized_cc: normalizeParticipants(ccValues), normalized_participants: participants, user_addresses: userAddresses, external_addresses: participants.filter((address) => !userAddresses.includes(address)), latest_message_id: last?.id ?? null, latest_message_at: last?.internalDate ? new Date(Number(last.internalDate)).toISOString() : null, latest_sender_address: latestSender, ...(reactivate ? { handled_at: null, handled_at_message_id: null, handled_at_history_id: null } : {}) }; await client.from("email_threads").upsert({ user_id: userId, integration_id: connection.id, provider_thread_id: item.id, subject, snippet: detail.snippet ?? item.snippet ?? null, participants, last_message_at: metadata.latest_message_at, message_count: messages.length, reply_state: replyState, metadata }, { onConflict: "user_id,integration_id,provider_thread_id" }); affected++; } }
    if (provider === "google_drive") { const data = await request("https://www.googleapis.com/drive/v3/files?pageSize=50&orderBy=modifiedTime%20desc&fields=files(id,name,mimeType,webViewLink,modifiedTime)", token) as { files?: Array<{ id: string; name: string; mimeType?: string; webViewLink?: string; modifiedTime?: string }> }; for (const file of data.files ?? []) { await client.from("external_files").upsert({ user_id: userId, integration_id: connection.id, provider: "google_drive", provider_file_id: file.id, name: file.name, mime_type: file.mimeType ?? null, web_url: file.webViewLink ?? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}`, modified_at_external: file.modifiedTime ?? null }, { onConflict: "user_id,integration_id,provider_file_id" }); affected++; } }
    if (provider === "github") { const repos = await request("https://api.github.com/user/repos?per_page=100&sort=updated", token) as unknown as Array<{ id: number; full_name: string; html_url: string; default_branch?: string; open_issues_count?: number; updated_at?: string }>; for (const repo of repos) { await client.from("external_references").upsert({ user_id: userId, provider: "github", external_id: String(repo.id), entity_type: "repository", entity_id: "00000000-0000-0000-0000-000000000000", title: repo.full_name, url: repo.html_url, external_updated_at: repo.updated_at ?? null, metadata: { default_branch: repo.default_branch, open_issues_count: repo.open_issues_count ?? 0 } }, { onConflict: "user_id,provider,external_id,entity_type,entity_id" }); affected++; } for (const repo of repos.slice(0, 20)) { const [issues, pulls] = await Promise.all([request(`https://api.github.com/repos/${encodeURIComponent(repo.full_name)}/issues?state=all&per_page=50&sort=updated`, token) as unknown as Promise<Array<{ id:number; number:number; title:string; state:string; labels?:Array<{name?:string}>; milestone?:{title?:string}|null; html_url?:string; created_at?:string; updated_at?:string; pull_request?:unknown }>>, request(`https://api.github.com/repos/${encodeURIComponent(repo.full_name)}/pulls?state=all&per_page=50&sort=updated`, token) as unknown as Promise<Array<{ id:number; number:number; title:string; state:string; draft?:boolean; merged_at?:string|null; head?:{ref?:string}; labels?:Array<{name?:string}>; milestone?:{title?:string}|null; html_url?:string; created_at?:string; updated_at?:string }>>]); for (const issue of issues.filter((item) => !item.pull_request)) { await client.from("github_work_items").upsert({ user_id:userId,repository_external_id:String(repo.id),external_id:String(issue.number),kind:"issue",title:issue.title,state:issue.state,is_draft:false,is_merged:false,labels:(issue.labels??[]).map((label)=>label.name).filter(Boolean),milestone:issue.milestone?.title??null,branch:null,html_url:issue.html_url??null,created_at_provider:issue.created_at??null,updated_at_provider:issue.updated_at??null,metadata:{} },{onConflict:"user_id,repository_external_id,external_id,kind"}); affected++; } for (const pull of pulls) { await client.from("github_work_items").upsert({ user_id:userId,repository_external_id:String(repo.id),external_id:String(pull.number),kind:"pull_request",title:pull.title,state:pull.state,is_draft:Boolean(pull.draft),is_merged:Boolean(pull.merged_at),labels:(pull.labels??[]).map((label)=>label.name).filter(Boolean),milestone:pull.milestone?.title??null,branch:pull.head?.ref??null,html_url:pull.html_url??null,created_at_provider:pull.created_at??null,updated_at_provider:pull.updated_at??null,metadata:{} },{onConflict:"user_id,repository_external_id,external_id,kind"}); affected++; } } }
    if (provider === "strava") {
      const activities = await request("https://www.strava.com/api/v3/athlete/activities?per_page=100", token) as unknown as Array<{ id: number; type: string; start_date?: string; moving_time?: number; distance?: number; total_elevation_gain?: number; calories?: number }>;
      for (const activity of activities) {
        const durationMin = activity.moving_time ? Math.round(activity.moving_time / 60) : null;
        const distKm = activity.distance ? Number((activity.distance / 1000).toFixed(2)) : null;
        await client.from("fitness_activities").upsert({
          user_id: userId,
          activity_type: stravaActivityType(activity.type),
          activity_date: String(activity.start_date ?? new Date().toISOString()).slice(0, 10),
          duration_seconds: activity.moving_time ?? null,
          duration_minutes: durationMin,
          distance_meters: activity.distance ?? null,
          distance_km: distKm,
          calories: activity.calories ? Math.round(activity.calories) : null,
          source: "strava",
          external_activity_id: String(activity.id),
          external_id: String(activity.id),
          metadata: { elevation_meters: activity.total_elevation_gain ?? null, raw_type: activity.type }
        }, { onConflict: "user_id,source,external_id" });
        affected++;
      }
    }
    if (provider === "hevy") {
      const resp = await fetch("https://api.hevyapp.com/v1/workouts?page=1&pageSize=15", {
        headers: { "api-key": token, "Accept": "application/json" }
      });
      if (!resp.ok) throw new Error("Hevy API sync failed: check your API key.");
      const body = await resp.json() as { workouts?: Array<Record<string, unknown>> };
      for (const w of body.workouts ?? []) {
        const exercises = (w.exercises ?? []) as Array<{ title?: string; sets?: Array<{ weight_kg?: number; reps?: number }> }>;
        let volume = 0;
        let setsCount = 0;
        const names: string[] = [];
        for (const ex of exercises) {
          if (ex.title) names.push(ex.title);
          for (const s of ex.sets ?? []) {
            setsCount++;
            volume += (Number(s.weight_kg ?? 0) * Number(s.reps ?? 1));
          }
        }
        const start = new Date(String(w.start_time ?? w.created_at ?? new Date().toISOString()));
        const end = w.end_time ? new Date(String(w.end_time)) : new Date(start.getTime() + 60 * 60 * 1000);
        const durationMinutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
        await client.from("fitness_activities").upsert({
          user_id: userId,
          activity_type: "Gym",
          activity_date: start.toISOString().slice(0, 10),
          duration_minutes: durationMinutes,
          duration_seconds: durationMinutes * 60,
          calories: Math.round(durationMinutes * 6.5),
          source: "hevy",
          external_activity_id: String(w.id),
          external_id: String(w.id),
          notes: `${String(w.title || "Gym Workout")} · ${names.slice(0, 4).join(", ")}${names.length > 4 ? ` +${names.length - 4} more` : ""} · ${setsCount} sets (${Math.round(volume)} kg volume)`,
          metadata: { workout_title: w.title, volume_kg: Math.round(volume), total_sets: setsCount, exercises: names }
        }, { onConflict: "user_id,source,external_id" });
        affected++;
      }
    }
    if (provider === "pacer") {
      const meta = (connection.provider_metadata ?? {}) as { recent_days?: Array<{ date: string; steps: number; distance_km?: number; duration_minutes?: number; calories?: number }> };
      for (const day of meta.recent_days ?? []) {
        await client.from("fitness_activities").upsert({
          user_id: userId,
          activity_type: "Walking",
          activity_date: day.date,
          distance_km: day.distance_km ?? Number(((day.steps * 0.75) / 1000).toFixed(2)),
          duration_minutes: day.duration_minutes ?? Math.round(day.steps / 100),
          duration_seconds: (day.duration_minutes ?? Math.round(day.steps / 100)) * 60,
          calories: day.calories ?? Math.round(day.steps * 0.04),
          source: "pacer",
          external_activity_id: `pacer-${day.date}`,
          external_id: `pacer-${day.date}`,
          notes: `${day.steps.toLocaleString()} steps via Pacer`,
          metadata: { steps: day.steps }
        }, { onConflict: "user_id,source,external_id" });
        affected++;
      }
    }
    if (provider === "myfitnesspal") {
      const meta = (connection.provider_metadata ?? {}) as { recent_nutrition?: Array<{ date: string; calories: number; protein_g?: number; carbs_g?: number; fat_g?: number }> };
      for (const log of meta.recent_nutrition ?? []) {
        await client.from("fitness_activities").upsert({
          user_id: userId,
          activity_type: "Other",
          activity_date: log.date,
          calories: log.calories,
          source: "myfitnesspal",
          external_activity_id: `mfp-${log.date}`,
          external_id: `mfp-${log.date}`,
          notes: `Nutrition: ${log.calories} kcal · ${log.protein_g ?? 0}g P · ${log.carbs_g ?? 0}g C · ${log.fat_g ?? 0}g F`,
          metadata: { calories_in: log.calories, protein: log.protein_g, carbs: log.carbs_g, fat: log.fat_g }
        }, { onConflict: "user_id,source,external_id" });
        affected++;
      }
    }
    const now = new Date().toISOString(); await client.from("integrations").update({ sync_status: "healthy", last_synced_at: now, last_successful_sync_at: now, last_error: null }).eq("id", connection.id).eq("user_id", userId); return { affected, lastSyncedAt: now };
  } catch (error) { await client.from("integrations").update({ sync_status: "attention", last_error: "Connection needs attention." }).eq("id", connection.id).eq("user_id", userId); throw error; }
}
