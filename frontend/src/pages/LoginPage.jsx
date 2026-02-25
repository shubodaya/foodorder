import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { login } from "../services/authService";
import { resolveAssetUrl } from "../services/runtimeConfig";

export default function LoginPage() {
  const { login: setAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const staffBackgroundUrl = resolveAssetUrl("/asset/staffbackground.png");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await login({ email, password });
      setAuth(data);

      if (location.state?.from) {
        navigate(location.state.from);
      } else if (data.user.role === "admin") {
        navigate("/staff-dashboard");
      } else {
        navigate("/new-orders");
      }
    } catch (_error) {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative min-h-[calc(100vh-7rem)] overflow-hidden rounded-[2rem] p-4 md:p-6">
      <div
        className="pointer-events-none absolute inset-[-12px]"
        style={{
          backgroundImage: `url('${staffBackgroundUrl}')`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          filter: "blur(4px)",
          transform: "scale(1.04)"
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/66" />

      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="rounded-3xl border border-white/35 bg-black/62 p-6 text-white shadow-panel backdrop-blur-md md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">Staff Access</p>
          <h1 className="mt-2 text-3xl font-black uppercase text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] md:text-4xl">Staff Login</h1>
          <p className="mt-3 max-w-xl text-sm text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            Admin default: admin@raysdiner.local / admin123
            <br />
            Kitchen default: kitchen@raysdiner.local / kitchen123
          </p>
        </div>

        <div className="rounded-3xl border border-white/35 bg-black/68 p-6 shadow-panel backdrop-blur-md">
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-white/45 bg-white/14 px-3 py-3 text-sm font-medium text-white placeholder:text-white/80"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-xl border border-white/45 bg-white/14 px-3 py-3 text-sm font-medium text-white placeholder:text-white/80"
              required
            />

            {error && <p className="text-sm text-red-300">{error}</p>}

            <button type="submit" disabled={loading} className="shimmer-btn w-full rounded-2xl bg-diner-red px-4 py-3 text-base font-bold text-white">
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
