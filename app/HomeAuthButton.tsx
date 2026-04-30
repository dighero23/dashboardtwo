"use client";

import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import LoginModal from "@/app/stocks/components/LoginModal";

export default function HomeAuthButton() {
  const { user, loading } = usePermissions();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) return null;

  return (
    <>
      {user ? (
        <button
          onClick={() => createClient().auth.signOut()}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-red-400 transition-colors border border-slate-700/60 bg-slate-800/60 rounded-lg px-3 py-1.5"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      ) : (
        <button
          onClick={() => setShowLogin(true)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors border border-slate-700/60 bg-slate-800/60 rounded-lg px-3 py-1.5"
        >
          <LogIn className="w-4 h-4" />
          Login
        </button>
      )}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => setShowLogin(false)}
        />
      )}
    </>
  );
}
