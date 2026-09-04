import { useMemo, useState } from "react";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { AppIcon } from "@/components/app-icon";
import { spacing, type AppColors, radii } from "@/constants/theme";
import { formatNextOccurrence, formatScheduleShort, formatTime, getNextOccurrenceDate } from "@/lib/alarm-utils";
import type { AlarmCard, AlarmTime } from "@/types/alarm";

type Props = {
  card: AlarmCard;
  colors: AppColors;
  onOpen: () => void;
  onToggle: (time: AlarmTime, enabled: boolean) => void;
};

function getNextTime(card: AlarmCard): AlarmTime | undefined {
  let nextTime: AlarmTime | undefined;
  let nextDate: Date | undefined;

  for (const time of card.times) {
    if (!time.enabled) continue;
    const date = getNextOccurrenceDate(time.schedule, time.hour, time.minute);
    if (date && (!nextDate || date.getTime() < nextDate.getTime())) {
      nextDate = date;
      nextTime = time;
    }
  }

  return nextTime;
}

function PhotoTile({ time, colors, large = false }: { time?: AlarmTime; colors: AppColors; large?: boolean }) {
  return (
    <View style={[styles.photoTile, large && styles.photoTileLarge, { backgroundColor: colors.primarySoft }]}>
      {time?.imageUri ? (
        <Image
          source={{ uri: time.imageUri }}
          contentFit="cover"
          transition={180}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <AppIcon name="photo" color={colors.primary} size={large ? 25 : 18} />
      )}
    </View>
  );
}

export function AlarmCardItem({ card, colors, onOpen, onToggle }: Props) {
  const [expanded, setExpanded] = useState(card.times.length <= 1);
  const activeCount = card.times.filter((time) => time.enabled).length;
  const nextTime = useMemo(() => getNextTime(card), [card]);
  const photos = useMemo(
    () => card.times.filter((time) => time.imageUri).slice(0, 3),
    [card.times],
  );
  const title = card.title.trim() || "ALARIM";

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.duration(220)}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          boxShadow: `0 8px 22px ${colors.shadow}`,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} grubunu ${expanded ? "daralt" : "genişlet"}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [styles.headerMain, pressed && styles.pressed]}
        >
          <View style={styles.collage}>
            {photos.length === 0 ? <PhotoTile colors={colors} large /> : null}
            {photos.map((time, index) => (
              <PhotoTile key={time.id} time={time} colors={colors} large={photos.length === 1 || index === 0} />
            ))}
          </View>
          <View style={styles.headerCopy}>
            <Text selectable style={[styles.title, { color: colors.text }]}>{title}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.activeDot, { backgroundColor: activeCount ? colors.success : colors.border }]} />
              <Text selectable style={[styles.meta, { color: colors.textMuted }]}>
                {activeCount ? `${activeCount} alarm açık` : "Tüm alarmlar kapalı"}
              </Text>
            </View>
            <Text selectable numberOfLines={1} style={[styles.next, { color: colors.primary }]}>
              {nextTime ? `Sonraki · ${formatNextOccurrence(nextTime)}` : "Yeni bir zaman ekle"}
            </Text>
          </View>
          <AppIcon name={expanded ? "chevron.up" : "chevron.down"} color={colors.textMuted} size={22} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} grubunu düzenle`}
          onPress={onOpen}
          style={({ pressed }) => [styles.editButton, { backgroundColor: colors.surfaceMuted }, pressed && styles.pressed]}
        >
          <AppIcon name="pencil" color={colors.text} size={17} />
        </Pressable>
      </View>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={LinearTransition.duration(220)}>
          <View style={[styles.times, { borderTopColor: colors.border }]}>
            {card.times.map((time) => (
              <View key={time.id} style={[styles.timeRow, { borderBottomColor: colors.border }, !time.enabled && styles.disabledRow]}>
                <PhotoTile time={time} colors={colors} />
                <View style={styles.timeCopy}>
                  <Text selectable style={[styles.time, { color: colors.text }]}>{formatTime(time.hour, time.minute)}</Text>
                  <Text selectable numberOfLines={1} style={[styles.timeTitle, { color: colors.text }]}>
                    {time.title.trim() || "Adsız alarm"}
                  </Text>
                  <Text selectable numberOfLines={1} style={[styles.schedule, { color: colors.textMuted }]}>
                    {formatScheduleShort(time.schedule)}
                  </Text>
                </View>
                <Switch
                  value={time.enabled}
                  onValueChange={(enabled) => onToggle(time, enabled)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.border}
                  accessibilityLabel={`${time.title.trim() || formatTime(time.hour, time.minute)} alarmını ${time.enabled ? "kapat" : "aç"}`}
                />
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title} grubunu düzenle`}
            onPress={onOpen}
            style={({ pressed }) => [styles.footer, { borderTopColor: colors.border }, pressed && styles.pressed]}
          >
            <Text style={[styles.footerText, { color: colors.primary }]}>Alarm ayrıntılarını düzenle</Text>
            <AppIcon name="arrow.right" color={colors.primary} size={19} />
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  headerMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 72,
  },
  collage: {
    width: 76,
    height: 64,
    flexDirection: "row",
    gap: 3,
    overflow: "hidden",
    borderRadius: radii.md,
  },
  photoTile: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photoTileLarge: {
    flex: 1,
    width: undefined,
    height: undefined,
    borderRadius: 0,
  },
  headerCopy: { flex: 1, gap: 4, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  activeDot: { width: 7, height: 7, borderRadius: 4 },
  meta: { fontSize: 12, fontWeight: "700" },
  next: { fontSize: 13, fontWeight: "800" },
  editButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.62 },
  times: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md },
  timeRow: {
    minHeight: 80,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  disabledRow: { opacity: 0.55 },
  timeCopy: { flex: 1, minWidth: 0, gap: 2 },
  time: { fontSize: 25, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -0.8 },
  timeTitle: { fontSize: 14, fontWeight: "800" },
  schedule: { fontSize: 12 },
  footer: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { fontSize: 14, fontWeight: "900" },
});
