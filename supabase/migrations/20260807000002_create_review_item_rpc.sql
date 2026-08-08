-- M5-B: atomic review creation.
--
-- M5-A inserted the item and its REVIEW_CREATED event as two separate
-- statements, which leaves a window where a review exists with no creation
-- event. The M5 hard gate says decisions without an audit event = 0; creation
-- deserves the same guarantee, so both writes move into one transaction.
--
-- The same advisory-lock + recheck idiom as ingest_replace_document and
-- decide_review_item: concurrent creates for one source serialize, and the
-- second caller returns the pending item that already exists rather than
-- duplicating human work.

create function public.create_review_item(
  p_review_id text,
  p_source_type text,
  p_source_key text,
  p_snapshot jsonb,
  p_snapshot_sha256 text,
  p_workflow_decision text,
  p_required_approval_level text,
  p_review_reasons jsonb,
  p_checklist jsonb,
  p_event_id text,
  p_actor text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing text;
begin
  if p_review_id is null or p_review_id = '' then
    raise exception 'REVIEW_INVALID_PAYLOAD: review_id missing';
  end if;
  if p_source_key is null or p_source_key = '' then
    raise exception 'REVIEW_INVALID_PAYLOAD: source_key missing';
  end if;
  if p_actor is null or p_actor = '' then
    raise exception 'REVIEW_INVALID_PAYLOAD: actor missing';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_source_key));

  -- In-transaction recheck: whoever got here first owns the open review.
  select review_id into v_existing
  from review_items
  where source_key = p_source_key and review_state = 'pending_review';
  if found then
    return jsonb_build_object('action', 'existing_pending', 'review_id', v_existing);
  end if;

  insert into review_items (
    review_id, source_type, source_key, snapshot, snapshot_sha256,
    workflow_decision, required_approval_level, review_reasons, checklist
  ) values (
    p_review_id, p_source_type, p_source_key, p_snapshot, p_snapshot_sha256,
    p_workflow_decision, p_required_approval_level,
    coalesce(p_review_reasons, '[]'::jsonb), coalesce(p_checklist, '[]'::jsonb)
  );

  insert into review_events (event_id, review_id, event_type, actor, payload)
  values (
    p_event_id, p_review_id, 'REVIEW_CREATED', p_actor,
    jsonb_build_object(
      'sourceType', p_source_type,
      'sourceKey', p_source_key,
      'snapshotSha256', p_snapshot_sha256,
      'workflowDecision', p_workflow_decision,
      'requiredApprovalLevel', p_required_approval_level
    )
  );

  return jsonb_build_object('action', 'created', 'review_id', p_review_id);
end;
$$;

revoke execute on function public.create_review_item(
  text, text, text, jsonb, text, text, text, jsonb, jsonb, text, text
) from public, anon, authenticated;
