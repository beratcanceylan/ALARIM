import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import {
  cancelAlarmNotifications,
  scheduleAlarmNotifications,
  scheduleSnoozeNotification,
} from "@/lib/notifications";
import { readCards, writeCards } from "@/lib/storage";
import type { AlarmCard, AlarmCardDraft, AlarmTime } from "@/types/alarm";

type AlarmStore = {
  cards: AlarmCard[];
  isReady: boolean;
  getCard: (cardId: number) => AlarmCard | undefined;
  getTime: (timeId: number) => { time: AlarmTime; card: AlarmCard } | undefined;
  saveCard: (draft: AlarmCardDraft) => Promise<number>;
  deleteCard: (cardId: number) => Promise<void>;
  setTimeEnabled: (timeId: number, enabled: boolean) => Promise<void>;
  markTimeFired: (timeId: number) => Promise<void>;
  snoozeTime: (timeId: number) => Promise<void>;
};

const AlarmStoreContext = createContext<AlarmStore | null>(null);

function nextId(cards: AlarmCard[], field: "card" | "time"): number {
  const ids =
    field === "card"
      ? cards.map((card) => card.id)
      : cards.flatMap((card) => card.times.map((time) => time.id));
  return Math.max(0, ...ids) + 1;
}

export function AlarmStoreProvider({ children }: PropsWithChildren) {
  const [cards, setCards] = useState<AlarmCard[]>([]);
  const [isReady, setIsReady] = useState(false);
  const didRescheduleOnStartup = useRef(false);

  useEffect(() => {
    let mounted = true;
    void readCards()
      .then((savedCards) => {
        if (mounted) setCards(savedCards);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setIsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady || didRescheduleOnStartup.current) return;
    didRescheduleOnStartup.current = true;
    const reschedulePromises: Promise<void>[] = [];
    for (const card of cards) {
      for (const time of card.times) {
        // Expo Notifications keeps scheduled local notifications across process death and
        // device restart. A one-time notification that already fired must not be recreated on
        // the next app launch, so only repair the repeating schedules here.
        if (time.repeatDays.length > 0) {
          reschedulePromises.push(
            scheduleAlarmNotifications(time, card).catch(() => undefined),
          );
        }
      }
    }
    void Promise.all(reschedulePromises);
  }, [cards, isReady]);

  const getCard = useCallback(
    (cardId: number) => cards.find((card) => card.id === cardId),
    [cards],
  );

  const getTime = useCallback(
    (timeId: number) => {
      for (const card of cards) {
        const time = card.times.find((candidate) => candidate.id === timeId);
        if (time) return { time, card };
      }
      return undefined;
    },
    [cards],
  );

  const saveCard = useCallback(async (draft: AlarmCardDraft): Promise<number> => {
    const cardId = draft.id > 0 ? draft.id : nextId(cards, "card");
    const previousCard = cards.find((card) => card.id === cardId);
    let generatedTimeId = nextId(cards, "time");
    const times = draft.times.map((time) => {
      const id = time.id > 0 ? time.id : generatedTimeId++;
      return { ...time, id, cardId };
    });
    const savedCard: AlarmCard = {
      id: cardId,
      title: draft.title,
      imageUri: draft.imageUri,
      note: draft.note,
      times,
    };
    const nextCards = previousCard
      ? cards.map((card) => (card.id === cardId ? savedCard : card))
      : [...cards, savedCard];

    await writeCards(nextCards);
    setCards(nextCards);

    const oldTimes = previousCard?.times ?? [];
    const cancellationPromises: Promise<void>[] = [];
    for (const oldTime of oldTimes) {
      if (!times.some((time) => time.id === oldTime.id)) {
        cancellationPromises.push(cancelAlarmNotifications(oldTime.id));
      }
    }
    await Promise.all(cancellationPromises);
    await Promise.all(
      times.map((time) =>
        scheduleAlarmNotifications(time, savedCard).catch(() => undefined),
      ),
    );
    return cardId;
  }, [cards]);

  const deleteCard = useCallback(async (cardId: number): Promise<void> => {
    const card = cards.find((candidate) => candidate.id === cardId);
    if (!card) return;
    await Promise.all(card.times.map((time) => cancelAlarmNotifications(time.id)));
    const nextCards = cards.filter((candidate) => candidate.id !== cardId);
    await writeCards(nextCards);
    setCards(nextCards);
  }, [cards]);

  const setTimeEnabled = useCallback(async (timeId: number, enabled: boolean): Promise<void> => {
    const entry = getTime(timeId);
    if (!entry) return;
    const updatedTime = { ...entry.time, enabled };
    const updatedCard = {
      ...entry.card,
      times: entry.card.times.map((time) => (time.id === timeId ? updatedTime : time)),
    };
    const nextCards = cards.map((card) => (card.id === entry.card.id ? updatedCard : card));
    await writeCards(nextCards);
    setCards(nextCards);
    if (enabled) {
      await scheduleAlarmNotifications(updatedTime, updatedCard).catch(() => undefined);
    } else {
      await cancelAlarmNotifications(timeId);
    }
  }, [cards, getTime]);

  const markTimeFired = useCallback(async (timeId: number): Promise<void> => {
    const entry = getTime(timeId);
    if (!entry || entry.time.repeatDays.length > 0 || !entry.time.enabled) return;
    await setTimeEnabled(timeId, false);
  }, [getTime, setTimeEnabled]);

  const snoozeTime = useCallback(async (timeId: number): Promise<void> => {
    const entry = getTime(timeId);
    if (!entry) return;
    await scheduleSnoozeNotification(entry.time, entry.card);
  }, [getTime]);

  const value = useMemo<AlarmStore>(
    () => ({
      cards,
      isReady,
      getCard,
      getTime,
      saveCard,
      deleteCard,
      setTimeEnabled,
      markTimeFired,
      snoozeTime,
    }),
    [
      cards,
      isReady,
      getCard,
      getTime,
      saveCard,
      deleteCard,
      setTimeEnabled,
      markTimeFired,
      snoozeTime,
    ],
  );

  return <AlarmStoreContext.Provider value={value}>{children}</AlarmStoreContext.Provider>;
}

export function useAlarmStore(): AlarmStore {
  const context = useContext(AlarmStoreContext);
  if (!context) throw new Error("useAlarmStore must be used inside AlarmStoreProvider");
  return context;
}
