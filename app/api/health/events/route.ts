import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { checkPermission } from "@/lib/permissions";
import type { EventType, ForType } from "@/lib/health/types";

export const dynamic = "force-dynamic";

function mapRow(r: Record<string, unknown>): object {
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
    eventType:     r.event_type as EventType,
    eventDate:     r.event_date,
    eventTime:     r.event_time ?? null,
    notes:         r.notes,
    status:        r.status,
    completedDate: r.completed_date ?? null,
    alert1Week:    r.alert_1_week !== false,
    alert1Day:     r.alert_1_day  !== false,
    createdAt:     r.created_at,
    updatedAt:     r.updated_at,
  };
}

// GET /api/health/events — own events + all dependent events
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_health")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const dep = url.searchParams.get("dependent_id");

  const db = createAdminClient();
  let q = db
    .from("health_events")
    .select(`
      id, user_id, for_type, dependent_id, title, event_type, event_date, event_time,
      notes, status, completed_date, alert_1_week, alert_1_day,
      created_at, updated_at, family_dependents ( name )
    `)
    // Own events OR any dependent event (shared with all health users)
    .or(`user_id.eq.${user.id},for_type.eq.dependent`)
    .neq("status", "completed")
    .order("event_date", { ascending: true });

  if (dep) q = q.eq("dependent_id", dep);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ events: (data ?? []).map(mapRow) });
}

// POST /api/health/events
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await checkPermission(user.id, "can_edit_health")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const {
    title, eventType, eventDate, eventTime,
    forType, dependentId, notes,
    alert1Week, alert1Day,
  } = body;

  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!eventDate)     return NextResponse.json({ error: "eventDate is required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("health_events")
    .insert({
      user_id:      user.id,
      for_type:     forType ?? "self",
      dependent_id: dependentId ?? null,
      title:        title.trim(),
      event_type:   eventType ?? "appointment",
      event_date:   eventDate,
      event_time:   eventTime ?? null,
      notes:        notes?.trim() ?? null,
      alert_1_week: alert1Week !== false,
      alert_1_day:  alert1Day  !== false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
