import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, FileText, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { parseShiftCsv, type ShiftCsvRow } from '@/lib/shifts/csv';



interface ShiftCSVImportProps {
  onImportComplete?: () => void;
}

export const ShiftCSVImport: React.FC<ShiftCSVImportProps> = ({ onImportComplete }) => {
  const { getShifts, getEmployees } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [csvData, setCsvData] = useState<ShiftCsvRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setCsvData([]);
    setValidationErrors([]);
    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const { data, errors } = parseShiftCsv(String(event.target?.result ?? ''));
        setCsvData(data);
        setValidationErrors(errors);
        if (errors.length > 0) toast.error(`Correct ${errors.length} invalid rows before importing.`);
        else if (data.length === 0) toast.error('No shift records found in CSV file');
        else toast.success(`Successfully parsed ${data.length} shifts from CSV`);
      } catch (error) {
        setCsvData([]);
        setValidationErrors([(error as Error).message]);
        toast.error((error as Error).message || 'Could not parse the CSV');
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      setCsvData([]);
      setValidationErrors(['Could not read the selected CSV file']);
      setIsUploading(false);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (csvData.length === 0 || validationErrors.length > 0) {
      toast.error('Correct the CSV validation errors before importing');
      return;
    }

    setIsImporting(true);
    try {
      // Use centralized API client instead of direct fetch
      const result = await apiClient.importShiftsFromCSV(csvData);
      const rowErrors = (result.errors ?? []).map(error => typeof error === 'string' ? error : `Row ${error.row}: ${error.error}`);

      if (!result.success || result.imported === 0) {
        setValidationErrors(rowErrors.length ? rowErrors : [result.message || 'No shifts were imported. Review the source file before retrying.']);
        toast.error(result.message || 'No shifts were imported. Review the row errors.');
        if (result.createdEmployees && result.createdEmployees > 0) await getEmployees();
        return;
      }

      if (result.success) {
        // Show comprehensive import results
        let successMessage = `Successfully imported ${result.imported} shifts!`;

        // Add information about created employees
        if (result.createdEmployees && result.createdEmployees > 0) {
          successMessage += ` Created ${result.createdEmployees} new employees.`;

          // Show details of new employees if available
          if (result.integrationInfo?.newEmployees) {
            const employeeNames = result.integrationInfo.newEmployees.map((emp: any) => emp.name).join(', ');
            toast.info(`New employees: ${employeeNames}`);
          }
        }

        toast.success(successMessage);

        // Handle warnings separately from errors
        if (result.warnings && result.warnings.length > 0) {
          toast.info(`${result.warnings.length} rows imported with warnings - please review`);
        }

        if (result.errors && result.errors.length > 0) {
          toast.error(`${result.errors.length} rows could not be imported`);
          setValidationErrors(rowErrors);
        }

        // Refresh shifts and employees data
        await getShifts();

        // If employees were created, refresh the employee list
        if (result.createdEmployees && result.createdEmployees > 0) {
          await getEmployees();
        }

        // Reset component state
        setCsvData([]);
        if (!result.errors?.length) {
          setValidationErrors([]);
          setIsOpen(false);
        }

        // Call callback if provided
        onImportComplete?.();
      } else {
        toast.error(result.message || 'Import failed');
      }
    } catch (error: any) {
      console.error('Error importing shifts:', error);
      // Use improved error handling with user-friendly messages
      const errorMessage = error?.userMessage || error?.message || 'Failed to import shifts. Please try again.';
      setCsvData([]);
      setValidationErrors([`Import result was not confirmed. ${errorMessage} Inspect saved shift records before uploading a new file; some rows may already have been saved.`]);
      toast.error(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateCSV = 'Employee Name,Start Date,End Date,Duration,Type,Regular Wage,Hourly Rate,Station Number,Position,Overtime Wage\n' +
      'John Doe,2026-01-15T09:00:00-05:00,2026-01-15T17:00:00-05:00,8:00,Work,120.00,15.00,A1,Server,0.00\n' +
      'John Doe,2026-01-15T13:00:00-05:00,2026-01-15T13:30:00-05:00,-,Break,0.00,0.00,A1,Break,0.00\n' +
      'Jane Smith,2026-01-16T10:00:00-05:00,2026-01-16T19:00:00-05:00,9:00,Work,135.00,15.00,Bar-1,Bartender,22.50';

    const blob = new Blob([templateCSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shift_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => window.URL.revokeObjectURL(url), 10_000);

    toast.success('Template downloaded!');
  };

  const resetImport = () => {
    setCsvData([]);
    setValidationErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Shifts from CSV</DialogTitle>
          <DialogDescription>
            Upload verified shift records. Dates must include a full ISO time and Z or an explicit UTC offset. Name-only group headings are skipped. Invalid rows must be corrected before import; times are never guessed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Need a template?</p>
                <p className="text-sm text-blue-700">Download our CSV template with sample data</p>
              </div>
            </div>
            <Button onClick={downloadTemplate} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csvFile">Choose CSV File</Label>
            <Input
              ref={fileInputRef}
              id="csvFile"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isUploading || isImporting}
            />
            {isUploading && (
              <p className="text-sm text-gray-600">Parsing CSV file...</p>
            )}
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="font-medium text-red-900">Validation Errors</p>
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                {validationErrors.slice(0, 10).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
                {validationErrors.length > 10 && (
                  <li>... and {validationErrors.length - 10} more errors</li>
                )}
              </ul>
            </div>
          )}

          {/* Preview Data */}
          {csvData.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-medium text-green-900">
                    {csvData.length} valid shifts ready to import
                  </p>
                </div>
                <Button onClick={resetImport} variant="outline" size="sm">
                  Reset
                </Button>
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Job Code</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 10).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {row.employeeName || 'Not specified'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {new Date(row.startTime).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.endTime ? new Date(row.endTime).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell>{row.jobCode}</TableCell>
                        <TableCell>{row.locationId}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            row.status === 'active' ? 'bg-green-100 text-green-800' :
                            row.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {row.status}
                          </span>
                        </TableCell>
                        <TableCell className="truncate max-w-32">{row.notes}</TableCell>
                      </TableRow>
                    ))}
                    {csvData.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500">
                          ... and {csvData.length - 10} more rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={csvData.length === 0 || validationErrors.length > 0 || isImporting}
            >
              {isImporting ? 'Importing...' : `Import ${csvData.length} Shifts`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
