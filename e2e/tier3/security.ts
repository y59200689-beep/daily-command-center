import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { provisionPeer, cleanupPeer } from "../../scripts/e2e/peer.mjs";
import { getE2ETarget } from "../../scripts/e2e/target.mjs";
import { snapshotRegistry } from "../../scripts/e2e/registry.mjs";
import { identity, normalClient, day, evidence } from "../tier1/workflows";

export async function tier3Isolation() {
  const owner = await normalClient();
  try {
    const { client: peer, metadata } = await provisionPeer();

    // 1. Forecasts table isolation
    const peerForecast = await peer
      .from("founder_forecasts")
      .insert({
        user_id: metadata.userId,
        prediction: `TIER1_E2E_${metadata.runId}_forecast`,
        predicted_outcome: "Outcome hypothesis",
        resolution_date: day(30),
        confidence: "medium",
        domain: "growth",
        resolution: "unresolved",
      })
      .select("id")
      .single();
    expect(peerForecast.error).toBeNull();
    snapshotRegistry(metadata);

    // Owner cannot see peer's forecast
    const ownerViewPeerForecast = await owner
      .from("founder_forecasts")
      .select("id")
      .eq("id", peerForecast.data!.id);
    expect(ownerViewPeerForecast.data).toEqual([]);

    // Owner cannot reassign user_id on their own record
    const ownerForecast = await owner
      .from("founder_forecasts")
      .insert({
        user_id: identity().userId,
        prediction: `TIER1_E2E_${identity().runId}_owner_fc`,
        predicted_outcome: "Owner outcome hypothesis",
        resolution_date: day(15),
        confidence: "high",
        domain: "product",
      })
      .select("id")
      .single();
    expect(ownerForecast.error).toBeNull();
    snapshotRegistry();

    const reassignment = await owner
      .from("founder_forecasts")
      .update({ user_id: metadata.userId })
      .eq("id", ownerForecast.data!.id)
      .select("id");
    expect(reassignment.error).not.toBeNull();

    // Cross-owner link rejected: owner forecast referencing peer experiment
    const peerExp = await peer
      .from("growth_experiments")
      .insert({
        user_id: metadata.userId,
        name: `TIER1_E2E_${metadata.runId}_exp`,
        hypothesis: "Peer experiment hypothesis",
        target_metric: "Conversion rate",
        status: "planned",
      })
      .select("id")
      .single();
    expect(peerExp.error).toBeNull();
    snapshotRegistry(metadata);

    const crossOwnerForecast = await owner
      .from("founder_forecasts")
      .insert({
        user_id: identity().userId,
        prediction: `TIER1_E2E_${identity().runId}_cross`,
        predicted_outcome: "Cross outcome",
        resolution_date: day(10),
        experiment_id: peerExp.data!.id,
      });
    expect(crossOwnerForecast.error).not.toBeNull();

    // Cross-owner link rejected: owner experiment referencing peer KPI
    const peerKpi = await peer
      .from("kpi_definitions")
      .insert({
        user_id: metadata.userId,
        name: `TIER1_E2E_${metadata.runId}_peer_kpi`,
        unit: "count",
        source: "manual",
        direction: "higher",
        frequency: "daily",
        active: true,
      })
      .select("id")
      .single();
    expect(peerKpi.error).toBeNull();
    snapshotRegistry(metadata);

    const crossOwnerExp = await owner
      .from("growth_experiments")
      .insert({
        user_id: identity().userId,
        name: `TIER1_E2E_${identity().runId}_invalid_kpi_exp`,
        hypothesis: "Cross owner experiment hypothesis",
        target_metric: "Conversion rate",
        kpi_id: peerKpi.data!.id,
        status: "idea",
      });
    expect(crossOwnerExp.error).not.toBeNull();

    // 2. Founder Daily Energy States isolation
    const peerState = await peer
      .from("founder_daily_states")
      .insert({
        user_id: metadata.userId,
        date: day(),
        energy: "high",
        focus: "strong",
        stress_load: "low",
      })
      .select("id")
      .single();
    expect(peerState.error).toBeNull();
    snapshotRegistry(metadata);

    // Owner cannot see peer's daily state
    const ownerViewPeerState = await owner
      .from("founder_daily_states")
      .select("id")
      .eq("id", peerState.data!.id);
    expect(ownerViewPeerState.data).toEqual([]);

    // 3. Anonymous access denied on Tier 3 tables
    const target = getE2ETarget();
    const anon = createClient(target.url, target.anonKey, { auth: { persistSession: false } });

    const anonForecasts = await anon.from("founder_forecasts").select("id");
    expect(anonForecasts.data ?? []).toEqual([]);

    const anonStates = await anon.from("founder_daily_states").select("id");
    expect(anonStates.data ?? []).toEqual([]);

    evidence("Tier 3 isolated DB / RLS verification, cross-owner links, reassignment denial, and anonymous protection", "PASS");
  } finally {
    await cleanupPeer();
  }
}
