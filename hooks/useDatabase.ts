import { useState } from 'react';
import apiClient from '@/lib/api-client';
import { errorMessage } from '@/lib/error-handling';

interface DatabaseBackup {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  created: string;
  createdFormatted: string;
}

interface DatabaseInfo {
  database: {
    path: string;
    size: number;
    sizeFormatted: string;
    created: string;
    createdFormatted: string;
  };
  backups: {
    directory: string;
    count: number;
    totalSize: number;
    latest: {
      name: string;
      created: string;
    } | null;
  };
}

export const useDatabase = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);

  const createBackup = async (customName?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.createDatabaseBackup(customName);
      if (response.success) {
        // Refresh backup list after creating
        await loadBackups();
        await loadDatabaseInfo();
        return response.backup;
      } else {
        throw new Error(response.message || 'Failed to create backup');
      }
    } catch (err) {
      const message = errorMessage(err, 'Failed to create backup');
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.listDatabaseBackups();
      if (response.success) {
        setBackups(response.backups);
        return response.backups;
      } else {
        throw new Error('Failed to load backups');
      }
    } catch (err) {
      const message = errorMessage(err, 'Failed to load backups');
      setError(message);
      setBackups([]);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const restoreFromBackup = async (backupName: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.restoreDatabaseFromBackup(backupName);
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to restore database');
      }
    } catch (err) {
      const message = errorMessage(err, 'Failed to restore database');
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const restoreFromFile = async (filePath: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.restoreDatabaseFromFile(filePath);
      if (response.success) {
        return response;
      } else {
        throw new Error(response.message || 'Failed to restore from file');
      }
    } catch (err) {
      const message = errorMessage(err, 'Failed to restore from file');
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const deleteBackup = async (backupName: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.deleteDatabaseBackup(backupName);
      if (response.success) {
        // Refresh backup list after deletion
        await loadBackups();
        await loadDatabaseInfo();
        return response;
      } else {
        throw new Error(response.message || 'Failed to delete backup');
      }
    } catch (err) {
      const message = errorMessage(err, 'Failed to delete backup');
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const loadDatabaseInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.getDatabaseInfo();
      if (response.success) {
        setDatabaseInfo(response);
        return response;
      } else {
        throw new Error('Failed to load database info');
      }
    } catch (err) {
      const message = errorMessage(err, 'Failed to load database info');
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };



  return {
    // State
    loading,
    error,
    backups,
    databaseInfo,
    
    // Actions
    createBackup,
    loadBackups,
    restoreFromBackup,
    restoreFromFile,
    deleteBackup,
    loadDatabaseInfo,
    clearError,
  };
};
