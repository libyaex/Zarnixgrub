# خطوات النشر (بالترتيب)

## 1) قاعدة البيانات — Supabase → SQL Editor
نفّذ بهذا الترتيب (كلها قابلة لإعادة التشغيل دون ضرر):

1. `supabase/schema.sql`
2. `supabase/phase1-hardening.sql` — الأدوار والفهارس
3. `supabase/phase2-auto-provision.sql` — إنشاء `profiles` تلقائياً + RLS
4. `supabase/phase3-complete.sql` — الأدوار المخصصة، دعوات الموظفين، مهام الخدمة اليدوية، فهارس التكامل، دالة الكوبون الذرية، وحاويات التخزين (`project_files` و`payment_receipts` خاصتان، `product_images` عامة)
5. `supabase/phase4-notifications.sql` — **جديد**: جداول الإشعارات والاشتراكات والتفضيلات + تفعيل Realtime للإشعارات الحية

> الخادم يعمل حتى قبل الخطوتين 4 و5 (يتراجع بأمان)، لكن الأدوار المخصصة والرفع والإشعارات تحتاجهما.

## 2) Supabase → Authentication
- **Providers → Google**: فعّله وأضف Client ID/Secret.
- **URL Configuration**: *Site URL* = رابط موقعك، وأضف نفس الرابط (و`http://localhost:3000` للتطوير) في *Redirect URLs*.

## 3) مفاتيح إشعارات الهاتف (Web Push)
```bash
node scripts/generate-vapid.mjs
```
انسخ القيم الثلاث إلى Vercel (`VAPID_PUBLIC_KEY`، `VAPID_PRIVATE_KEY`، `VAPID_SUBJECT`). بدونها تعمل الإشعارات داخل التطبيق فقط (الجرس والتنبيهات)، ولا يظهر خطأ.

## 4) Vercel → Settings → Environment Variables
| المتغير | ملاحظة |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | للمتصفح (عامّان) |
| `SUPABASE_URL` | نفس رابط المشروع (للخادم) |
| `SUPABASE_SERVICE_ROLE_KEY` | **سري** — لا يوضع في أي متغير `VITE_` |
| `OWNER_EMAIL` | أول دخول موثّق بهذا البريد يصبح `owner` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | إشعارات الهاتف |

بعد أي تغيير في المتغيرات **أعد النشر**.

## 5) كيف تعمل SEO وPWA على Vercel
`vercel.json` يحوّل صفحات التطبيق و`/manifest.webmanifest` و`/robots.txt` و`/sitemap.xml` إلى دالة الخادم، فتُكتب وسوم SEO (العنوان، الوصف، Open Graph، JSON-LD) من **إعدادات لوحة التحكم** قبل وصول الصفحة للمتصفح أو لعناكب البحث. الملفات الساكنة (`/assets`، `/icons`، `/sw.js`) تُخدم مباشرة.

## 6) التحقق بعد النشر
1. `/api/health` → `"ok": true` وأن `supabase_host` يطابق مشروعك.
2. سجّل الدخول بحساب `OWNER_EMAIL` → لوحة التحكم.
3. **الإعدادات**: غيّر اسم المنصة أو الشعار → احفظ → يتغير الموقع فوراً.
4. **SEO**: افتح `/robots.txt` و`/sitemap.xml` و`/manifest.webmanifest`. للفهرسة عطّل «اشتراط تسجيل الدخول لتصفح المتجر» (مفعّل افتراضياً حفاظاً على السلوك السابق).
5. **PWA**: على Android Chrome تظهر بطاقة «ثبّت التطبيق» بعد الزيارة الثانية. على iPhone: Safari → مشاركة → إضافة إلى الشاشة الرئيسية (الإشعارات على iOS تتطلب iOS 16.4+ والتطبيق مثبّتاً).
6. **الإشعارات**: من صفحة الإشعارات ← الإعدادات فعّل إشعارات الجهاز ثم «إشعار تجريبي». ثم من لوحة التحكم ← الإشعارات والبث أرسل إعلاناً.
7. الدورة الكاملة: منتج + ملف zip → طلب من حساب عميل → إيصال → اعتماد → تنزيل (وتصل إشعارات للمراجع ثم للعميل).

## 7) تشغيل محلي
```bash
cp .env.example .env     # املأ القيم
bun install              # أو npm install
npm run dev              # الخادم على :3000 (يخدم dist بعد npm run build)
npm run dev:web          # الواجهة (Vite) مع proxy إلى :3000
npm run verify           # اختبارات + فحص أنواع + بناء
```
> الـ Service Worker لا يُسجَّل في وضع التطوير (يعمل في نسخة الإنتاج فقط) حتى لا يلتبس عليك التخزين المؤقت.
