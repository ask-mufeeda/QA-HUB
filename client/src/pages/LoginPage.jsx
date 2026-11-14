import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

const allowedRoles = ["admin", "tester", "developer"];

function getErrorMessage(error) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(null);
  const [feedback, setFeedback] = useState(null);

  async function handleLogin(event) {
    event.preventDefault();
    setPending("login");
    setFeedback({ type: "info", text: "Checking your login details..." });

    let authenticated = false;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;
      authenticated = true;

      if (!data.user) {
        throw new Error("User account could not be found.");
      }

      setFeedback({ type: "info", text: "Verifying your account..." });

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(`Profile verification failed: ${profileError.message}`);
      }

      if (!profile) {
        throw new Error("A profile could not be found for this account.");
      }

      const role = String(profile.role ?? "")
        .trim()
        .toLowerCase();

      if (!allowedRoles.includes(role)) {
        throw new Error(`This account has an unsupported role: ${role || "none"}.`);
      }

      setFeedback({ type: "success", text: "Signed in. Opening QA Hub..." });
      navigate("/app", { replace: true });
    } catch (error) {
      if (authenticated) {
        try {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;
        } catch (signOutError) {
          console.error("Could not clear the unverified session:", signOutError);
        }
      }

      console.error("Login error:", error);
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally {
      setPending(null);
    }
  }

  async function handlePasswordReset() {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setFeedback({
        type: "error",
        text: "Enter your email address first so we can send a reset link.",
      });
      return;
    }

    setPending("reset");
    setFeedback({ type: "info", text: "Sending your password reset email..." });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: new URL("/client/reset-password", window.location.origin).href,
      });

      if (error) throw error;

      setFeedback({
        type: "success",
        text: "Reset link sent. Check your email to continue.",
      });
    } catch (error) {
      console.error("Password reset error:", error);
      setFeedback({ type: "error", text: getErrorMessage(error) });
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 lg:p-6">
      <div className="mx-auto grid min-h-screen max-w-7xl overflow-hidden bg-white shadow-xl shadow-slate-900/5 lg:min-h-[calc(100vh-3rem)] lg:grid-cols-2 lg:rounded-[2rem]">
        <section className="relative isolate flex min-h-56 flex-col overflow-hidden bg-slate-950 px-6 py-6 text-white sm:px-10 lg:min-h-full lg:px-14 lg:py-12">
          <div
            aria-hidden="true"
            className="absolute -left-32 top-20 -z-10 size-80 rounded-full bg-indigo-500/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-40 right-0 -z-10 size-96 rounded-full bg-cyan-400/15 blur-3xl"
          />

          <Link
            to="/"
            aria-label="QA Hub home"
            className="inline-flex w-fit items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-500 text-sm font-black shadow-lg shadow-indigo-950/30">
              Q
            </span>
            QA<span className="-ml-2 text-cyan-300">Hub</span>
          </Link>

          <div className="my-auto hidden max-w-xl py-12 lg:block">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-slate-200">
              <span className="size-2 rounded-full bg-emerald-400" />
              Your QA workspace, all in one place
            </div>
            <h1 className="max-w-lg text-5xl font-semibold leading-tight tracking-tight xl:text-6xl">
              Build better software,{" "}
              <span className="text-cyan-300">one test at a time.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
              Pick up where you left off with your testing tools, practice
              projects, and team workspace.
            </p>

            <div className="mt-12 max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-slate-950/20 backdrop-blur">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400">WORKSPACE</p>
                  <p className="mt-1 text-sm font-semibold">Quality dashboard</p>
                </div>
                <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                  Active
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Test cases", "128"],
                  ["Open bugs", "12"],
                  ["Pass rate", "96%"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/5 bg-slate-950/40 p-3"
                  >
                    <p className="text-lg font-semibold">{value}</p>
                    <p className="mt-1 text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex h-16 items-end gap-2" aria-hidden="true">
                {[34, 52, 40, 72, 57, 88, 66, 100, 76, 91, 62, 82].map(
                  (height, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-t-sm bg-gradient-to-t from-indigo-600 to-cyan-300 opacity-80"
                      style={{ height: `${height}%` }}
                    />
                  ),
                )}
              </div>
            </div>
          </div>

          <p className="mt-5 hidden text-xs text-slate-400 lg:block">
            Learn. Practise. Test. Grow.
          </p>
          <p className="mt-5 text-sm text-slate-300 lg:hidden">
            Your QA workspace, all in one place.
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <Link
              to="/"
              className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 lg:hidden"
            >
              <span aria-hidden="true">←</span> Back to home
            </Link>

            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
                Welcome back
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Sign in to your account
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Enter your details below to continue to your QA workspace.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-800"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-800"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={pending !== null}
                    className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-20 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 px-4 text-xs font-semibold text-slate-500 transition hover:text-indigo-700 focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-indigo-600"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {feedback && (
                <p
                  role={feedback.type === "error" ? "alert" : "status"}
                  aria-live={feedback.type === "error" ? "assertive" : "polite"}
                  className={`rounded-xl border px-4 py-3 text-sm leading-5 ${
                    feedback.type === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : feedback.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-indigo-100 bg-indigo-50 text-indigo-700"
                  }`}
                >
                  {feedback.text}
                </p>
              )}

              <button
                type="submit"
                disabled={pending !== null}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {pending === "login" && (
                  <span
                    aria-hidden="true"
                    className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                )}
                {pending === "login" ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-slate-600">
              New to QA Hub?{" "}
              <Link
                to="/register"
                className="font-semibold text-indigo-600 transition hover:text-indigo-800 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Create an account
              </Link>
            </p>

            <Link
              to="/"
              className="mt-8 hidden w-fit items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 lg:inline-flex"
            >
              <span aria-hidden="true">←</span> Back to home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
