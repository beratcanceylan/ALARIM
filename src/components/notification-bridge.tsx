import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";

import { useAlarmStore } from "@/context/alarm-store";
import {
  configureNotifications,
  requestNotificationPermission,
  SNOOZE_ACTION_ID,
  DISMISS_ACTION_ID,
} from "@/lib/notifications";

function getAlarmData(notification: Notifications.Notification): { timeId: string } | null {
  const data = notification.request.content.data;
  if (data?.type !== "alarm" || typeof data.timeId !== "string") return null;
  return { timeId: data.timeId };
}

export function NotificationBridge() {
  const router = useRouter();
  const { markTimeFired } = useAlarmStore();

  useEffect(() => {
    void configureNotifications()
      .then(() => requestNotificationPermission())
      .catch(() => undefined);

    const openRingingScreen = (
      notification: Notifications.Notification,
      action?: string,
    ) => {
      const data = getAlarmData(notification);
      if (!data) return;
      const notificationData = notification.request.content.data;
      if (notificationData?.oneTime === true) void markTimeFired(Number(data.timeId));
      const query = [
        `timeId=${encodeURIComponent(data.timeId)}`,
        `notificationId=${encodeURIComponent(notification.request.identifier)}`,
        ...(action ? [`action=${encodeURIComponent(action)}`] : []),
      ].join("&");
      router.push(`/ringing?${query}`);
    };

    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      openRingingScreen(notification);
    });
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const action = response.actionIdentifier === SNOOZE_ACTION_ID || response.actionIdentifier === DISMISS_ACTION_ID
        ? response.actionIdentifier
        : undefined;
      openRingingScreen(response.notification, action);
    });

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [markTimeFired, router]);

  return <></>;
}
