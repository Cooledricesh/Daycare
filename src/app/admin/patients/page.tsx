'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search } from 'lucide-react';
import { PatientsTable } from '@/features/admin/components/PatientsTable';
import { PatientFormModal } from '@/features/admin/components/PatientFormModal';
import { usePatients, useCoordinators } from '@/features/admin/hooks/usePatients';
import { usePatientsStore } from '@/features/admin/stores/usePatientsStore';
import { useDebounce } from 'react-use';

export default function PatientsPage() {
  const {
    filters,
    page,
    limit,
    selectedPatientId,
    isFormModalOpen,
    formMode,
    setFilters,
    setPage,
    openCreateModal,
    openEditModal,
    closeModal,
  } = usePatientsStore();

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useDebounce(() => {
    setFilters({ search: debouncedSearch });
  }, 500, [debouncedSearch]);

  const { data: coordinators } = useCoordinators();

  const queryFilters = {
    page,
    limit,
    search: filters.search || undefined,
    status: filters.status !== 'all' ? filters.status : undefined,
    coordinator_id: filters.coordinator_id || undefined,
  };

  const { data, isLoading } = usePatients(queryFilters);

  const patients = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">환자 관리</h1>
          <p className="text-sm text-gray-600 mt-1">
            전체 {total}명의 환자
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          환자 추가
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="이름 검색..."
              value={debouncedSearch}
              onChange={(e) => setDebouncedSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 상태 필터 */}
          <Select
            value={filters.status}
            onValueChange={(value: any) => setFilters({ status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="active">활성</SelectItem>
              <SelectItem value="discharged">퇴원</SelectItem>
              <SelectItem value="suspended">중단</SelectItem>
            </SelectContent>
          </Select>

          {/* 담당 코디 필터 */}
          <Select
            value={filters.coordinator_id || "all"}
            onValueChange={(value) => setFilters({ coordinator_id: value === "all" ? "" : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="전체 코디" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 코디</SelectItem>
              {coordinators?.map((coordinator) => (
                <SelectItem key={coordinator.id} value={coordinator.id}>
                  {coordinator.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">
          불러오는 중...
        </div>
      ) : (
        <>
          <PatientsTable
            patients={patients}
            onEdit={(patient) => openEditModal(patient.id)}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                이전
              </Button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}

      {/* Form Modal */}
      <PatientFormModal
        isOpen={isFormModalOpen}
        onClose={closeModal}
        mode={formMode}
        patient={selectedPatient}
      />
    </div>
  );
}
