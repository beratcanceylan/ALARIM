import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "@/components/app-icon";
import { TimeRowEditor } from "@/components/time-row-editor";
import { useAppColors, radii, spacing } from "@/constants/theme";
import { useAlarmStore } from "@/context/alarm-store";
import { isWithinFiveMinutes, getDateAtTime } from "@/lib/alarm-utils";
import { copyToAppStorage, deleteManagedMedia, type MediaFolder } from "@/lib/media";
import {
  MAX_ALARM_TITLE_LENGTH,
  MAX_GROUP_TITLE_LENGTH,
  MAX_NOTE_LENGTH,
} from "@/lib/storage-core";
import { createEmptyTime, type AlarmTime } from "@/types/alarm";

type MediaSource = "gallery" | "camera";

type Validation = {
  groupError?: string;
  timesError?: string;
  timeErrors: Record<number, string>;
  timeWarnings: Record<number, string>;
};

function validateDraft(title: string, times: AlarmTime[], now = new Date()): Validation {
  const validation: Validation = { timeErrors: {}, timeWarnings: {} };
  if (!title.trim()) validation.groupError = "Alarm başlığı eklemeden devam edemezsin.";
  else if (title.trim().length > MAX_GROUP_TITLE_LENGTH) validation.groupError = "Alarm başlığı çok uzun.";
  if (times.length === 0) validation.timesError = "En az bir alarm saati ekle.";

  for (const time of times) {
    if (time.title.trim().length > MAX_ALARM_TITLE_LENGTH) {
      validation.timeErrors[time.id] = "Alarm adı çok uzun.";
    }
    if (time.note.trim().length > MAX_NOTE_LENGTH) {
      validation.timeErrors[time.id] = "Not çok uzun.";
    }
    if (time.schedule.type === "weekly" && time.schedule.repeatDays.length === 0) {
      validation.timeErrors[time.id] = "Haftalık alarm için en az bir gün seç.";
    }
    if (time.schedule.type === "once") {
      const date = getDateAtTime(time.schedule.date, time.hour, time.minute);
      if (!date || date.getTime() <= now.getTime()) {
        validation.timeErrors[time.id] = "Tek seferlik alarm için gelecekte bir tarih seç.";
      }
    }
  }

  for (let leftIndex = 0; leftIndex < times.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < times.length; rightIndex += 1) {
      const left = times[leftIndex];
      const right = times[rightIndex];
      if (isWithinFiveMinutes(left, right)) {
        validation.timeWarnings[left.id] = "Bu alarm başka bir alarma çok yakın.";
        validation.timeWarnings[right.id] = "Bu alarm başka bir alarma çok yakın.";
      }
    }
  }

  return validation;
}

