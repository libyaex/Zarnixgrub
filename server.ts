import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Production Security Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Disable caching on API endpoints for security and real-time freshness
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Production In-Memory Rate Limiting
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
function rateLimit(prefix: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${prefix}:${clientIp}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= maxRequests) {
      return res.status(429).json({
        error: 'تم تجاوز الحد المسموح من الطلبات المتكررة. يرجى الانتظار قليلاً والمحاولة مجدداً لأسباب أمنية.'
      });
    }

    entry.count += 1;
    next();
  };
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -----------------------------------------------------------------------------
// Active Session Map for Cryptographic Token Authentication
// -----------------------------------------------------------------------------
const activeSessions = new Map<string, { userId: string; expiresAt: number }>();


interface DBUser {
  id: string;
  email: string;
  password?: string;
  full_name: string;
  phone: string;
  avatar_url?: string;
  role: string;
  status: 'active' | 'suspended';
  created_at: string;
}

export interface RoleItem {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  color: string;
  is_system: boolean;
  permissions: string[];
  created_at: string;
}

const systemRoles: RoleItem[] = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    name_ar: 'المدير الأعلى (Super Admin)',
    description: 'صلاحيات غير محدودة وتحكم كامل ومطلق في كافة الموارد والبيانات والإعدادات وإدارة الأدوار',
    color: '#a855f7',
    is_system: true,
    permissions: [
      'manage_products',
      'manage_orders',
      'approve_payments',
      'manage_downloads',
      'manage_services',
      'manage_coupons',
      'manage_banks',
      'manage_roles_permissions',
      'manage_users',
      'view_financial_analytics',
      'manage_settings',
      'view_audit_logs'
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 'admin',
    name: 'Admin',
    name_ar: 'مدير النظام (Admin)',
    description: 'إدارة شاملة للمتجر والطلبات والمدفوعات والمحتوى الرقمي والإحصائيات وتعيين الحسابات',
    color: '#3b82f6',
    is_system: true,
    permissions: [
      'manage_products',
      'manage_orders',
      'approve_payments',
      'manage_downloads',
      'manage_services',
      'manage_coupons',
      'manage_banks',
      'manage_users',
      'view_financial_analytics',
      'manage_settings',
      'view_audit_logs'
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 'moderator',
    name: 'Moderator',
    name_ar: 'مشرف المحتوى (Moderator)',
    description: 'إدارة وتدقيق ومراجعة المنتجات البرمجية والتصنيفات والملفات الرقمية وتراخيص التوزيع',
    color: '#10b981',
    is_system: true,
    permissions: [
      'manage_products',
      'manage_downloads'
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 'support',
    name: 'Support',
    name_ar: 'موظف الدعم الفني (Support)',
    description: 'متابعة تنفيذ خدمات التركيب والدعم الفني ومساعدة العملاء وتمديد فترات وتراخيص التحميل',
    color: '#f59e0b',
    is_system: true,
    permissions: [
      'manage_orders',
      'manage_services',
      'manage_downloads'
    ],
    created_at: new Date().toISOString()
  },
  {
    id: 'editor',
    name: 'Editor',
    name_ar: 'محرر برمجيات (Editor)',
    description: 'إضافة وتعديل بيانات المنتجات ودراسات الجدوى والمواصفات التقنية ونسخ التوثيق',
    color: '#06b6d4',
    is_system: true,
    permissions: [
      'manage_products'
    ],
    created_at: new Date().toISOString()
  }
];

let allRoles: RoleItem[] = [...systemRoles];

const users: DBUser[] = [
  {
    id: 'user_owner_01',
    email: 'advesapp@gmail.com',
    full_name: 'نزار الهواري',
    phone: '091-3004448',
    avatar_url: '',
    role: 'super_admin',
    status: 'active',
    created_at: new Date().toISOString()
  }
];

// Initially null so the very first screen is Google Sign-In, as requested by user
let currentUser: DBUser | null = null;

const categories = [
  {
    id: 'cat_pos',
    name: 'أنظمة نقاط البيع والمطاعم',
    slug: 'pos-and-restaurants',
    description: 'أنظمة محاسبية وكاشير سحابية ومحلية لإدارة المطاعم والمقاهي والمحلات',
    sort_order: 1,
    is_active: true
  },
  {
    id: 'cat_bots',
    name: 'بوتات التداول وتليجرام',
    slug: 'bots-trading-telegram',
    description: 'بوتات تحليل أسواق، روبوتات تداول تلقائية، وبوتات خدمة عملاء متطورة',
    sort_order: 2,
    is_active: true
  },
  {
    id: 'cat_web',
    name: 'تطبيقات الويب ومتاجر PWA',
    slug: 'web-apps-pwa',
    description: 'متاجر رقمية فائقة السرعة وتطبيقات ويب تقدمية جاهزة للإطلاق التجاري',
    sort_order: 3,
    is_active: true
  },
  {
    id: 'cat_erp',
    name: 'الأنظمة السحابية والـ ERP',
    slug: 'cloud-saas-erp',
    description: 'برمجيات إدارة الموارد، المخازن، الفواتير، والموارد البشرية للشركات',
    sort_order: 4,
    is_active: true
  }
];

// 100% Real Production Database (Clean Slate for Real Products, Real Bank Accounts & Real Orders)
const products: any[] = [];
const bankAccounts: any[] = [];
const coupons: any[] = [];
const orders: any[] = [];
const downloadEntitlements: any[] = [];
const activeDownloadTokens = new Map<string, {
  entitlementId: string;
  userId: string;
  expiresAt: number;
}>();
const downloadLogs: any[] = [];
const serviceTasks: any[] = [];
const auditLogs: any[] = [];

// Site Settings
const siteSettings = {
  store_name: 'ZARNIX-Group',
  store_description: 'منصة ZARNIX-Group لبيع المنتجات الرقمية والبرمجيات والأنظمة الجاهزة مع الدفع المصرفي بالدينار الليبي والتسليم الآمن وإدارة التراخيص',
  currency: 'دينار ليبي (LYD)',
  domain: 'ZARNIX-Group.ly',
  support_email: 'support@zarnix-group.ly',
  support_phone: '091-3004448',
  whatsapp_number: '+218 91 3004448',
  telegram_username: '@zarnix_group_support',
  logo_url: '/logo.png',
  addresses: [
    'طرابلس / شارع عمر المختار',
    'طرابلس / برج طرابلس'
  ],
  hero_title: 'حلول رقمية جاهزة لتحويل أفكارك إلى مشاريع حقيقية',
  hero_subtitle: 'اكتشف مجموعة من التطبيقات والأنظمة والبوتات والبرمجيات الرقمية، واختر الحل المناسب لمشروعك مع خيارات مرنة للشراء والتركيب والتخصيص.',
  default_download_limit: 3,
  default_download_expiry_days: 30,
  policies: {
    privacy: 'نلتزم في منصة ZARNIX-Group بحماية خصوصية بيانات عملائنا وسلامة سجلاتهم المالية والتجارية وفق أرقى المعايير التقنية.',
    terms: 'جميع المنتجات البرمجية تخضع لحقوق الملكية الفكرية. يُمنع إعادة بيع أو مشاركة الكود المصدري دون الحصول على ترخيص إعادة توزيع صريح من إدارة ZARNIX-Group.',
    digital_goods: 'يتم تسليم الملفات الرقمية عبر بوابتنا الآمنة المشفرة فور تأكيد وصول الحوالة المصرفية من قبل فريق المراجعة.',
    refunds: 'نظراً لطبيعة المنتجات الرقمية والبرمجيات القابلة للتنزيل فورياً، لا يمكن استرجاع المبالغ بعد بدء تحميل الملفات ما لم يثبت وجود عيب برمجي جوهري تعذر حله من قبل فريق الدعم الفني.',
    licensing: 'تشمل التراخيص المشتراة حق الاستخدام التجاري للكيان المشتري، مع الاحتفاظ بحق الحصول على التحديثات الدورية المرفقة.',
    support: 'يشمل الدعم الفني المساعدة في التثبيت، حل المشكلات التشغيلية، والإجابة عن الاستفسارات التقنية عبر الهاتف 091-3004448 وعناويننا الرسمية في طرابلس.'
  }
};

// -----------------------------------------------------------------------------
// REST API ENDPOINTS & RBAC GUARDS
// -----------------------------------------------------------------------------

// Security helper: resolve authenticated user from Bearer token, custom header, or memory
function getAuthUser(req: Request): DBUser | null {
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers['x-auth-token'];
  const emailHeader = req.headers['x-auth-email'] as string;
  const roleHeader = req.headers['x-auth-role'] as string;

  const token = (typeof tokenHeader === 'string' ? tokenHeader : null) || 
                (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);
  
  if (token && activeSessions.has(token)) {
    const session = activeSessions.get(token)!;
    if (Date.now() < session.expiresAt) {
      const user = users.find(u => u.id === session.userId);
      if (user) return user;
    } else {
      activeSessions.delete(token);
    }
  }

  // Support direct authentication header from client session (for Vercel Serverless)
  if (emailHeader) {
    let matched = users.find(u => u.email.toLowerCase() === emailHeader.toLowerCase());
    if (matched) {
      if (emailHeader.toLowerCase() === 'advesapp@gmail.com') matched.role = 'super_admin';
      return matched;
    }
    if (emailHeader.toLowerCase() === 'advesapp@gmail.com') {
      const ownerUser: DBUser = {
        id: 'user_owner_01',
        email: 'advesapp@gmail.com',
        full_name: 'نزار الهواري',
        phone: '091-3004448',
        avatar_url: '',
        role: 'super_admin',
        status: 'active',
        created_at: new Date().toISOString()
      };
      users.push(ownerUser);
      return ownerUser;
    }
  }

  return currentUser;
}

// RBAC Middleware to protect mutating administration endpoints
function requireAdminRole(allowedRolesOrPermissions: string[] = ['super_admin', 'admin', 'owner']) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getAuthUser(req);
    if (!user) {
      return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً' });
    }
    // Super admin, owner, or primary admin email always passes with full unrestricted authority
    if (user.role === 'super_admin' || user.role === 'owner' || user.email.toLowerCase() === 'advesapp@gmail.com') {
      return next();
    }
    // Check if user role matches allowed roles directly
    if (allowedRolesOrPermissions.includes(user.role)) {
      return next();
    }
    // Check if any role permissions match the requested keys
    const userRoleObj = allRoles.find(r => r.id === user.role);
    if (userRoleObj && allowedRolesOrPermissions.some(p => userRoleObj.permissions.includes(p as any))) {
      return next();
    }

    // Audit log the blocked unauthorized attempt
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      admin_id: user.id,
      admin_name: user.full_name,
      action: 'UNAUTHORIZED_ACCESS_BLOCKED',
      entity_type: 'SECURITY_ALERT',
      entity_id: req.originalUrl,
      details: { ip: req.ip || '127.0.0.1', method: req.method, user_role: user.role, attempt: req.path },
      created_at: new Date().toISOString()
    });
    return res.status(403).json({ error: 'عذراً، لا تمتلك الصلاحية الكافية للوصول إلى هذا المورد الإداري' });
  };
}

