'use client';

import { TasksPageContent } from '@/features/shared/components/TasksPageContent';

export default function NurseTasksPage() {
  return <TasksPageContent patientLinkPrefix="/nurse/patient" />;
}
