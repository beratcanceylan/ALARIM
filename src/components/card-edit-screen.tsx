import { useCallback, useEffect, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
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

import { useAppColors, spacing } from "@/constants/theme";
import { useAlarmStore } from "@/context/alarm-store";
import { copyToAppStorage } from "@/lib/media";
import { createEmptyTime, type AlarmTime } from "@/types/alarm";
import { TimeRowEditor } from "@/components/time-row-editor";

export function CardEditScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const { cardId: rawCardId } = useLocalSearchParams<{ cardId: string }>();
  const cardId = Number(rawCardId ?? 0);
  const isExisting = Number.isFinite(cardId) && cardId > 0;
  const { isReady, getCard, saveCard, deleteCard } = useAlarmStore();
  const [note, setNote] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [times, setTimes] = useState<AlarmTime[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const loadedId = useRef<number | null>(null);

  useEffect(() => {
    if (!isReady || loadedId.current === cardId) return;
    loadedId.current = cardId;
    const card = isExisting ? getCard(cardId) : undefined;
    setNote(card?.note ?? "");
    setImageUri(card?.imageUri ?? null);
    setTimes(card?.times.map((time) => ({ ...time, repeatDays: [...time.repeatDays] })) ?? []);
    setIsLoaded(true);
  }, [cardId, getCard, isExisting, isReady]);

  const updateTime = useCallback((index: number, updated: AlarmTime) => {
    setTimes((current) => current.map((time, timeIndex) => (timeIndex === index ? updated : time)));
  }, []);

  const pickImage = useCallback(async (source: "gallery" | "camera") => {
    try {
      const result = source === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.9,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.9,
          });

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const storedUri = await copyToAppStorage(
        asset.uri,
        "images",
        asset.fileName ?? `alarm-image-${Date.now()}.jpg`,
        "jpg",
      );
      setImageUri(storedUri);
    } catch {
      Alert.alert("Görsel alınamadı", "Fotoğraf seçilirken bir sorun oluştu.");
    }
  }, []);

  const pickSound = useCallback(async (index: number) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const storedUri = await copyToAppStorage(asset.uri, "sounds", asset.name, "mp3");
      updateTime(index, { ...times[index], soundUri: storedUri, soundName: asset.name });
    } catch {
      Alert.alert("Ses alınamadı", "Ses dosyası seçilirken bir sorun oluştu.");
    }
  }, [times, updateTime]);

  const save = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveCard({
        id: isExisting ? cardId : 0,
        title: note.trim() || "Hatırlatıcı",
        imageUri,
        note,
        times,
      });
      router.back();
    } catch {
      Alert.alert("Kaydedilemedi", "Alarm kartı kaydedilirken bir sorun oluştu.");
    } finally {
      setIsSaving(false);
    }
  }, [cardId, imageUri, isExisting, isSaving, note, router, saveCard, times]);

  const removeCard = useCallback(() => {
    if (!isExisting) return;
    Alert.alert(
      "Kartı sil",
      "Bu kart ve ona bağlı tüm alarm saatleri silinecek.",
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
        <View style={styles.intro}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>KART AYARLARI</Text>
          <Text selectable style={[styles.heading, { color: colors.text }]}>Kendine bir hatırlatma bırak.</Text>
          <Text selectable style={[styles.subheading, { color: colors.textMuted }]}>Notun ve alarmların birlikte görünsün.</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>NOT</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Bugün neyi unutmamalısın?"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={[styles.noteInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>GÖRSEL</Text>
            {imageUri ? (
              <Pressable onPress={() => setImageUri(null)}>
                <Text style={[styles.link, { color: colors.primary }]}>Kaldır</Text>
              </Pressable>
            ) : null}
          </View>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.imagePlaceholderIcon, { color: colors.primary }]}>◌</Text>
              <Text style={[styles.imagePlaceholderText, { color: colors.textMuted }]}>İstersen bir görsel ekle</Text>
            </View>
          )}
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => void pickImage("gallery")}
              style={({ pressed }) => [styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Galeriden seç</Text>
            </Pressable>
            <Pressable
              onPress={() => void pickImage("camera")}
              style={({ pressed }) => [styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Kamera</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ALARM SAATLERİ</Text>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Gün seçmezsen bir kez çalar.</Text>
            </View>
            <Text style={[styles.count, { color: colors.primary }]}>{times.length}</Text>
          </View>
          <View style={styles.timeList}>
            {times.map((time, index) => (
              <TimeRowEditor
                key={time.id}
                time={time}
                onChange={(updated) => updateTime(index, updated)}
                onRemove={() => setTimes((current) => current.filter((_, timeIndex) => timeIndex !== index))}
                onPickSound={() => void pickSound(index)}
                onClearSound={() => updateTime(index, { ...time, soundUri: null, soundName: null })}
              />
            ))}
          </View>
          <Pressable
            onPress={() => setTimes((current) => [...current, createEmptyTime(cardId)])}
            style={({ pressed }) => [styles.addTimeButton, { borderColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={[styles.addTimeIcon, { color: colors.primary }]}>＋</Text>
            <Text style={[styles.addTimeText, { color: colors.primary }]}>Saat ekle</Text>
          </Pressable>
        </View>

        <Pressable
          disabled={isSaving}
          onPress={() => void save()}
          style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, pressed && styles.savePressed, isSaving && styles.disabled]}
        >
          {isSaving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Kaydet</Text>}
        </Pressable>

        {isExisting ? (
          <Pressable onPress={removeCard} style={styles.deleteButton}>
            <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Kartı sil</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, paddingBottom: 48, gap: spacing.xl },
  intro: { gap: 5 },
  eyebrow: { fontSize: 12, fontWeight: "900", letterSpacing: 1.4 },
  heading: { fontSize: 29, lineHeight: 35, fontWeight: "900", letterSpacing: -0.9 },
  subheading: { fontSize: 15, lineHeight: 21 },
  section: { gap: spacing.sm },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  sectionLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  sectionHint: { fontSize: 12, marginTop: 3 },
  link: { fontSize: 13, fontWeight: "800" },
  count: { fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
  noteInput: { minHeight: 118, borderWidth: 1, borderRadius: 20, padding: spacing.md, fontSize: 16, lineHeight: 23 },
  preview: { width: "100%", height: 190, borderRadius: 22 },
  imagePlaceholder: { minHeight: 150, borderWidth: 1, borderRadius: 22, alignItems: "center", justifyContent: "center", gap: 8, borderStyle: "dashed" },
  imagePlaceholderIcon: { fontSize: 38, fontWeight: "200" },
  imagePlaceholderText: { fontSize: 14 },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  secondaryButton: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 14, fontWeight: "800" },
  timeList: { gap: spacing.sm },
  addTimeButton: { minHeight: 50, borderWidth: 1.5, borderRadius: 17, borderStyle: "dashed", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  addTimeIcon: { fontSize: 21, fontWeight: "300" },
  addTimeText: { fontSize: 14, fontWeight: "900" },
  saveButton: { height: 56, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  saveButtonText: { fontSize: 16, fontWeight: "900" },
  savePressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.65 },
  deleteButton: { alignItems: "center", paddingVertical: spacing.sm },
  deleteButtonText: { fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.62 },
});
