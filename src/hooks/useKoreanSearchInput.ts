import { useState, useRef, useCallback } from 'react';
import { expandDoubleConsonants } from '@/lib/chosung';

// 한글 자음 (초성) 범위: ㄱ(0x3131) ~ ㅎ(0x314E)
function isHangeulConsonant(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x3131 && code <= 0x314E;
}

// 문자열이 모두 한글 자음으로만 이루어져 있는지 확인
function isAllConsonants(str: string): boolean {
  return str.length > 0 && [...str].every(isHangeulConsonant);
}

/**
 * 한글 초성 검색을 위한 커스텀 훅.
 * - 초성만 입력할 경우: IME 조합 중에도 즉시 검색 반영
 * - 일반 한글 입력(모음 포함): 조합 완료 시에만 검색 반영
 * - 쌍자음(ㄲ→ㄱㄱ)은 chosung 유틸에서 자동 분리
 */
export function useKoreanSearchInput() {
  const [rawValue, setRawValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const isComposingRef = useRef(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRawValue(value);
    // 초성(자음)만 입력 중이면 조합 상태와 무관하게 즉시 반영
    // 일반 한글(모음 포함)이면 조합 완료 후 반영
    if (!isComposingRef.current || isAllConsonants(value)) {
      setSearchQuery(value);
    }
  }, []);

  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    const value = (e.target as HTMLInputElement).value;
    setRawValue(value);
    setSearchQuery(value);
  }, []);

  const clear = useCallback(() => {
    setRawValue('');
    setSearchQuery('');
  }, []);

  return {
    rawValue,
    searchQuery,
    inputProps: {
      value: rawValue,
      onChange: handleChange,
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
    },
    clear,
  };
}
