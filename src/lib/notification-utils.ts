function baseIdentifier(timeId: number): string {
  return `alarm_${timeId}`;
}

export function notificationBaseIdentifier(timeId: number): string {
  return baseIdentifier(timeId);
}

export function notificationIdentifiersFor(timeId: number): string[] {
  return [
    `${baseIdentifier(timeId)}_once`,
    `${baseIdentifier(timeId)}_snooze`,
    ...Array.from({ length: 7 }, (_, index) => `${baseIdentifier(timeId)}_day_${index + 1}`),
  ];
}
