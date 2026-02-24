import { Link } from "react-router-dom";

import { CAFE_CONFIGS } from "../constants/cafes";
import { getAssetBaseUrl } from "../services/runtimeConfig";

export default function PortalPage() {
  const assetBaseUrl = getAssetBaseUrl();
  const landingBackgroundUrl = `${assetBaseUrl}/asset/background.avif`;
  const cafeTileBackgroundUrl = `${assetBaseUrl}/asset/woodboard.jpg`;

  return (
    <section className="relative min-h-[calc(100vh-7rem)] overflow-hidden rounded-[2rem] p-4 md:p-6">
      <div
        className="pointer-events-none absolute inset-[-12px]"
        style={{
          backgroundImage: `url('${landingBackgroundUrl}')`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          filter: "blur(3px)",
          transform: "scale(1.04)"
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/66 via-slate-900/58 to-slate-950/74" />
      <div className="pointer-events-none absolute -left-24 top-8 h-52 w-52 rounded-full bg-diner-amber/12 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-diner-teal/12 blur-3xl" />

      <div className="relative z-[1] space-y-8">
        <div className="rounded-[2rem] border border-white/20 bg-black/30 p-8 text-white shadow-panel backdrop-blur-sm md:p-10">
          <div className="grid gap-6 md:grid-cols-[1.65fr,1fr] md:items-start">
            <div className="relative z-[1]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/90">Self-Service Ordering</p>
              <h1 className="mt-2 text-4xl font-black uppercase md:text-5xl">Choose Your Cafe</h1>
              <p className="mt-3 max-w-2xl text-sm md:text-base">
                Fast touch ordering with live kitchen updates and big-screen order pickup board.
              </p>
              <a
                href="https://www.woodlandspark.com/"
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center rounded-2xl border border-white/35 bg-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/95 transition hover:bg-white/25"
              >
                Woodlands Family Theme Park
              </a>
            </div>

            <div className="relative z-[1] rounded-2xl border border-white/20 bg-black/28 p-4 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/85">How It Works</p>
              <div className="mt-3 space-y-2.5 text-xs md:text-sm">
                <p><span className="font-black text-diner-amber">1.</span> Choose the correct cafe.</p>
                <p><span className="font-black text-diner-amber">2.</span> Add food and checkout quickly.</p>
                <p><span className="font-black text-diner-amber">3.</span> Watch your number on the order board.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {CAFE_CONFIGS.map((cafe, index) => (
            <Link
              key={cafe.slug}
              to={`/${cafe.slug}/menu`}
              style={{ animationDelay: `${120 * index}ms` }}
              className="group relative animate-rise-in overflow-hidden rounded-[1.5rem] border border-amber-100/35 p-5 text-white shadow-panel transition duration-200 hover:-translate-y-1"
            >
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: `url('${cafeTileBackgroundUrl}')`,
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  backgroundRepeat: "no-repeat"
                }}
              />
              <div className="pointer-events-none absolute inset-0 bg-slate-950/72" />

              <div className="relative z-[1]">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/28 text-xs font-black text-white shadow-[0_0_18px_rgba(255,255,255,0.28)]">
                  0{index + 1}
                </div>
                <h2 className="text-xl font-black uppercase text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.95)] md:text-2xl">{cafe.label}</h2>
                <p className="mt-2 text-sm text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">Menu, cart, and quick checkout for {cafe.label} customers.</p>
                <span className="shimmer-btn mt-4 inline-flex items-center rounded-2xl bg-diner-red px-4 py-2 text-sm font-bold text-white">
                  Open Menu
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

    </section>
  );
}
