'use client';

import { TasksPageContent } from '@/features/shared/components/TasksPageContent';

export default function DoctorTasksPage() {
  return <TasksPageContent patientLinkPrefix="/doctor/history" />;
}
