// 한글 초성 검색 유틸리티
const CHOSUNG = [
  'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
  'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];

// 단일 자음 목록 (쌍자음 제외)
const SINGLE_CONSONANTS = [
  'ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
];

// 복합 자음 → 단일 자음 분리 매핑 (쌍자음 + 겹받침)
const COMPOUND_TO_SINGLE: Record<string, string> = {
  'ㄲ': 'ㄱㄱ',
  'ㄳ': 'ㄱㅅ',
  'ㄵ': 'ㄴㅈ',
  'ㄶ': 'ㄴㅎ',
  'ㄸ': 'ㄷㄷ',
  'ㄺ': 'ㄹㄱ',
  'ㄻ': 'ㄹㅁ',
  'ㄼ': 'ㄹㅂ',
  'ㄽ': 'ㄹㅅ',
  'ㄾ': 'ㄹㅌ',
  'ㄿ': 'ㄹㅍ',
  'ㅀ': 'ㄹㅎ',
  'ㅃ': 'ㅂㅂ',
  'ㅄ': 'ㅂㅅ',
  'ㅆ': 'ㅅㅅ',
  'ㅉ': 'ㅈㅈ',
};

/**
 * 쌍자음을 단일 자음으로 분리한다.
 * 예: "ㄲㅅ" → "ㄱㄱㅅ", "ㅎㅁㅅ" → "ㅎㅁㅅ" (변화 없음)
 */
export function expandDoubleConsonants(query: string): string {
  return [...query].map(c => COMPOUND_TO_SINGLE[c] ?? c).join('');
}

/**
 * 문자열이 모두 한글 자음인지 확인한다.
 * 쌍자음, 겹받침(ㄳ, ㅄ, ㄶ 등)도 자음으로 인정한다.
 */
function isAllChosung(str: string): boolean {
  return [...str].every(c => {
    const code = c.charCodeAt(0);
    return code >= 0x3131 && code <= 0x314E;
  });
}

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
 * - 쌍자음은 자동 분리 (예: "ㄲ" → "ㄱㄱ"으로 검색)
 * - 일반 문자열: includes 매칭 (예: "김" → "김승현")
 */
export function matchesChosung(name: string, query: string): boolean {
  if (!query) return true;
  if (!isAllChosung(query)) return name.includes(query);
  const expanded = expandDoubleConsonants(query);
  const nameChosung = [...name].map(getChosung).join('');
  return nameChosung.includes(expanded);
}
