import { useState, useEffect, useCallback } from 'react';
import type { ApiResponse } from '../types';

const API_BASE_URL = 'http://localhost:13207';

/** Get stored user info from localStorage */
function getStoredUser(): { role: string; id: string; orgId?: string } | null {
  try {
    const stored = localStorage.getItem('nexus_org');
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/** Common headers including auth */
function getAuthHeaders(existing?: HeadersInit): HeadersInit {
  const user = getStoredUser();
  const headers: Record<string, string> = { ...(existing as Record<string, string>) };
  if (user) {
    headers['X-User-Role'] = user.role;
    headers['X-User-Id'] = user.id;
    if (user.orgId) headers['X-User-OrgId'] = user.orgId;
  }
  return headers;
}

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiReturn<T> extends UseApiState<T> {
  refetch: () => Promise<void>;
  execute: (url: string, options?: RequestInit) => Promise<T | null>;
}

export function useApi<T>(endpoint: string): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        try {
          const body = await response.json();
          throw new Error(body?.message || `请求失败 (${response.status})`);
        } catch (e) {
          if (e instanceof Error && !e.message.startsWith('请求失败')) throw e;
          throw new Error(`请求失败 (${response.status})`);
        }
      }
      
      const result: ApiResponse<T> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'API request failed');
      }
      
      setState({ data: result.data, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      });
    }
  }, [endpoint]);

  const execute = useCallback(async (url: string, options?: RequestInit): Promise<T | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        headers: getAuthHeaders({
          'Content-Type': 'application/json',
          ...options?.headers,
        }),
        ...options,
      });
      
      if (!response.ok) {
        try {
          const body = await response.json();
          throw new Error(body?.message || `请求失败 (${response.status})`);
        } catch (e) {
          if (e instanceof Error && !e.message.startsWith('请求失败')) throw e;
          throw new Error(`请求失败 (${response.status})`);
        }
      }
      
      const result: ApiResponse<T> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'API request failed');
      }
      
      return result.data;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      }));
      return null;
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refetch: fetchData,
    execute,
  };
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const isFormData = options?.body instanceof FormData;
  const baseHeaders: Record<string, string> = isFormData
    ? { ...(options?.headers as Record<string, string>) }
    : { 'Content-Type': 'application/json', ...(options?.headers as Record<string, string>) };
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: getAuthHeaders(baseHeaders),
  });

  if (!response.ok) {
    try {
      const body = await response.json();
      throw new Error(body?.message || `请求失败 (${response.status})`);
    } catch (e) {
      if (e instanceof Error && e.message !== `请求失败 (${response.status})`) throw e;
      throw new Error(`请求失败 (${response.status})`);
    }
  }

  return response.json();
}