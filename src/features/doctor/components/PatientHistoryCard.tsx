'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
        </div>
      </CardContent>
    </Card>
  );
}
