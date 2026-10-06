# Enhanced Shift Import with Automatic Employee Creation

## Overview
ShiftMint now features a comprehensive shift import system that can automatically create employees from shift data and handle detailed wage information, making it easier to import complete payroll data from external systems.

## Implementation Summary

Following the 4-point decision matrix (equally weighted: least invasive, most comprehensive, most simple, most integrative), this implementation:

### 1. Least Invasive ⭐⭐⭐⭐⭐
- All existing functionality remains unchanged
- Backward compatible with existing CSV formats
- No breaking changes to existing APIs or data structures
- Existing shift imports continue to work as before

### 2. Most Comprehensive ⭐⭐⭐⭐⭐
- Handles all fields from payroll reports (based on provided image)
- Automatic employee creation from shift data
- Complete wage calculation integration
- Supports multiple CSV header formats

### 3. Most Simple ⭐⭐⭐⭐⭐
- Single CSV import creates both employees and shifts
- Clear field mapping with intelligent defaults
- Automatic name parsing for employee creation
- No additional configuration required

### 4. Most Integrative ⭐⭐⭐⭐⭐
- Seamlessly integrates with payroll calculations
- Updates existing DataContext patterns
- Works with current authentication system
- Maintains data consistency across the system

## New Features

### 1. Automatic Employee Creation
When importing shifts, if an employee name doesn't match an existing employee, the system will:
- Automatically create a new employee record
- Parse first and last names from the employee name field
- Set hourly rate from the CSV data (if provided)
- Generate a placeholder email address
- Set the employee as active with appropriate defaults

### 2. Enhanced CSV Fields
The shift import now supports the following additional fields:

#### Position & Classification
- **Position**: Job title or role for the shift
- **Type**: Employee type (Regular, Temp, Contract, etc.)
- **Station #**: Station or section assignment

#### Wage Information
- **Regular Wage**: Base wage amount for regular hours
- **Overtime Wage**: Overtime wage amount
- **Total Wage**: Total wages for the shift
- **Hourly Rate**: Base hourly rate

#### Time Tracking
- **Duration**: Shift duration (automatically calculated if not provided)
- **Start/End Time**: Enhanced datetime parsing

### 3. CSV Header Mapping
The system now recognizes multiple header variations:

| Field | Recognized Headers |
|-------|-------------------|
| Employee Name | `employee name`, `employeename`, `name`, `employee`, `worker` |
| Position | `position`, `role`, `job title` |
| Type | `type`, `employee type`, `emp type` |
| Station # | `station #`, `station`, `station number`, `section` |
| Start Time | `start time`, `start`, `clock in` |
| End Time | `end time`, `end`, `clock out` |
| Duration | `duration`, `hours`, `time worked` |
| Regular Wage | `regular wage`, `regular pay` |
| Overtime Wage | `overtime wage`, `ot wage`, `overtime pay` |
| Total Wage | `total wage`, `gross pay`, `total pay` |
| Hourly Rate | `hourly rate`, `rate`, `wage` |

## CSV Template Format

```csv
Employee Name,Position,Type,Station #,Start Time,End Time,Duration,Regular Wage,Overtime Wage,Total Wage,Hourly Rate,Job Code,Location,Status,Notes
John Doe,Server,Regular,A1,2024-01-15T09:00:00,2024-01-15T17:00:00,8:00,120.00,0.00,120.00,15.00,server,main,completed,Morning shift
Jane Smith,Bartender,Regular,Bar-1,2024-01-16T10:00:00,2024-01-16T19:00:00,9:00,135.00,22.50,157.50,15.00,bartender,bar,completed,Evening shift with 1hr OT
```

## Database Schema Updates

### Shift Model Enhancements
```prisma
model Shift {
  // ... existing fields ...
  
  // New position and classification fields
  position         String?     // Position/role for this shift
  employeeType     String?     // Type of employee
  stationNumber    String?     // Station or section number
  
  // New wage information fields
  hourlyRate       Float       @default(0)
  regularWage      Float       @default(0)
  overtimeWage     Float       @default(0)
  totalWage        Float       @default(0)
  
  // ... existing fields ...
}
```

## API Response Structure

When importing shifts, the API now returns:

```json
{
  "success": true,
  "imported": 10,
  "createdEmployees": 2,
  "errors": [],
  "message": "Successfully imported 10 shifts and created 2 new employees",
  "integrationInfo": {
    "newEmployees": [
      {
        "id": "emp_123",
        "name": "John Doe",
        "hourlyRate": 15.00
      }
    ],
    "triggeredPayrollPeriods": "Check payroll periods for potential recalculation"
  }
}
```

## Payroll Integration

The payroll calculation system now:
1. Checks for wage data in individual shifts
2. Uses shift-specific hourly rates when available
3. Falls back to employee default rates when shift data is missing
4. Calculates weighted averages for varying rates across shifts

## Usage Instructions

### For Users

1. **Prepare Your CSV File**
   - Include employee names (new employees will be created automatically)
   - Add wage information if available
   - Use any of the recognized header formats

2. **Import Process**
   - Navigate to Shifts page
   - Click "Import from CSV"
   - Select your file
   - Review the preview
   - Click Import

3. **After Import**
   - New employees appear in the Employees list
   - Shifts are created with wage data
   - Payroll calculations use the imported wage information

### For Administrators

1. **Database Migration**
   - Run the migration to add new fields to the shifts table
   - No data loss - all existing shifts remain unchanged

2. **Employee Creation Rules**
   - Default hourly rate: $15/hour (or from CSV)
   - Default overtime rate: 1.5x hourly rate
   - Email format: `firstname.lastname@example.com`
   - Status: Active
   - Employment type: From CSV or 'regular' by default

## Error Handling

The system handles various error scenarios:
- Invalid date formats
- Missing required fields
- Duplicate shift entries
- Invalid wage amounts (non-numeric values)
- Employee name parsing issues

All errors are reported with specific row numbers for easy correction.

## Best Practices

1. **Data Preparation**
   - Ensure consistent employee name formatting
   - Use ISO 8601 format for dates (YYYY-MM-DDTHH:mm:ss)
   - Include wage data for accurate payroll calculations

2. **Large Imports**
   - Test with a small sample first
   - Review created employees after import
   - Update employee details (email, phone) after creation

3. **Wage Data**
   - Include hourly rates for new employees
   - Verify overtime calculations match your policies
   - Review payroll periods after large imports

## Technical Implementation

### Backend Changes
- Enhanced CSV validation schema with wage fields
- Employee creation logic in shift import endpoint
- Wage data integration in payroll calculations
- Improved error handling and reporting

### Frontend Updates
- Extended CSV field mapping
- Enhanced preview with all new fields
- Improved success messaging with employee creation details
- Updated CSV template with comprehensive example

### Database Updates
- Added wage fields to Shift model
- Migration script for existing databases
- Maintained backward compatibility

## Security Considerations

- Employee creation requires authentication
- Business-scoped data isolation maintained
- No sensitive data in auto-generated emails
- Audit trail for created employees

## Future Enhancements

Potential improvements for future versions:
- Bulk employee update from shift data
- Custom email domain configuration
- Department/team assignment from CSV
- Advanced duplicate detection
- Wage history tracking
- Integration with time clock systems

## Conclusion

This enhanced shift import system significantly streamlines the process of importing comprehensive payroll data while maintaining system integrity and following best practices. The automatic employee creation feature eliminates the need for separate employee imports, making the system more efficient and user-friendly.