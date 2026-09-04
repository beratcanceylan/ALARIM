import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";

import { AlarmCardItem } from "@/components/alarm-card-item";
import { AppIcon } from "@/components/app-icon";
import { useAppColors, radii, spacing } from "@/constants/theme";
import { useAlarmStore } from "@/context/alarm-store";
import { formatNextOccurrence, getNextOccurrenceDate } from "@/lib/alarm-utils";
import {
  getNotificationPermissionStatus,
  isNotificationModuleAvailable,
  requestNotificationPermission,
} from "@/lib/notifications";
import type { AlarmCard, AlarmTime } from "@/types/alarm";

type NextAlarm = { time: AlarmTime; card: AlarmCard };

function getNextAlarm(cards: AlarmCard[]): NextAlarm | undefined {
  let result: NextAlarm | undefined;
  let resultDate: Date | undefined;

  for (const card of cards) {
    for (const time of card.times) {
      if (!time.enabled) continue;
      const date = getNextOccurrenceDate(time.schedule, time.hour, time.minute);
      if (date && (!resultDate || date.getTime() < resultDate.getTime())) {
        resultDate = date;
        result = { time, card };
      }
    }
  }

  return result;
}

export default function HomeScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { cards, isReady, notificationWarnings, rescheduleNotifications, setTimeEnabled } = useAlarmStore();
  const [notificationGranted, setNotificationGranted] = useState<boolean | null>(null);

  const refreshNotificationPermission = useCallback(() => {
    let active = true;
    void getNotificationPermissionStatus()
      .then((granted) => {
        if (active) setNotificationGranted(granted);
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
    const granted = await requestNotificationPermission().catch(() => false);
    setNotificationGranted(granted);
    if (granted) await rescheduleNotifications().catch(() => undefined);
  }, [rescheduleNotifications]);

  const openSettings = useCallback(() => {
    void Linking.openSettings().catch(() => undefined);
  }, []);

  const nextAlarm = useMemo(() => getNextAlarm(cards), [cards]);
  const totalAlarms = useMemo(() => cards.reduce((total, card) => total + card.times.length, 0), [cards]);
  const enabledAlarms = useMemo(
    () => cards.reduce((total, card) => total + card.times.filter((time) => time.enabled).length, 0),
    [cards],
  );

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
        <View style={[styles.loadingMark, { backgroundColor: colors.primarySoft }]}>
          <AppIcon name="bell.fill" color={colors.primary} size={25} />
        </View>
        <ActivityIndicator color={colors.primary} />
        <Text selectable style={[styles.loadingText, { color: colors.textMuted }]}>Alarmların hazırlanıyor…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "ALARIM", headerShown: false }} />
      <FlatList
        data={cards}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderCard}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.listContent, cards.length === 0 && styles.emptyListContent]}
        ListHeaderComponent={
          <View style={styles.headerContent}>
            <View style={styles.brandRow}>
              <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
                <AppIcon name="bell.fill" color={colors.onPrimary} size={18} />
              </View>
              <Text style={[styles.brand, { color: colors.text }]}>ALARIM</Text>
              <View style={styles.brandSpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Yeni alarm ekle"
                onPress={() => router.push("/edit/0")}
                style={({ pressed }) => [styles.headerAdd, { backgroundColor: colors.primary, boxShadow: `0 4px 12px ${colors.shadow}` }, pressed && styles.pressed]}
              >
                <AppIcon name="plus" color={colors.onPrimary} size={23} />
              </Pressable>
            </View>
            <Text selectable style={[styles.heroTitle, { color: colors.text }]}>Günün ritmini kur.</Text>
            <Text selectable style={[styles.heroSubtitle, { color: colors.textMuted }]}>Fotoğraflarınla hatırlamak istediğin anları uyandır.</Text>

            <View style={[styles.statsCard, { backgroundColor: colors.primary, boxShadow: `0 8px 20px ${colors.shadow}` }]}>
              <View style={styles.statMain}>
                <Text style={[styles.statCaption, { color: colors.onPrimary }]}>SONRAKİ ALARM</Text>
                <Text selectable style={[styles.nextTime, { color: colors.onPrimary }]}>{nextAlarm ? formatNextOccurrence(nextAlarm.time) : "Hazır"}</Text>
                <Text selectable numberOfLines={1} style={[styles.nextTitle, { color: colors.onPrimary }]}>
                  {nextAlarm ? `${nextAlarm.card.title} · ${nextAlarm.time.title.trim() || "Adsız alarm"}` : "Yukarıdaki + ile alarm ekle"}
                </Text>
              </View>
              <View style={[styles.statIcon, { backgroundColor: "#FFFFFF24" }]}>
                <AppIcon name="clock.fill" color={colors.onPrimary} size={28} />
              </View>
              <View style={[styles.statFooter, { borderTopColor: "#FFFFFF38" }]}>
                <Text style={[styles.statFooterText, { color: colors.onPrimary }]}>{cards.length} kayıt</Text>
                <Text style={[styles.statFooterText, { color: colors.onPrimary }]}>{enabledAlarms}/{totalAlarms} açık</Text>
              </View>
            </View>

            {!isNotificationModuleAvailable() ? (
              <View style={[styles.warningBanner, { backgroundColor: colors.warningSoft }]}>
                <AppIcon name="ellipsis.circle" color={colors.warning} size={20} />
                <Text selectable style={[styles.warningText, { color: colors.warning }]}>Alarm bildirimleri için Expo Go yerine development build kullanmalısın.</Text>
              </View>
            ) : notificationGranted === false ? (
              <Pressable
                onPress={() => void requestPermission()}
                style={({ pressed }) => [styles.permissionBanner, { backgroundColor: colors.dangerSoft }, pressed && styles.pressed]}
              >
                <View style={[styles.permissionIcon, { backgroundColor: colors.surface }]}>
                  <AppIcon name="bell.fill" color={colors.danger} size={18} />
                </View>
                <View style={styles.permissionCopy}>
                  <Text style={[styles.permissionTitle, { color: colors.danger }]}>Bildirimler kapalı</Text>
                  <Text selectable style={[styles.permissionText, { color: colors.danger }]}>Alarm saatlerini kaçırmamak için izin ver.</Text>
                </View>
                <Text style={[styles.permissionAction, { color: colors.danger }]}>İzin ver</Text>
              </Pressable>
            ) : null}

            {notificationWarnings.length > 0 ? (
              <View style={[styles.warningBanner, { backgroundColor: colors.warningSoft }]}>
                <AppIcon name="ellipsis.circle" color={colors.warning} size={20} />
                <Text selectable style={[styles.warningText, { color: colors.warning }]}>{notificationWarnings[0].message}</Text>
                {notificationWarnings[0].reason === "permission" ? (
                  <Pressable onPress={openSettings} hitSlop={8}>
                    <Text style={[styles.warningAction, { color: colors.warning }]}>Ayarlar</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {cards.length > 0 ? (
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>ALARMLARIN</Text>
                  <Text selectable style={[styles.sectionTitle, { color: colors.text }]}>Hepsi burada</Text>
                </View>
                <Text style={[styles.sectionCount, { color: colors.textMuted }]}>{cards.length}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, boxShadow: `0 8px 20px ${colors.shadow}` }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
              <AppIcon name="photo" color={colors.primary} size={29} />
            </View>
            <Text selectable style={[styles.emptyTitle, { color: colors.text }]}>Henüz alarm yok</Text>
            <Text selectable style={[styles.emptyText, { color: colors.textMuted }]}>Yukarıdaki + ile alarm saatini, fotoğrafını ve notunu ekle.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  loadingMark: { width: 56, height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  loadingText: { fontSize: 14 },
  listContent: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
  emptyListContent: { flexGrow: 1 },
  headerContent: { gap: spacing.md, marginBottom: spacing.sm },
  brandRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  brandMark: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  brandSpacer: { flex: 1 },
  headerAdd: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 32, fontWeight: "900", letterSpacing: -1.2, marginTop: spacing.sm },
  heroSubtitle: { fontSize: 15, lineHeight: 21, marginTop: -spacing.sm },
  statsCard: { minHeight: 154, borderRadius: radii.lg, padding: spacing.lg, overflow: "hidden" },
  statMain: { flex: 1, gap: 4, paddingRight: 55 },
  statCaption: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2, opacity: 0.8 },
  nextTime: { fontSize: 31, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -1 },
  nextTitle: { fontSize: 13, fontWeight: "700", opacity: 0.9 },
  statIcon: { position: "absolute", top: spacing.lg, right: spacing.lg, width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  statFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, flexDirection: "row", justifyContent: "space-between" },
  statFooterText: { fontSize: 12, fontWeight: "800", opacity: 0.9 },
  permissionBanner: { minHeight: 70, borderRadius: radii.md, padding: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  permissionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  permissionCopy: { flex: 1, gap: 3 },
  permissionTitle: { fontSize: 14, fontWeight: "900" },
  permissionText: { fontSize: 13, lineHeight: 18 },
  permissionAction: { fontSize: 13, fontWeight: "900", paddingHorizontal: spacing.sm },
  warningBanner: { minHeight: 58, borderRadius: radii.md, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  warningText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  warningAction: { fontSize: 13, fontWeight: "900" },
  sectionHeading: { marginTop: spacing.sm, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionEyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  sectionTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, marginTop: 3 },
  sectionCount: { fontSize: 15, fontWeight: "800", marginBottom: 3 },
  emptyCard: { flex: 1, minHeight: 330, borderWidth: 1, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  emptyTitle: { fontSize: 21, fontWeight: "900", letterSpacing: -0.4 },
  emptyText: { maxWidth: 285, fontSize: 14, lineHeight: 21, textAlign: "center" },
  pressed: { opacity: 0.65 },
});
