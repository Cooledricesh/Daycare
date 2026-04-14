'use client';

import { TasksPageContent } from '@/features/shared/components/TasksPageContent';

export default function AdminTasksPage() {
  return <TasksPageContent patientLinkPrefix="/dashboard/admin/patients" />;
}
