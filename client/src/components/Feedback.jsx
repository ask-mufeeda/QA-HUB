export default function Feedback({ message, type = "info" }) {
  if (!message) return null;

  const styles = {
    error: "border-rose-200 bg-rose-50 text-rose-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-indigo-100 bg-indigo-50 text-indigo-700",
  };

  return (
    <p
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      className={`rounded-xl border px-4 py-3 text-sm leading-5 ${styles[type] ?? styles.info}`}
    >
      {message}
    </p>
  );
}
