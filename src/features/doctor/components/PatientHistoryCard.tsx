'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cake } from 'lucide-react';
import { calculateKoreanAge, isBirthdayToday } from '@/lib/birthday';
import type { PatientBasicInfo } from '../backend/schema';

interface PatientHistoryCardProps {
  patient: PatientBasicInfo;
}

export function PatientHistoryCard({ patient }: PatientHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {patient.name}
          {patient.gender && (
            <Badge variant="outline">
              {patient.gender === 'M' ? '남' : '여'}
            </Badge>
          )}
          {patient.birth_date && isBirthdayToday(patient.birth_date) && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
              <Cake className="w-3 h-3" />
              오늘 생일
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">호실:</span>
            <span className="ml-2 font-medium">{patient.room_number || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">담당 코디:</span>
            <span className="ml-2 font-medium">{patient.coordinator_name || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">담당 의사:</span>
            <span className="ml-2 font-medium">{patient.doctor_name || '-'}</span>
          </div>
          {patient.birth_date && (
            <div>
              <span className="text-gray-500">생년월일:</span>
              <span className="ml-2 font-medium">
                {patient.birth_date}
                {calculateKoreanAge(patient.birth_date) !== null && (
                  <> (만 {calculateKoreanAge(patient.birth_date)}세)</>
                )}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
