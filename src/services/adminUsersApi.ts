import axios from 'axios';

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  authMethod?: string;
  personalVaultInitialized?: boolean;
}

export interface AdminUsersResponse {
  users: AdminUserRecord[];
  pagination: {
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PersonalVaultResetResult {
  success: boolean;
  message: string;
  deletedFolders: number;
  deletedVaults: number;
  initialized: boolean;
}

export async function fetchAdminUsers(page = 1, limit = 100): Promise<AdminUsersResponse> {
  const res = await axios.get<AdminUsersResponse>('/api/admin/users', {
    params: { page, limit },
  });
  return res.data;
}

export async function resetUserPersonalVault(userId: string): Promise<PersonalVaultResetResult> {
  const res = await axios.post<PersonalVaultResetResult>(`/api/admin/users/${encodeURIComponent(userId)}/reset-personal-vault`);
  return res.data;
}
