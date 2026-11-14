import { Link } from "react-router-dom";

const features = [
  {
    title: "Test case management",
    description: "Create, run, and track test cases across your QA projects.",
    to: "/manual-testing",
    icon: "01",
  },
  {
    title: "Bug tracking",
    description: "Report issues, share evidence, and follow fixes through to resolution.",
    to: "/bugs",
    icon: "02",
  },
  {
    title: "API testing",
    description: "Build confidence in APIs with clear testing guides and examples.",
    to: "/api-testing",
    icon: "03",
  },
  {
    title: "SQL practice",
    description: "Learn database queries in an interactive in-browser playground.",
    to: "/sql-practice",
    icon: "04",
  },
  {
    title: "Learning resources",
    description: "Explore practical material for growing your QA skills.",
    to: "/resources",
    icon: "05",
  },
  {
    title: "Team workspace",
    description: "Give testers, developers, and admins the tools they need.",
    to: "/login",
    icon: "06",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <Link to="/" className="text-xl font-black tracking-tight text-slate-900">
            QA<span className="text-indigo-600">Hub</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 sm:flex">
            <a href="#features" className="transition hover:text-indigo-600">
              Features
            </a>
            <a href="#about" className="transition hover:text-indigo-600">
              About
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="overflow-hidden bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-cyan-200">
                <span className="size-2 rounded-full bg-emerald-400" />
                Your practical QA workspace
              </p>
              <h1 className="mt-7 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Everything you need to{" "}
                <span className="text-cyan-300">master QA testing.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
                Learn, practise, and improve your software testing skills with
                practical tools for your whole QA journey.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:bg-indigo-400"
                >
                  Create your account
                </Link>
                <a
                  href="#features"
                  className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                >
                  Explore the tools
                </a>
              </div>
              <p className="mt-5 text-xs text-slate-400">
                Learn. Practise. Test. Grow.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs font-medium text-slate-400">WORKSPACE</p>
                  <p className="mt-1 text-lg font-semibold">Quality overview</p>
                </div>
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  All systems ready
                </span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  ["128", "Test cases"],
                  ["12", "Open bugs"],
                  ["96%", "Pass rate"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/5 bg-slate-950/50 p-4"
                  >
                    <p className="text-2xl font-semibold">{value}</p>
                    <p className="mt-2 text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              <div
                className="mt-7 flex h-28 items-end gap-2"
                aria-label="Illustrative QA activity chart"
              >
                {[34, 52, 40, 72, 57, 88, 66, 100, 76, 91, 62, 82].map(
                  (height, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-600 to-cyan-300 opacity-80"
                      style={{ height: `${height}%` }}
                    />
                  ),
                )}
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                <span>Mon</span>
                <span>Wed</span>
                <span>Fri</span>
                <span>Sun</span>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
              Explore QA Hub
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Your testing toolkit, in one place
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Build confidence with hands-on tools designed for real QA work.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Link
                key={feature.title}
                to={feature.to}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-950/5"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-700">
                  {feature.icon}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {feature.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 group-hover:text-indigo-800">
                  Explore <span aria-hidden="true">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section id="about" className="bg-indigo-50 px-5 py-16 text-center sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Learn. Practise. Test. Grow.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Your next step towards becoming a more confident QA engineer starts
            here.
          </p>
        </section>
      </main>

      <footer className="bg-slate-950 px-5 py-6 text-center text-xs text-slate-400">
        © 2026 QA Hub. All rights reserved.
      </footer>
    </div>
  );
}
