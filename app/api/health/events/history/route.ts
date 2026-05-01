import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// GET /api/health/events/history — completed events (own + dependents), newest first
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_health")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url    = new URL(req.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0",  10);

  const db = createAdminClient();
  const { data, count, error } = await db
    .from("health_events")
    .select(`
      id, user_id, for_type, dependent_id, title, event_type, event_date,
      notes, status, completed_date, alert_1_week, alert_1_day,
      created_at, updated_at, family_dependents ( name )
    `, { count: "exact" })
    .or(`user_id.eq.${user.id},for_type.eq.dependent`)
    .eq("status", "completed")
    .order("completed_date", { ascending: false, nullsFirst: false })
    .order("event_date",     { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events = (data ?? []).map((r) => {
    const dep = Array.isArray(r.family_dependents)
      ? (r.family_dependents as { name: string }[])[0]
      : (r.family_dependents as { name: string } | null);
    return {
      id:            r.id,
      userId:        r.user_id,
      forType:       r.for_type ?? "self",
      dependentId:   r.dependent_id,
      dependentName: dep?.name ?? null,
      title:         r.title,
      eventType:     r.event_type,
      eventDate:     r.event_date,
      notes:         r.notes,
      status:        r.status,
      completedDate: r.completed_date ?? null,
      alert1Week:    r.alert_1_week !== false,
      alert1Day:     r.alert_1_day  !== false,
      createdAt:     r.created_at,
      updatedAt:     r.updated_at,
    };
  });

  return NextResponse.json({ events, total: count ?? 0, limit, offset });
}
