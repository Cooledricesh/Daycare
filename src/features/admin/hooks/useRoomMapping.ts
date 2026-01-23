'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/remote/api-client';
import type {
  RoomMappingItem,
  CreateRoomMappingRequest,
  UpdateRoomMappingRequest,
} from '../backend/schema';

interface RoomMappingResponse {
  data: RoomMappingItem[];
}

export function useRoomMappings() {
  return useQuery({
    queryKey: ['admin', 'room-mapping'],
    queryFn: async () => {
      const response = await apiClient.get<RoomMappingResponse>(
        '/api/admin/settings/room-mapping'
      );
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRoomMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRoomMappingRequest) => {
      const response = await apiClient.post<RoomMappingItem>(
        '/api/admin/settings/room-mapping',
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'room-mapping'] });
    },
  });
}

export function useUpdateRoomMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roomPrefix,
      data,
    }: {
      roomPrefix: string;
      data: UpdateRoomMappingRequest;
    }) => {
      const response = await apiClient.put<RoomMappingItem>(
        `/api/admin/settings/room-mapping/${roomPrefix}`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'room-mapping'] });
    },
  });
}

export function useDeleteRoomMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomPrefix: string) => {
      const response = await apiClient.delete<{ success: boolean }>(
        `/api/admin/settings/room-mapping/${roomPrefix}`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'room-mapping'] });
    },
  });
}
