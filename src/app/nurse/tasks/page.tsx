'use client';

import { TasksPageContent } from '@/features/shared/components/TasksPageContent';
import { TodayHighlightCard } from '@/features/highlights/components/TodayHighlightCard';

export default function NurseTasksPage() {
  return (
    <div>
      <div className="px-4 pt-4">
        <TodayHighlightCard patientLinkPrefix="/nurse/patient" className="mb-4" />
      </div>
      <TasksPageContent patientLinkPrefix="/nurse/patient" />
    </div>
  );
}
