import type { Request } from 'express';
import { supabaseAdmin } from './supabaseAdmin.ts';

/** Append-only audit trail. Never throws: auditing must not break the action itself. */
export async function audit(
  req: Request,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      admin_id: req.user!.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });
  } catch (error) {
    console.error('[audit] failed to write audit log:', error);
  }
}
