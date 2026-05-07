import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0a0e17] text-[#e0e7ff] flex items-center justify-center px-6">
      <Suspense fallback={
        <div className="w-full max-w-sm text-center">
          <div className="w-10 h-10 border-2 border-white/10 border-t-[#4AB8FF] rounded-full animate-spin mx-auto" />
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
