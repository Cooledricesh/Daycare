'use client';

import { Button } from '@/components/ui/button';
import type { Patient } from '../backend/schema';

interface ConfirmationModalProps {
  patient: Patient;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function ConfirmationModal({
  patient,
  isOpen,
  onCancel,
  onConfirm,
  isLoading = false,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {patient.name} 님
          </h2>
          <p className="text-2xl text-gray-700">
            출석하시겠습니까?
          </p>
        </div>

        <div className="flex gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 h-16 text-xl"
          >
            아니오
          </Button>
          <Button
            size="lg"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 h-16 text-xl"
          >
            {isLoading ? '처리 중...' : '예'}
          </Button>
        </div>
      </div>
    </div>
  );
}