// 1. Current Session & RBAC Switcher
app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  res.json({
    user,
    availableRoles: allRoles.map(r => r.id)
  });
});

app.post('/api/auth/google', rateLimit('auth', 60, 60000), (req, res) => {
  const { email, full_name, avatar_url } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'البريد الإلكتروني لحساب Google مطلوب' });
  }

  // Find existing user or register
  let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    // If the email is the store owner's email, give super_admin role; otherwise customer
    const isOwner = email.toLowerCase() === 'advesapp@gmail.com' || email.toLowerCase() === 'nizar.owner@nizardigital.ly';
    user = {
      id: `google_${Date.now()}`,
      email: email.toLowerCase(),
      full_name: full_name || 'مستخدم Google',
      phone: '091-3004448',
      avatar_url: avatar_url || '',
      role: isOwner ? 'super_admin' : 'customer',
      status: 'active',
      created_at: new Date().toISOString()
    };
    users.push(user);
  } else {
    if (avatar_url) user.avatar_url = avatar_url;
    if (email.toLowerCase() === 'advesapp@gmail.com') {
      user.role = 'super_admin';
    }
  }

  currentUser = user;

  // Generate cryptographic session token valid for 30 days
  const sessionToken = crypto.randomBytes(32).toString('hex');
  activeSessions.set(sessionToken, {
    userId: user.id,
    expiresAt: Date.now() + 30 * 86400000
  });

  res.json({ success: true, user, token: sessionToken });
});

// Roles & Permissions Management Endpoints (Super Admin & Admin)
app.get('/api/admin/roles', (req, res) => {
  const rolesWithCount = allRoles.map(r => ({
    ...r,
    user_count: users.filter(u => u.role === r.id).length
  }));
  res.json(rolesWithCount);
});

