import * as Notifications from "expo-notifications";

import { getNextTriggerDate, isoToExpoWeekday } from "@/lib/alarm-utils";
import type { AlarmCard, AlarmTime, IsoWeekday } from "@/types/alarm";

export const ALARM_CHANNEL_ID = "alarms";
export const ALARM_CATEGORY_ID = "alarm_actions";
export const SNOOZE_ACTION_ID = "snooze";
export const DISMISS_ACTION_ID = "dismiss";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureNotifications(): Promise<void> {
  if (process.env.EXPO_OS === "android") {
    await Notifications.setNotificationChannelAsync(ALARM_CHANNEL_ID, {
      name: "Alarmlar",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  await Notifications.setNotificationCategoryAsync(
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
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function baseIdentifier(timeId: number): string {
  return `alarm_${timeId}`;
}

function identifiersFor(timeId: number): string[] {
  return [
    `${baseIdentifier(timeId)}_once`,
    `${baseIdentifier(timeId)}_snooze`,
    ...Array.from({ length: 7 }, (_, index) => `${baseIdentifier(timeId)}_day_${index + 1}`),
  ];
}

function contentFor(time: AlarmTime, card: AlarmCard): Notifications.NotificationContentInput {
  return {
    title: card.title.trim() || "Alarim",
    body: card.note.trim() || "Alarm zamanı geldi.",
    sound: "default",
    categoryIdentifier: ALARM_CATEGORY_ID,
    autoDismiss: true,
    data: {
      type: "alarm",
      timeId: String(time.id),
      oneTime: time.repeatDays.length === 0,
    },
    ...(process.env.EXPO_OS === "android"
      ? {
          priority: "max",
          vibrate: [0, 300, 200, 300],
        }
      : {}),
  };
}

function weeklyTrigger(day: IsoWeekday, time: AlarmTime): Notifications.SchedulableNotificationTriggerInput {
  if (process.env.EXPO_OS === "android") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: isoToExpoWeekday(day),
      hour: time.hour,
      minute: time.minute,
      channelId: ALARM_CHANNEL_ID,
    };
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    weekday: isoToExpoWeekday(day),
    hour: time.hour,
    minute: time.minute,
    repeats: true,
  };
}

async function cancelByIdentifier(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
}

export async function cancelAlarmNotifications(timeId: number): Promise<void> {
  await Promise.all(identifiersFor(timeId).map(cancelByIdentifier));
}

export async function scheduleAlarmNotifications(
  time: AlarmTime,
  card: AlarmCard,
): Promise<void> {
  await cancelAlarmNotifications(time.id);
  if (!time.enabled) return;

  const content = contentFor(time, card);
  if (time.repeatDays.length > 0) {
    await Promise.all(
      time.repeatDays.map((day) =>
        Notifications.scheduleNotificationAsync({
          identifier: `${baseIdentifier(time.id)}_day_${day}`,
          content,
          trigger: weeklyTrigger(day, time),
        }),
      ),
    );
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: `${baseIdentifier(time.id)}_once`,
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: getNextTriggerDate(time.hour, time.minute),
      channelId: ALARM_CHANNEL_ID,
    },
  });
}

export async function scheduleSnoozeNotification(
  time: AlarmTime,
  card: AlarmCard,
): Promise<void> {
  const snoozeIdentifier = `${baseIdentifier(time.id)}_snooze`;
  await cancelByIdentifier(snoozeIdentifier);
  await Notifications.scheduleNotificationAsync({
    identifier: snoozeIdentifier,
    content: contentFor(time, card),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, time.snoozeMinutes * 60),
      repeats: false,
      channelId: ALARM_CHANNEL_ID,
    },
  });
}
