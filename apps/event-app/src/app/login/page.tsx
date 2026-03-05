"use client";

import { LoginForm } from "@/components/auth/login-form";
import { AuthBackground } from "@/components/auth/auth-background";
import { ScotiabankHexLogo } from "@/components/ScotiabankHexLogo";

export default function Page() {
  return (
    <AuthBackground>
      <div className="w-full max-w-md flex flex-col items-center gap-6 p-6 md:p-10">
        <div className="bg-white/70 backdrop-blur-xs rounded-2xl shadow-2xl p-6 w-full flex flex-col items-center gap-6 border border-white/40">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12">
              <ScotiabankHexLogo />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Convene</h1>
          </div>
          <LoginForm />
        </div>
      </div>
    </AuthBackground>
  );
}