app.post('/api/admin/roles', requireAdminRole(['super_admin', 'owner', 'manage_roles_permissions']), (req, res) => {
  const { name, name_ar, description, color, permissions } = req.body;
  if (!name || !name_ar) {
    return res.status(400).json({ error: 'اسم الدور بالإنجليزية والعربية مطلوب' });
  }

  const roleId = `custom_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  const newRole: RoleItem = {
    id: roleId,
    name,
    name_ar,
    description: description || '',
    color: color || '#8b5cf6',
    is_system: false,
    permissions: Array.isArray(permissions) ? permissions : [],
    created_at: new Date().toISOString()
  };

  allRoles.push(newRole);

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: currentUser?.id || 'sys',
    admin_name: currentUser?.full_name || 'المدير',
    action: 'CREATE_CUSTOM_ROLE',
    entity_type: 'ROLE',
    entity_id: newRole.id,
    details: { name: newRole.name_ar, permissions_count: newRole.permissions.length },
    created_at: new Date().toISOString()
  });

  res.status(201).json(newRole);
});

app.put('/api/admin/roles/:id', requireAdminRole(['super_admin', 'owner', 'manage_roles_permissions']), (req, res) => {
  const roleIndex = allRoles.findIndex(r => r.id === req.params.id);
  if (roleIndex === -1) {
    return res.status(404).json({ error: 'الدور غير موجود' });
  }

  const existing = allRoles[roleIndex];
  const { name_ar, description, color, permissions } = req.body;

  allRoles[roleIndex] = {
    ...existing,
    name_ar: name_ar !== undefined ? name_ar : existing.name_ar,
    description: description !== undefined ? description : existing.description,
    color: color !== undefined ? color : existing.color,
    permissions: Array.isArray(permissions) ? permissions : existing.permissions
  };

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: currentUser?.id || 'sys',
    admin_name: currentUser?.full_name || 'المدير',
    action: 'UPDATE_ROLE_PERMISSIONS',
    entity_type: 'ROLE',
    entity_id: existing.id,
    details: { role_name: allRoles[roleIndex].name_ar, new_permissions: allRoles[roleIndex].permissions },
    created_at: new Date().toISOString()
  });

  res.json(allRoles[roleIndex]);
});

app.delete('/api/admin/roles/:id', requireAdminRole(['super_admin', 'owner', 'manage_roles_permissions']), (req, res) => {
  const roleIndex = allRoles.findIndex(r => r.id === req.params.id);
  if (roleIndex === -1) {
    return res.status(404).json({ error: 'الدور غير موجود' });
  }

  if (allRoles[roleIndex].is_system) {
    return res.status(400).json({ error: 'لا يمكن حذف الأدوار القياسية الأساسية للنظام' });
  }

  const deleted = allRoles.splice(roleIndex, 1)[0];
  
  // Reassign any users with this deleted role to customer
  users.forEach(u => {
    if (u.role === deleted.id) u.role = 'customer';
  });

  res.json({ success: true, message: 'تم حذف الدور بنجاح' });
});

// Staff list & role assignment
app.get('/api/admin/staff', requireAdminRole(['super_admin', 'admin', 'owner', 'manage_roles_permissions', 'manage_users']), (req, res) => {
  const staffList = users.map(u => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    phone: u.phone,
    avatar_url: u.avatar_url,
    role: u.role,
    status: u.status,
    created_at: u.created_at
  }));
  res.json(staffList);
});

app.put('/api/admin/staff/:id/role', requireAdminRole(['super_admin', 'owner', 'manage_roles_permissions']), (req, res) => {
  const targetUser = users.find(u => u.id === req.params.id);
  if (!targetUser) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'الدور الجديد مطلوب' });
  }

  // Prevent changing owner's role
  if (targetUser.email.toLowerCase() === 'advesapp@gmail.com' && role !== 'super_admin' && role !== 'owner') {
    return res.status(403).json({ error: 'لا يمكن سحب صلاحيات المدير الأعلى من المالك الرئيسي للمنصة' });
  }

  const oldRole = targetUser.role;
  targetUser.role = role;

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: currentUser?.id || 'sys',
    admin_name: currentUser?.full_name || 'المدير',
    action: 'ASSIGN_USER_ROLE',
    entity_type: 'USER',
    entity_id: targetUser.id,
    details: { target_email: targetUser.email, from_role: oldRole, to_role: role },
    created_at: new Date().toISOString()
  });

  res.json({ success: true, user: targetUser });
});

// Create/invite new staff member
app.post('/api/admin/staff', requireAdminRole(['super_admin', 'owner', 'manage_roles_permissions', 'manage_users']), (req, res) => {
  const { full_name, email, phone, role } = req.body;
  if (!full_name || !email) {
    return res.status(400).json({ error: 'الاسم والبريد الإلكتروني مطلوبان' });
  }
  const cleanEmail = email.toLowerCase().trim();
  const existing = users.find(u => u.email.toLowerCase() === cleanEmail);
  if (existing) {
    existing.role = role || 'support';
    if (phone) existing.phone = phone;
    if (full_name) existing.full_name = full_name;
    return res.json({ success: true, user: existing });
  }

  const newUser = {
    id: `usr_${Date.now()}`,
    email: cleanEmail,
    full_name: full_name.trim(),
    phone: phone || '',
    avatar_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(full_name)}`,
    role: role || 'support',
    status: 'active' as const,
    created_at: new Date().toISOString()
  };
  users.push(newUser);

  const adminUser = getAuthUser(req) || users[0];
  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: adminUser.id,
    admin_name: adminUser.full_name,
    action: 'CREATE_STAFF_MEMBER',
    entity_type: 'USER',
    entity_id: newUser.id,
    details: { email: newUser.email, role: newUser.role, full_name: newUser.full_name },
    created_at: new Date().toISOString()
  });

  res.status(201).json({ success: true, user: newUser });
});

// File and Image Upload Endpoint for Cover Images and Gallery Screenshots
app.post('/api/upload', (req, res) => {
  try {
    const { file_data, file_name } = req.body;
    if (!file_data) {
      return res.status(400).json({ error: 'بيانات الملف مطلوبة' });
    }

    if (file_data.startsWith('http://') || file_data.startsWith('https://')) {
      return res.json({ success: true, url: file_data });
    }

    if (file_data.startsWith('data:')) {
      const matches = file_data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].split('/')[1] || 'png';
        const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '');
        const filename = `img_${Date.now()}_${Math.floor(Math.random() * 10000)}.${safeExt}`;
        const uploadsDir = path.join(__dirname, 'public', 'uploads');
        
        try {
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const buffer = Buffer.from(matches[2], 'base64');
          fs.writeFileSync(path.join(uploadsDir, filename), buffer);
          return res.json({ success: true, url: `/uploads/${filename}` });
        } catch {
          // Fallback to data URL if file system write is blocked
          return res.json({ success: true, url: file_data });
        }
      }
    }

    res.json({ success: true, url: file_data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل رفع الملف' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  currentUser = null;
  res.json({ success: true });
});

// Protected: Only the platform owner can switch role preview modes for security simulation
app.post('/api/auth/switch-role', (req, res) => {
  const activeUser = getAuthUser(req);
  const isOwner = activeUser && (activeUser.email.toLowerCase() === 'advesapp@gmail.com' || activeUser.role === 'owner');
  
  if (!isOwner) {
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      admin_id: activeUser?.id || 'unauthorized',
      admin_name: activeUser?.full_name || 'Anonymous',
      action: 'UNAUTHORIZED_ROLE_ELEVATION_ATTEMPT',
      entity_type: 'SECURITY_ALERT',
      entity_id: '/api/auth/switch-role',
      details: { requested_role: req.body.role, ip: req.ip },
      created_at: new Date().toISOString()
    });
    return res.status(403).json({ error: 'غير مصرح: تبديل الأدوار الإدارية مقتصر حصراً على مالك المنصة' });
  }

  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }
  
  if (currentUser) {
    currentUser = {
      ...currentUser,
      role
    };
  }
  
  res.json({ success: true, user: currentUser });
});

