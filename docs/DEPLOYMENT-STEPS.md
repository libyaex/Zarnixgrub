# خطوات النشر (بالترتيب)

## 1) قاعدة البيانات — Supabase → SQL Editor
نفّذ بهذا الترتيب بالضبط (كلها قابلة لإعادة التشغيل دون ضرر):

1. `supabase/schema.sql`
2. `supabase/phase1-hardening.sql` — الأدوار والفهارس
3. `supabase/phase2-auto-provision.sql` — إنشاء `profiles` تلقائياً + RLS
4. `supabase/phase3-complete.sql` — **جديد**: الأدوار المخصصة، دعوات الموظفين،
   مهام الخدمة اليدوية، فهارس التكامل، دالة الكوبون الذرية، وحاويات التخزين
   (`project_files` و`payment_receipts` خاصتان، `product_images` عامة).

> الخادم يعمل حتى قبل تنفيذ الخطوة 4 (يتراجع بأمان)، لكن الأدوار المخصصة ودعوات
> الموظفين ورفع الملفات تحتاجها.

## 2) Supabase → Authentication
- **Providers → Google**: فعّله وأضف Client ID/Secret من Google Cloud.
- **URL Configuration**:
  - *Site URL* = رابط موقعك الفعلي (`https://your-domain`).
  - *Redirect URLs*: أضف نفس الرابط (و`http://localhost:3000` للتطوير).
  - إن لم يكن النطاق مدرجاً هنا يعيدك Supabase إلى Site URL ولا تُنشأ جلسة
    (سبب شائع لحلقة "العودة لصفحة الدخول").

## 3) Vercel → Settings → Environment Variables
| المتغير | ملاحظة |
|---|---|
| `VITE_SUPABASE_URL` | رابط المشروع (للمتصفح) |
| `VITE_SUPABASE_ANON_KEY` | مفتاح anon (عام بطبيعته) |
| `SUPABASE_URL` | **نفس** رابط المشروع (للخادم) |
| `SUPABASE_SERVICE_ROLE_KEY` | **سري** — لا تضعه في أي ملف أو متغير `VITE_` |
| `OWNER_EMAIL` | أول دخول موثّق بهذا البريد يصبح `owner` تلقائياً |

لم يعد هناك مفتاح احتياطي مدمج في الكود: إن غاب `VITE_SUPABASE_*` لن يعمل الدخول.
بعد أي تغيير في المتغيرات **أعد النشر** (Redeploy).

## 4) التحقق بعد النشر
1. افتح `https://your-domain/api/health` → يجب أن ترى `"ok": true` وأن
   `supabase_host` يطابق مشروعك.
2. سجّل الدخول بحساب `OWNER_EMAIL` → يجب أن تظهر لوحة التحكم.
3. أنشئ تصنيفاً ثم منتجاً وارفع ملف مشروع (zip) → افتح المنتج وتأكد أن الملف
   ظهر في قائمة الملفات.
4. من حساب عميل آخر: اطلب المنتج → أرسل إثبات تحويل → اعتمده من لوحة التحكم →
   يجب أن يظهر التنزيل في بوابة العميل.

## 5) تشغيل محلي
```bash
cp .env.example .env     # املأ القيم
bun install              # أو npm install
npm run dev              # الخادم على :3000
npm run dev:web          # الواجهة (Vite) مع proxy إلى :3000
npm run verify           # اختبارات + فحص أنواع + بناء
```
