import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Image } from "expo-image";
import * as Notifications from "expo-notifications";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { useAlarmStore } from "@/context/alarm-store";
import { formatTime } from "@/lib/alarm-utils";
import { DISMISS_ACTION_ID, SNOOZE_ACTION_ID } from "@/lib/notifications";
import { spacing } from "@/constants/theme";

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function RingingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ timeId?: string; notificationId?: string; action?: string }>();
  const timeId = Number(getParam(params.timeId));
  const notificationId = getParam(params.notificationId);
  const action = getParam(params.action);
  const { getTime, markTimeFired, snoozeTime } = useAlarmStore();
  const entry = Number.isFinite(timeId) ? getTime(timeId) : undefined;
  const player = useAudioPlayer(entry?.time.soundUri ?? null);
  const actionHandled = useRef(false);
  const [busy, setBusy] = useState(false);

  const leave = useCallback(async () => {
    if (notificationId) {
      await Notifications.dismissNotificationAsync(notificationId).catch(() => undefined);
    } else {
      await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [notificationId, router]);

  useEffect(() => {
    if (!entry || actionHandled.current) return;
    actionHandled.current = true;
    if (entry.time.repeatDays.length === 0) void markTimeFired(entry.time.id);

    if (action === SNOOZE_ACTION_ID) {
      void snoozeTime(entry.time.id).finally(() => {
        void leave();
      });
    } else if (action === DISMISS_ACTION_ID) {
      void leave();
    }
  }, [action, entry, leave, markTimeFired, snoozeTime]);

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

  const title = useMemo(() => entry?.card.title.trim() || "Alarim", [entry?.card.title]);

  if (!entry) {
    return (
      <View style={styles.fallback}>
        <StatusBar style="light" />
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
        <Text style={styles.brand}>ALARIM</Text>
        <Text style={styles.live}>ŞİMDİ</Text>
      </View>
      <View style={styles.content}>
        {entry.card.imageUri ? (
          <Image source={{ uri: entry.card.imageUri }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={styles.imageFallback}>
            <Text style={styles.imageFallbackMark}>A</Text>
          </View>
        )}
        <Text selectable style={styles.time}>{formatTime(entry.time.hour, entry.time.minute)}</Text>
        <Text selectable style={styles.title}>{title}</Text>
        <Text selectable style={styles.note}>{entry.card.note.trim() || "Alarm zamanı geldi."}</Text>
        <Text style={styles.soundHint}>{soundUri ? "Özel ses çalıyor" : "Varsayılan bildirim sesi"}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          disabled={busy}
          onPress={() => void handleSnooze()}
          style={({ pressed }) => [styles.snoozeButton, pressed && styles.pressed, busy && styles.disabled]}
        >
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
  fallbackButton: { paddingHorizontal: spacing.lg, paddingVertical: 14, borderRadius: 18, backgroundColor: "#6F61E8" },
  fallbackButtonText: { color: "#FFFFFF", fontWeight: "900" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#C7BFFF", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  live: { color: "#A8A0C8", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  image: { width: "100%", height: 280, borderRadius: 30, marginBottom: spacing.md },
  imageFallback: { width: 150, height: 150, borderRadius: 75, backgroundColor: "#302A58", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  imageFallbackMark: { color: "#B7A9FF", fontSize: 60, fontWeight: "900" },
  time: { color: "#FFFFFF", fontSize: 72, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -3 },
  title: { color: "#C7BFFF", fontSize: 20, fontWeight: "800" },
  note: { color: "#FFFFFF", fontSize: 17, lineHeight: 24, textAlign: "center", maxWidth: 340 },
  soundHint: { color: "#A8A0C8", fontSize: 13, marginTop: spacing.sm },
  actions: { gap: spacing.sm },
  snoozeButton: { minHeight: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#302A58", borderWidth: 1, borderColor: "#514980" },
  snoozeText: { color: "#DDD8FF", fontSize: 16, fontWeight: "900" },
  dismissButton: { minHeight: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#6F61E8" },
  dismissText: { color: "#F3F1FF", fontSize: 16, fontWeight: "900" },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.6 },
});
