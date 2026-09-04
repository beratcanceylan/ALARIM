import { useCallback, useEffect, useRef } from "react";
import type * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import { useAlarmStore } from "@/context/alarm-store";
import {
  configureNotifications,
  DISMISS_ACTION_ID,
  loadNotificationsModule,
  requestNotificationPermission,
  SNOOZE_ACTION_ID,
} from "@/lib/notifications";

type AlarmNotificationData = {
  timeId: number;
};

function parseTimeId(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function getAlarmData(notification: Notifications.Notification): AlarmNotificationData | null {
  const data = notification.request.content.data as Record<string, unknown> | undefined;
  const timeId = parseTimeId(data?.timeId);
  if (data?.type !== "alarm" || timeId === null) return null;
  return { timeId };
}

function getSafeNotificationId(notification: Notifications.Notification, expectedTimeId: number): string | null {
  const identifier = notification.request.identifier;
  const match = /^alarm_(\d+)_(once|snooze|day_[1-7])$/.exec(identifier);
  if (!match || Number(match[1]) !== expectedTimeId) return null;
  return identifier;
}

function getNotificationKey(notification: Notifications.Notification, identifier: string): string {
  return `${identifier}:${notification.date}`;
}

function getSafeAction(actionIdentifier: string): string | undefined {
  if (actionIdentifier === SNOOZE_ACTION_ID || actionIdentifier === DISMISS_ACTION_ID) return actionIdentifier;
  return undefined;
}

export function NotificationBridge() {
  const router = useRouter();
  const { isReady } = useAlarmStore();
  const handledNotifications = useRef(new Set<string>());
  const receivedNotifications = useRef(new Set<string>());

  const openRingingScreen = useCallback((
    notification: Notifications.Notification,
    action?: string,
    source: "received" | "response" = "response",
  ) => {
    const data = getAlarmData(notification);
    if (!data) return;
    const notificationId = getSafeNotificationId(notification, data.timeId);
    if (!notificationId) return;
    const notificationKey = getNotificationKey(notification, notificationId);

    if (source === "received") {
      if (handledNotifications.current.has(notificationKey) || receivedNotifications.current.has(notificationKey)) return;
      receivedNotifications.current.add(notificationKey);
    } else {
      if (handledNotifications.current.has(notificationKey)) return;
      const wasAlreadyReceived = receivedNotifications.current.has(notificationKey);
      receivedNotifications.current.delete(notificationKey);
      handledNotifications.current.add(notificationKey);

      const query = [
        `timeId=${encodeURIComponent(String(data.timeId))}`,
        `notificationId=${encodeURIComponent(notificationId)}`,
        ...(action ? [`action=${encodeURIComponent(action)}`] : []),
      ].join("&");
      if (wasAlreadyReceived && action) router.replace(`/ringing?${query}`);
      else if (!wasAlreadyReceived) router.push(`/ringing?${query}`);
      return;
    }

    const query = [
      `timeId=${encodeURIComponent(String(data.timeId))}`,
      `notificationId=${encodeURIComponent(notificationId)}`,
    ].join("&");
    router.push(`/ringing?${query}`);
  }, [router]);

  useEffect(() => {
    if (!isReady || process.env.EXPO_OS === "web") return;

    let mounted = true;
    let receivedSubscription: { remove: () => void } | undefined;
    let responseSubscription: { remove: () => void } | undefined;

    void configureNotifications()
      .then(() => requestNotificationPermission())
      .then(() => loadNotificationsModule())
      .then((notifications) => {
        if (!mounted) return;

        receivedSubscription = notifications.addNotificationReceivedListener((notification) => {
          openRingingScreen(notification, undefined, "received");
        });
        responseSubscription = notifications.addNotificationResponseReceivedListener((response) => {
          openRingingScreen(response.notification, getSafeAction(response.actionIdentifier), "response");
        });

        let lastResponse: Notifications.NotificationResponse | null | undefined;
        try {
          lastResponse = notifications.getLastNotificationResponse();
        } catch {
          // Some development clients do not expose the native response module.
        }
        if (lastResponse) {
          openRingingScreen(lastResponse.notification, getSafeAction(lastResponse.actionIdentifier), "response");
          void notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      receivedSubscription?.remove();
      responseSubscription?.remove();
    };
  }, [isReady, openRingingScreen]);

  return null;
}