export function CardEditScreen() {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cardId: rawCardId } = useLocalSearchParams<{ cardId: string }>();
  const cardId = Number(rawCardId ?? 0);
  const isExisting = Number.isSafeInteger(cardId) && cardId > 0;
  const { isReady, getCard, saveCard, deleteCard } = useAlarmStore();
  const [groupTitle, setGroupTitle] = useState("");
  const [times, setTimes] = useState<AlarmTime[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [validation, setValidation] = useState<Validation>({ timeErrors: {}, timeWarnings: {} });
  const loadedId = useRef<number | null>(null);
  const stagedMedia = useRef(new Map<string, MediaFolder>());

  useEffect(() => {
    if (!isReady || loadedId.current === cardId) return;
    loadedId.current = cardId;
    const card = isExisting ? getCard(cardId) : undefined;
    setGroupTitle(card?.title ?? "");
    setTimes(card?.times.map((time) => ({
      ...time,
      schedule: time.schedule.type === "weekly"
        ? { type: "weekly", repeatDays: [...time.schedule.repeatDays] }
        : { type: "once", date: time.schedule.date },
    })) ?? [createEmptyTime(0)]);
    setIsLoaded(true);
  }, [cardId, getCard, isExisting, isReady]);

  useEffect(() => () => {
    const cleanup = [...stagedMedia.current.entries()].map(([uri, folder]) => deleteManagedMedia(uri, folder));
    void Promise.all(cleanup);
  }, []);

  const updateTime = useCallback((updated: AlarmTime) => {
    setTimes((current) => current.map((time) => (time.id === updated.id ? updated : time)));
  }, []);

  const updateTimeFields = useCallback((timeId: number, fields: Partial<AlarmTime>) => {
    setTimes((current) => current.map((time) => (
      time.id === timeId ? { ...time, ...fields } : time
    )));
  }, []);

  const removeTime = useCallback((timeId: number) => {
    setTimes((current) => current.filter((time) => time.id !== timeId));
  }, []);

  const addTime = useCallback(() => {
    setTimes((current) => [...current, createEmptyTime(cardId)]);
  }, [cardId]);

  const pickImage = useCallback(async (timeId: number, source: MediaSource) => {
    try {
      const result = source === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.85,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.85,
          });

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 12_000_000) {
        Alert.alert("Görsel çok büyük", "12 MB’tan küçük bir görsel seç.");
        return;
      }
      const storedUri = await copyToAppStorage(
        asset.uri,
        "images",
        asset.fileName ?? `alarm-image-${Date.now()}.jpg`,
        "jpg",
      );
      stagedMedia.current.set(storedUri, "images");
      updateTimeFields(timeId, { imageUri: storedUri });
    } catch {
      Alert.alert("Görsel alınamadı", "Fotoğraf seçilirken bir sorun oluştu.");
    }
  }, [updateTimeFields]);

  const pickSound = useCallback(async (timeId: number) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const storedUri = await copyToAppStorage(asset.uri, "sounds", asset.name, "mp3");
      stagedMedia.current.set(storedUri, "sounds");
      updateTimeFields(timeId, { soundUri: storedUri, soundName: asset.name });
    } catch {
      Alert.alert("Ses alınamadı", "Ses dosyası seçilirken bir sorun oluştu.");
    }
  }, [updateTimeFields]);

  const cleanupUnusedStagedMedia = useCallback(async (keptUris: Set<string>) => {
    const staged = [...stagedMedia.current.entries()];
    stagedMedia.current.clear();
    await Promise.all(
      staged
        .filter(([uri]) => !keptUris.has(uri))
        .map(([uri, folder]) => deleteManagedMedia(uri, folder)),
    );
  }, []);

  const validationResult = useMemo(() => validateDraft(groupTitle, times), [groupTitle, times]);

  const save = useCallback(async () => {
    const nextValidation = validateDraft(groupTitle, times);
    setValidation(nextValidation);
    setShowErrors(true);
    if (nextValidation.groupError || nextValidation.timesError || Object.keys(nextValidation.timeErrors).length > 0) return;
    if (isSaving) return;

    setIsSaving(true);
    try {
      const result = await saveCard({
        id: isExisting ? cardId : 0,
        title: groupTitle.trim(),
        times,
      });
      const keptMedia = new Set(
        times.flatMap((time) => [time.imageUri, time.soundUri].filter((uri): uri is string => Boolean(uri))),
      );
      await cleanupUnusedStagedMedia(keptMedia);
      if (result.warnings.length > 0) {
        Alert.alert("Alarm kaydedildi", result.warnings[0].message);
      }
      router.back();
    } catch {
      Alert.alert("Kaydedilemedi", "Alarm kaydedilirken bir sorun oluştu.");
    } finally {
      setIsSaving(false);
    }
  }, [cardId, cleanupUnusedStagedMedia, groupTitle, isExisting, isSaving, router, saveCard, times]);

  const removeCard = useCallback(() => {
    if (!isExisting) return;
    Alert.alert(
      "Alarmı sil",
      "Bu kayıt ve içindeki tüm alarm saatleri silinecek.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => {
            void deleteCard(cardId).then(() => router.back());
          },
        },
      ],
    );
  }, [cardId, deleteCard, isExisting, router]);

  if (!isReady || !isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Alarm hazırlanıyor…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: isExisting ? "Alarmı düzenle" : "Yeni alarm" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.section}>
          <View style={styles.identityRow}>
            <View style={[styles.identityIcon, { backgroundColor: colors.primarySoft }]}>
              <AppIcon name="bell.fill" color={colors.primary} size={21} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ALARM BAŞLIĞI</Text>
              <TextInput
                value={groupTitle}
                onChangeText={setGroupTitle}
                placeholder="Örn. Sabah rutinim"
                placeholderTextColor={colors.textMuted}
                maxLength={MAX_GROUP_TITLE_LENGTH}
                accessibilityLabel="Alarm başlığı"
                style={[styles.titleInput, { color: colors.text, backgroundColor: colors.surface, borderColor: validation.groupError && showErrors ? colors.danger : colors.border }]}
              />
            </View>
          </View>
          {validation.groupError && showErrors ? <Text selectable style={[styles.error, { color: colors.danger }]}>{validation.groupError}</Text> : null}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View style={styles.sectionHeadingCopy}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>SAATLER</Text>
              <Text selectable style={[styles.sectionHint, { color: colors.textMuted }]}>{times.length} alarm</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Alarm saati ekle"
              onPress={addTime}
              style={({ pressed }) => [styles.addIconButton, { backgroundColor: colors.primarySoft }, pressed && styles.pressed]}
            >
              <AppIcon name="plus" color={colors.primary} size={21} />
            </Pressable>
          </View>
          {times.length > 0 ? (
            <View style={styles.timeList}>
              {times.map((time) => (
                <TimeRowEditor
                  key={time.id}
                  time={time}
                  onChange={updateTime}
                  onRemove={() => removeTime(time.id)}
                  onPickImage={(source) => void pickImage(time.id, source)}
                  onClearImage={() => updateTime({ ...time, imageUri: null })}
                  onPickSound={() => void pickSound(time.id)}
                  onClearSound={() => updateTime({ ...time, soundUri: null, soundName: null })}
                  error={showErrors ? validationResult.timeErrors[time.id] : undefined}
                  warning={validationResult.timeWarnings[time.id]}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyTimes, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <AppIcon name="clock.fill" color={colors.primary} size={25} />
              <Text selectable style={[styles.emptyTitle, { color: colors.text }]}>Henüz saat yok</Text>
              <Text selectable style={[styles.emptyText, { color: colors.textMuted }]}>Yukarıdaki + ile saat ekle.</Text>
            </View>
          )}
          {validation.timesError && showErrors ? <Text selectable style={[styles.error, { color: colors.danger }]}>{validation.timesError}</Text> : null}
        </View>
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <Pressable
          disabled={isSaving}
          onPress={() => void save()}
          style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, pressed && styles.savePressed, isSaving && styles.disabled]}
        >
          {isSaving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Kaydet</Text>}
        </Pressable>

        {isExisting ? (
          <Pressable onPress={removeCard} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
            <AppIcon name="trash" color={colors.danger} size={16} />
            <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Sil</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  loadingText: { fontSize: 14 },
  content: { padding: spacing.md, paddingBottom: spacing.lg, gap: spacing.md },
  section: { gap: spacing.sm },
  identityRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  identityIcon: { width: 44, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  identityCopy: { flex: 1, gap: 4 },
  sectionHeadingRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  sectionHeadingCopy: { gap: 3 },
  sectionLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  sectionHint: { fontSize: 13 },
  titleInput: { minHeight: 46, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, fontSize: 16, fontWeight: "700" },
  error: { fontSize: 13, lineHeight: 19, fontWeight: "700" },
  addIconButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  timeList: { gap: spacing.sm },
  emptyTimes: { minHeight: 104, borderWidth: 1, borderStyle: "dashed", borderRadius: radii.lg, alignItems: "center", justifyContent: "center", padding: spacing.md, gap: spacing.xs },
  emptyTitle: { fontSize: 16, fontWeight: "900" },
  emptyText: { fontSize: 13, textAlign: "center" },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.xs },
  saveButton: { minHeight: 50, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  saveButtonText: { fontSize: 16, fontWeight: "900" },
  savePressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  deleteButton: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  deleteButtonText: { fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.65 },
});
