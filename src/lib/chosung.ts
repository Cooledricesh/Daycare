// 한글 초성 검색 유틸리티
const CHOSUNG = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
  'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];

/**
 * 한글 문자의 초성을 추출한다.
 * 한글이 아닌 문자는 그대로 반환한다.
 */
export function getChosung(char: string): string {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return char;
  return CHOSUNG[Math.floor(code / 588)];
}

/**
 * 이름이 검색어와 매칭되는지 확인한다.
 * - 초성만으로 이루어진 쿼리: 초성 매칭 (예: "ㄱㅅ" → "김승현")
 * - 일반 문자열: includes 매칭 (예: "김" → "김승현")
 */
export function matchesChosung(name: string, query: string): boolean {
  if (!query) return true;
  const isChosungQuery = [...query].every(c => CHOSUNG.includes(c));
  if (!isChosungQuery) return name.includes(query);
  const nameChosung = [...name].map(getChosung).join('');
  return nameChosung.includes(query);
}
