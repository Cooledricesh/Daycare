'use client';

import type { PatientSegments } from '../lib/dto';
import { TopAttendersTable } from './TopAttendersTable';
import { RiskPatientsTable } from './RiskPatientsTable';
import { NewPatientsTable } from './NewPatientsTable';
import { DischargesTable } from './DischargesTable';

interface PatientSegmentsSectionProps {
  patientSegments: PatientSegments;
}

export function PatientSegmentsSection({ patientSegments }: PatientSegmentsSectionProps) {
  const { top_attenders, risk_patients, new_patients, discharges } = patientSegments;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">환자 세그먼트</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopAttendersTable topAttenders={top_attenders} />
        <RiskPatientsTable riskPatients={risk_patients} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NewPatientsTable newPatients={new_patients} />
        <DischargesTable discharges={discharges} />
      </div>
    </div>
  );
}
