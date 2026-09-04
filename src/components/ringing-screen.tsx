import { useCallback, useEffect, useRef, useState } from "react";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { AppIcon } from "@/components/app-icon";
import { useAlarmStore } from "@/context/alarm-store";
import { formatScheduleShort, formatTime } from "@/lib/alarm-utils";
import {
  dismissNotification,
  DISMISS_ACTION_ID,
  SNOOZE_ACTION_ID,
} from "@/lib/notifications";
import { radii, spacing } from "@/constants/theme";

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function safeTimeId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isSafeNotificationId(value: string | undefined, timeId: number | null): boolean {
  if (!value || timeId === null) return false;
  const match = new RegExp(`^alarm_${timeId}_(once|snooze|day_[1-7])$`).exec(value);
  return Boolean(match);
}

export function RingingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ timeId?: string; notificationId?: string; action?: string }>();
  const timeId = safeTimeId(getParam(params.timeId));
  const notificationId = getParam(params.notificationId);
  const action = getParam(params.action);
  const { getTime, isReady, markTimeFired, snoozeTime } = useAlarmStore();
  const entry = timeId ? getTime(timeId) : undefined;
  const player = useAudioPlayer(entry?.time.soundUri ?? null);
  const handledActionKey = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);

  const leave = useCallback(async () => {
    if (notificationId && isSafeNotificationId(notificationId, timeId)) {
      await dismissNotification(notificationId).catch(() => undefined);
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [notificationId, router, timeId]);

  useEffect(() => {
    const actionKey = `${timeId ?? "invalid"}:${notificationId ?? ""}:${action ?? ""}`;
    if (!entry || handledActionKey.current === actionKey) return;
    handledActionKey.current = actionKey;
    if (entry.time.schedule.type === "once") void markTimeFired(entry.time.id);

    if (action === SNOOZE_ACTION_ID) {
      void snoozeTime(entry.time.id).finally(() => {
        void leave();
      });
    } else if (action === DISMISS_ACTION_ID) {
      void leave();
    }
  }, [action, entry, leave, markTimeFired, notificationId, snoozeTime, timeId]);

  const soundUri = entry?.time.soundUri;
  useEffect(() => {
    if (!entry || action === SNOOZE_ACTION_ID || action === DISMISS_ACTION_ID) return;
    if (process.env.EXPO_OS !== "web") {
      void setAudioModeAsync({
        playsInSilentMode: true,
        interruptionMode: "doNotMix",
        shouldPlayInBackground: true,
      }).catch(() => undefined);
    }
    if (process.env.EXPO_OS === "ios") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    }
    if (soundUri) {
      // expo-audio exposes looping as an imperative player property.
      // eslint-disable-next-line react-hooks/immutability
      player.loop = true;
      player.play();
    }
    return () => {
      player.pause();
    };
  }, [action, entry, player, soundUri]);

  const handleDismiss = useCallback(async () => {
    setBusy(true);
    player.pause();
    await leave();
  }, [leave, player]);

  const handleSnooze = useCallback(async () => {
    if (!entry) return;
    setBusy(true);
    player.pause();
    await snoozeTime(entry.time.id);
    await leave();
  }, [entry, leave, player, snoozeTime]);

  const title = entry?.time.title.trim() || entry?.card.title.trim() || "ALARIM";
  const note = entry?.time.note.trim() || "Alarm zamanı geldi.";

  if (!isReady) {
    return (
      <View style={styles.fallback}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color="#B9ACFF" />
        <Text selectable style={styles.fallbackTitle}>Alarm hazırlanıyor…</Text>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.fallback}>
        <StatusBar style="light" />
        <AppIcon name="bell.fill" color="#B9ACFF" size={34} />
        <Text selectable style={styles.fallbackTitle}>Alarm bulunamadı</Text>
        <Pressable onPress={() => router.replace("/")} style={styles.fallbackButton}>
          <Text style={styles.fallbackButtonText}>Alarmlara dön</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><AppIcon name="bell.fill" color="#E7E1FF" size={14} /></View>
          <Text style={styles.brand}>ALARIM</Text>
        </View>
        <Text style={styles.live}>ŞİMDİ</Text>
      </View>
      <View style={styles.content}>
        {entry.time.imageUri ? (
          <Image source={{ uri: entry.time.imageUri }} contentFit="cover" transition={220} style={styles.image} />
        ) : (
          <View style={styles.imageFallback}>
            <AppIcon name="bell.fill" color="#B9ACFF" size={46} />
          </View>
        )}
        <Text selectable style={styles.time}>{formatTime(entry.time.hour, entry.time.minute)}</Text>
        <Text selectable style={styles.title}>{title}</Text>
        <Text selectable style={styles.note}>{note}</Text>
        <View style={styles.scheduleBadge}>
          <AppIcon name="calendar" color="#D9D2FF" size={14} />
          <Text selectable style={styles.scheduleText}>{formatScheduleShort(entry.time.schedule)}</Text>
        </View>
        {soundUri ? <Text style={styles.soundHint}>Özel ses uygulama içinde çalıyor</Text> : null}
      </View>
      <View style={styles.actions}>
        <Pressable
          disabled={busy}
          onPress={() => void handleSnooze()}
          style={({ pressed }) => [styles.snoozeButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          <AppIcon name="bell.fill" color="#DDD8FF" size={18} />
          <Text style={styles.snoozeText}>Ertele · {entry.time.snoozeMinutes} dk</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => void handleDismiss()}
          style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          {busy ? <ActivityIndicator color="#F3F1FF" /> : <Text style={styles.dismissText}>Kapat</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#17142A", paddingHorizontal: spacing.lg, paddingTop: 18, paddingBottom: spacing.lg },
  fallback: { flex: 1, backgroundColor: "#17142A", alignItems: "center", justifyContent: "center", gap: spacing.lg },
  fallbackTitle: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  fallbackButton: { paddingHorizontal: spacing.lg, paddingVertical: 14, borderRadius: radii.md, backgroundColor: "#6F61E8" },
  fallbackButtonText: { color: "#FFFFFF", fontWeight: "900" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandMark: { width: 26, height: 26, borderRadius: 9, backgroundColor: "#6F61E8", alignItems: "center", justifyContent: "center" },
  brand: { color: "#E7E1FF", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  live: { color: "#A8A0C8", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  image: { width: "100%", height: 280, borderRadius: radii.lg, marginBottom: spacing.md },
  imageFallback: { width: 150, height: 150, borderRadius: 75, backgroundColor: "#302A58", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  time: { color: "#FFFFFF", fontSize: 72, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -3 },
  title: { color: "#C7BFFF", fontSize: 20, fontWeight: "800", textAlign: "center" },
  note: { color: "#FFFFFF", fontSize: 17, lineHeight: 24, textAlign: "center", maxWidth: 340 },
  scheduleBadge: { minHeight: 32, paddingHorizontal: spacing.sm, borderRadius: 16, backgroundColor: "#302A58", flexDirection: "row", alignItems: "center", gap: 6 },
  scheduleText: { color: "#D9D2FF", fontSize: 12, fontWeight: "800" },
  soundHint: { color: "#A8A0C8", fontSize: 13, marginTop: spacing.sm },
  actions: { gap: spacing.sm },
  snoozeButton: { minHeight: 56, borderRadius: radii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm, backgroundColor: "#302A58", borderWidth: 1, borderColor: "#514980" },
  snoozeText: { color: "#DDD8FF", fontSize: 16, fontWeight: "900" },
  dismissButton: { minHeight: 56, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: "#6F61E8" },
  dismissText: { color: "#F3F1FF", fontSize: 16, fontWeight: "900" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
});
