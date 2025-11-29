'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearchPatients } from '../hooks/useSearchPatients';
import { debounce } from 'es-toolkit';
import type { Patient } from '../backend/schema';

interface PatientSearchSectionProps {
  onPatientSelect: (patient: Patient) => void;
}

export function PatientSearchSection({ onPatientSelect }: PatientSearchSectionProps) {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const { data: patients = [], isLoading } = useSearchPatients(debouncedQuery);

  // Debounce 검색
  useEffect(() => {
    const debouncedFn = debounce((value: string) => {
      setDebouncedQuery(value);
    }, 300);

    debouncedFn(inputValue);
  }, [inputValue]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 날짜 표시 */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          오늘 출석 체크
        </h1>
        <p className="text-2xl text-gray-600">
          {new Date().toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      {/* 검색 입력창 */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
        <Input
          type="text"
          placeholder="이름을 입력하세요"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="h-16 pl-14 pr-4 text-2xl"
          autoFocus
        />
      </div>

      {/* 자동완성 목록 */}
      {debouncedQuery && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500 text-xl">
              검색 중...
            </div>
          ) : patients.length > 0 ? (
            <ul>
              {patients.map((patient) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPatientSelect(patient);
                      setInputValue('');
                      setDebouncedQuery('');
                    }}
                    className="w-full px-6 py-5 text-left text-2xl hover:bg-gray-50 transition-colors border-b last:border-b-0"
                  >
                    {patient.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-6 text-center text-gray-500 text-xl">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      )}
    </div>
  );
}
