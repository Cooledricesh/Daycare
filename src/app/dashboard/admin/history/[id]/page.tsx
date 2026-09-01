'use client';

import { use } from 'react';
import { PatientFullHistoryPage } from '@/features/shared/components/PatientFullHistoryPage';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminHistoryPage({ params }: PageProps) {
  const { id } = use(params);
  return <PatientFullHistoryPage patientId={id} />;
}
