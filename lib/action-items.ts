/**
 * lib/action-items.ts
 * Helper functions for creating and resolving action items from cron jobs.
 * Used by all cron jobs to write structured action_items rows.
 */

import { getSupabaseAdmin } from "@/lib/cron/run-job"
import type { UpsertActionItemParams, ActionItemType, RelatedEntityType } from "@/types/action-items"

/**
 * Insert an action item, silently skipping if an identical one already exists today.
 * Returns true if created, false if skipped (duplicate), throws on real errors.
 */
export async function upsertActionItem(params: UpsertActionItemParams): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)

  // Check for existing (same type + entity + today) to honour the daily dedup constraint
  let query = supabase
    .from("action_items")
    .select("id", { count: "exact", head: true })
    .eq("type", params.type)
    .eq("is_resolved", false)
    .eq("is_dismissed", false)
    .gte("created_at", `${today}T00:00:00.000Z`)
    .lte("created_at", `${today}T23:59:59.999Z`)

  if (params.related_entity_id) {
    query = query.eq("related_entity_id", params.related_entity_id)
  } else {
    query = query.is("related_entity_id", null)
  }

  if (params.related_entity_type) {
    query = query.eq("related_entity_type", params.related_entity_type)
  } else {
    query = query.is("related_entity_type", null)
  }

  const { count } = await query

  if (count && count > 0) {
    return false // already created today — skip
  }

  const { error } = await supabase.from("action_items").insert({
    type: params.type,
    severity: params.severity,
    title: params.title,
    description: params.description ?? null,
    related_entity_type: params.related_entity_type ?? null,
    related_entity_id: params.related_entity_id ?? null,
    related_url: params.related_url ?? null,
    source: params.source,
    data: params.data ?? null,
    expires_at: params.expires_at ?? null,
    is_resolved: false,
    is_dismissed: false,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    // Unique constraint violation — another process beat us; safe to ignore
    if (error.code === "23505") return false
    throw new Error(`[action-items] insert failed: ${error.message}`)
  }

  return true
}

/**
 * Auto-resolve existing action items for a given type/entity when the condition clears.
 * e.g. slot usage drops below 80% → resolve all unresolved slot_warning items.
 */
export async function autoResolveActionItems(
  type: ActionItemType,
  relatedEntityType?: RelatedEntityType | null,
  relatedEntityId?: string | null
): Promise<number> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()

  // First find IDs to resolve
  let selectQuery = supabase
    .from("action_items")
    .select("id")
    .eq("type", type)
    .eq("is_resolved", false)
    .eq("is_dismissed", false)

  if (relatedEntityType) {
    selectQuery = selectQuery.eq("related_entity_type", relatedEntityType)
  } else {
    selectQuery = selectQuery.is("related_entity_type", null)
  }
  if (relatedEntityId) {
    selectQuery = selectQuery.eq("related_entity_id", relatedEntityId)
  } else {
    selectQuery = selectQuery.is("related_entity_id", null)
  }

  const { data: toResolve, error: selectError } = await selectQuery

  if (selectError) {
    console.error(`[action-items] auto-resolve select error for ${type}: ${selectError.message}`)
    return 0
  }

  if (!toResolve || toResolve.length === 0) return 0

  const ids = toResolve.map((r) => r.id)

  const { error: updateError } = await supabase
    .from("action_items")
    .update({
      is_resolved: true,
      resolved_at: now,
      resolved_by: "cron",
      updated_at: now,
    })
    .in("id", ids)

  if (updateError) {
    console.error(`[action-items] auto-resolve update error for ${type}: ${updateError.message}`)
    return 0
  }

  return ids.length
}