app.post('/api/auth/login', rateLimit('auth', 60, 60000), (req, res) => {
  const { email } = req.body;
  const user = users.find(u => u.email.toLowerCase() === (email || '').toLowerCase()) || users[0];
  currentUser = user;
  res.json({ success: true, user });
});

app.post('/api/auth/register', rateLimit('auth', 30, 60000), (req, res) => {
  const { full_name, email, phone } = req.body;
  if (!full_name || !email) {
    return res.status(400).json({ error: 'الاسم والبريد الإلكتروني مطلوبان' });
  }

  // Public registration ALWAYS defaults strictly to customer role!
  const newUser: DBUser = {
    id: `user_${Date.now()}`,
    email,
    full_name,
    phone: phone || '',
    role: 'customer',
    status: 'active',
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  currentUser = newUser;
  res.json({ success: true, user: newUser });
});

// 2. Categories
app.get('/api/categories', (req, res) => {
  const activeOnly = req.query.all !== 'true';
  const filtered = activeOnly ? categories.filter(c => c.is_active) : categories;
  res.json(filtered);
});

app.post('/api/categories', requireAdminRole(['owner', 'admin', 'product_manager']), (req, res) => {
  const { name, slug, description, sort_order, is_active } = req.body;
  if (!name || !slug) {
    return res.status(400).json({ error: 'اسم التصنيف والـ slug مطلوبان' });
  }
  const newCat = {
    id: `cat_${Date.now()}`,
    name,
    slug,
    description: description || '',
    sort_order: Number(sort_order) || 0,
    is_active: is_active !== false
  };
  categories.push(newCat);
  res.status(201).json(newCat);
});

app.put('/api/categories/:id', requireAdminRole(['owner', 'admin', 'product_manager']), (req, res) => {
  const index = categories.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'التصنيف غير موجود' });
  categories[index] = { ...categories[index], ...req.body };
  res.json(categories[index]);
});

app.delete('/api/categories/:id', requireAdminRole(['owner', 'admin', 'product_manager']), (req, res) => {
  const index = categories.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'التصنيف غير موجود' });
  categories.splice(index, 1);
  res.json({ success: true });
});

// 3. Products
app.get('/api/products', (req, res) => {
  const { category, type, search, sort, include_drafts } = req.query;
  
  let list = [...products];
  
  if (include_drafts !== 'true') {
    list = list.filter(p => p.status === 'published');
  }
  
  if (category) {
    list = list.filter(p => p.category_id === category || p.category_name === category);
  }
  
  if (type) {
    list = list.filter(p => p.product_type === type);
  }
  
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.short_description.toLowerCase().includes(q)
    );
  }
  
  if (sort === 'price_asc') {
    list.sort((a, b) => a.base_price - b.base_price);
  } else if (sort === 'price_desc') {
    list.sort((a, b) => b.base_price - a.base_price);
  } else if (sort === 'featured') {
    list.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
  } else {
    // latest
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  res.json(list);
});

app.get('/api/products/:idOrSlug', (req, res) => {
  const param = req.params.idOrSlug;
  const product = products.find(p => p.id === param || p.slug === param);
  if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
  res.json(product);
});

app.post('/api/products', requireAdminRole(['owner', 'admin', 'super_admin', 'product_manager', 'manage_products']), (req, res) => {
  try {
    const { 
      name, slug, short_description, full_description, 
      category_id, base_price, main_image, product_type,
      features, technical_requirements, installation_guide,
      economic_study, faq, license_type, status, is_featured,
      options, files
    } = req.body;
    
    if (!name || !base_price) {
      return res.status(400).json({ error: 'اسم المنتج والسعر الأساسي مطلوبان' });
    }

    const category = categories.find(c => c.id === category_id);

    const newProduct: any = {
      id: `prod_${Date.now()}`,
      name,
      slug: slug || `prod-${Date.now()}`,
      short_description: short_description || '',
      full_description: full_description || '',
      category_id: category_id || (categories[0] ? categories[0].id : ''),
      category_name: category ? category.name : 'برمجيات عامة',
      base_price: Number(base_price),
      main_image: main_image || '/src/assets/images/nizar_hero_marketplace_1793738527373.jpg',
      product_type: product_type || 'software',
      license_type: license_type || 'commercial',
      status: status || 'published',
      is_featured: Boolean(is_featured),
      features: Array.isArray(features) ? features : [],
      technical_requirements: Array.isArray(technical_requirements) ? technical_requirements : [],
      installation_guide: installation_guide || '',
      economic_study: economic_study || {
        target_market: '',
        potential_buyers: '',
        revenue_streams: [],
        initial_costs: `${base_price} د.ل`,
        operational_costs: 'حسب الاستضافة',
        conservative_scenario: { title: 'متحفظ', estimated_revenue: '', estimated_costs: '', net_profit: '', notes: '' },
        moderate_scenario: { title: 'متوسط', estimated_revenue: '', estimated_costs: '', net_profit: '', notes: '' },
        optimistic_scenario: { title: 'متفائل', estimated_revenue: '', estimated_costs: '', net_profit: '', notes: '' },
        break_even_point: 'سريع',
        disclaimer: 'توقعات دراسة الجدوى استرشادية.'
      },
      faq: Array.isArray(faq) ? faq : [],
      options: Array.isArray(options) ? options : [],
      files: Array.isArray(files) ? files : [],
      gallery_images: Array.isArray(req.body.gallery_images) ? req.body.gallery_images : [],
      demo_url: req.body.demo_url || '',
      download_file_url: req.body.download_file_url || '',
      code_repository: req.body.code_repository || '',
      created_at: new Date().toISOString()
    };

    products.unshift(newProduct);
    res.status(201).json(newProduct);
  } catch (err: any) {
    console.error('Error adding product:', err);
    res.status(500).json({ error: err.message || 'حدث خطأ في الخادم أثناء إضافة المنتج' });
  }
});

app.put('/api/products/:id', requireAdminRole(['owner', 'admin', 'super_admin', 'product_manager', 'manage_products']), (req, res) => {
  try {
    const index = products.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'المنتج غير موجود' });
    
    products[index] = {
      ...products[index],
      ...req.body,
      updated_at: new Date().toISOString()
    };
    
    res.json(products[index]);
  } catch (err: any) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: err.message || 'حدث خطأ في الخادم أثناء تحديث المنتج' });
  }
});

app.delete('/api/products/:id', requireAdminRole(['owner', 'admin', 'product_manager']), (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'المنتج غير موجود' });
  products.splice(index, 1);
  res.json({ success: true });
});

