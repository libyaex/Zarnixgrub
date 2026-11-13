export type UserRole = 
  | 'owner' 
  | 'super_admin'
  | 'admin' 
  | 'moderator'
  | 'support'
  | 'editor'
  | 'product_manager' 
  | 'payment_manager' 
  | 'support_manager' 
  | 'customer'
  | string;

export type PermissionKey =
  | 'manage_products'
  | 'manage_orders'
  | 'approve_payments'
  | 'manage_downloads'
  | 'manage_services'
  | 'manage_coupons'
  | 'manage_banks'
  | 'manage_roles_permissions'
  | 'manage_users'
  | 'view_financial_analytics'
  | 'manage_settings'
  | 'view_audit_logs';

export interface RoleItem {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  color: string;
  is_system: boolean;
  permissions: PermissionKey[];
  user_count?: number;
  created_at: string;
}

export type PaymentStatus = 
  | 'unsubmitted' 
  | 'submitted' 
  | 'under_review' 
  | 'paid' 
  | 'rejected' 
  | 'refunded';

export type OrderStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'cancelled';

export type ServiceStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'waiting_customer_info' 
  | 'completed' 
  | 'cancelled';

export type DiscountType = 'fixed' | 'percentage';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  status: 'active' | 'suspended';
  /** Effective permissions resolved by the server (built-in or custom role). */
  permissions?: string[];
  is_staff?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_path?: string;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
}

export interface TechnicalRequirement {
  label: string;
  value: string;
}

export interface EconomicScenario {
  title: string;
  estimated_revenue: string;
  estimated_costs: string;
  net_profit: string;
  notes: string;
}

export interface EconomicStudy {
  target_market: string;
  potential_buyers: string;
  revenue_streams: string[];
  initial_costs: string;
  operational_costs: string;
  conservative_scenario: EconomicScenario;
  moderate_scenario: EconomicScenario;
  optimistic_scenario: EconomicScenario;
  break_even_point: string;
  disclaimer: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ProductOption {
  id: string;
  product_id: string;
  name: string;
  description?: string;
  price: number; // in Libyan Dinar (LYD)
  option_type: 'checkbox' | 'radio' | 'addon' | 'package';
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  requires_option_id?: string;
  conflicts_with_id?: string;
}

export interface ProductFile {
  id: string;
  product_id: string;
  file_name: string;
  storage_path: string;
  file_size: number; // in bytes
  mime_type: string;
  version: string;
  is_active: boolean;
  is_downloadable: boolean;
  download_count: number;
  created_at: string;
}

export interface ProductVersion {
  id: string;
  product_id: string;
  version_name: string;
  release_notes?: string;
  created_at: string;
  is_active: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  short_description: string;
  full_description: string;
  category_id?: string;
  category_name?: string;
  base_price: number; // in LYD
  main_image: string;
  product_type: 'web_app' | 'pwa' | 'android' | 'desktop' | 'pos_system' | 'accounting' | 'telegram_bot' | 'ecommerce' | 'source_code' | 'template';
  technical_requirements: TechnicalRequirement[];
  installation_guide?: string;
  features: string[];
  economic_study: EconomicStudy;
  faq: FAQItem[];
  license_type: 'personal' | 'commercial' | 'single_project' | 'non_exclusive' | 'custom';
  status: 'published' | 'draft' | 'archived';
  is_featured: boolean;
  gallery_images?: string[];
  demo_url?: string;
  download_file_url?: string;
  code_repository?: string;
  options?: ProductOption[];
  files?: ProductFile[];
  versions?: ProductVersion[];
  created_at: string;
  updated_at?: string;
}

export interface SelectedOptionSnapshot {
  option_id: string;
  name: string;
  price: number;
  description?: string;
}

export interface CartItem {
  id: string;
  product: Product;
  selected_options: SelectedOptionSnapshot[];
  base_price: number;
  options_total: number;
  total_price: number;
  quantity: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name_snapshot: string;
  base_price_snapshot: number;
  selected_options_snapshot: SelectedOptionSnapshot[];
  total_price: number;
  quantity: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  currency: 'LYD';
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  coupon_code?: string;
  customer_notes?: string;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
  payment_submission?: PaymentSubmission;
  payment_account_id?: string;
}

export interface PaymentAccount {
  id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  iban?: string;
  instructions?: string;
  is_active: boolean;
  is_default: boolean;
}

export interface PaymentSubmission {
  id: string;
  order_id: string;
  sender_name: string;
  sender_bank?: string;
  transaction_reference: string;
  transferred_amount: number;
  transfer_date: string;
  receipt_storage_path: string; // URL or base64 preview
  notes?: string;
  status: PaymentStatus;
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface DownloadEntitlement {
  id: string;
  user_id: string;
  order_id: string;
  order_number: string;
  product_id: string;
  product_name: string;
  product_file_id: string;
  file_name: string;
  file_size: number;
  version: string;
  allowed_downloads: number;
  used_downloads: number;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
}

export interface DownloadLog {
  id: string;
  entitlement_id: string;
  user_id: string;
  user_name?: string;
  file_id: string;
  file_name?: string;
  order_id: string;
  order_number?: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  status: 'success' | 'failed' | 'expired' | 'limit_reached';
}

export interface ServiceTask {
  id: string;
  order_id: string;
  order_number: string;
  user_id: string;
  customer_name?: string;
  product_id: string;
  product_name: string;
  service_name: string;
  status: ServiceStatus;
  details?: string;
  admin_notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'order' | 'payment' | 'download' | 'service' | 'info';
  is_read: boolean;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_order: number;
  max_uses: number;
  used_count: number;
  starts_at: string;
  expires_at?: string;
  is_active: boolean;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any>;
  created_at: string;
}

export interface SiteSettings {
  store_name: string;
  store_description: string;
  currency: string;
  domain?: string;
  addresses?: string[];
  logo_url?: string;
  support_email: string;
  support_phone: string;
  hero_title: string;
  hero_subtitle: string;
  default_download_limit: number;
  default_download_expiry_days: number;
  whatsapp_number?: string;
  telegram_username?: string;
  policies?: {
    privacy?: string;
    terms?: string;
    digital_goods?: string;
    refunds?: string;
    licensing?: string;
    support?: string;
  };
}
