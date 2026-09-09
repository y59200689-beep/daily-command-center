import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/supabase/server";
import { buildClientWaitingState } from "@/lib/success";

export async function GET(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("client_id");

    let clientQuery = supabase
      .from("clients")
      .select("id, name, company, status")
      .eq("user_id", userId)
      .is("deleted_at", null);

    let commQuery = supabase
      .from("client_commitments")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["open", "unclear"]);

    let taskQuery = supabase
      .from("tasks")
      .select("id, client_id, title, waiting_for, status, due_date, created_at")
      .eq("user_id", userId)
      .not("status", "eq", "completed");

    let waitingQuery = supabase
      .from("waiting_items")
      .select("id, client_id, title, status, requested_at, expected_by")
      .eq("user_id", userId)
      .eq("status", "waiting");

    let approvalQuery = supabase
      .from("approvals")
      .select("id, client_id, title, status, created_at")
      .eq("user_id", userId)
      .eq("status", "pending");

    if (clientId) {
      clientQuery = clientQuery.eq("id", clientId);
      commQuery = commQuery.eq("client_id", clientId);
      taskQuery = taskQuery.eq("client_id", clientId);
      waitingQuery = waitingQuery.eq("client_id", clientId);
      approvalQuery = approvalQuery.eq("client_id", clientId);
    }

    const [clientsRes, commitmentsRes, tasksRes, waitingRes, approvalsRes] = await Promise.all([
      clientQuery,
      commQuery,
      taskQuery,
      waitingQuery,
      approvalQuery,
    ]);

    if (clientsRes.error) throw clientsRes.error;
    if (commitmentsRes.error) throw commitmentsRes.error;

    const waitingState = buildClientWaitingState(
      clientsRes.data ?? [],
      commitmentsRes.data ?? [],
      tasksRes.data ?? [],
      waitingRes.data ?? [],
      approvalsRes.data ?? []
    );

    return NextResponse.json({
      data: waitingState,
      counts: {
        waitingOnUs: waitingState.waitingOnUs.length,
        waitingOnClient: waitingState.waitingOnClient.length,
        total: waitingState.waitingOnUs.length + waitingState.waitingOnClient.length,
      },
    });
  } catch (error) {
    return apiError(error, "Client waiting state could not be loaded.");
  }
}
