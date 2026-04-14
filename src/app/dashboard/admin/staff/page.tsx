'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { StaffTable } from '@/features/admin/components/StaffTable';
import { StaffFormModal } from '@/features/admin/components/StaffFormModal';
import { PasswordResetModal } from '@/features/admin/components/PasswordResetModal';
import { useStaff } from '@/features/admin/hooks/useStaff';
import { useStaffStore } from '@/features/admin/stores/useStaffStore';

export default function StaffPage() {
  const {
    filters,
    page,
    limit,
    selectedStaffId,
    isFormModalOpen,
    isPasswordResetModalOpen,
    formMode,
    setFilters,
    setPage,
    openCreateModal,
    openEditModal,
    openPasswordResetModal,
    closeModal,
  } = useStaffStore();

  const queryFilters = {
    page,
    limit,
    role: filters.role !== 'all' ? filters.role : undefined,
    status: filters.status !== 'all' ? filters.status : undefined,
  };

  const { data, isLoading } = useStaff(queryFilters);

  const staff = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const selectedStaff = staff.find((s) => s.id === selectedStaffId);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">직원 관리</h1>
          <p className="text-sm text-gray-600 mt-1">
            전체 {total}명의 직원
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          직원 추가
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 역할 필터 */}
          <Select
            value={filters.role}
            onValueChange={(value: any) => setFilters({ role: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 역할</SelectItem>
              <SelectItem value="doctor">의사</SelectItem>
              <SelectItem value="coordinator">코디네이터</SelectItem>
              <SelectItem value="nurse">간호사</SelectItem>
              <SelectItem value="admin">관리자</SelectItem>
            </SelectContent>
          </Select>

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
              <SelectItem value="inactive">비활성</SelectItem>
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
          <StaffTable
            staff={staff}
            onEdit={(member) => openEditModal(member.id)}
            onResetPassword={(member) => openPasswordResetModal(member.id)}
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
      <StaffFormModal
        isOpen={isFormModalOpen}
        onClose={closeModal}
        mode={formMode}
        staff={selectedStaff}
      />

      {/* Password Reset Modal */}
      <PasswordResetModal
        isOpen={isPasswordResetModalOpen}
        onClose={closeModal}
        staffId={selectedStaffId}
        staffName={selectedStaff?.name}
      />
    </div>
  );
}
