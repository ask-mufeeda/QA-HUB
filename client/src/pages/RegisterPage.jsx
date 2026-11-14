import { useState } from "react";
import { Link } from "react-router-dom";
import Feedback from "../components/Feedback.jsx";
import { supabase } from "../lib/supabase.js";

export default function RegisterPage() {
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  function updateField(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (values.password !== values.confirmPassword) {
      setFeedback({ type: "error", text: "Passwords do not match." });
      return;
    }

    setPending(true);
    setFeedback({ type: "info", text: "Creating your account..." });
    try {
      const { error } = await supabase.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: { data: { full_name: values.name.trim() } },
      });

      if (error) throw error;

      setValues({ name: "", email: "", password: "", confirmPassword: "" });
      setFeedback({
        type: "success",
        text: "Registration successful. Check your email to confirm your account.",
      });
    } catch (error) {
      console.error("Registration error:", error);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Could not create your account.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="flex min-h-48 flex-col justify-between bg-slate-950 px-6 py-7 text-white sm:px-10 lg:min-h-screen lg:px-14 lg:py-12">
        <Link to="/" className="w-fit text-xl font-black tracking-tight">
          QA<span className="text-cyan-300">Hub</span>
        </Link>
        <div className="hidden max-w-xl pb-12 lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">
            Start building your skills
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight">
            Make every test count.
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">
            Join your QA workspace and keep your learning, practice, and projects
            moving forward.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-7 inline-flex text-sm font-medium text-slate-500 hover:text-indigo-700"
          >
            ← Back to home
          </Link>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
            Create an account
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            Start your QA journey
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Create your account to access your QA Hub workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {[
              ["name", "Full name", "text", "Your name", "name"],
              ["email", "Email address", "email", "you@example.com", "email"],
              ["password", "Password", "password", "Create a password", "new-password"],
              [
                "confirmPassword",
                "Confirm password",
                "password",
                "Confirm your password",
                "new-password",
              ],
            ].map(([name, label, type, placeholder, autoComplete]) => (
              <div key={name}>
                <label
                  htmlFor={name}
                  className="mb-2 block text-sm font-medium text-slate-800"
                >
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  autoComplete={autoComplete}
                  required
                  minLength={type === "password" ? 6 : undefined}
                  value={values[name]}
                  onChange={updateField}
                  placeholder={placeholder}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
            ))}
            <Feedback message={feedback?.text} type={feedback?.type} />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-800">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
