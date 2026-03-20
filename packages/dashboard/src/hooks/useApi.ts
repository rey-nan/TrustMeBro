import { useState, useEffect } from 'react';
import { api, type ApiResponse } from '../api/client';

export function useApi<T>(path: string | null, options?: { immediate?: boolean }) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = async () => {
    if (!path) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get<ApiResponse<T>>(path);
      if (response.success && response.data) {
        setData(response.data as T);
      } else {
        setError(response.error || 'Unknown error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (options?.immediate !== false) {
      execute();
    }
  }, [path]);

  return { data, loading, error, refetch: execute };
}

export function useMutation<TInput, TOutput>(
  method: 'post' | 'put' | 'delete'
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = async (path: string, body?: TInput): Promise<TOutput | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await api[method]<TOutput>(path, body);
      if (response.success && response.data) {
        return response.data;
      } else {
        setError(response.error || 'Unknown error');
        return null;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { mutate, loading, error };
}
