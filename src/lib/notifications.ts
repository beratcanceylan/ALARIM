import type * as Notifications from "expo-notifications";
import { isRunningInExpoGo } from "expo";

import {
  getNextOccurrenceDate,
  isoToExpoWeekday,
} from "@/lib/alarm-utils";
import {
  notificationBaseIdentifier,
  notificationIdentifiersFor,
} from "@/lib/notification-utils";
import type { AlarmCard, AlarmTime, IsoWeekday } from "@/types/alarm";

export { notificationIdentifiersFor } from "@/lib/notification-utils";

export const ALARM_CHANNEL_ID = "alarms";
export const ALARM_CATEGORY_ID = "alarm_actions";
export const SNOOZE_ACTION_ID = "snooze";
export const DISMISS_ACTION_ID = "dismiss";
const DEV_BUILD_REQUIRED_ERROR = "Alarm bildirimleri Expo Go'da kullanılamaz; development build gerekir.";

type NotificationsModule = typeof import("expo-notifications");

let notificationsModulePromise: Promise<NotificationsModule> | null = null;
let handlerConfigured = false;

/**
 * Keep the unsupported Expo Go module out of the route module's top-level
 * import graph. Native notification APIs are loaded when the native app is
 * ready, which also lets the UI render a useful warning if a development
 * build has not been installed yet.
 */
export function loadNotificationsModule(): Promise<NotificationsModule> {
  if (process.env.EXPO_OS === "web") {
    return Promise.reject(new Error("Notifications are only available on iOS and Android."));
  }
  if (isRunningInExpoGo()) {
    return Promise.reject(new Error(DEV_BUILD_REQUIRED_ERROR));
  }

  notificationsModulePromise ??= import("expo-notifications");
  return notificationsModulePromise;
}

export function isNotificationModuleAvailable(): boolean {
  return process.env.EXPO_OS !== "web" && !isRunningInExpoGo();
}

export type NotificationFailureReason = "permission" | "schedule" | "unsupported" | "unknown";

export type NotificationSyncWarning = {
  timeId: number;
  reason: NotificationFailureReason;
  message: string;
};

