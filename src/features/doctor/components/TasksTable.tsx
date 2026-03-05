'use client';

import { CheckCircle2, Circle } from 'lucide-react';
import type { TaskItem } from '../backend/schema';
import Link from 'next/link';

interface TasksTableProps {
  tasks: TaskItem[];
  patientLinkPrefix?: string;
}

function isCompleted(task: TaskItem): boolean {
  return task.coordinator_completed || task.nurse_completed;
}

export function TasksTable({ tasks, patientLinkPrefix = '/doctor/history' }: TasksTableProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        해당 기간의 지시사항이 없습니다.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {tasks.map((task) => {
        const completed = isCompleted(task);
        return (
          <div key={task.consultation_id} className="flex items-start gap-3 py-3 px-1">
            {completed ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <Link
                  href={`${patientLinkPrefix}/${task.patient_id}`}
                  className="text-sm font-medium text-blue-600 hover:underline whitespace-nowrap"
                >
                  {task.patient_name}
                </Link>
                <span className="text-xs text-gray-400">{task.date}</span>
              </div>
              <p className="text-sm text-gray-700 line-clamp-2">{task.task_content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
