import React from 'react';

interface State { error: Error | null }

/** Last line of defence: a render crash shows a recoverable screen instead of a blank page. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-[#06090f] text-slate-200 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <p className="text-4xl mb-3">⚠️</p>
          <h1 className="text-lg font-bold text-white mb-2">حدث خلل غير متوقع</h1>
          <p className="text-sm text-slate-400 mb-5">لم نتمكن من عرض هذه الصفحة. يمكنك إعادة المحاولة أو العودة للرئيسية.</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm cursor-pointer">إعادة التحميل</button>
            <a href="/" className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-200 text-sm">الرئيسية</a>
          </div>
        </div>
      </div>
    );
  }
}
