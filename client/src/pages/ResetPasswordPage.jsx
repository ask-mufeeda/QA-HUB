import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { supabase } from "../lib/supabase.js";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const recoverySetup = useRef(null);

  useEffect(() => {
    let active = true;

    if (!recoverySetup.current) {
      recoverySetup.current = (async () => {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = new URLSearchParams(url.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState({}, document.title, url.pathname);
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          window.history.replaceState({}, document.title, url.pathname);
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          throw new Error("This password reset link is invalid or has expired.");
        }
      })();
    }

    recoverySetup.current
      .then(() => {
        if (!active) return;
        setReady(true);
        setFeedback(null);
      })
      .catch((error) => {
        if (!active) return;
        console.error("Password recovery setup failed:", error);
        setFeedback({
          type: "error",
          text: error instanceof Error ? error.message : "Could not verify the reset link.",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (password.length < 6) {
      setFeedback({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (password !== confirmPassword) {
      setFeedback({ type: "error", text: "Passwords do not match." });
      return;
    }

    setPending(true);
    setFeedback({ type: "info", text: "Updating your password..." });
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setFeedback({ type: "success", text: "Your password has been updated." });
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (error) {
      console.error("Password update failed:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Could not update your password.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-10">
        <Link to="/" className="text-xl font-black tracking-tight text-slate-900">
          QA<span className="text-indigo-600">Hub</span>
        </Link>
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
          Account recovery
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Set a new password
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Choose a new password for your QA Hub account.
        </p>

        {ready ? (
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-800">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-sm font-medium text-slate-800"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
              />
            </div>
            <Feedback message={feedback?.text} type={feedback?.type} />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {pending ? "Updating password..." : "Update password"}
            </button>
          </form>
        ) : (
          <Feedback
            message={feedback?.text ?? "Verifying your password reset link..."}
            type={feedback?.type ?? "info"}
          />
        )}

        <Link to="/login" className="mt-6 inline-flex text-sm font-semibold text-indigo-600">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
