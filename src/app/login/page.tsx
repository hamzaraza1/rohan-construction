import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-900 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <svg viewBox="0 0 32 32" className="size-12" aria-hidden>
            <rect width="32" height="32" rx="7" fill="#244b76" />
            <path d="M7 23V13l9-5 9 5v10h-5v-6h-8v6z" fill="#f5b041" />
          </svg>
          <h1 className="mt-4 text-xl font-semibold text-white">Rohan Construction</h1>
          <p className="mt-1 text-sm text-slate-300">Project &amp; financial management</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Authorised partners only. All activity is logged.</p>
      </div>
    </main>
  );
}
