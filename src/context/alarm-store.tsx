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
  classifyNotificationError,
  configureNotifications,
  notificationErrorMessage,
  scheduleAlarmNotifications,
  scheduleSnoozeNotification,
  type NotificationSyncWarning,
} from "@/lib/notifications";
import { deleteManagedMedia } from "@/lib/media";
import { getNextOccurrenceDate } from "@/lib/alarm-utils";
import { readCards, writeCards } from "@/lib/storage";
import { parseStoredCards } from "@/lib/storage-core";
import type { AlarmCard, AlarmCardDraft, AlarmTime } from "@/types/alarm";

type SaveCardResult = {
  cardId: number;
  warnings: NotificationSyncWarning[];
};

type AlarmStore = {
  cards: AlarmCard[];
  isReady: boolean;
  notificationWarnings: NotificationSyncWarning[];
  getCard: (cardId: number) => AlarmCard | undefined;
  getTime: (timeId: number) => { time: AlarmTime; card: AlarmCard } | undefined;
  saveCard: (draft: AlarmCardDraft) => Promise<SaveCardResult>;
  deleteCard: (cardId: number) => Promise<void>;
  setTimeEnabled: (timeId: number, enabled: boolean) => Promise<NotificationSyncWarning | null>;
  markTimeFired: (timeId: number) => Promise<void>;
  snoozeTime: (timeId: number) => Promise<NotificationSyncWarning | null>;
  rescheduleNotifications: () => Promise<NotificationSyncWarning[]>;
  clearNotificationWarnings: () => void;
};

const AlarmStoreContext = createContext<AlarmStore | null>(null);

function nextId(cards: AlarmCard[], field: "card" | "time"): number {
  const ids =
    field === "card"
      ? cards.map((card) => card.id)
      : cards.flatMap((card) => card.times.map((time) => time.id));
  return Math.max(0, ...ids) + 1;
}

function cloneTime(time: AlarmTime, cardId: number, id = time.id): AlarmTime {
  return {
    ...time,
    id,
    cardId,
    schedule: time.schedule.type === "weekly"
      ? { type: "weekly", repeatDays: [...time.schedule.repeatDays] }
      : { type: "once", date: time.schedule.date },
  };
}

function mediaReferences(cards: AlarmCard[]): Set<string> {
  const references = new Set<string>();
  for (const card of cards) {
    for (const time of card.times) {
      if (time.imageUri) references.add(time.imageUri);
      if (time.soundUri) references.add(time.soundUri);
    }
  }
  return references;
}

async function cleanupOrphanedMedia(previous: AlarmCard[], next: AlarmCard[]): Promise<void> {
  const currentReferences = mediaReferences(next);
  const cleanup: Promise<void>[] = [];

  for (const card of previous) {
    for (const time of card.times) {
      if (time.imageUri && !currentReferences.has(time.imageUri)) {
        cleanup.push(deleteManagedMedia(time.imageUri, "images"));
      }
      if (time.soundUri && !currentReferences.has(time.soundUri)) {
        cleanup.push(deleteManagedMedia(time.soundUri, "sounds"));
      }
    }
  }

  await Promise.all(cleanup);
}

function notificationWarning(timeId: number, error: unknown): NotificationSyncWarning {
  const reason = classifyNotificationError(error);
  return {
    timeId,
    reason,
    message: notificationErrorMessage(reason),
  };
}

async function syncTime(time: AlarmTime, card: AlarmCard): Promise<NotificationSyncWarning | null> {
  try {
    await scheduleAlarmNotifications(time, card);
    return null;
  } catch (error) {
    return notificationWarning(time.id, error);
  }
}

