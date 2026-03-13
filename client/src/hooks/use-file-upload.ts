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

      setProgress(0);

      // Upload files one at a time (server accepts single file with field name 'file')
      const results: UploadedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);

        const response = await apiClient.post(
          `/projects/${projectId}/files`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const fileProgress = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                );
                const overallProgress = Math.round(
                  ((i * 100 + fileProgress) / files.length)
                );
                setProgress(overallProgress);
              }
            },
          }
        );

        results.push(response as unknown as UploadedFile);
      }

      return results;
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
