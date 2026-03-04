import { useState, useRef, useCallback } from 'react';
import { expandDoubleConsonants } from '@/lib/chosung';

/**
 * 한글 초성 검색을 위한 커스텀 훅.
 * IME 조합 중에는 검색을 지연시키고,
 * 조합 완료 시 쌍자음을 자동 분리한다.
 */
export function useKoreanSearchInput() {
  const [rawValue, setRawValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const isComposingRef = useRef(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRawValue(value);
    // IME 조합 중이 아닐 때만 검색어 업데이트
    if (!isComposingRef.current) {
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