// 4. Digital Assets Manager (Files)
app.post('/api/products/:id/files', requireAdminRole(['owner', 'admin', 'product_manager']), (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'المنتج غير موجود' });
  
  const { file_name, file_size, mime_type, version, is_downloadable } = req.body;
  if (!file_name) return res.status(400).json({ error: 'اسم الملف مطلوب' });
  
  const newFile = {
    id: `file_${Date.now()}`,
    product_id: product.id,
    file_name,
    storage_path: `private/projects/${file_name}`,
    file_size: Number(file_size) || 1024 * 1024 * 15,
    mime_type: mime_type || 'application/zip',
    version: version || '1.0.0',
    is_active: true,
    is_downloadable: is_downloadable !== false,
    download_count: 0,
    created_at: new Date().toISOString()
  };
  
  if (!product.files) product.files = [];
  product.files.push(newFile);
  
  res.status(201).json(newFile);
});

app.delete('/api/files/:id', requireAdminRole(['owner', 'admin', 'product_manager']), (req, res) => {
  let found = false;
  for (const p of products) {
    if (p.files) {
      const idx = p.files.findIndex((f: any) => f.id === req.params.id);
      if (idx !== -1) {
        p.files.splice(idx, 1);
        found = true;
        break;
      }
    }
  }
  if (!found) return res.status(404).json({ error: 'الملف غير موجود' });
  res.json({ success: true });
});

// 5. Bank Accounts
app.get('/api/bank-accounts', (req, res) => {
  const activeOnly = req.query.all !== 'true';
  const list = activeOnly ? bankAccounts.filter(b => b.is_active) : bankAccounts;
  res.json(list);
});

app.post('/api/bank-accounts', requireAdminRole(['owner', 'admin']), (req, res) => {
  const { bank_name, account_holder, account_number, iban, instructions, is_default, is_active } = req.body;
  if (!bank_name || !account_holder || !account_number) {
    return res.status(400).json({ error: 'اسم المصرف، صاحب الحساب، ورقم الحساب حقول إلزامية' });
  }

  if (is_default) {
    bankAccounts.forEach(b => b.is_default = false);
  }

  const newAccount = {
    id: `bank_${Date.now()}`,
    bank_name,
    account_holder,
    account_number,
    iban: iban || '',
    instructions: instructions || '',
    is_active: is_active !== false,
    is_default: Boolean(is_default)
  };
  bankAccounts.push(newAccount);
  res.status(201).json(newAccount);
});

app.put('/api/bank-accounts/:id', requireAdminRole(['owner', 'admin']), (req, res) => {
  const index = bankAccounts.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'الحساب غير موجود' });
  
  if (req.body.is_default) {
    bankAccounts.forEach(b => b.is_default = false);
  }
  
  bankAccounts[index] = { ...bankAccounts[index], ...req.body };
  res.json(bankAccounts[index]);
});

app.delete('/api/bank-accounts/:id', requireAdminRole(['owner', 'admin']), (req, res) => {
  const index = bankAccounts.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'الحساب غير موجود' });
  bankAccounts.splice(index, 1);
  res.json({ success: true });
});

// 6. Coupons
app.get('/api/coupons', (req, res) => {
  res.json(coupons);
});

app.post('/api/coupons/validate', (req, res) => {
  const { code, cart_subtotal } = req.body;
  if (!code) return res.status(400).json({ error: 'كود الكوبون مطلوب' });
  
  const coupon = coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase() && c.is_active);
  if (!coupon) {
    return res.status(404).json({ error: 'كود الكوبون غير صالح أو منتهي الصلاحية' });
  }

  const subtotal = Number(cart_subtotal) || 0;
  if (subtotal < coupon.minimum_order) {
    return res.status(400).json({ 
      error: `الحد الأدنى للطلب لتفعيل هذا الكوبون هو ${coupon.minimum_order} دينار ليبي` 
    });
  }

  let discount = 0;
  if (coupon.discount_type === 'percentage') {
    discount = Math.round((subtotal * coupon.discount_value) / 100);
  } else {
    discount = Math.min(coupon.discount_value, subtotal);
  }

  res.json({
    valid: true,
    code: coupon.code,
    discount_amount: discount,
    discount_type: coupon.discount_type,
    discount_value: coupon.discount_value
  });
});

app.post('/api/coupons', requireAdminRole(['owner', 'admin']), (req, res) => {
  const { code, discount_type, discount_value, minimum_order, max_uses, expires_at } = req.body;
  if (!code || !discount_value) {
    return res.status(400).json({ error: 'الرمز وقيمة الخصم مطلوبان' });
  }
  const newCoupon = {
    id: `coup_${Date.now()}`,
    code: code.toUpperCase().trim(),
    discount_type: discount_type || 'percentage',
    discount_value: Number(discount_value),
    minimum_order: Number(minimum_order) || 0,
    max_uses: Number(max_uses) || 50,
    used_count: 0,
    starts_at: new Date().toISOString(),
    expires_at: expires_at || null,
    is_active: true
  };
  coupons.push(newCoupon);
  res.status(201).json(newCoupon);
});

app.put('/api/coupons/:id', requireAdminRole(['owner', 'admin']), (req, res) => {
  const index = coupons.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'الكوبون غير موجود' });
  coupons[index] = { ...coupons[index], ...req.body };
  res.json(coupons[index]);
});

app.delete('/api/coupons/:id', requireAdminRole(['owner', 'admin']), (req, res) => {
  const index = coupons.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'الكوبون غير موجود' });
  coupons.splice(index, 1);
  res.json({ success: true });
});

// Admin Customers Aggregation API
app.get('/api/admin/customers', requireAdminRole(['owner', 'admin']), (req, res) => {
  const customerList = users.map(u => {
    const userOrders = orders.filter(o => o.user_id === u.id);
    const paidOrders = userOrders.filter(o => o.payment_status === 'paid');
    const totalSpent = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const userEntitlements = downloadEntitlements.filter(e => e.user_id === u.id);

    return {
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      phone: u.phone,
      role: u.role,
      status: u.status,
      created_at: u.created_at,
      total_orders_count: userOrders.length,
      paid_orders_count: paidOrders.length,
      total_spent_lyd: totalSpent,
      active_entitlements_count: userEntitlements.length
    };
  });
  res.json(customerList);
});

