import { useCallback, useMemo, useState } from "react";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppIcon } from "@/components/app-icon";
import { useAppColors, radii, spacing } from "@/constants/theme";
import { formatDateKeyForInput, formatScheduleShort, formatTime, getDateAtTime, getSoundLabel } from "@/lib/alarm-utils";
import { getDefaultOnceDate, SNOOZE_OPTIONS, WEEKDAYS, type AlarmSchedule, type AlarmTime, type IsoWeekday } from "@/types/alarm";

type MediaSource = "gallery" | "camera";

type Props = {
  time: AlarmTime;
  onChange: (time: AlarmTime) => void;
  onRemove: () => void;
  onPickImage: (source: MediaSource) => void;
  onClearImage: () => void;
  onPickSound: () => void;
  onClearSound: () => void;
  error?: string;
  warning?: string;
};

type PickerMode = "time" | "date";

const selectedDayAccessibilityState = { selected: true };
const unselectedDayAccessibilityState = { selected: false };

function dateForTime(time: AlarmTime): Date {
  if (time.schedule.type === "once") {
    return getDateAtTime(time.schedule.date, time.hour, time.minute) ?? new Date();
  }
  const date = new Date();
  date.setHours(time.hour, time.minute, 0, 0);
  return date;
}

export function TimeRowEditor({
  time,
  onChange,
  onRemove,
  onPickImage,
  onClearImage,
  onPickSound,
  onClearSound,
  error,
  warning,
}: Props) {
  const colors = useAppColors();
  const [expanded, setExpanded] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [draftPickerDate, setDraftPickerDate] = useState(() => dateForTime(time));

  const openPicker = useCallback((mode: PickerMode) => {
    setPickerMode(mode);
    setDraftPickerDate(dateForTime(time));
  }, [time]);

  const applyPickerDate = useCallback((date: Date, mode: PickerMode) => {
    if (mode === "time") {
      onChange({ ...time, hour: date.getHours(), minute: date.getMinutes() });
      return;
    }

    const nextDate = formatDateKeyForInput(date);
    const schedule: AlarmSchedule = { type: "once", date: nextDate };
    onChange({ ...time, schedule });
  }, [onChange, time]);

  const handlePickerChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate || !pickerMode) {
      if (process.env.EXPO_OS !== "ios") setPickerMode(null);
      return;
    }
    if (process.env.EXPO_OS === "ios") {
      setDraftPickerDate(selectedDate);
      return;
    }
    if (event.type === "set") applyPickerDate(selectedDate, pickerMode);
    setPickerMode(null);
  }, [applyPickerDate, pickerMode]);

  const toggleDay = useCallback((value: IsoWeekday) => {
    if (time.schedule.type !== "weekly") return;
    const selected = time.schedule.repeatDays.includes(value);
    const repeatDays = selected
      ? time.schedule.repeatDays.filter((day) => day !== value)
      : [...time.schedule.repeatDays, value].sort((left, right) => left - right);
    onChange({ ...time, schedule: { type: "weekly", repeatDays } });
  }, [onChange, time]);

  const selectScheduleType = useCallback((type: AlarmSchedule["type"]) => {
    if (type === time.schedule.type) return;
    if (type === "weekly") {
      onChange({ ...time, schedule: { type: "weekly", repeatDays: [] } });
      return;
    }
    onChange({
      ...time,
      schedule: {
        type: "once",
        date: time.schedule.type === "once" ? time.schedule.date : getDefaultOnceDate(time.hour, time.minute, new Date()),
      },
    });
  }, [onChange, time]);

  const cycleSnooze = useCallback(() => {
    const currentIndex = SNOOZE_OPTIONS.indexOf(time.snoozeMinutes as (typeof SNOOZE_OPTIONS)[number]);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % SNOOZE_OPTIONS.length;
    onChange({ ...time, snoozeMinutes: SNOOZE_OPTIONS[nextIndex] });
  }, [onChange, time]);

  const selectedDays = useMemo(
    () => time.schedule.type === "weekly" ? time.schedule.repeatDays : [],
    [time.schedule],
  );

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(160)}
      layout={LinearTransition.duration(220)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: error ? colors.danger : colors.border,
          boxShadow: `0 5px 16px ${colors.shadow}`,
        },
      ]}
    >
      <View style={styles.summaryRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${formatTime(time.hour, time.minute)} alarm ayrıntılarını ${expanded ? "daralt" : "göster"}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={({ pressed }) => [styles.summaryButton, pressed && styles.pressed]}
        >
          {time.imageUri ? (
            <Image source={{ uri: time.imageUri }} contentFit="cover" transition={180} style={styles.summaryImage} />
          ) : (
            <View style={[styles.summaryImage, styles.summaryImageFallback, { backgroundColor: colors.primarySoft }]}>
              <AppIcon name="photo" color={colors.primary} size={22} />
            </View>
          )}
          <View style={styles.summaryCopy}>
            <Text selectable style={[styles.summaryTime, { color: colors.text }]}>{formatTime(time.hour, time.minute)}</Text>
            <Text selectable numberOfLines={1} style={[styles.summaryTitle, { color: colors.text }]}>
              {time.title.trim() || "Adsız alarm"}
            </Text>
            <Text selectable numberOfLines={1} style={[styles.summarySchedule, { color: colors.textMuted }]}>
              {formatScheduleShort(time.schedule)}
            </Text>
          </View>
          <AppIcon name={expanded ? "chevron.up" : "chevron.down"} color={colors.textMuted} size={22} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Alarmı sil"
          onPress={onRemove}
          style={({ pressed }) => [styles.removeButton, { backgroundColor: colors.dangerSoft }, pressed && styles.pressed]}
        >
          <AppIcon name="trash" color={colors.danger} size={18} />
        </Pressable>
      </View>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.details}>
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>ALARM ADI</Text>
            <TextInput
              value={time.title}
              onChangeText={(title) => onChange({ ...time, title })}
              placeholder="Örn. Sabah yürüyüşü"
              placeholderTextColor={colors.textMuted}
              maxLength={80}
              style={[styles.textInput, { color: colors.text, backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>NOT</Text>
            <TextInput
              value={time.note}
              onChangeText={(note) => onChange({ ...time, note })}
              placeholder="Bu alarm sana neyi hatırlatsın?"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
              textAlignVertical="top"
              style={[styles.noteInput, { color: colors.text, backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            />
          </View>

          <View style={styles.fieldGroup}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>GÖRSEL</Text>
              {time.imageUri ? (
                <Pressable onPress={onClearImage} hitSlop={8}>
                  <Text style={[styles.inlineAction, { color: colors.primary }]}>Kaldır</Text>
                </Pressable>
              ) : null}
            </View>
            {time.imageUri ? (
              <Image source={{ uri: time.imageUri }} contentFit="cover" transition={180} style={styles.imagePreview} />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <AppIcon name="photo" color={colors.primary} size={28} />
                <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Bu alarma bir görsel ekle</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={time.imageUri ? "Alarm görselini değiştir" : "Alarm görseli ekle"}
              onPress={() => setShowImageMenu(true)}
              style={({ pressed }) => [styles.outlineButton, { borderColor: colors.border }, pressed && styles.pressed]}
            >
              <AppIcon name="photo" color={colors.text} size={18} />
              <Text style={[styles.outlineButtonText, { color: colors.text }]}>{time.imageUri ? "Görseli değiştir" : "Görsel ekle"}</Text>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>ZAMANLAMA</Text>
            <View style={[styles.segmented, { backgroundColor: colors.surfaceMuted }]}>
              {(["weekly", "once"] as const).map((type) => {
                const selected = time.schedule.type === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => selectScheduleType(type)}
                    style={({ pressed }) => [styles.segment, selected && { backgroundColor: colors.surface, boxShadow: `0 2px 8px ${colors.shadow}` }, pressed && styles.pressed]}
                  >
                    <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}>{type === "weekly" ? "Haftalık" : "Tek seferlik"}</Text>
                  </Pressable>
                );
              })}
            </View>
            {time.schedule.type === "weekly" ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                {WEEKDAYS.map((day) => {
                  const selected = selectedDays.includes(day.value);
                  return (
                    <Pressable
                      key={day.value}
                      accessibilityRole="button"
                      accessibilityState={selected ? selectedDayAccessibilityState : unselectedDayAccessibilityState}
                      onPress={() => toggleDay(day.value)}
                      style={({ pressed }) => [styles.dayChip, { backgroundColor: selected ? colors.primary : colors.surfaceMuted, borderColor: selected ? colors.primary : colors.border }, pressed && styles.pressed]}
                    >
                      <Text style={[styles.dayLabel, { color: selected ? colors.onPrimary : colors.textMuted }]}>{day.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Tarih ${formatScheduleShort(time.schedule)}. Değiştirmek için dokun`}
                onPress={() => openPicker("date")}
                style={({ pressed }) => [styles.settingButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, pressed && styles.pressed]}
              >
                <AppIcon name="calendar" color={colors.primary} size={20} />
                <View style={styles.settingCopy}>
                  <Text style={[styles.settingCaption, { color: colors.textMuted }]}>TARİH</Text>
                  <Text selectable style={[styles.settingValue, { color: colors.text }]}>{formatScheduleShort(time.schedule)}</Text>
                </View>
                <AppIcon name="chevron.down" color={colors.textMuted} size={18} />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Saat ${formatTime(time.hour, time.minute)}. Değiştirmek için dokun`}
              onPress={() => openPicker("time")}
              style={({ pressed }) => [styles.settingButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, pressed && styles.pressed]}
            >
              <AppIcon name="clock.fill" color={colors.primary} size={20} />
              <View style={styles.settingCopy}>
                <Text style={[styles.settingCaption, { color: colors.textMuted }]}>SAAT</Text>
                <Text selectable style={[styles.settingValue, { color: colors.text }]}>{formatTime(time.hour, time.minute)}</Text>
              </View>
              <AppIcon name="chevron.down" color={colors.textMuted} size={18} />
            </Pressable>
          </View>

          <View style={styles.actionSettings}>
            <Pressable onPress={onPickSound} style={({ pressed }) => [styles.actionSetting, { borderColor: colors.border }, pressed && styles.pressed]}>
              <AppIcon name="music.note" color={colors.primary} size={20} />
              <View style={styles.settingCopy}>
                <Text style={[styles.settingCaption, { color: colors.textMuted }]}>SES</Text>
                <Text numberOfLines={1} style={[styles.settingValue, { color: colors.text }]}>{getSoundLabel(time)}</Text>
              </View>
            </Pressable>
            <Pressable onPress={cycleSnooze} style={({ pressed }) => [styles.actionSetting, { borderColor: colors.border }, pressed && styles.pressed]}>
              <AppIcon name="bell.fill" color={colors.primary} size={20} />
              <View style={styles.settingCopy}>
                <Text style={[styles.settingCaption, { color: colors.textMuted }]}>ERTELEME</Text>
                <Text style={[styles.settingValue, { color: colors.text }]}>{time.snoozeMinutes} dk</Text>
              </View>
            </Pressable>
          </View>

          <View style={[styles.enabledRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <View style={styles.enabledCopy}>
              <AppIcon name="bell.fill" color={colors.primary} size={20} />
              <View style={styles.settingCopy}>
                <Text style={[styles.settingCaption, { color: colors.textMuted }]}>ETKİNLİK</Text>
                <Text style={[styles.settingValue, { color: colors.text }]}>{time.enabled ? "Alarm açık" : "Alarm kapalı"}</Text>
              </View>
            </View>
            <Switch
              value={time.enabled}
              onValueChange={(enabled) => onChange({ ...time, enabled })}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
              ios_backgroundColor={colors.border}
              accessibilityLabel="Alarmı etkinleştir"
            />
          </View>

          {time.soundUri ? (
            <Pressable onPress={onClearSound} hitSlop={8}>
              <Text style={[styles.inlineAction, { color: colors.primary }]}>Varsayılan sesi kullan</Text>
            </Pressable>
          ) : null}
          {error ? <Text selectable style={[styles.feedback, { color: colors.danger }]}>{error}</Text> : null}
          {warning ? <Text selectable style={[styles.feedback, { color: colors.warning }]}>{warning}</Text> : null}
        </Animated.View>
      ) : null}

      {showImageMenu ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setShowImageMenu(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowImageMenu(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Alarm görseli</Text>
              <Text selectable style={[styles.sheetSubtitle, { color: colors.textMuted }]}>Bu saate özel bir fotoğraf seç.</Text>
              <Pressable onPress={() => { setShowImageMenu(false); onPickImage("gallery"); }} style={({ pressed }) => [styles.sheetOption, { borderColor: colors.border }, pressed && styles.pressed]}>
                <AppIcon name="photo" color={colors.primary} size={21} />
                <Text style={[styles.sheetOptionText, { color: colors.text }]}>Galeriden seç</Text>
              </Pressable>
              {process.env.EXPO_OS !== "web" ? (
                <Pressable onPress={() => { setShowImageMenu(false); onPickImage("camera"); }} style={({ pressed }) => [styles.sheetOption, { borderColor: colors.border }, pressed && styles.pressed]}>
                  <AppIcon name="camera.fill" color={colors.primary} size={21} />
                  <Text style={[styles.sheetOptionText, { color: colors.text }]}>Kamera ile çek</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setShowImageMenu(false)} style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}>
                <Text style={[styles.sheetCancelText, { color: colors.textMuted }]}>Vazgeç</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {pickerMode && process.env.EXPO_OS !== "web" ? (
        process.env.EXPO_OS === "ios" ? (
          <Modal transparent animationType="fade" visible onRequestClose={() => setPickerMode(null)}>
            <View style={styles.modalBackdrop}>
              <View style={[styles.pickerCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>{pickerMode === "time" ? "Alarm saati" : "Alarm tarihi"}</Text>
                <DateTimePicker
                  value={draftPickerDate}
                  mode={pickerMode}
                  display="spinner"
                  is24Hour
                  minimumDate={pickerMode === "date" ? new Date() : undefined}
                  onChange={handlePickerChange}
                  style={styles.iosPicker}
                />
                <View style={styles.modalActions}>
                  <Pressable onPress={() => setPickerMode(null)}><Text style={[styles.modalActionText, { color: colors.textMuted }]}>Vazgeç</Text></Pressable>
                  <Pressable onPress={() => { applyPickerDate(draftPickerDate, pickerMode); setPickerMode(null); }}><Text style={[styles.modalActionText, { color: colors.primary }]}>Tamam</Text></Pressable>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={draftPickerDate}
            mode={pickerMode}
            display="default"
            is24Hour
            minimumDate={pickerMode === "date" ? new Date() : undefined}
            onChange={handlePickerChange}
          />
        )
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: radii.lg, overflow: "hidden" },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm },
  summaryButton: { flex: 1, minHeight: 70, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryImage: { width: 62, height: 62, borderRadius: radii.md, overflow: "hidden" },
  summaryImageFallback: { alignItems: "center", justifyContent: "center" },
  summaryCopy: { flex: 1, minWidth: 0, gap: 2 },
  summaryTime: { fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -0.8 },
  summaryTitle: { fontSize: 14, fontWeight: "800" },
  summarySchedule: { fontSize: 12 },
  removeButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.62 },
  details: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.md },
  fieldGroup: { gap: spacing.sm },
  fieldLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  textInput: { minHeight: 48, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: 16 },
  noteInput: { minHeight: 92, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, fontSize: 15, lineHeight: 21 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  inlineAction: { fontSize: 13, fontWeight: "900" },
  imagePreview: { width: "100%", height: 180, borderRadius: radii.md, overflow: "hidden" },
  imagePlaceholder: { minHeight: 135, borderWidth: 1, borderStyle: "dashed", borderRadius: radii.md, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  placeholderText: { fontSize: 13 },
  outlineButton: { minHeight: 46, borderWidth: 1, borderRadius: radii.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  outlineButtonText: { fontSize: 14, fontWeight: "900" },
  segmented: { minHeight: 48, borderRadius: radii.md, padding: 4, flexDirection: "row", gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 13, fontWeight: "900" },
  days: { gap: spacing.sm, paddingVertical: 2 },
  dayChip: { minWidth: 44, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  dayLabel: { fontSize: 12, fontWeight: "900" },
  settingButton: { minHeight: 62, borderWidth: 1, borderRadius: radii.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md },
  settingCopy: { flex: 1, minWidth: 0, gap: 2 },
  settingCaption: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  settingValue: { fontSize: 15, fontWeight: "800" },
  actionSettings: { flexDirection: "row", gap: spacing.sm },
  actionSetting: { flex: 1, minWidth: 0, minHeight: 70, borderWidth: 1, borderRadius: radii.md, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.sm },
  enabledRow: { minHeight: 66, borderWidth: 1, borderRadius: radii.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md },
  enabledCopy: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  feedback: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "#00000070", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.lg, gap: spacing.sm },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: spacing.sm },
  sheetTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  sheetSubtitle: { fontSize: 14, lineHeight: 20, marginBottom: spacing.sm },
  sheetOption: { minHeight: 54, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
  sheetOptionText: { fontSize: 15, fontWeight: "800" },
  sheetCancel: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  sheetCancelText: { fontSize: 15, fontWeight: "900" },
  pickerCard: { margin: spacing.lg, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  iosPicker: { alignSelf: "center" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg },
  modalActionText: { fontSize: 15, fontWeight: "900" },
});
