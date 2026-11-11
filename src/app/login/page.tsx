"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Info, Loader2, Lock, Mail } from "lucide-react";
import { useStore } from "@/lib/store";
import { checkEmail, useForm } from "@/lib/form";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { Checkbox, FormField, Input } from "@/components/ui/Field";

type F = { email: string; password: string };

export default function LoginPage() {
  const router = useRouter();
  const { data, setSession } = useStore();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const { bind, errors, handleSubmit, setValues } = useForm<F>({ email: "", password: "" }, (v) => {
    const e: Partial<F> = {};
    const em = checkEmail(v.email, true);
    if (em) e.email = em;
    if (!v.password) e.password = "Password is required";
    else if (v.password.length < 6) e.password = "Password must be at least 6 characters";
    return e;
  });

  const submit = handleSubmit((v) => {
    setFailure(undefined);
    const user = data.users.find((u) => u.email.toLowerCase() === v.email.trim().toLowerCase());
    if (!user) return setFailure("No account with this email. Use one of the demo accounts below.");
    if (!user.isActive) return setFailure("This account is disabled. Contact the administrator.");
    setBusy(true);
    // Stage 1: no real authentication. Any password of 6+ characters is accepted.
    setTimeout(() => {
      setSession({ name: user.name, email: user.email, role: user.role });
      router.push("/");
    }, 500);
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-brand-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <svg className="absolute inset-0 h-full w-full opacity-[0.07]" aria-hidden>
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M32 0H0V32" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <svg viewBox="0 0 400 260" className="absolute right-0 bottom-0 w-[60%] text-white/10" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M40 250V60h10V40h160v20h-140" />
          <path d="M50 60l20 20M70 60l20 20M90 60l20 20M110 60l20 20M130 60l20 20M150 60l20 20" />
          <path d="M190 60v40m-6 0h12m-6 0v8" />
          <rect x="230" y="120" width="140" height="130" />
          <path d="M230 160h140M230 200h140M276 120v130M322 120v130" />
          <path d="M0 250h400" />
        </svg>
        <Logo className="relative" />
        <div className="relative max-w-md">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">Every site, every rupee, in one place.</h1>
          <p className="mt-4 text-brand-100/80">
            Track client payments, contractor bills, supplier deliveries, site stock and partner withdrawals across all your projects.
          </p>
          <ul className="mt-8 grid grid-cols-2 gap-4 text-sm">
            {["Project-wise cash position", "Supplier advances & deliveries", "Contractor installments", "Site inventory"].map((t) => (
              <li key={t} className="flex items-center gap-2 text-brand-100">
                <span className="size-1.5 rounded-full bg-accent-400" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-200/60">© 2026 Rohan Construction · Internal use only</p>
      </div>

      <div className="flex items-center justify-center bg-white px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Logo light={false} className="mb-10 lg:hidden" />
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Welcome back. Enter your account details.</p>

          <form onSubmit={submit} noValidate className="mt-8 space-y-5">
            {failure && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">{failure}</div>}
            <FormField label="Email address" htmlFor="email" error={errors.email}>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input {...bind("email")} type="email" autoComplete="username" placeholder="you@rohanconstruction.pk" className="pl-9" />
              </div>
            </FormField>
            <FormField label="Password" htmlFor="password" error={errors.password}>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input {...bind("password")} type={show ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className="pr-10 pl-9" />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </FormField>
            <div className="flex items-center justify-between">
              <Checkbox label="Keep me signed in" defaultChecked />
              <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setFailure("Password reset is handled by the administrator (Hamza).")}>
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="h-11 w-full" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
            <p className="flex items-center gap-1.5 font-medium"><Info className="size-4" /> Frontend preview: demo accounts</p>
            <p className="mt-1 text-xs text-amber-800">Real sign-in is built in Stage 2. For now any password of 6+ characters works.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setValues({ email: "hamza@rohanconstruction.pk", password: "demo1234" })} className="rounded-md bg-white px-2 py-1 text-xs font-medium ring-1 ring-amber-300 hover:bg-amber-100">
                Admin: hamza@…
              </button>
              <button type="button" onClick={() => setValues({ email: "bilal@rohanconstruction.pk", password: "demo1234" })} className="rounded-md bg-white px-2 py-1 text-xs font-medium ring-1 ring-amber-300 hover:bg-amber-100">
                Partner (read-only): bilal@…
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