async function getConfiguredNotifications(): Promise<NotificationsModule> {
  const notifications = await loadNotificationsModule();
  if (!handlerConfigured) {
    notifications.setNotificationHandler({
      handleNotification: async (notification) => ({
        shouldShowBanner: true,
        shouldShowList: true,
        // Custom files are played by RingingScreen while the app is active.
        // The OS still uses the default sound in the background or locked.
        shouldPlaySound: notification.request.content.data?.hasCustomSound !== true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }
  return notifications;
}

export async function configureNotifications(): Promise<void> {
  if (process.env.EXPO_OS === "web") return;
  const notifications = await getConfiguredNotifications();

  if (process.env.EXPO_OS === "android") {
    await notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: "ALARIM",
      importance: notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      sound: "default",
      lockscreenVisibility: notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  await notifications.setNotificationCategoryAsync(
    ALARM_CATEGORY_ID,
    [
      {
        identifier: SNOOZE_ACTION_ID,
        buttonTitle: "Ertele",
        options: { opensAppToForeground: true },
      },
      {
        identifier: DISMISS_ACTION_ID,
        buttonTitle: "Kapat",
        options: { isDestructive: true, opensAppToForeground: true },
      },
    ],
    { customDismissAction: true },
  );
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (process.env.EXPO_OS === "web") return true;
  const notifications = await loadNotificationsModule();

  const current = await notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });
  return requested.granted;
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  if (process.env.EXPO_OS === "web") return true;
  const notifications = await loadNotificationsModule();
  const permission = await notifications.getPermissionsAsync();
  return permission.granted;
}

export async function dismissNotification(notificationId: string): Promise<void> {
  if (process.env.EXPO_OS === "web") return;
  const notifications = await loadNotificationsModule();
  await notifications.dismissNotificationAsync(notificationId);
}

function contentFor(time: AlarmTime, card: AlarmCard): Notifications.NotificationContentInput {
  const title = time.title.trim() || card.title.trim() || "ALARIM";
  const body = time.note.trim() || `${title} alarmı geldi.`;

  return {
    title,
    body,
    sound: "default",
    categoryIdentifier: ALARM_CATEGORY_ID,
    autoDismiss: true,
    data: {
      type: "alarm",
      timeId: String(time.id),
      cardId: String(card.id),
      oneTime: time.schedule.type === "once",
      hasCustomSound: Boolean(time.soundUri),
    },
    ...(process.env.EXPO_OS === "ios" && time.imageUri
      ? {
          attachments: [{
            identifier: `alarm-${time.id}`,
            url: time.imageUri,
            type: null,
          }],
        }
      : {}),
    ...(process.env.EXPO_OS === "android"
      ? {
          priority: "max",
          vibrate: [0, 300, 200, 300],
        }
      : {}),
  };
}

function weeklyTrigger(
  notifications: NotificationsModule,
  day: IsoWeekday,
  time: AlarmTime,
): Notifications.SchedulableNotificationTriggerInput {
  if (process.env.EXPO_OS === "android") {
    return {
      type: notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: isoToExpoWeekday(day),
      hour: time.hour,
      minute: time.minute,
      channelId: ALARM_CHANNEL_ID,
    };
  }

  // iOS schedules repeating weekly notifications through its calendar
  // trigger; the weekday numbering is still Sunday = 1 through Saturday = 7.
  return {
    type: notifications.SchedulableTriggerInputTypes.CALENDAR,
    repeats: true,
    weekday: isoToExpoWeekday(day),
    hour: time.hour,
    minute: time.minute,
  };
}

function onceTrigger(
  notifications: NotificationsModule,
  time: AlarmTime,
): Notifications.DateTriggerInput {
  if (time.schedule.type !== "once") {
    throw new Error("A one-time trigger requires a dated schedule.");
  }

  const date = getNextOccurrenceDate(time.schedule, time.hour, time.minute);
  if (!date) throw new Error("The one-time alarm date has already passed.");

  return {
    type: notifications.SchedulableTriggerInputTypes.DATE,
    date,
    ...(process.env.EXPO_OS === "android" ? { channelId: ALARM_CHANNEL_ID } : {}),
  };
}

async function cancelByIdentifier(
  notifications: NotificationsModule,
  identifier: string,
): Promise<void> {
  await notifications.cancelScheduledNotificationAsync(identifier);
}

export async function cancelAlarmNotifications(timeId: number): Promise<void> {
  if (process.env.EXPO_OS === "web") return;
  const notifications = await loadNotificationsModule();
  await Promise.all(notificationIdentifiersFor(timeId).map((identifier) => cancelByIdentifier(notifications, identifier)));
}

export async function scheduleAlarmNotifications(
  time: AlarmTime,
  card: AlarmCard,
): Promise<void> {
  if (process.env.EXPO_OS === "web") return;
  const notifications = await loadNotificationsModule();

  await Promise.all(
    notificationIdentifiersFor(time.id).map((identifier) => cancelByIdentifier(notifications, identifier)),
  );
  if (!time.enabled) return;

  const content = contentFor(time, card);
  if (time.schedule.type === "weekly") {
    await Promise.all(
      time.schedule.repeatDays.map((day) =>
        notifications.scheduleNotificationAsync({
          identifier: `${notificationBaseIdentifier(time.id)}_day_${day}`,
          content,
          trigger: weeklyTrigger(notifications, day, time),
        }),
      ),
    );
    return;
  }

  await notifications.scheduleNotificationAsync({
    identifier: `${notificationBaseIdentifier(time.id)}_once`,
    content,
    trigger: onceTrigger(notifications, time),
  });
}

export async function scheduleSnoozeNotification(
  time: AlarmTime,
  card: AlarmCard,
): Promise<void> {
  if (process.env.EXPO_OS === "web") return;
  const notifications = await loadNotificationsModule();

  const snoozeIdentifier = `${notificationBaseIdentifier(time.id)}_snooze`;
  await cancelByIdentifier(notifications, snoozeIdentifier);
  await notifications.scheduleNotificationAsync({
    identifier: snoozeIdentifier,
    content: contentFor(time, card),
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, time.snoozeMinutes * 60),
      repeats: false,
      ...(process.env.EXPO_OS === "android" ? { channelId: ALARM_CHANNEL_ID } : {}),
    },
  });
}

export function classifyNotificationError(error: unknown): NotificationFailureReason {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("expo go") || normalized.includes("development build")) return "unsupported";
  if (normalized.includes("permission") || normalized.includes("securityexception")) return "permission";
  if (normalized.includes("date") || normalized.includes("trigger") || normalized.includes("schedule")) return "schedule";
  return "unknown";
}

export function notificationErrorMessage(reason: NotificationFailureReason): string {
  if (reason === "unsupported") {
    return "Alarm bildirimleri Expo Go'da çalışmaz. `bun run android` veya `bun run ios` ile development build aç.";
  }
  if (reason === "permission") {
    return "Bildirim veya kesin alarm izni kapalı. Ayarlardan Alarmlar ve bildirimler izinlerini aç.";
  }
  if (reason === "schedule") return "Bu alarmın tarihi geçmiş veya zamanlaması geçersiz.";
  return "Alarm bildirimi planlanamadı. Lütfen izinlerini kontrol edip tekrar dene.";
}
