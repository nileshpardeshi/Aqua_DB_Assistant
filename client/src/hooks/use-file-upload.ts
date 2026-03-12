import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  status: 'uploaded' | 'parsing' | 'parsed' | 'error';
  createdAt: string;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Upload files with multipart/form-data and track progress.
 */
export function useFileUpload(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!projectId) throw new Error('Project ID is required');

      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      setProgress(0);

      const response = await apiClient.post(
        `/projects/${projectId}/files/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const pct = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setProgress(pct);
            }
          },
        }
      );

      return response as unknown as UploadedFile[];
    },
    onSuccess: () => {
      setProgress(100);
      // Invalidate schema-related queries after upload
      queryClient.invalidateQueries({
        queryKey: ['schema', projectId],
      });
    },
    onError: () => {
      setProgress(0);
    },
  });

  const reset = () => {
    setProgress(0);
    mutation.reset();
  };

  return {
    upload: mutation.mutate,
    uploadAsync: mutation.mutateAsync,
    isUploading: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    progress,
    reset,
  };
}
