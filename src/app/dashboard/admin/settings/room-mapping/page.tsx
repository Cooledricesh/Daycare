'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { RoomMappingTable } from '@/features/admin/components/RoomMappingTable';
import { RoomMappingFormModal } from '@/features/admin/components/RoomMappingFormModal';
import {
  useRoomMappings,
  useDeleteRoomMapping,
} from '@/features/admin/hooks/useRoomMapping';
import { useRoomMappingStore } from '@/features/admin/stores/useRoomMappingStore';

export default function RoomMappingPage() {
  const {
    selectedRoomPrefix,
    isFormModalOpen,
    isDeleteDialogOpen,
    formMode,
    openCreateModal,
    openEditModal,
    openDeleteDialog,
    closeModal,
    closeDeleteDialog,
  } = useRoomMappingStore();

  const { data: mappings, isLoading } = useRoomMappings();
  const deleteMapping = useDeleteRoomMapping();

  const mappingsList = mappings || [];
  const selectedMapping = mappingsList.find(
    (m) => m.room_prefix === selectedRoomPrefix
  );

  const handleDelete = async () => {
    if (selectedRoomPrefix) {
      try {
        await deleteMapping.mutateAsync(selectedRoomPrefix);
        closeDeleteDialog();
      } catch (error) {
        console.error('Failed to delete room mapping:', error);
      }
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">호실-담당자 매핑</h1>
          <p className="text-sm text-gray-600 mt-1">
            호실별 담당 코디네이터를 설정합니다. 환자 동기화 시 호실에 따라 자동으로
            담당자가 배정됩니다.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          매핑 추가
        </Button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">호실 매핑 안내</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            - 환자의 호실 번호가 매핑된 호실과 일치하면 해당 코디네이터가 자동
            배정됩니다.
          </li>
          <li>
            - 환자 수는 해당 호실에 있는 활성 환자의 수를 표시합니다.
          </li>
          <li>
            - 비활성화된 매핑은 동기화 시 적용되지 않습니다.
          </li>
        </ul>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">불러오는 중...</div>
      ) : (
        <RoomMappingTable
          mappings={mappingsList}
          onEdit={(mapping) => openEditModal(mapping.room_prefix)}
          onDelete={(mapping) => openDeleteDialog(mapping.room_prefix)}
        />
      )}

      {/* Form Modal */}
      <RoomMappingFormModal
        isOpen={isFormModalOpen}
        onClose={closeModal}
        mode={formMode}
        mapping={selectedMapping}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>매핑 삭제</DialogTitle>
            <DialogDescription>
              호실 &quot;{selectedRoomPrefix}&quot; 매핑을 삭제하시겠습니까?
              <br />
              삭제 후에는 복구할 수 없으며, 해당 호실 환자의 담당자 자동 배정이
              적용되지 않습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={deleteMapping.isPending}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMapping.isPending}
            >
              {deleteMapping.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
