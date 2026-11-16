"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@jewelcrm.local");
  const [password, setPassword] = useState("Owner@123");
  const [otp, setOtp] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, otp: needsOtp ? otp : undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    if (data.requiresOtp) {
      setNeedsOtp(true);
      setError("Enter the 6-digit OTP from the server console (mock 2FA).");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,_#f3e5c5,_#fbf7ef_55%)] p-6">
      <form onSubmit={onSubmit} className="card w-full max-w-md space-y-4 p-8">
        <div className="eyebrow">JewelCRM</div>
        <h1 className="font-serif text-3xl">Sign in to the showroom</h1>
        <p className="text-sm text-stone-500">Owner and manager accounts require a one-time code after password.</p>
        <label className="block text-sm font-semibold">Email<input className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Password<input className="mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {needsOtp && (
          <label className="block text-sm font-semibold">OTP<input className="mt-1" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" /></label>
        )}
        {error && <div className="rounded-xl bg-[#fff1e8] px-3 py-2 text-sm text-[#8a3b16]">{error}</div>}
        <button className="gold-button w-full" disabled={loading}>{loading ? "Signing in…" : needsOtp ? "Verify OTP" : "Continue"}</button>
        <div className="text-xs text-stone-500">Demo: owner@jewelcrm.local / Owner@123</div>
      </form>
    </div>
  );
}
