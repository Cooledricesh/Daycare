'use client';

import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompletionScreenProps {
  patientName: string;
  onReset: () => void;
}

export function CompletionScreen({ patientName, onReset }: CompletionScreenProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onReset]);

  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <CheckCircle className="w-32 h-32 text-green-500 mx-auto mb-8" />

      <h2 className="text-4xl font-bold text-gray-900 mb-4">
        {patientName} 님
      </h2>

      <p className="text-3xl text-gray-700 mb-8">
        오늘도 좋은 하루 되세요!
      </p>

      <p className="text-xl text-gray-500 mb-8">
        ({countdown}초 후 자동으로 처음 화면으로)
      </p>

      <Button
        size="lg"
        onClick={onReset}
        className="h-16 text-xl px-12"
      >
        처음으로
      </Button>
    </div>
  );
}
