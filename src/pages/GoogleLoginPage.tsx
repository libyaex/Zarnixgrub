import React, { useState } from 'react';
import { ShieldCheck, Lock, Sparkles, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface GoogleLoginPageProps {
  onSuccess: () => void;
}

export const GoogleLoginPage: React.FC<GoogleLoginPageProps> = ({ onSuccess }) => {
  const { authError, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignInWithGoogle = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      if (supabase) {
        // Always return to the origin the user is on (the old localhost -> vercel
        // override sent the session to another domain and caused a login loop).
        const redirectUrl = window.location.origin;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            queryParams: {
              prompt: 'select_account' // Forces Google to show all accounts on the device!
            }
          }
        });
        if (error) {
          console.error('Supabase Google OAuth error:', error);
          setErrorMsg('حدث خطأ أثناء فتح Google: ' + error.message);
          setLoading(false);
        }
        return;
      }

      setErrorMsg('لتفعيل نافذة Google الحقيقية للزوار، يرجى تزويدنا بمفتاح anon key من Supabase لإضافته في إعدادات الموقع.');
      setLoading(false);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || 'حدث خطأ غير متوقع');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06090f] text-slate-100 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden">
      
      {/* Background ambient lighting in rich Emerald & Mint glow */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        
        {/* Brand Lockup */}
        <div className="text-center space-y-3">
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-cyan-500 via-blue-600 to-emerald-400 shadow-2xl shadow-cyan-950/80 mx-auto">
            <img
              src="/logo.png"
              alt="شعار ZARNIX-Group"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              ZARNIX-Group
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              المنصة الرقمية المتخصصة في بيع وتطوير البرمجيات والأنظمة
            </p>
          </div>
        </div>

        {/* Auth Gate Card */}
        <div className="bg-[#0b1019]/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
          
          <div className="text-center space-y-1.5 border-b border-slate-800/80 pb-4">
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">
              بوابة الدخول الموحدة
            </span>
            <h2 className="text-base sm:text-lg font-bold text-white">
              تسجيل الدخول عبر Google
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              لتأمين ملفاتك الرقمية ومتابعة طلباتك، يتم الدخول والتسجيل حصراً باستخدام حساب Google.
            </p>
          </div>

          {/* Official Google Sign-In Button */}
          <div className="space-y-3 pt-2">
            {(errorMsg || authError) && (
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs leading-relaxed text-center font-medium">
                <div>{errorMsg || authError}</div>
                {authError && !errorMsg && (
                  <button
                    onClick={() => { void logout(); }}
                    className="mt-2 underline text-rose-200 cursor-pointer"
                  >
                    تسجيل الخروج وإعادة المحاولة
                  </button>
                )}
              </div>
            )}
            <button
              onClick={handleSignInWithGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm sm:text-base transition-all shadow-xl shadow-black/40 cursor-pointer disabled:opacity-60 active:scale-98 border border-slate-200"
            >
              {/* Google SVG Official Icon */}
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول عبر Google'}</span>
            </button>
          </div>

          {/* Value Highlights */}
          <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>ربط مشترياتك وترخيص الكود بحسابك المعتمد</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>تسليم الملفات وحصص التحميل بشكل مشفر وآمن</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>متابعة مهام التركيب والدعم الفني المباشر</span>
            </div>
          </div>

          {/* Security guarantee */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>تسجيل دخول مشفر وفق معايير Google Security 2026</span>
          </div>

        </div>

        {/* Footer info */}
        <div className="text-center space-y-1 text-xs text-slate-500">
          <p className="font-semibold text-slate-400">
            ZARNIX-Group — طرابلس، ليبيا
          </p>
          <p>
            هاتف: <span dir="ltr" className="text-slate-300 font-mono">091-3004448</span> | الموقع المعتمد: <span className="text-cyan-400 font-mono">ZARNIX-Group.ly</span>
          </p>
        </div>

      </div>

    </div>
  );
};