export function AlarmStoreProvider({ children }: PropsWithChildren) {
  const [cards, setCards] = useState<AlarmCard[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [notificationWarnings, setNotificationWarnings] = useState<NotificationSyncWarning[]>([]);
  const cardsRef = useRef<AlarmCard[]>([]);
  const mutationQueue = useRef(Promise.resolve());
  const didRescheduleOnStartup = useRef(false);

  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const next = mutationQueue.current.then(operation, operation);
    mutationQueue.current = next.then(() => undefined, () => undefined);
    return next;
  }, []);

  const commitCards = useCallback(async (nextCards: AlarmCard[]): Promise<void> => {
    await writeCards(nextCards);
    cardsRef.current = nextCards;
    setCards(nextCards);
  }, []);

  useEffect(() => {
    let mounted = true;
    void readCards()
      .then((savedCards) => {
        if (!mounted) return;
        cardsRef.current = savedCards;
        setCards(savedCards);
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

    void enqueue(async () => {
      const currentCards = cardsRef.current;
      let changed = false;
      const expiredTimeIds: number[] = [];
      const nextCards = currentCards.map((card) => ({
        ...card,
        times: card.times.map((time) => {
          if (
            time.enabled &&
            time.schedule.type === "once" &&
            !getNextOccurrenceDate(time.schedule, time.hour, time.minute)
          ) {
            changed = true;
            expiredTimeIds.push(time.id);
            return { ...time, enabled: false };
          }
          return cloneTime(time, card.id);
        }),
      }));

      if (changed) await commitCards(nextCards);

      const warnings: NotificationSyncWarning[] = [];
      let configurationError: unknown;
      try {
        await configureNotifications();
      } catch (error) {
        configurationError = error;
      }

      if (configurationError) {
        for (const card of nextCards) {
          for (const time of card.times) {
            if (time.enabled) warnings.push(notificationWarning(time.id, configurationError));
          }
        }
      }

      await Promise.all(expiredTimeIds.map(async (timeId) => {
        try {
          await cancelAlarmNotifications(timeId);
        } catch (error) {
          warnings.push(notificationWarning(timeId, error));
        }
      }));
      if (!configurationError) {
        for (const card of nextCards) {
          for (const time of card.times) {
            if (!time.enabled) continue;
            const warning = await syncTime(time, card);
            if (warning) warnings.push(warning);
          }
        }
      }
      setNotificationWarnings(warnings);
    });
  }, [commitCards, enqueue, isReady]);

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

  const saveCard = useCallback((draft: AlarmCardDraft): Promise<SaveCardResult> => enqueue(async () => {
    const currentCards = cardsRef.current;
    const cardId = draft.id > 0 ? draft.id : nextId(currentCards, "card");
    const previousCard = currentCards.find((card) => card.id === cardId);
    const usedTimeIds = new Set(currentCards.flatMap((card) => card.times.map((time) => time.id)));
    let generatedTimeId = nextId(currentCards, "time");
    const times = draft.times.map((time) => {
      let id = time.id;
      if (id <= 0 || (usedTimeIds.has(id) && !previousCard?.times.some((oldTime) => oldTime.id === id))) {
        while (usedTimeIds.has(generatedTimeId)) generatedTimeId += 1;
        id = generatedTimeId;
        generatedTimeId += 1;
      }
      usedTimeIds.add(id);
      return cloneTime(time, cardId, id);
    });

    const draftCard: AlarmCard = {
      id: cardId,
      title: draft.title.trim(),
      times,
    };
    const candidateCards = previousCard
      ? currentCards.map((card) => (card.id === cardId ? draftCard : card))
      : [...currentCards, draftCard];
    const nextCards = parseStoredCards(JSON.stringify(candidateCards), "modern");
    const savedCard = nextCards.find((card) => card.id === cardId) ?? draftCard;

    await commitCards(nextCards);

    const oldTimes = previousCard?.times ?? [];
    const warnings: NotificationSyncWarning[] = [];
    await Promise.all(
      oldTimes
        .filter((oldTime) => !savedCard.times.some((time) => time.id === oldTime.id))
        .map(async (oldTime) => {
          try {
            await cancelAlarmNotifications(oldTime.id);
          } catch (error) {
            warnings.push(notificationWarning(oldTime.id, error));
          }
        }),
    );

    for (const time of savedCard.times) {
      const warning = await syncTime(time, savedCard);
      if (warning) warnings.push(warning);
    }
    setNotificationWarnings(warnings);
    await cleanupOrphanedMedia(currentCards, nextCards);
    return { cardId: savedCard.id, warnings };
  }), [commitCards, enqueue]);

  const deleteCard = useCallback((cardId: number): Promise<void> => enqueue(async () => {
    const currentCards = cardsRef.current;
    const card = currentCards.find((candidate) => candidate.id === cardId);
    if (!card) return;

    const warnings: NotificationSyncWarning[] = [];
    await Promise.all(card.times.map(async (time) => {
      try {
        await cancelAlarmNotifications(time.id);
      } catch (error) {
        warnings.push(notificationWarning(time.id, error));
      }
    }));
    const nextCards = currentCards.filter((candidate) => candidate.id !== cardId);
    await commitCards(nextCards);
    setNotificationWarnings(warnings);
    await cleanupOrphanedMedia(currentCards, nextCards);
  }), [commitCards, enqueue]);

  const setTimeEnabled = useCallback((timeId: number, enabled: boolean): Promise<NotificationSyncWarning | null> => enqueue(async () => {
    const currentCards = cardsRef.current;
    for (const card of currentCards) {
      const existingTime = card.times.find((time) => time.id === timeId);
      if (!existingTime) continue;

      const updatedTime = { ...existingTime, enabled };
      const updatedCard = {
        ...card,
        times: card.times.map((time) => (time.id === timeId ? updatedTime : time)),
      };
      const nextCards = currentCards.map((candidate) => (candidate.id === card.id ? updatedCard : candidate));
      await commitCards(nextCards);

      const warning = await syncTime(updatedTime, updatedCard);
      setNotificationWarnings(warning ? [warning] : []);
      return warning;
    }
    return null;
  }), [commitCards, enqueue]);

  const markTimeFired = useCallback((timeId: number): Promise<void> => enqueue(async () => {
    const entry = cardsRef.current
      .flatMap((card) => card.times.map((time) => ({ time, card })))
      .find(({ time }) => time.id === timeId);
    if (!entry || entry.time.schedule.type !== "once" || !entry.time.enabled) return;

    const updatedCard = {
      ...entry.card,
      times: entry.card.times.map((time) => (time.id === timeId ? { ...time, enabled: false } : time)),
    };
    const nextCards = cardsRef.current.map((card) => (card.id === entry.card.id ? updatedCard : card));
    await commitCards(nextCards);
    try {
      await cancelAlarmNotifications(timeId);
    } catch (error) {
      setNotificationWarnings([notificationWarning(timeId, error)]);
    }
  }), [commitCards, enqueue]);

  const snoozeTime = useCallback((timeId: number): Promise<NotificationSyncWarning | null> => enqueue(async () => {
    const entry = cardsRef.current
      .flatMap((card) => card.times.map((time) => ({ time, card })))
      .find(({ time }) => time.id === timeId);
    if (!entry) return null;

    try {
      await scheduleSnoozeNotification(entry.time, entry.card);
      return null;
    } catch (error) {
      const warning = notificationWarning(timeId, error);
      setNotificationWarnings([warning]);
      return warning;
    }
  }), [enqueue]);

  const rescheduleNotifications = useCallback((): Promise<NotificationSyncWarning[]> => enqueue(async () => {
    const warnings: NotificationSyncWarning[] = [];
    let configurationError: unknown;
    try {
      await configureNotifications();
    } catch (error) {
      configurationError = error;
    }

    for (const card of cardsRef.current) {
      for (const time of card.times) {
        if (!time.enabled) continue;
        const warning = configurationError
          ? notificationWarning(time.id, configurationError)
          : await syncTime(time, card);
        if (warning) warnings.push(warning);
      }
    }
    setNotificationWarnings(warnings);
    return warnings;
  }), [enqueue]);

  const clearNotificationWarnings = useCallback(() => setNotificationWarnings([]), []);

  const value = useMemo<AlarmStore>(
    () => ({
      cards,
      isReady,
      notificationWarnings,
      getCard,
      getTime,
      saveCard,
      deleteCard,
      setTimeEnabled,
      markTimeFired,
      snoozeTime,
      rescheduleNotifications,
      clearNotificationWarnings,
    }),
    [
      cards,
      isReady,
      notificationWarnings,
      getCard,
      getTime,
      saveCard,
      deleteCard,
      setTimeEnabled,
      markTimeFired,
      snoozeTime,
      rescheduleNotifications,
      clearNotificationWarnings,
    ],
  );

  return <AlarmStoreContext.Provider value={value}>{children}</AlarmStoreContext.Provider>;
}

export function useAlarmStore(): AlarmStore {
  const context = useContext(AlarmStoreContext);
  if (!context) throw new Error("useAlarmStore must be used inside AlarmStoreProvider");
  return context;
}
