import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useDatabase } from '@/hooks/useDatabase';
import { Database, Download, Upload, Trash2, AlertTriangle, CheckCircle, Clock, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { normalizeCustomBackupName } from '@/lib/database/backup-name';

export const DatabaseBackupSettings: React.FC = () => {
  const {
    loading,
    error,
    backups,
    databaseInfo,
    createBackup,
    loadBackups,
    restoreFromBackup,
    deleteBackup,
    loadDatabaseInfo,
    clearError
  } = useDatabase();

  const [customBackupName, setCustomBackupName] = useState('');
  const [backupNameError, setBackupNameError] = useState<string | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const selectBackupFile = (window as any).electronAPI?.database?.selectBackupFile as (() => Promise<string | null>) | undefined;

  useEffect(() => {
    // Load initial data
    void loadDatabaseInfo().catch(() => undefined);
    void loadBackups().catch(() => undefined);
  }, []);

  const handleCreateBackup = async () => {
    let filename: string | undefined;
    try { filename = normalizeCustomBackupName(customBackupName); }
    catch (error) {
      setBackupNameError(error instanceof Error ? error.message : 'Invalid backup name');
      return;
    }
    setBackupNameError(null);
    try {
      const backup = await createBackup(filename);
      toast.success(`Backup created: ${backup.name}`);
      setCustomBackupName('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create backup');
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;
    
    try {
      await restoreFromBackup(selectedBackup);
      toast.success('Database restored successfully! Please restart the application.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore database');
    }
  };

  const handleDeleteBackup = async (backupName: string) => {
    try {
      await deleteBackup(backupName);
      toast.success(`Backup deleted: ${backupName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete backup');
    }
  };

  const handleImportBackup = async () => {
    if (!selectBackupFile) return;
    try {
      // Use Electron's dialog to select backup file
      const filePath = await selectBackupFile();
      
      if (filePath) {
        // Use the API client directly since restoreFromFile isn't properly exposed
        await apiClient.restoreDatabaseFromFile(filePath);
        toast.success('Database restored from imported file! Please restart the application.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import backup');
    }
  };

  return (
    <div className="space-y-6">
      {error && <Alert role="alert" className="border-destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearError}
            className="ml-2"
          >
            Dismiss
          </Button>
        </AlertDescription>
      </Alert>}
      {/* Database Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Database Information
          </CardTitle>
          <CardDescription>
            Current database status and location
          </CardDescription>
        </CardHeader>
        <CardContent>
          {databaseInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Database Size</Label>
                <p className="text-lg font-semibold">{databaseInfo.database.sizeFormatted}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                <p className="text-lg font-semibold">{databaseInfo.database.createdFormatted}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Backup Count</Label>
                <p className="text-lg font-semibold">{databaseInfo.backups.count}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Latest Backup</Label>
                <p className="text-lg font-semibold">
                  {databaseInfo.backups.latest ? databaseInfo.backups.latest.created : 'None'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">Loading database information...</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Create Backup
          </CardTitle>
          <CardDescription>
            Create a backup of your current database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="backup-name">Custom Backup Name (Optional)</Label>
              <Input
                id="backup-name"
                placeholder="e.g., before-payroll-update"
                value={customBackupName}
                onChange={(e) => { setCustomBackupName(e.target.value); setBackupNameError(null); }}
                aria-invalid={Boolean(backupNameError)}
                aria-describedby={backupNameError ? 'backup-name-error' : 'backup-name-help'}
              />
              <p id="backup-name-help" className="text-sm text-muted-foreground mt-1">A .db extension is added to simple labels. Leave blank for an automatic name.</p>
              {backupNameError && <p id="backup-name-error" role="alert" className="text-sm text-destructive mt-1">{backupNameError}</p>}
            </div>
          </div>
          <Button 
            onClick={handleCreateBackup} 
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creating Backup...' : 'Create Backup'}
          </Button>
        </CardContent>
      </Card>

      {/* Backup List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Available Backups
          </CardTitle>
          <CardDescription>
            Manage your database backups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No backups found</p>
              <p className="text-sm text-muted-foreground">Create your first backup above</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div key={backup.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{backup.name}</h4>
                      <Badge variant="secondary">{backup.sizeFormatted}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created: {backup.createdFormatted}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedBackup(backup.name)}
                        >
                          <Upload className="w-4 h-4 mr-1" />
                          Restore
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Restore Database?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will replace your current database with the backup "{backup.name}". 
                            Your current data will be backed up first as a safety measure.
                            <br /><br />
                            <strong>⚠️ Warning:</strong> You should restart the application after restoration.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRestoreBackup}>
                            Restore Database
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Backup?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the backup "{backup.name}"? 
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteBackup(backup.name)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Backup
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Backup
          </CardTitle>
          <CardDescription>
            Restore from an external backup file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {selectBackupFile
                  ? 'Import a backup file from another ShiftMint installation or external source.'
                  : 'Selecting a local backup file requires the desktop app. For a hosted workspace, an authorized server operator must transfer the backup into its backup directory before restoring it from the list above.'}
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleImportBackup} 
              disabled={loading || !selectBackupFile}
              className="w-full"
              variant="outline"
            >
              <Upload className="w-4 h-4 mr-2" />
              {loading ? 'Importing...' : 'Select Backup File to Import'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
