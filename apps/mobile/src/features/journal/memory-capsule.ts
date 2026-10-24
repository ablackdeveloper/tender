export function mondayForDate(date: Date): string {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = value.getDay() || 7;
  value.setDate(value.getDate() - day + 1);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const calendarDay = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${calendarDay}`;
}

export function toggleCapsuleEntry(current: string[], entryId: string): string[] {
  if (current.includes(entryId)) {
    return current.filter((id) => id !== entryId);
  }
  if (current.length >= 5) return current;
  return [...current, entryId];
}
