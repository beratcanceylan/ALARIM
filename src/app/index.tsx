import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Notifications from "expo-notifications";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { AlarmCardItem } from "@/components/alarm-card-item";
import { useAppColors, spacing } from "@/constants/theme";
import { useAlarmStore } from "@/context/alarm-store";
import type { AlarmCard } from "@/types/alarm";

export default function HomeScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { cards, isReady, setTimeEnabled } = useAlarmStore();
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(null);

  const refreshNotificationPermission = useCallback(() => {
    let active = true;
    void Notifications.getPermissionsAsync()
      .then((permission) => {
        if (active) setNotificationGranted(permission.granted);
      })
      .catch(() => {
        if (active) setNotificationGranted(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(refreshNotificationPermission);

  const requestPermission = useCallback(async () => {
    const permission = await Notifications.requestPermissionsAsync();
    setNotificationGranted(permission.granted);
  }, []);

  const renderCard = useCallback(
    ({ item }: { item: AlarmCard }) => (
      <AlarmCardItem
        card={item}
        colors={colors}
        onOpen={() => router.push(`/edit/${item.id}`)}
        onToggle={(time, enabled) => void setTimeEnabled(time.id, enabled)}
      />
    ),
    [colors, router, setTimeEnabled],
  );

  if (!isReady) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Alarmlar hazırlanıyor…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Alarmlar" }} />
      <FlatList
        data={cards}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCard}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.listContent,
          cards.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>GÜNÜN AKIŞI</Text>
            <Text selectable style={[styles.heroTitle, { color: colors.text }]}>Sakin bir gün için</Text>
            <Text selectable style={[styles.heroSubtitle, { color: colors.textMuted }]}>Hatırlatıcılarını tek yerde tut.</Text>
            {notificationGranted === false ? (
              <Pressable
                onPress={() => void requestPermission()}
                style={[styles.permissionBanner, { backgroundColor: colors.dangerSoft }]}
              >
                <View style={styles.permissionCopy}>
                  <Text style={[styles.permissionTitle, { color: colors.danger }]}>Bildirimler kapalı</Text>
                  <Text selectable style={[styles.permissionText, { color: colors.danger }]}>Alarmları zamanında görmek için izin ver.</Text>
                </View>
                <Text style={[styles.permissionAction, { color: colors.danger }]}>İzin ver</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyIcon, { color: colors.primary }]}>＋</Text>
            <Text selectable style={[styles.emptyTitle, { color: colors.text }]}>İlk alarmını oluştur</Text>
            <Text selectable style={[styles.emptyText, { color: colors.textMuted }]}>Bir not ekle, saatini seç ve gününü kolaylaştır.</Text>
          </View>
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Yeni alarm ekle"
        onPress={() => router.push("/edit/0")}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.primary, boxShadow: `0 6px 16px ${colors.shadow}` },
          pressed && styles.fabPressed,
        ]}
      >
        <Text style={[styles.fabIcon, { color: colors.onPrimary }]}>＋</Text>
        <Text style={[styles.fabLabel, { color: colors.onPrimary }]}>Yeni alarm</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  loadingText: { fontSize: 14 },
  listContent: { padding: spacing.lg, paddingBottom: 132, gap: spacing.md },
  emptyListContent: { flexGrow: 1 },
  hero: { gap: 4, marginBottom: spacing.sm },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1.4, marginBottom: 5 },
  heroTitle: { fontSize: 31, fontWeight: "900", letterSpacing: -1.1 },
  heroSubtitle: { fontSize: 16, marginBottom: spacing.md },
  permissionBanner: {
    minHeight: 70,
    borderRadius: 18,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  permissionCopy: { flex: 1, gap: 3 },
  permissionTitle: { fontSize: 14, fontWeight: "800" },
  permissionText: { fontSize: 13, lineHeight: 18 },
  permissionAction: { fontSize: 13, fontWeight: "900" },
  emptyCard: {
    flex: 1,
    minHeight: 260,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: { fontSize: 42, fontWeight: "200", lineHeight: 50 },
  emptyTitle: { fontSize: 19, fontWeight: "800" },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 260 },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    height: 58,
    borderRadius: 29,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  fabPressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  fabIcon: { fontSize: 25, fontWeight: "300", marginTop: -2 },
  fabLabel: { fontSize: 14, fontWeight: "900" },
});
