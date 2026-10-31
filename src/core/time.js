// Schema の pattern と同じ
const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

function isValidTime(value) {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

export function isValidPeriod(period) {
  return Array.isArray(period) && period.length === 2 && isValidTime(period[0]) && isValidTime(period[1]);
}

// "8:00" と "10:00" を文字列で比べると順序が逆になるので、分に換算して比べる
export function toMinutes(time) {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

export function normalizeTime(value) {
  if (!isValidTime(value)) return value;
  const [h, m] = value.split(":");
  return `${h.padStart(2, "0")}:${m}`;
}

// 開始>終了（日をまたぐ）区間を、MAA GUIが扱える2区間に分ける。形式不正の区間は原文のまま
export function splitPeriods(periods) {
  const result = [];
  for (const period of periods) {
    if (isValidPeriod(period) && toMinutes(period[0]) > toMinutes(period[1])) {
      result.push([period[0], "23:59"], ["00:00", period[1]]);
    } else {
      result.push(period);
    }
  }
  return result;
}
