"use client";

import { useState } from "react";

export type PushPromptState =
  | "idle"
  | "show-banner"
  | "subscribing"
  | "done"
  | "denied";

async function registerAndSubscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
  await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  if (existing) return; // already subscribed, nothing to do

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  });

  const json = sub.toJSON();
  await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
}

export function usePushSubscription() {
  const [promptState, setPromptState] = useState<PushPromptState>("idle");

  async function trySubscribeAfterAlert() {
    // Not supported in non-PWA iOS browsers and old browsers
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const permission = Notification.permission;

    if (permission === "denied") {
      setPromptState("denied");
      return;
    }

    if (permission === "granted") {
      // Silent background subscription — user already gave permission
      try {
        await registerAndSubscribePush();
      } catch {
        // Transient error, don't bother the user
      }
      return;
    }

    // permission === "default" — never asked
    if (sessionStorage.getItem("push-prompt-dismissed")) return;

    setPromptState("show-banner");
  }

  async function confirmSubscribe() {
    setPromptState("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setPromptState("denied");
        return;
      }
      if (permission !== "granted") {
        setPromptState("idle");
        return;
      }
      await registerAndSubscribePush();
      setPromptState("done");
    } catch {
      setPromptState("idle");
    }
  }

  function dismissBanner() {
    sessionStorage.setItem("push-prompt-dismissed", "1");
    setPromptState("idle");
  }

  return { promptState, trySubscribeAfterAlert, confirmSubscribe, dismissBanner };
}
