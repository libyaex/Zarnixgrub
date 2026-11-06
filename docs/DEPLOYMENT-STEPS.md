# خطوات التشغيل اليدوية — إكمال الإعداد الإنتاجي

> هذه الخطوات المتبقية لا يمكن تنفيذها إلا من حساباتك في GitHub وVercel وSupabase،
> لأنها تتطلب صلاحيات وأسراراً لا تُرسل في المحادثة.

## 1) ملف CI (اختياري لكن موصى به)

الأداة لا تستطيع الكتابة في مسار يبدأ بنقطة في المستودع، لذا أنشئ الملف يدوياً:

1. في GitHub افتح المستودع → **Add file → Create new file**
2. اكتب الاسم بالكامل: `.github/workflows/ci.yml`
3. الصق المحتوى التالي:

```yaml
name: CI
on:
  push:
    branches: [main, security/phase-1]
  pull_request:
    branches: [main]
permissions:
  contents: read
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run lint
      - run: bun run build
```

4. Commit إلى فرع `security/phase-1`

## 2) تنفيذ سكربتات قاعدة البيانات (Supabase → SQL Editor)

نفّذ بهذا الترتيب بالضبط:

1. `supabase/schema.sql` (الأساس — إن لم يكن منفذاً بعد)
2. `supabase/phase1-hardening.sql` (الأدوار + الصلاحيات + فهرس المرجع الفريد)
3. `supabase/phase2-auto-provision.sql` (إنشاء profiles تلقائياً + RLS)

بعد أول دخول لك عبر Google OAuth نفّذ مرة واحدة:

```sql
UPDATE public.profiles SET role = 'owner' WHERE email = 'advesapp@gmail.com';
```

## 3) حاويات التخزين (Supabase → Storage)

أنشئ حاويتين **خاصتين (PRIVATE)**:

| الحاوية | الاستخدام |
|---|---|
| `project_files` | ملفات المنتجات الفعلية (zip/rar) |
| `payment_receipts` | صور إيصالات التحويل |

⚠️ لا تجعلهما عامتين أبداً — التنزيل يتم عبر روابط موقّعة فقط.

## 4) متغيرات البيئة (Vercel → Project → Settings → Environment Variables)

| المتغير | ملاحظات |
|---|---|
| `SUPABASE_URL` | رابط مشروع Supabase |
| `VITE_SUPABASE_URL` | نفس الرابط (للواجهة) |
| `VITE_SUPABASE_ANON_KEY` | مفتاح anon العام |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ سري للغاية — للخادم فقط |

لا تضع `SERVICE_ROLE_KEY` في أي ملف داخل المستودع.

## 5) التحقق المحلي قبل الدمج

```bash
git checkout security/phase-1
bun install
bun run lint   # tsc --noEmit
bun run build  # بناء Vite
```

إذا نجحت الخطوتان: افتح Pull Request من `security/phase-1` إلى `main`
ثم اربط Vercel بالنشر من فرع `main` بعد الدمج.

## 6) اختبار الدخان بعد النشر

- [ ] الدخول عبر Google يعمل ويعيد دورك الحقيقي من `/api/auth/me`
- [ ] إنشاء منتج من اللوحة يظهر للزوار (ليس localStorage)
- [ ] طلب تجريبي: السعر محسوب في الخادم ويطابق الإجمالي
- [ ] رفع إيصال ثم اعتماده يفعّل حصص التحميل
- [ ] رابط التنزيل يعمل مرة واحدة ثم ينقص العدّاد