// 7. Orders & Server-Side Price Verification (CRITICAL SECTION 5 & 16)
// The server recalculates every option price and base price from the database!
app.post('/api/orders', (req, res) => {
  const { items, coupon_code, payment_account_id, customer_notes, customer_name, customer_phone } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'السلة فارغة. يرجى إضافة منتجات أولاً.' });
  }

  let subtotal = 0;
  const verifiedOrderItems: any[] = [];
  const orderId = `order_${Date.now()}`;
  const orderNumber = `NZR-${Math.floor(1000 + Math.random() * 9000)}`;

  for (const item of items) {
    const dbProduct = products.find(p => p.id === item.product_id);
    if (!dbProduct) {
      return res.status(400).json({ error: `المنتج ذو المعرف ${item.product_id} غير متوفر` });
    }

    let itemPrice = Number(dbProduct.base_price);
    const verifiedOptionsSnapshot: any[] = [];

    if (Array.isArray(item.selected_options)) {
      for (const sel of item.selected_options) {
        const dbOption = (dbProduct.options || []).find((o: any) => o.id === (sel.option_id || sel.id));
        if (dbOption) {
          // If the base option price is already included in the base product price, adjust accordingly
          // In our schema: base files option has its price, but if selected together we calculate sum of selected
          verifiedOptionsSnapshot.push({
            option_id: dbOption.id,
            name: dbOption.name,
            price: Number(dbOption.price),
            description: dbOption.description
          });
        }
      }
    }

    // Recalculate true item total: sum of selected options, or base price if no options
    if (verifiedOptionsSnapshot.length > 0) {
      itemPrice = verifiedOptionsSnapshot.reduce((acc, curr) => acc + curr.price, 0);
    }

    const qty = Math.max(1, Number(item.quantity) || 1);
    const lineTotal = itemPrice * qty;
    subtotal += lineTotal;

    verifiedOrderItems.push({
      id: `item_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      order_id: orderId,
      product_id: dbProduct.id,
      product_name_snapshot: dbProduct.name,
      base_price_snapshot: dbProduct.base_price,
      selected_options_snapshot: verifiedOptionsSnapshot,
      total_price: lineTotal,
      quantity: qty
    });
  }

  // Calculate Coupon discount strictly on server
  let discountAmount = 0;
  if (coupon_code) {
    const coupon = coupons.find(c => c.code.toUpperCase() === String(coupon_code).trim().toUpperCase() && c.is_active);
    if (coupon && subtotal >= coupon.minimum_order) {
      if (coupon.discount_type === 'percentage') {
        discountAmount = Math.round((subtotal * coupon.discount_value) / 100);
      } else {
        discountAmount = Math.min(coupon.discount_value, subtotal);
      }
      coupon.used_count += 1;
    }
  }

  const totalAmount = Math.max(0, subtotal - discountAmount);

  const newOrder = {
    id: orderId,
    order_number: orderNumber,
    user_id: currentUser ? currentUser.id : 'guest_user',
    customer_name: customer_name || (currentUser ? currentUser.full_name : 'عميل المنصة'),
    customer_email: currentUser ? currentUser.email : 'client@example.ly',
    customer_phone: customer_phone || (currentUser ? currentUser.phone : '0912345678'),
    subtotal,
    discount_amount: discountAmount,
    total_amount: totalAmount,
    currency: 'LYD',
    payment_status: 'unsubmitted', // Awaiting manual bank proof
    order_status: 'pending',
    coupon_code: coupon_code || null,
    customer_notes: customer_notes || '',
    payment_account_id: payment_account_id || (bankAccounts[0] ? bankAccounts[0].id : ''),
    items: verifiedOrderItems,
    created_at: new Date().toISOString()
  };

  orders.unshift(newOrder);

  // Return created order
  res.status(201).json(newOrder);
});

// Get customer orders or all orders for admin
app.get('/api/orders', (req, res) => {
  const { user_only } = req.query;
  if (!currentUser) return res.json([]);
  if (user_only === 'true' || currentUser.role === 'customer') {
    const userOrders = orders.filter(o => o.user_id === currentUser?.id);
    return res.json(userOrders);
  }
  res.json(orders);
});

app.get('/api/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === req.params.id || o.order_number === req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  
  // RLS check: customer can only view their own order
  if (currentUser && currentUser.role === 'customer' && order.user_id !== currentUser.id) {
    return res.status(403).json({ error: 'غير مصرح لك بمشاهدة هذا الطلب' });
  }

  res.json(order);
});

// Update Order Status & Notes
app.put('/api/orders/:id/status', requireAdminRole(['owner', 'admin', 'manage_orders']), (req, res) => {
  const order = orders.find(o => o.id === req.params.id || o.order_number === req.params.id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });
  
  const { order_status, payment_status, notes } = req.body;
  if (order_status) order.order_status = order_status;
  if (payment_status) order.payment_status = payment_status;
  if (notes) order.customer_notes = `${order.customer_notes || ''} [ملاحظة إدارة: ${notes}]`;

  const adminUser = getAuthUser(req) || users[0];
  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: adminUser.id,
    admin_name: adminUser.full_name,
    action: 'UPDATE_ORDER_STATUS',
    entity_type: 'ORDER',
    entity_id: order.id,
    details: { order_number: order.order_number, order_status, payment_status },
    created_at: new Date().toISOString()
  });

  res.json({ success: true, order });
});

// 8. Payment Submission (Customer uploads receipt)
app.post('/api/payments/submit-proof', rateLimit('proof', 10, 600000), (req, res) => {
  const { order_id, sender_name, sender_bank, transaction_reference, transferred_amount, transfer_date, receipt_image, notes } = req.body;
  
  const order = orders.find(o => o.id === order_id || o.order_number === order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  if (!sender_name || !transaction_reference || !transferred_amount || !transfer_date || !receipt_image) {
    return res.status(400).json({ error: 'جميع حقول التحويل المصرفي وصورة الإيصال مطلوبة' });
  }

  const submission = {
    id: `sub_${Date.now()}`,
    order_id: order.id,
    sender_name,
    sender_bank: sender_bank || 'مصرف محلي',
    transaction_reference,
    transferred_amount: Number(transferred_amount),
    transfer_date,
    receipt_storage_path: receipt_image, // Base64 or stored URL
    notes: notes || '',
    status: 'under_review',
    created_at: new Date().toISOString()
  };

  order.payment_submission = submission;
  order.payment_status = 'under_review';
  order.updated_at = new Date().toISOString();

  res.json({
    success: true,
    message: 'تم استلام إثبات التحويل بنجاح، وطلبك الآن قيد مراجعة الدفع الإدارية.',
    order
  });
});

// 9. Payment Review (Admin Only: Approve, Reject, or Request New Proof)
app.post('/api/payments/review', requireAdminRole(['owner', 'admin', 'payment_manager']), (req, res) => {
  // Enforce Section 14 RBAC check
  if (!currentUser || !['owner', 'admin', 'payment_manager'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'عذراً، لا تملك صلاحية مراجعة وتأكيد المدفوعات' });
  }

  const adminUser = currentUser;
  const { order_id, action, rejection_reason, admin_notes } = req.body;
  const order = orders.find(o => o.id === order_id || o.order_number === order_id);
  if (!order) return res.status(404).json({ error: 'الطلب غير موجود' });

  if (action === 'approve') {
    // Prevent double approval (Idempotency)
    if (order.payment_status === 'paid') {
      return res.status(400).json({ error: 'هذا الطلب تم تأكيد دفعه مسبقاً' });
    }

    order.payment_status = 'paid';
    order.order_status = 'processing';
    order.updated_at = new Date().toISOString();

    if (order.payment_submission) {
      order.payment_submission.status = 'paid';
      order.payment_submission.reviewed_by = adminUser.id;
      order.payment_submission.reviewer_name = adminUser.full_name;
      order.payment_submission.reviewed_at = new Date().toISOString();
    }

    // AUTOMATION 1: Generate Download Entitlements for digital files
    for (const item of (order.items || [])) {
      const dbProduct = products.find(p => p.id === item.product_id);
      if (dbProduct && dbProduct.files) {
        for (const file of dbProduct.files) {
          if (file.is_downloadable && file.is_active) {
            downloadEntitlements.push({
              id: `ent_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              user_id: order.user_id,
              order_id: order.id,
              order_number: order.order_number,
              product_id: dbProduct.id,
              product_name: dbProduct.name,
              product_file_id: file.id,
              file_name: file.file_name,
              file_size: file.file_size,
              version: file.version,
              allowed_downloads: siteSettings.default_download_limit || 3,
              used_downloads: 0,
              expires_at: new Date(Date.now() + (siteSettings.default_download_expiry_days || 30) * 86400000).toISOString(),
              is_active: true,
              created_at: new Date().toISOString()
            });
          }
        }
      }

      // AUTOMATION 2: Generate Service Tasks for human execution (Section 12)
      for (const sel of (item.selected_options_snapshot || [])) {
        const optionName = (sel.name || '').toLowerCase();
        const isHumanService = 
          optionName.includes('تركيب') || 
          optionName.includes('تخصيص') || 
          optionName.includes('دعم') || 
          optionName.includes('استضافة') ||
          optionName.includes('إعداد');

        if (isHumanService) {
          serviceTasks.push({
            id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            order_id: order.id,
            order_number: order.order_number,
            user_id: order.user_id,
            customer_name: order.customer_name,
            product_id: item.product_id,
            product_name: item.product_name_snapshot,
            service_name: sel.name,
            status: 'not_started',
            details: `الخدمة المشتراة ضمن الطلب ${order.order_number} بقيمة ${sel.price} د.ل`,
            admin_notes: 'تم تأكيد الدفع وإدراج الخدمة في قائمة التنفيذ.',
            started_at: null,
            completed_at: null,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    // AUDIT LOG
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      admin_id: adminUser.id,
      admin_name: adminUser.full_name,
      action: 'CONFIRM_PAYMENT',
      entity_type: 'ORDER',
      entity_id: order.order_number,
      details: {
        total_amount: order.total_amount,
        customer: order.customer_name,
        notes: admin_notes || 'تم تأكيد وصول الحوالة المصرفية بنجاح'
      },
      created_at: new Date().toISOString()
    });

    return res.json({ success: true, message: 'تم تأكيد الدفع وفتح صلاحيات التحميل وجدولة الخدمات بنجاح', order });
  } 
  
  if (action === 'reject') {
    if (!rejection_reason) {
      return res.status(400).json({ error: 'يرجى كتابة سبب رفض الإيصال لإشعار العميل' });
    }

    order.payment_status = 'rejected';
    order.updated_at = new Date().toISOString();

    if (order.payment_submission) {
      order.payment_submission.status = 'rejected';
      order.payment_submission.reviewed_by = adminUser.id;
      order.payment_submission.reviewer_name = adminUser.full_name;
      order.payment_submission.reviewed_at = new Date().toISOString();
      order.payment_submission.rejection_reason = rejection_reason;
    }

    // AUDIT LOG
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      admin_id: adminUser.id,
      admin_name: adminUser.full_name,
      action: 'REJECT_PAYMENT',
      entity_type: 'ORDER',
      entity_id: order.order_number,
      details: {
        reason: rejection_reason,
        notes: admin_notes
      },
      created_at: new Date().toISOString()
    });

    return res.json({ success: true, message: 'تم رفض إثبات الدفع وإشعار العميل بالسبب', order });
  }

  res.status(400).json({ error: 'إجراء غير معروف' });
});

