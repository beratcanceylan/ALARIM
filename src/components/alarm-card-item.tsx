import { Image } from "expo-image";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { formatRepeatDays, formatTime } from "@/lib/alarm-utils";
import { spacing, type AppColors } from "@/constants/theme";
import type { AlarmCard, AlarmTime } from "@/types/alarm";

type Props = {
  card: AlarmCard;
  colors: AppColors;
  onOpen: () => void;
  onToggle: (time: AlarmTime, enabled: boolean) => void;
};

export function AlarmCardItem({ card, colors, onOpen, onToggle }: Props) {
  const title = card.title.trim() || "Hatırlatıcı";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          boxShadow: `0 6px 16px ${colors.shadow}`,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} kartını düzenle`}
        onPress={onOpen}
        style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
      >
        {card.imageUri ? (
          <Image source={{ uri: card.imageUri }} style={styles.thumbnail} contentFit="cover" />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailFallback, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.thumbnailMark, { color: colors.primary }]}>A</Text>
          </View>
        )}
        <View style={styles.headerCopy}>
          <Text selectable style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          <Text selectable numberOfLines={2} style={[styles.note, { color: colors.textMuted }]}>
            {card.note.trim() || "Not eklemek için dokun"}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
      </Pressable>

      {card.times.length === 0 ? (
        <Pressable onPress={onOpen} style={styles.noTimes}>
          <Text style={[styles.noTimesText, { color: colors.textMuted }]}>Henüz saat eklenmedi</Text>
          <Text style={[styles.addHint, { color: colors.primary }]}>Saat ekle</Text>
        </Pressable>
      ) : (
        <View style={styles.times}>
          {card.times.map((time) => (
            <View key={time.id} style={[styles.timeRow, { borderTopColor: colors.border }]}>
              <View style={styles.timeCopy}>
                <Text selectable style={[styles.time, { color: colors.text }]}>
                  {formatTime(time.hour, time.minute)}
                </Text>
                <Text selectable style={[styles.repeat, { color: colors.textMuted }]}>
                  {formatRepeatDays(time.repeatDays)}
                </Text>
              </View>
              <Switch
                value={time.enabled}
                onValueChange={(enabled) => onToggle(time, enabled)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
                accessibilityLabel={`${formatTime(time.hour, time.minute)} alarmını ${time.enabled ? "kapat" : "aç"}`}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
  },
  pressed: { opacity: 0.72 },
  thumbnail: { width: 58, height: 58, borderRadius: 18 },
  thumbnailFallback: { alignItems: "center", justifyContent: "center" },
  thumbnailMark: { fontSize: 24, fontWeight: "800" },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  note: { fontSize: 14, lineHeight: 20 },
  chevron: { fontSize: 28, fontWeight: "300", marginLeft: 2 },
  times: { paddingHorizontal: spacing.md },
  timeRow: {
    minHeight: 64,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeCopy: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, flexShrink: 1 },
  time: { fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
  repeat: { fontSize: 13, flexShrink: 1 },
  noTimes: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#00000012",
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  noTimesText: { fontSize: 14 },
  addHint: { fontSize: 14, fontWeight: "800" },
});
