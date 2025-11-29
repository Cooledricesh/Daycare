'use client';

import { CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface VitalsInputSectionProps {
  patientName: string;
  attendanceTime: string;
  vitalsInput: {
    systolic: string;
    diastolic: string;
    blood_sugar: string;
  };
  onVitalsInputChange: (field: 'systolic' | 'diastolic' | 'blood_sugar', value: string) => void;
  onSkip: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export function VitalsInputSection({
  patientName,
  attendanceTime,
  vitalsInput,
  onVitalsInputChange,
  onSkip,
  onSave,
  isSaving,
}: VitalsInputSectionProps) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* 출석 완료 메시지 */}
      <div className="text-center mb-8">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          출석 완료!
        </h2>
        <p className="text-2xl text-gray-700 mb-1">
          {patientName} 님
        </p>
        <p className="text-xl text-gray-500">
          {attendanceTime} 출석
        </p>
      </div>

      <div className="h-px bg-gray-300 my-8" />

      {/* 활력징후 입력 */}
      <div className="mb-8">
        <h3 className="text-2xl font-semibold text-gray-900 mb-2 text-center">
          혈압/혈당을 입력하세요
        </h3>
        <p className="text-lg text-gray-500 text-center mb-6">
          (선택사항)
        </p>

        {/* 혈압 */}
        <div className="mb-6">
          <label className="block text-xl font-medium text-gray-700 mb-3">
            혈압
          </label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              placeholder="120"
              value={vitalsInput.systolic}
              onChange={(e) => onVitalsInputChange('systolic', e.target.value)}
              className="h-14 text-xl text-center"
            />
            <span className="text-2xl font-bold text-gray-400">/</span>
            <Input
              type="number"
              placeholder="80"
              value={vitalsInput.diastolic}
              onChange={(e) => onVitalsInputChange('diastolic', e.target.value)}
              className="h-14 text-xl text-center"
            />
            <span className="text-lg text-gray-500 ml-2">mmHg</span>
          </div>
          <div className="flex justify-between mt-2 px-1 text-sm text-gray-500">
            <span>(수축기)</span>
            <span>(이완기)</span>
          </div>
        </div>

        {/* 혈당 */}
        <div className="mb-6">
          <label className="block text-xl font-medium text-gray-700 mb-3">
            혈당
          </label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              placeholder="105"
              value={vitalsInput.blood_sugar}
              onChange={(e) => onVitalsInputChange('blood_sugar', e.target.value)}
              className="h-14 text-xl text-center"
            />
            <span className="text-lg text-gray-500 ml-2">mg/dL</span>
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          size="lg"
          onClick={onSkip}
          disabled={isSaving}
          className="flex-1 h-16 text-xl"
        >
          건너뛰기
        </Button>
        <Button
          size="lg"
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 h-16 text-xl"
        >
          {isSaving ? '저장 중...' : '저장'}
        </Button>
      </div>
    </div>
  );
}
