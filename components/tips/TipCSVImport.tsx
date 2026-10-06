import React, { useState } from 'react';
import { useData } from '@/contexts/DataContext';
import { useEmployees } from '@/hooks/useEmployees';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TipTypeSchema, type TipType } from '@/lib/types/api-dtos';
import { errorMessage } from '@/lib/error-handling';

interface CSVRow extends Record<string, unknown> {
  employeeName?: string;
  amount: string;
  tipType: TipType;
  tableNumber?: string;
  serverName?: string;
  timestamp?: string;
  notes?: string;
}

function csvRecords(csv: string): Array<{ values: string[]; line: number }> {
  const records: Array<{ values: string[]; line: number }> = [];
  let values: string[] = [], field = '', quoted = false, closedQuote = false, line = 1, rowLine = 1;
  const finishField = () => { values.push(field.trim()); field = ''; closedQuote = false; };
  const finishRow = () => { finishField(); if (values.some(value => value !== '')) records.push({ values, line: rowLine }); values = []; rowLine = line + 1; };
  const input = csv.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index++; }
      else if (quoted) { quoted = false; closedQuote = true; }
      else if (!field.trim() && !closedQuote) { field = ''; quoted = true; }
      else throw new Error('CSV contains an unexpected quotation mark');
    } else if (character === ',' && !quoted) finishField();
    else if ((character === '\n' || character === '\r') && !quoted) {
      finishRow(); line++;
      if (character === '\r' && input[index + 1] === '\n') index++;
    } else {
      if (closedQuote && !/\s/.test(character)) throw new Error('CSV contains text after a quoted field');
      field += character;
      if (character === '\n') line++;
      else if (character === '\r' && input[index + 1] !== '\n') line++;
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  finishRow();
  return records;
}

function occurrenceTimestamp(value: string): string {
  if (!value) throw new Error('Actual tip timestamp is required');
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!match) throw new Error('Use an ISO timestamp with Z or an explicit UTC offset');
  const day = new Date(match[1] + '-' + match[2] + '-' + match[3] + 'T00:00:00Z');
  const instant = new Date(value);
  if (day.getUTCFullYear() !== Number(match[1]) || day.getUTCMonth() + 1 !== Number(match[2]) || day.getUTCDate() !== Number(match[3]) || !Number.isFinite(instant.getTime())) throw new Error('Timestamp contains an invalid calendar date or UTC offset');
  return instant.toISOString();
}

function parseTipCsv(csv: string, employees: Array<{ firstName: string; lastName: string }>): { data: CSVRow[]; errors: string[]; sourceRows: number[] } {
  const records = csvRecords(csv);
  if (records.length < 2) throw new Error('CSV file must contain at least a header row and one data row');
  const aliases: Record<string, string> = {
    employeename: 'employeeName', name: 'employeeName', employee: 'employeeName', server: 'employeeName',
    amount: 'amount', tipamount: 'amount', tip: 'amount',
    tiptype: 'tipType', type: 'tipType',
    tablenumber: 'tableNumber', table: 'tableNumber',
    servername: 'serverName',
    timestamp: 'timestamp', date: 'timestamp', time: 'timestamp', datetime: 'timestamp', createdat: 'timestamp',
    notes: 'notes', description: 'notes', comment: 'notes',
  };
  const mapping = records[0].values.map(header => aliases[header.toLowerCase().replace(/[\s_-]/g, '')]);
  const fields = mapping.filter(Boolean);
  if (new Set(fields).size !== fields.length) throw new Error('CSV has duplicate columns for the same tip field');
  const data: CSVRow[] = [], errors: string[] = [], sourceRows: number[] = [];
  for (const record of records.slice(1)) {
    try {
      if (record.values.length !== mapping.length) throw new Error('Column count mismatch');
      const row: Record<string, string> = {};
      mapping.forEach((field, column) => { if (field) row[field] = record.values[column]; });
      if (!row.amount) throw new Error('Tip amount is required');
      const amount = Number(row.amount.replace(/^\$/, '').replaceAll(',', ''));
      if (!/^\$?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(row.amount) || !Number.isFinite(amount) || amount <= 0) throw new Error('Invalid tip amount format');
      const suppliedType = mapping.includes('tipType');
      if (suppliedType && !row.tipType) throw new Error('Tip type is required when its column is present');
      const type = TipTypeSchema.safeParse(suppliedType ? row.tipType.trim().toLowerCase() : 'credit');
      if (!type.success) throw new Error('Unsupported tip type; use ' + TipTypeSchema.options.join(', '));
      const timestamp = occurrenceTimestamp(row.timestamp || '');
      const employeeName = (row.employeeName || row.serverName || '').trim();
      if (employeeName && employees.filter(employee => (employee.firstName + ' ' + employee.lastName).toLowerCase() === employeeName.toLowerCase()).length !== 1) throw new Error('Assign the tip to one existing employee using a unique full name');
      data.push({ employeeName: row.employeeName || '', amount: String(amount), tipType: type.data, timestamp, notes: row.notes || '', tableNumber: row.tableNumber || '', serverName: row.serverName || row.employeeName || '' });
      sourceRows.push(record.line);
    } catch (error) { errors.push('Row ' + record.line + ': ' + errorMessage(error)); }
  }
  if (records.length - 1 > 5000) errors.push('A file can contain at most 5000 tip rows.');
  return { data, errors, sourceRows };
}

