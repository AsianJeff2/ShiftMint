import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { z } from 'zod';

interface CSVRow extends Record<string, unknown> {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  hourlyRate: string;
  role: string;
  department?: string;
  tipEligible: boolean;
  startDate: string;
}

const employeeHeaders: Record<string, keyof CSVRow> = {
  firstname: 'firstName', lastname: 'lastName', email: 'email', emailaddress: 'email', phone: 'phone', phonenumber: 'phone',
  hourlyrate: 'hourlyRate', wage: 'hourlyRate', payrate: 'hourlyRate', role: 'role', position: 'role', jobtitle: 'role',
  department: 'department', tipeligible: 'tipEligible', tips: 'tipEligible', startdate: 'startDate', hiredate: 'startDate',
};
function employeeRecords(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', state: 'plain' | 'quoted' | 'closed' = 'plain';
  const addField = () => { row.push(field.trim()); field = ''; state = 'plain'; };
  const addRow = () => { addField(); if (row.some(value => value !== '')) rows.push(row); row = []; };
  const csv = input.replace(/^\uFEFF/, '');
  for (let index = 0; index < csv.length; index++) {
    const character = csv[index];
    if (state === 'quoted') {
      if (character === '"' && csv[index + 1] === '"') { field += '"'; index++; }
      else if (character === '"') state = 'closed';
      else field += character;
    } else if (character === ',') addField();
    else if (character === '\n' || character === '\r') { if (character === '\r' && csv[index + 1] === '\n') index++; addRow(); }
    else if (character === '"' && state === 'plain' && field.length === 0) state = 'quoted';
    else if (state === 'closed' && /\s/.test(character)) continue;
    else if (state === 'closed' || character === '"') throw new Error('CSV quotes must enclose a whole field; escape literal quotes by doubling them.');
    else field += character;
  }
  if (state === 'quoted') throw new Error('CSV contains an unterminated quoted field.');
  if (field || row.length || state === 'closed') addRow();
  return rows;
}
export function parseEmployeeCsv(csv: string): { data: CSVRow[]; errors: string[] } {
  const rows = employeeRecords(csv);
  if (rows.length < 2) throw new Error('CSV requires a header and at least one employee row.');
  const mapping = rows[0].map(header => employeeHeaders[header.trim().toLowerCase().replace(/[\s_-]/g, '')]);
  const fields = mapping.filter(Boolean);
  if (new Set(fields).size !== fields.length) throw new Error('CSV has duplicate columns for the same employee field.');
  const required = ['firstName', 'lastName', 'email', 'hourlyRate', 'role', 'tipEligible', 'startDate'];
  if (required.some(field => !fields.includes(field))) throw new Error('CSV requires First Name, Last Name, Email, Hourly Rate, Role, Tip Eligible and Start Date columns.');
  const data: CSVRow[] = [], errors: string[] = [];
  for (let index = 1; index < rows.length; index++) {
    try {
      if (rows[index].length !== mapping.length) throw new Error('Column count does not match the header.');
      const record: Record<string, string> = {};
      mapping.forEach((field, column) => { if (field) record[field] = rows[index][column]; });
      if (required.some(field => !record[field])) throw new Error('Required employee values cannot be blank.');
      if (!z.string().email().safeParse(record.email).success) throw new Error('Email must be valid.');
      if (!Number.isFinite(Number(record.hourlyRate)) || Number(record.hourlyRate) <= 0) throw new Error('Hourly Rate must be a positive number.');
      const eligibility = record.tipEligible.toLowerCase();
      if (eligibility !== 'true' && eligibility !== 'false') throw new Error('Tip Eligible must be true or false.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(record.startDate) || !Number.isFinite(Date.parse(record.startDate)) || new Date(record.startDate).toISOString().slice(0, 10) !== record.startDate) throw new Error('Start Date must be an actual calendar date in YYYY-MM-DD format.');
      data.push({ ...record, tipEligible: eligibility === 'true' } as CSVRow);
    } catch (error) { errors.push(`Row ${index + 1}: ${(error as Error).message}`); }
  }
  return { data, errors };
}

interface EmployeeCSVImportProps {
  onImportComplete?: () => void;
}

export const EmployeeCSVImport: React.FC<EmployeeCSVImportProps> = ({ onImportComplete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [acknowledgedCount, setAcknowledgedCount] = useState(0);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setCsvData([]); setValidationErrors([]); setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { data, errors } = parseEmployeeCsv(String(e.target?.result ?? ''));

        setCsvData(data);
        setValidationErrors(errors);
        
        if (errors.length > 0) toast.error('Correct the CSV validation errors before importing.');
        else if (data.length > 0) {
          toast.success(`Parsed ${data.length} valid employees from CSV`);
        }
      } catch (error) {
        setCsvData([]); setValidationErrors([(error as Error).message]);
        toast.error((error as Error).message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => { setCsvData([]); setValidationErrors(['Could not read the selected CSV file.']); setIsUploading(false); };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (csvData.length === 0 || validationErrors.length > 0) {
      toast.error('Correct the CSV validation errors before importing.');
      return;
    }

    setIsImporting(true);
    try {
      const result = await apiClient.importEmployeesFromCSV(csvData);

      const errors = result.errors || [];
      const rowErrors = errors.map(error => `Row ${error.row}: ${error.error}`);
      if (!result.success || result.imported === 0) {
        setValidationErrors(rowErrors.length ? rowErrors : [result.message || 'No employees were imported.']);
        toast.error('No employees were imported. Review the row errors.');
        return;
      }
      if (!Number.isInteger(result.imported) || result.imported < 0 || result.imported > csvData.length) {
        setCsvData([]); setValidationErrors(['The import response could not be reconciled. Refresh employees before uploading again.']);
        return;
      }
      setAcknowledgedCount(previous => previous + result.imported);
      if (result.imported !== csvData.length || errors.length > 0) {
        const rejected = new Set(errors.map(error => error.row - 1));
        const identified = errors.every(error => Number.isInteger(error.row) && error.row >= 1 && error.row <= csvData.length) && rejected.size === csvData.length - result.imported;
        setCsvData(identified ? csvData.filter((_row, index) => rejected.has(index)) : []);
        setValidationErrors(rowErrors.length ? rowErrors : ['Some results could not be reconciled. Review stored employees before uploading again.']);
        toast.warning(`Imported ${result.imported} employees; review the rejected rows.`);
        onImportComplete?.();
      } else {
        toast.success(`Successfully imported ${result.imported} employees!`);
        setCsvData([]);
        setValidationErrors([]);
        setIsOpen(false);
        onImportComplete?.();
      }
    } catch (error: any) {
      setCsvData([]);
      setValidationErrors(['The import outcome is unknown. Inspect saved employees before uploading a new file.']);
      toast.error('The import outcome is unknown. Inspect saved employees before uploading again.');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const templateCSV = 'First Name,Last Name,Email,Phone,Hourly Rate,Role,Department,Tip Eligible,Start Date\nJohn,Doe,john.doe@example.com,555-0123,15.00,server,food service,true,2024-01-15\nJane,Example,jane.example@example.com,555-0124,20.00,cook,kitchen,false,2024-02-01';
    const blob = new Blob([templateCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Template downloaded successfully!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import Employees from CSV</DialogTitle>
          <DialogDescription>
            Supply actual hire dates as YYYY-MM-DD and Tip Eligible as true or false. Download the template for the expected columns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Step 1: Upload CSV File</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="csvFile">Choose CSV File</Label>
                  <Input id="csvFile" type="file" accept=".csv" onChange={handleFileUpload} disabled={isUploading || isImporting} />
                </div>
                <Button variant="outline" onClick={downloadTemplate} className="shrink-0">
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </CardContent>
          </Card>

          {acknowledgedCount > 0 && <p role="status">Already imported {acknowledgedCount} employees. Imported rows are omitted from the remaining preview. Correct your file and upload only rejected rows.</p>}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Validation Errors:</div>
                <ul className="list-disc list-inside text-xs max-h-40 overflow-auto">
                  {validationErrors.map((error, index) => <li key={index}>{error}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {csvData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Step 2: Review Data</CardTitle>
                <CardDescription>{csvData.length} employees in the remaining preview.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md max-h-60 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Tip Eligible</TableHead>
                        <TableHead>Start Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.firstName} {row.lastName}</TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell>${row.hourlyRate}</TableCell>
                          <TableCell>{row.role}</TableCell>
                          <TableCell>{row.tipEligible ? 'true' : 'false'}</TableCell>
                          <TableCell>{row.startDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={csvData.length === 0 || validationErrors.length > 0 || isUploading || isImporting}>
              {isImporting ? 'Importing...' : `Import ${csvData.length} Employees`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
