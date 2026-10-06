export interface ShiftCsvRow extends Record<string, unknown> {
  employeeName: string;
  startTime: string;
  endTime: string;
  jobCode?: string;
  locationId?: string;
  status?: string;
  notes?: string;
}

const headerFields: Record<string, string> = {
  employeename: 'employeeName', name: 'employeeName', employee: 'employeeName', worker: 'employeeName', staff: 'employeeName',
  startdate: 'startTime', starttime: 'startTime', start: 'startTime', enddate: 'endTime', endtime: 'endTime', end: 'endTime',
  duration: 'duration', hours: 'duration', hoursworked: 'duration',
  regularwage: 'regularWage', regularpay: 'regularWage', hourlyrate: 'hourlyRate', rate: 'hourlyRate', wage: 'hourlyRate', payrate: 'hourlyRate',
  stationnumber: 'stationNumber', 'station#': 'stationNumber', station: 'stationNumber', section: 'stationNumber',
  position: 'jobCode', jobcode: 'jobCode', role: 'position', jobtitle: 'position', job: 'position',
  type: 'type', shifttype: 'type', category: 'type', overtimewage: 'overtimeWage', otwage: 'overtimeWage', overtimepay: 'overtimeWage', otpay: 'overtimeWage',
  totalwage: 'totalWage', grosspay: 'totalWage', status: 'status', shiftstatus: 'status', location: 'locationId', store: 'locationId', notes: 'notes',
};

function records(csv: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let index = 0; index < csv.length; index++) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') { field += '"'; index++; }
      else if (quoted || field.length === 0) quoted = !quoted;
      else field += character;
    } else if (character === delimiter && !quoted) { row.push(field.trim()); field = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index++;
      row.push(field.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = []; field = '';
    } else field += character;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  row.push(field.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

/** Import timestamps must carry their UTC offset. Browser and host timezone never guess it. */
function timestamp(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error('Use an ISO date and time with Z or an explicit UTC offset, for example 2026-10-05T09:00:00-04:00');
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  const instant = new Date(value);
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3]) || !Number.isFinite(instant.getTime())) throw new Error('Timestamp contains an invalid calendar date or UTC offset');
  return instant.toISOString();
}

export function parseShiftCsv(csv: string): { data: ShiftCsvRow[]; errors: string[] } {
  const input = csv.replace(/^\uFEFF/, '');
  const firstLine = input.split(/\r?\n/, 1)[0];
  const delimiter = [',', ';', '\t', '|'].sort((a, b) => (records(firstLine, b)[0]?.length ?? 0) - (records(firstLine, a)[0]?.length ?? 0))[0];
  const rows = records(input, delimiter);
  if (rows.length < 2) throw new Error('CSV requires a header and at least one shift row');
  const headers = rows[0].map(value => value.toLowerCase().replace(/[\s_-]/g, ''));
  const mapping = headers.map(header => headerFields[header]);
  const mappedFields = mapping.filter(Boolean);
  if (new Set(mappedFields).size !== mappedFields.length) throw new Error('CSV has duplicate columns for the same shift field');
  if (!mapping.includes('startTime')) throw new Error('CSV requires a Start Date or Start Time column');
  const data: ShiftCsvRow[] = [], errors: string[] = [];
  let currentEmployeeName = '';
  for (let index = 1; index < rows.length; index++) {
    const values = rows[index];
    if (values.length === headers.length && values.every((value, column) => value.toLowerCase().replace(/[\s_-]/g, '') === headers[column])) continue;
    const populated = values.map((value, column) => ({ value, column })).filter(item => item.value !== '');
    // Group headings carry a name, never a punch. They may be a single cell or a full empty row.
    if (populated.length === 1 && (values.length === 1 || mapping[populated[0].column] === 'employeeName') && /^[\p{L}][\p{L}\s.'’,\-]+$/u.test(populated[0].value)) {
      currentEmployeeName = populated[0].value;
      continue;
    }
    try {
      if (values.length !== headers.length) throw new Error(`Expected ${headers.length} columns; found ${values.length}`);
      const row: Record<string, string> = {};
      mapping.forEach((field, column) => { if (field) row[field] = values[column]; });
      row.employeeName ||= currentEmployeeName;
      if (!row.employeeName) throw new Error('Employee name is required');
      if (!row.startTime) throw new Error('Start date and time are required');
      row.startTime = timestamp(row.startTime);
      row.endTime = row.endTime ? timestamp(row.endTime) : '';
      if (row.endTime && new Date(row.endTime) <= new Date(row.startTime)) throw new Error('End time must follow start time');
      const type = row.type?.trim().toLowerCase();
      if (type && !['work', 'break'].includes(type)) throw new Error('Unsupported shift type; use Work or Break');
      const isBreak = type === 'break' || row.jobCode?.toLowerCase() === 'break' || row.position?.toLowerCase().includes('break');
      row.type = isBreak ? 'break' : 'work';
      row.status = isBreak ? 'break' : (row.status?.trim().toLowerCase() || (row.endTime ? 'completed' : 'active'));
      if (!['active', 'completed', 'pending_review', 'break'].includes(row.status)) throw new Error('Unsupported shift status');
      if ((row.status === 'completed' || row.status === 'break') && !row.endTime) throw new Error('Completed shifts and breaks require an end time');
      for (const field of ['hourlyRate', 'regularWage', 'overtimeWage', 'totalWage']) {
        if (!row[field]) continue;
        const number = Number(row[field].replace(/^\$/, '').replaceAll(',', ''));
        if (!Number.isFinite(number) || number < 0) throw new Error(`${field} must be a nonnegative number`);
        row[field] = String(number);
      }
      row.jobCode = isBreak ? 'break' : (row.jobCode || 'general');
      row.locationId ||= 'main';
      row.notes ||= '';
      data.push(row as ShiftCsvRow);
    } catch (error) { errors.push(`Row ${index + 1}: ${(error as Error).message}`); }
  }
  return { data, errors };
}
