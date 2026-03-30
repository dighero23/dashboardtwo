"use client";

import { useState, useEffect } from "react";
import { BellRing, BellOff, Loader2 } from "lucide-react";

type State = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

export default function PushSubscribeButton() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "subscribed" : "unsubscribed"))
      .catch(() => setState("unsubscribed"));
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      });

      const json = sub.toJSON();
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });

      setState("subscribed");
    } catch (err) {
      console.error("[push] subscribe error:", err);
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setState("unsubscribed");
    } catch (err) {
      console.error("[push] unsubscribe error:", err);
    } finally {
      setBusy(false);
    }
  }

  // Not supported or permission denied — show nothing or muted indicator
  if (state === "unsupported") return null;
  if (state === "loading") return null;

  if (state === "denied") {
    return (
      <span
        title="Notifications blocked in browser settings"
        className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 border border-slate-800 rounded-lg px-3 py-1.5 cursor-not-allowed select-none"
      >
        <BellOff className="w-3.5 h-3.5" />
        Blocked
      </span>
    );
  }

  if (state === "subscribed") {
    return (
      <button
        onClick={unsubscribe}
        disabled={busy}
        title="Push notifications on — click to disable"
        className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400 border border-amber-500/40 hover:border-amber-500/70 rounded-lg px-3 py-1.5 transition-colors"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <BellRing className="w-3.5 h-3.5" />
        )}
        Push on
      </button>
    );
  }

  // unsubscribed
  return (
    <button
      onClick={subscribe}
      disabled={busy}
      title="Enable push notifications for price alerts"
      className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 rounded-lg px-3 py-1.5 transition-colors"
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <BellRing className="w-3.5 h-3.5" />
      )}
      Push
    </button>
  );
}
