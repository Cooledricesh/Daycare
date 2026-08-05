import { parseISO, isValid } from 'date-fns';

export function formatBirthDateShort(birthDate: string | null): string {
  if (!birthDate) return '';
  const parsed = parseISO(birthDate);
  if (!isValid(parsed)) return '';
  return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

export function calculateKoreanAge(
  birthDate: string | null,
  today: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const parsed = parseISO(birthDate);
  if (!isValid(parsed)) return null;

  const birthYear = parsed.getFullYear();
  const birthMonth = parsed.getMonth();
  const birthDay = parsed.getDate();

  let age = today.getFullYear() - birthYear;

  const notReachedThisYear =
    today.getMonth() < birthMonth ||
    (today.getMonth() === birthMonth && today.getDate() < birthDay);

  if (notReachedThisYear) {
    age -= 1;
  }

  return age;
}

export function isBirthdayToday(
  birthDate: string | null,
  today: Date = new Date(),
): boolean {
  if (!birthDate) return false;
  const parsed = parseISO(birthDate);
  if (!isValid(parsed)) return false;

  const birthMonth = parsed.getMonth();
  const birthDay = parsed.getDate();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  if (birthMonth === todayMonth && birthDay === todayDay) return true;

  // 윤년 2/29 생일 -> 평년 2/28로 매칭
  if (birthMonth === 1 && birthDay === 29) {
    const isLeap =
      today.getFullYear() % 4 === 0 &&
      (today.getFullYear() % 100 !== 0 || today.getFullYear() % 400 === 0);
    if (!isLeap && todayMonth === 1 && todayDay === 28) return true;
  }

  return false;
}

export function isBirthdayOnDate(
  birthDate: string | null,
  dateString: string,
): boolean {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;

  const parsed = parseISO(birthDate);
  if (!isValid(parsed)) return false;

  const year = Number(dateString.slice(0, 4));
  const month = Number(dateString.slice(5, 7));
  const day = Number(dateString.slice(8, 10));
  const birthMonth = parsed.getMonth() + 1;
  const birthDay = parsed.getDate();

  if (birthMonth === month && birthDay === day) return true;

  if (birthMonth === 2 && birthDay === 29) {
    const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    if (!isLeap && month === 2 && day === 28) return true;
  }

  return false;
}

export function daysUntilNextBirthday(
  birthDate: string | null,
  today: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const parsed = parseISO(birthDate);
  if (!isValid(parsed)) return null;

  const currentYear = today.getFullYear();
  let nextBirthday = new Date(
    currentYear,
    parsed.getMonth(),
    parsed.getDate(),
  );

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (nextBirthday < todayStart) {
    nextBirthday = new Date(currentYear + 1, parsed.getMonth(), parsed.getDate());
  }

  const diffMs = nextBirthday.getTime() - todayStart.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