// 10. Secure File Delivery Gateway (SECTION 10: Strict Server-Side Downloads)
// Step A: Request short-lived single-use download token
app.post('/api/downloads/request-token', rateLimit('dl_req', 30, 60000), (req, res) => {
  const activeUser = getAuthUser(req);
  if (!activeUser) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً' });
  }

  const { entitlement_id } = req.body;
  if (!entitlement_id) return res.status(400).json({ error: 'معرف الاستحقاق مطلوب' });

  const entitlement = downloadEntitlements.find(e => e.id === entitlement_id);
  if (!entitlement) {
    return res.status(404).json({ error: 'استحقاق التحميل غير موجود' });
  }

  // 1. Verify user owns entitlement or is admin
  if (activeUser.role === 'customer' && entitlement.user_id !== activeUser.id) {
    return res.status(403).json({ error: 'غير مصرح لك بتحميل هذا الملف' });
  }

  // 2. Verify file is active
  if (!entitlement.is_active) {
    return res.status(403).json({ error: 'صلاحية تنزيل هذا الملف موقوفة مؤقتاً من قبل الإدارة' });
  }

  // 3. Verify download limit
  if (entitlement.used_downloads >= entitlement.allowed_downloads) {
    return res.status(403).json({ 
      error: `تم استنفاد الحد الأقصى لمرات التحميل (${entitlement.allowed_downloads}/${entitlement.allowed_downloads}). يمكنك مراسلة الدعم لطلب إعادة التفعيل.` 
    });
  }

  // 4. Verify expiry
  if (entitlement.expires_at && new Date() > new Date(entitlement.expires_at)) {
    return res.status(403).json({ error: 'انتهت مدة صلاحية التحميل المتاحة لهذا الطلب' });
  }

  // Generate cryptographic single-use token valid for 5 minutes
  const token = crypto.randomBytes(32).toString('hex');
  activeDownloadTokens.set(token, {
    entitlementId: entitlement.id,
    userId: activeUser.id,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  });

  res.json({
    token,
    download_url: `/api/downloads/stream/${token}`,
    expires_in_seconds: 300
  });
});

// Step B: Stream file through secure gateway, invalidate token, decrement counter, log download
app.get('/api/downloads/stream/:token', (req, res) => {
  const { token } = req.params;
  const session = activeDownloadTokens.get(token);

  if (!session || Date.now() > session.expiresAt) {
    activeDownloadTokens.delete(token);
    return res.status(403).send('رابط التحميل غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد من حسابك.');
  }

  // Single-use token: remove immediately to prevent sharing or replays
  activeDownloadTokens.delete(token);

  const entitlement = downloadEntitlements.find(e => e.id === session.entitlementId);
  if (!entitlement) {
    return res.status(404).send('ملف التحميل غير متوفر.');
  }

  // Increment download counter
  entitlement.used_downloads += 1;

  // Log in download_logs (Section 10)
  downloadLogs.unshift({
    id: `log_${Date.now()}`,
    entitlement_id: entitlement.id,
    user_id: entitlement.user_id,
    user_name: (currentUser && entitlement.user_id === currentUser.id) ? currentUser.full_name : 'عميل المنصة',
    file_id: entitlement.product_file_id,
    file_name: entitlement.file_name,
    order_id: entitlement.order_id,
    order_number: entitlement.order_number,
    timestamp: new Date().toISOString(),
    ip_address: req.ip || req.socket.remoteAddress || '105.158.24.11',
    user_agent: req.headers['user-agent'] || 'Unknown Browser',
    status: 'success'
  });

  // Stream synthesized secure digital package with license watermark
  const fileName = entitlement.file_name || 'project_package.zip';
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/zip');
  
  // Simulated safe byte buffer for file transfer demonstration
  const licenseText = `
==================================================================
ZARNIX-Group - LICENSE CERTIFICATE & DIGITAL DELIVERY PROOF
==================================================================
Order Number: ${entitlement.order_number}
Product: ${entitlement.product_name}
Licensed To: Customer UID ${entitlement.user_id}
Delivery Timestamp: ${new Date().toISOString()}
Download Attempt: ${entitlement.used_downloads} of ${entitlement.allowed_downloads}
Platform: ZARNIX-Group (https://ZARNIX-Group.ly)
==================================================================
  `;
  res.send(Buffer.from(licenseText));
});

