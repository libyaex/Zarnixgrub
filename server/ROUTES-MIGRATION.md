# server/ROUTES-MIGRATION.md — خريطة ترحيل مسارات المرحلة 2

> يوثّق المصير المخطط لكل مسار قديم في `server.ts` عند إعادة التوصيل.
> الحالة قبل التوصيل: كل المسارات القديمة تعمل كما هي (سلوك غير متغير).
> الحالة بعد التوصيل (المرحلة 2): كل مسار إداري محمي بمصادقة JWT وصلاحية.

| المسار القديم | القرار | بديل / حماية المرحلة 2 |
|---|---|---|
| `GET /api/auth/me` (ذاكرة) | استبدال | `server/routes/auth.ts` — JWT + دور من `profiles` |
| `POST /api/auth/google` (يقبل أي بريد) | **حذف** | دخول Google فقط عبر Supabase OAuth من الواجهة |
| `POST /api/auth/login` (بريد بلا كلمة سر) | **حذف** | لا بديل — المصادقة عبر Supabase حصراً |
| `POST /api/auth/register` | إعادة توجيه | إنشاء صف `profiles` عند أول دخول OAuth (trigger) |
| `POST /api/auth/switch-role` (بلا حماية) | **حذف نهائي** | كانت تتيح لمن يملك `manage_users` ترقية نفسه؛ الأدوار تُغيَّر فقط عبر `PUT /api/admin/staff/:id/role` بقواعد `canChangeRole` |
| `POST /api/auth/logout` | تبسيط | إزالة خرائط الجلسات؛ JWT يُتحقق لكل طلب |
| `x-auth-email` (ترويسة) | **حذف نهائي** | لا ترويسات هوية من العميل إطلاقاً |
| `currentUser` (متغير مشترك) | **حذف نهائي** | `req.user` لكل طلب عبر `requireAuth` |
| `activeSessions` (خريطة ذاكرة) | **حذف نهائي** | لا جلسات خادمية؛ توكنات Supabase قصيرة العمر |
| `/api/products` (قراءة) | إبقاء عام | يبقى عاماً للقراءة فقط |
| `/api/admin/*` (كل المسارات الإدارية) | تأمين | `requireAuth` + `requirePermission(...)` لكل مسار |
| `/api/coupons` (بلا حماية) | تأمين | `requirePermission('manage_coupons')` للكتابة؛ التحقق فقط عام |
| `/api/upload` (بلا حماية) | تأمين | `requireAuth` + رفع إلى Supabase Storage بحاويات خاصة |
| `/api/payments/review` | تأمين | `requirePermission('approve_payments')` + مقارنة المبلغ بإجمالي الطلب + منع تكرار المرجع |
| `payment_status → paid` من مسار الطلب | **حذف** | تغيير الحالة إلى `paid` عبر مسار المراجعة فقط |

## مبدأ عدم الثقة بالعميل

- الواجهة ترسل `product_id` + `option_ids` فقط؛ الخادم يعيد حساب الأسعار من قاعدة البيانات.
- أي مبلغ أو حالة دفع قادمة من المتصفح تُرفض.
- الدور يُقرأ من `/api/auth/me` ولا يُحدد في المتصفح مطلقاً.
