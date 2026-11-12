import { useEffect, useState } from "react";
import "./Toast.css";

export default function Toast({
  title,
  message,
  tone,
  announce = true,
}: {
  title: string;
  message: string;
  tone: "warning" | "success";
  announce?: boolean;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <output
      className={`app-toast app-toast-${tone}`}
      aria-label="Уведомление"
      aria-live={announce ? "polite" : "off"}
      aria-atomic="true"
    >
      <span className="app-toast-icon" aria-hidden="true">
        {tone === "success" ? "✓" : "!"}
      </span>
      <span>
        <strong>{title}</strong>
        <span className="app-toast-message">{message}</span>
      </span>
      <button
        className="app-toast-close"
        type="button"
        aria-label="Закрыть уведомление"
        onClick={() => setVisible(false)}
      >
        ×
      </button>
    </output>
  );
}
