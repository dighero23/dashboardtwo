import webpush from "web-push";

// Initialize once with VAPID details
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
}

export interface StoredSubscription {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
}

/**
 * Send a push notification to a stored subscription.
 * Returns true on success, false if subscription is expired (caller should delete it).
 */
export async function sendPush(
  sub: StoredSubscription,
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    // 410 Gone or 404 Not Found = subscription expired, caller should delete
    if (status === 410 || status === 404) return false;
    console.error("[webpush] sendNotification error:", err);
    return true; // transient error — don't delete subscription
  }
}
