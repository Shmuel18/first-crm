import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="w-full">
      {/* Logo Section */}
      <div className="text-center mb-10">
        <div className="brand-logo text-5xl mb-2 leading-none">KAUFMAN</div>
        <div className="brand-tagline">FINANCE · TRUST · EXCELLENCE</div>
      </div>

      {/* Login Box */}
      <div className="bg-white rounded-2xl shadow-2xl p-8" dir="rtl">
        <div className="mb-6">
          <h1 className="font-display text-2xl text-neutral-900 mb-1">
            כניסה למערכת
          </h1>
          <p className="text-sm text-neutral-500">
            ברוכים השבים. אנא הזינו את פרטי הכניסה.
          </p>
        </div>

        <LoginForm />
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <div className="text-xs text-neutral-500">
          © 2026 Kaufman Finance Group · כל הזכויות שמורות
        </div>
      </div>
    </div>
  );
}
