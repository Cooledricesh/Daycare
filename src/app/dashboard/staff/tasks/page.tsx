'use client';

import { TasksPageContent } from '@/features/shared/components/TasksPageContent';

export default function StaffTasksPage() {
  return <TasksPageContent patientLinkPrefix="/dashboard/staff/patient" />;
}
