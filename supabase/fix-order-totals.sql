-- =============================================================================
-- One-off repair: orders created while checkout double-charged the base price
-- (e.g. base 450 + tier 450 + install 180 = 1,080 instead of 630).
--
-- Recalculates ONLY orders that are not paid yet (unsubmitted / rejected), using
-- the option prices frozen in order_items.selected_options_snapshot.
-- Paid / under-review orders are never touched: review those by hand, because
-- the customer may already have transferred the wrong amount.
--
-- Orders that used a PERCENTAGE coupon keep their old discount_amount; check
-- them manually (SELECT below lists them).
-- =============================================================================

-- 1) Preview: what would change
SELECT o.order_number, o.total_amount AS current_total,
       s.correct_subtotal - o.discount_amount AS corrected_total, o.coupon_code
FROM public.orders o
JOIN (
  SELECT oi.order_id,
         SUM(
           CASE WHEN jsonb_array_length(COALESCE(oi.selected_options_snapshot, '[]'::jsonb)) > 0
                THEN (SELECT COALESCE(SUM((x->>'price')::numeric), 0) FROM jsonb_array_elements(oi.selected_options_snapshot) x)
                ELSE oi.base_price_snapshot END * oi.quantity
         ) AS correct_subtotal
  FROM public.order_items oi GROUP BY oi.order_id
) s ON s.order_id = o.id
WHERE o.payment_status IN ('unsubmitted', 'rejected')
  AND o.subtotal <> s.correct_subtotal;

-- 2) Apply
UPDATE public.order_items oi
SET total_price = CASE WHEN jsonb_array_length(COALESCE(oi.selected_options_snapshot, '[]'::jsonb)) > 0
                       THEN (SELECT COALESCE(SUM((x->>'price')::numeric), 0) FROM jsonb_array_elements(oi.selected_options_snapshot) x)
                       ELSE oi.base_price_snapshot END * oi.quantity
FROM public.orders o
WHERE o.id = oi.order_id AND o.payment_status IN ('unsubmitted', 'rejected');

UPDATE public.orders o
SET subtotal = s.total,
    total_amount = GREATEST(0, s.total - o.discount_amount),
    updated_at = NOW()
FROM (SELECT order_id, SUM(total_price) AS total FROM public.order_items GROUP BY order_id) s
WHERE s.order_id = o.id
  AND o.payment_status IN ('unsubmitted', 'rejected')
  AND o.subtotal <> s.total;
