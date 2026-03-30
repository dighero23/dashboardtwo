"use client";

import { useState } from "react";

export type PushPromptState =
  | "idle"
  | "show-banner"
  | "subscribing"
  | "done"
  | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

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
    // Cast needed: TS types lag behind spec — Uint8Array is valid per W3C
    applicationServerKey: urlBase64ToUint8Array(
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
    ) as unknown as ArrayBuffer,
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
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const permission: NotificationPermission = (window as any).Notification.permission;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const permission = await (window as any).Notification.requestPermission();
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
