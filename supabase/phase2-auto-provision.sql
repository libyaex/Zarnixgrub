-- =============================================================================
-- Phase 2 — Auto-provisioning profile rows for new OAuth users
-- المرحلة 2 — إنشاء صفوف profiles تلقائياً لمستخدمي OAuth الجدد
--
-- Run AFTER schema.sql and phase1-hardening.sql in the Supabase SQL Editor.
-- الهدف: عند أول دخول عبر Google OAuth يُنشأ صف في profiles تلقائياً،
-- والدور يأتي من قاعدة البيانات حصراً (الافتراضي: customer).
-- =============================================================================

-- 1) دالة إنشاء الملف الشخصي للمستخدم الجديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, status)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    'customer', -- الدور الافتراضي؛ الترقية تتم من مسار إداري محمي فقط
    'active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2) تفعيل الدالة عند إنشاء مستخدم جديد في Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) سياسة تسمح للمستخدم بقراءة ملفه الشخصي فقط (RLS على profiles)
--    (تُضاف بجانب سياسات schema.sql الأصلية إن وُجدت)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'profiles_select_own'
  ) THEN
    CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;

-- 4) ترقية حساب المالك الأول يدوياً (نفّذها مرة واحدة بعد أول دخولك):
--    UPDATE public.profiles SET role = 'owner'
--    WHERE email = 'advesapp@gmail.com';
--    ملاحظة: البريد هنا يُستخدم مرة واحدة فقط لتعيين المالك في قاعدة
--    البيانات، وليس لتحديد الدور من المتصفح.
