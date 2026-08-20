const DATE_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  weekday: "short",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatMenuBarTime(date: Date) {
  const dateParts = DATE_FORMATTER.formatToParts(date);
  const month = dateParts.find((part) => part.type === "month")?.value ?? "";
  const day = dateParts.find((part) => part.type === "day")?.value ?? "";

  return `${month}月${day}日 ${WEEKDAY_FORMATTER.format(date)} ${TIME_FORMATTER.format(date)}`;
}
