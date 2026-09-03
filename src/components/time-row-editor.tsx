import { useCallback, useMemo, useState } from "react";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppColors, spacing } from "@/constants/theme";
import { formatRepeatDays, formatTime, getSoundLabel } from "@/lib/alarm-utils";
import { SNOOZE_OPTIONS, WEEKDAYS, type AlarmTime, type IsoWeekday } from "@/types/alarm";

type Props = {
  time: AlarmTime;
  onChange: (time: AlarmTime) => void;
  onRemove: () => void;
  onPickSound: () => void;
  onClearSound: () => void;
};

const selectedDayAccessibilityState = { selected: true };
const unselectedDayAccessibilityState = { selected: false };

export function TimeRowEditor({
  time,
  onChange,
  onRemove,
  onPickSound,
  onClearSound,
}: Props) {
  const colors = useAppColors();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const pickerDate = useMemo(() => {
    const date = new Date();
    date.setHours(time.hour, time.minute, 0, 0);
    return date;
  }, [time.hour, time.minute]);
  const [draftPickerDate, setDraftPickerDate] = useState(pickerDate);

  const openTimePicker = () => {
    setDraftPickerDate(pickerDate);
    setShowTimePicker(true);
  };

  const applyPickedTime = (date: Date) => {
    onChange({ ...time, hour: date.getHours(), minute: date.getMinutes() });
  };

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) {
      if (process.env.EXPO_OS !== "ios") setShowTimePicker(false);
      return;
    }
    if (process.env.EXPO_OS === "ios") {
      setDraftPickerDate(selectedDate);
      return;
    }
    if (event.type === "set") applyPickedTime(selectedDate);
    setShowTimePicker(false);
  };

  const toggleDay = useCallback((value: IsoWeekday) => {
    const selected = time.repeatDays.includes(value);
    const repeatDays = selected
      ? time.repeatDays.filter((day) => day !== value)
      : [...time.repeatDays, value].sort((a, b) => a - b);
    onChange({ ...time, repeatDays });
  }, [onChange, time]);

  const dayStyles = useMemo(
    () => ({
      selected: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
      },
      unselected: {
        backgroundColor: colors.surfaceMuted,
        borderColor: colors.border,
      },
      selectedLabel: { color: colors.onPrimary },
      unselectedLabel: { color: colors.textMuted },
    }),
    [colors],
  );

  const dayPressHandlers = useMemo(() => {
    const handlers = new Map<IsoWeekday, () => void>();
    for (const day of WEEKDAYS) handlers.set(day.value, () => toggleDay(day.value));
    return handlers;
  }, [toggleDay]);

  const renderDay = useCallback(
    ({ item: day }: { item: (typeof WEEKDAYS)[number] }) => {
      const selected = time.repeatDays.includes(day.value);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={selected ? selectedDayAccessibilityState : unselectedDayAccessibilityState}
          onPress={dayPressHandlers.get(day.value)}
          style={({ pressed }) => [
            styles.dayChip,
            selected ? dayStyles.selected : dayStyles.unselected,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.dayLabel, selected ? dayStyles.selectedLabel : dayStyles.unselectedLabel]}>{day.label}</Text>
        </Pressable>
      );
    },
    [dayPressHandlers, dayStyles, time.repeatDays],
  );

  const cycleSnooze = () => {
    const currentIndex = SNOOZE_OPTIONS.indexOf(time.snoozeMinutes as (typeof SNOOZE_OPTIONS)[number]);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % SNOOZE_OPTIONS.length;
    onChange({ ...time, snoozeMinutes: SNOOZE_OPTIONS[nextIndex] });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Saat ${formatTime(time.hour, time.minute)}. Değiştirmek için dokun`}
          onPress={openTimePicker}
          style={({ pressed }) => [styles.timeButton, { backgroundColor: colors.primarySoft }, pressed && styles.pressed]}
        >
          <Text selectable style={[styles.time, { color: colors.primary }]}>
            {formatTime(time.hour, time.minute)}
          </Text>
          <Text style={[styles.repeat, { color: colors.textMuted }]}>{formatRepeatDays(time.repeatDays)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Saat satırını sil"
          onPress={onRemove}
          style={({ pressed }) => [styles.removeButton, { backgroundColor: colors.dangerSoft }, pressed && styles.pressed]}
        >
          <Text style={[styles.removeIcon, { color: colors.danger }]}>×</Text>
        </Pressable>
      </View>

      <FlatList
        data={WEEKDAYS}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}
        keyExtractor={(day) => String(day.value)}
        renderItem={renderDay}
      />

      <View style={[styles.optionsRow, { borderTopColor: colors.border }]}>
        <Pressable onPress={onPickSound} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
          <Text style={[styles.optionCaption, { color: colors.textMuted }]}>SES</Text>
          <Text numberOfLines={1} style={[styles.optionValue, { color: colors.text }]}>{getSoundLabel(time)}</Text>
        </Pressable>
        <View style={[styles.optionDivider, { backgroundColor: colors.border }]} />
        <Pressable onPress={cycleSnooze} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
          <Text style={[styles.optionCaption, { color: colors.textMuted }]}>ERTELEME</Text>
          <Text style={[styles.optionValue, { color: colors.text }]}>{time.snoozeMinutes} dk</Text>
        </Pressable>
      </View>

      {time.soundUri ? (
        <Pressable onPress={onClearSound} style={styles.clearSound}>
          <Text style={[styles.clearSoundText, { color: colors.primary }]}>Varsayılan sesi kullan</Text>
        </Pressable>
      ) : null}

      {showTimePicker && process.env.EXPO_OS !== "ios" ? (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          is24Hour
          display="default"
          onChange={handlePickerChange}
        />
      ) : null}

      {showTimePicker && process.env.EXPO_OS === "ios" ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowTimePicker(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Alarm saati</Text>
              <DateTimePicker
                value={draftPickerDate}
                mode="time"
                display="spinner"
                onChange={handlePickerChange}
                style={styles.iosPicker}
              />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setShowTimePicker(false)}>
                  <Text style={[styles.modalActionText, { color: colors.textMuted }]}>Vazgeç</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    applyPickedTime(draftPickerDate);
                    setShowTimePicker(false);
                  }}
                >
                  <Text style={[styles.modalActionText, { color: colors.primary }]}>Tamam</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 24, padding: spacing.md, gap: spacing.md },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  timeButton: { flex: 1, borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: 12, gap: 3 },
  time: { fontSize: 30, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -0.8 },
  repeat: { fontSize: 13 },
  removeButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  removeIcon: { fontSize: 28, fontWeight: "300", lineHeight: 30 },
  days: { gap: 8, paddingRight: 8 },
  dayChip: { minWidth: 43, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  dayLabel: { fontSize: 12, fontWeight: "800" },
  optionsRow: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", paddingTop: spacing.sm },
  option: { flex: 1, minWidth: 0, gap: 3 },
  optionDivider: { width: StyleSheet.hairlineWidth, height: 30, marginHorizontal: spacing.md },
  optionCaption: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  optionValue: { fontSize: 14, fontWeight: "700" },
  clearSound: { alignSelf: "flex-start" },
  clearSoundText: { fontSize: 12, fontWeight: "800" },
  pressed: { opacity: 0.65 },
  modalBackdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "center", padding: spacing.lg },
  modalCard: { borderRadius: 24, padding: spacing.lg, gap: spacing.md },
  modalTitle: { fontSize: 18, fontWeight: "900" },
  iosPicker: { alignSelf: "center" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg },
  modalActionText: { fontSize: 15, fontWeight: "900" },
});