interface TipCSVImportProps {
  onImportComplete?: () => void;
}

export const TipCSVImport: React.FC<TipCSVImportProps> = ({ onImportComplete }) => {
  const { getTips } = useData();
  const { employees } = useEmployees();
  const [isOpen, setIsOpen] = useState(false);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [sourceRows, setSourceRows] = useState<number[]>([]);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvData([]); setValidationErrors([]); setSourceRows([]); setImportResult(null);

    if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseTipCsv(String(e.target?.result || ''), employees);
        setCsvData(parsed.data);
        setSourceRows(parsed.sourceRows);
        setValidationErrors(parsed.errors);
        if (parsed.errors.length) toast.error('Fix all validation errors before importing this file.');
        else if (!parsed.data.length) toast.error('No valid rows found in CSV file');
        else toast.success('Parsed ' + parsed.data.length + ' valid tips from CSV');
      } catch (error) {
        console.error('Error parsing CSV:', error);
        const message = errorMessage(error, 'Error parsing CSV file. Please check the format.');
        setValidationErrors([message]); toast.error(message);
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => { setIsUploading(false); setValidationErrors(['Could not read the CSV file. Choose it again.']); toast.error('Could not read the CSV file. Choose it again.'); };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData.length || validationErrors.length || isImporting) return;
    setIsImporting(true);
    try {
      const result = await apiClient.importTipsFromCSV(csvData);
      const errors = result.errors.map(error => error.row > 0 ? 'CSV row ' + (sourceRows[error.row - 1] ?? error.row + 1) + ': ' + error.error : error.error);
      setCsvData([]); setSourceRows([]);
      setValidationErrors(errors);
      if (result.imported > 0) {
        toast.success('Successfully imported ' + result.imported + ' tips!');
        await getTips();
        onImportComplete?.();
      }
      if (!result.success || errors.length || result.imported === 0) {
        const summary = result.imported + ' tips imported. ' + errors.length + ' rows rejected. Review the errors and upload only corrected, unimported rows.';
        setImportResult(summary);
        if (!errors.length) setValidationErrors([result.message || 'No tips were imported. Review the file before trying again.']);
        toast.error(result.imported === 0 ? 'No tips were imported. Review the row errors.' : 'Some rows were rejected. Imported rows must not be submitted again.');
      } else {
        setValidationErrors([]); setImportResult(null); setIsOpen(false);
      }
    } catch (error) {
      setCsvData([]); setSourceRows([]);
      const message = errorMessage(error, 'The import result could not be confirmed.');
      setValidationErrors([message]);
      setImportResult('The import result could not be confirmed. Check tip records before uploading again; some rows may already be saved.');
      toast.error(message);
    } finally { setIsImporting(false); }
  };

  const downloadTemplate = () => {
    const templateCSV = 'Employee Name,Amount,Tip Type,Table Number,Server Name,Timestamp,Notes\nJohn Doe,25.50,credit,12,John Doe,2026-10-05T19:30:00Z,Great service\nJane Smith,18.00,cash,8,Jane Smith,2026-10-05T20:15:00Z,Regular customer';
    
    const blob = new Blob([templateCSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tip-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    
    toast.success('Template downloaded successfully!');
  };

  const getTotalAmount = () => {
    return csvData.reduce((sum, row) => sum + parseFloat(row.amount), 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Tips from CSV</DialogTitle>
          <DialogDescription>
            Upload tip records with their actual occurrence timestamp, including Z or a UTC offset. When the Tip Type column is absent, tips use credit. If the column is present, each row must contain a supported type. Download the template for the format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {importResult && <Alert><AlertDescription>{importResult}</AlertDescription></Alert>}
          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Step 1: Upload CSV File</CardTitle>
              <CardDescription>
                Use positive decimal amounts, optionally with a leading $ and correctly grouped thousands. Correct every validation error before importing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="csvFile">Choose CSV File</Label>
                  <Input
                    id="csvFile"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={isUploading || isImporting}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  className="shrink-0"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
              
              {isUploading && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Processing CSV file...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-2">Validation Errors Found:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.slice(0, 10).map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                  {validationErrors.length > 10 && (
                    <li className="text-sm">... and {validationErrors.length - 10} more errors</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Data Preview */}
          {csvData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Step 2: Review Data</CardTitle>
                <CardDescription>
                  {csvData.length} tips ready for import - Total: {formatCurrency(getTotalAmount())}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md max-h-60 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Table</TableHead>
                        <TableHead>Server</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 10).map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{row.employeeName || '-'}</TableCell>
                          <TableCell className="font-mono">{formatCurrency(parseFloat(row.amount))}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.tipType}</Badge>
                          </TableCell>
                          <TableCell>{row.tableNumber || '-'}</TableCell>
                          <TableCell>{row.serverName || '-'}</TableCell>
                          <TableCell>{formatDate(row.timestamp || '')}</TableCell>
                          <TableCell className="max-w-32 truncate">{row.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {csvData.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground">
                            ... and {csvData.length - 10} more tips
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Import Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {csvData.length > 0 && (
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  {validationErrors.length ? 'Correct the file before importing' : 'Ready to import ' + csvData.length + ' tips (' + formatCurrency(getTotalAmount()) + ')'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={csvData.length === 0 || validationErrors.length > 0 || isImporting || isUploading}
              >
                {isImporting ? 'Importing...' : `Import ${csvData.length} Tips`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