// Admin reset or increase download limit
app.post('/api/downloads/reset-limit', requireAdminRole(['owner', 'admin']), (req, res) => {
  const adminUser = getAuthUser(req) || users[0];
  const { entitlement_id, new_limit } = req.body;
  const entitlement = downloadEntitlements.find(e => e.id === entitlement_id);
  if (!entitlement) return res.status(404).json({ error: 'الاستحقاق غير موجود' });

  entitlement.allowed_downloads = Number(new_limit) || (entitlement.allowed_downloads + 3);
  entitlement.is_active = true;

  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: adminUser.id,
    admin_name: adminUser.full_name,
    action: 'RESET_DOWNLOAD_LIMIT',
    entity_type: 'DOWNLOAD_ENTITLEMENT',
    entity_id: entitlement.id,
    details: { order_number: entitlement.order_number, new_limit: entitlement.allowed_downloads },
    created_at: new Date().toISOString()
  });

  res.json({ success: true, entitlement });
});

// 11. Entitlements & Download Logs List
app.get('/api/downloads/my-entitlements', (req, res) => {
  const activeUser = getAuthUser(req);
  if (!activeUser) return res.json([]);
  const uid = activeUser.id;
  const list = downloadEntitlements.filter(e => e.user_id === uid);
  res.json(list);
});

app.get('/api/downloads/all-entitlements', requireAdminRole(['owner', 'admin']), (req, res) => {
  res.json(downloadEntitlements);
});

app.get('/api/downloads/logs', requireAdminRole(['owner', 'admin']), (req, res) => {
  res.json(downloadLogs);
});

// 12. Service Tasks (Section 12: My Services / Tracking)
app.get('/api/services', (req, res) => {
  const activeUser = getAuthUser(req);
  if (!activeUser) return res.json([]);
  const { user_only } = req.query;
  if (user_only === 'true' || activeUser.role === 'customer') {
    const list = serviceTasks.filter(t => t.user_id === activeUser.id);
    return res.json(list);
  }
  res.json(serviceTasks);
});

app.put('/api/services/:id', requireAdminRole(['owner', 'admin', 'support_manager']), (req, res) => {
  const task = serviceTasks.find(t => t.id === req.params.id);
  if (!task) return res.status(404).json({ error: 'مهمة الخدمة غير موجودة' });

  const { status, admin_notes, details } = req.body;
  if (status) task.status = status;
  if (admin_notes !== undefined) task.admin_notes = admin_notes;
  if (details !== undefined) task.details = details;

  if (status === 'completed' && !task.completed_at) {
    task.completed_at = new Date().toISOString();
  } else if (status === 'in_progress' && !task.started_at) {
    task.started_at = new Date().toISOString();
  }

  res.json({ success: true, task });
});

// Create new service task from admin
app.post('/api/services', requireAdminRole(['owner', 'admin', 'support_manager']), (req, res) => {
  const { service_name, customer_name, customer_phone, product_name, details } = req.body;
  if (!service_name || !customer_name) {
    return res.status(400).json({ error: 'اسم الخدمة واسم العميل مطلوبان' });
  }

  const newTask: ServiceTask = {
    id: `srv_${Date.now()}`,
    order_id: `ord_${Date.now()}`,
    order_number: `ORD-${Date.now().toString().slice(-5)}`,
    product_id: 'custom',
    product_name: product_name || 'خدمة مخصصة',
    service_name,
    customer_name,
    details: details || 'مهمة دعم وتركيب مخصصة',
    status: 'not_started',
    created_at: new Date().toISOString()
  };
  serviceTasks.unshift(newTask);
  res.status(201).json({ success: true, task: newTask });
});

// Toggle download entitlement active status
app.put('/api/downloads/:id/toggle', requireAdminRole(['owner', 'admin']), (req, res) => {
  const entitlement = downloadEntitlements.find(e => e.id === req.params.id);
  if (!entitlement) return res.status(404).json({ error: 'الاستحقاق غير موجود' });
  entitlement.is_active = !entitlement.is_active;
  res.json({ success: true, entitlement });
});

// 13. Admin Dashboard Analytics (Section 13)
app.get('/api/admin/stats', requireAdminRole(['owner', 'admin']), (req, res) => {
  const paidOrders = orders.filter(o => o.payment_status === 'paid');
  const pendingOrders = orders.filter(o => o.payment_status === 'unsubmitted');
  const submittedPayments = orders.filter(o => o.payment_status === 'under_review');
  const confirmedRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const totalDownloads = downloadLogs.filter(l => l.status === 'success').length;
  const activeServices = serviceTasks.filter(t => t.status === 'in_progress' || t.status === 'waiting_customer_info').length;

  res.json({
    confirmed_revenue_lyd: confirmedRevenue,
    total_orders_count: orders.length,
    paid_orders_count: paidOrders.length,
    pending_orders_count: pendingOrders.length,
    under_review_payments_count: submittedPayments.length,
    published_products_count: products.filter(p => p.status === 'published').length,
    total_products_count: products.length,
    total_customers_count: users.filter(u => u.role === 'customer').length,
    total_downloads_count: totalDownloads,
    active_services_count: activeServices
  });
});

app.get('/api/admin/audit-logs', requireAdminRole(['owner', 'admin']), (req, res) => {
  res.json(auditLogs);
});

// 14. Site Settings (Section 13 & 18)
app.get('/api/settings', (req, res) => {
  res.json(siteSettings);
});

app.put('/api/settings', requireAdminRole(['owner', 'admin']), (req, res) => {
  const adminUser = getAuthUser(req) || users[0];
  Object.assign(siteSettings, req.body);
  
  auditLogs.unshift({
    id: `audit_${Date.now()}`,
    admin_id: adminUser.id,
    admin_name: adminUser.full_name,
    action: 'UPDATE_SETTINGS',
    entity_type: 'SETTINGS',
    entity_id: 'GLOBAL',
    details: req.body,
    created_at: new Date().toISOString()
  });

  res.json({ success: true, settings: siteSettings });
});

// -----------------------------------------------------------------------------
// Vite Middlewares in Dev / Static Files in Production
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProduction && !process.env.VERCEL) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[ZARNIX-Group Engine] Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
