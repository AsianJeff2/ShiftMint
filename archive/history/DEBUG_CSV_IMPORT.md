# CSV Import Debug Analysis

## User's Data Format
Looking at the provided data, the format appears to be:

```
Position | Type | ID | Start Date/Time | End Date/Time | Duration | Regular Wage | OT Wage | Total Wage | Hourly Rate
Server | Time Clock | 1 | 7/02/2025 11:10:00 AM | 7/02/2025 5:02:00 PM | 5 Hrs 52 Min (5.867) | $96.80 | $0.00 | $96.80 | $16.50
```

With employee names appearing as separate rows:
```
Chang, Michael
```

## Current Issues

1. **Employee Creation Not Working**
   - The CSV parser expects employee name in each row
   - The actual data has employee name as a separate header row
   - Need to handle this grouped format

2. **Column Mapping**
   - Need to map Position -> jobCode
   - Need to map Type -> status or notes
   - Need to extract employee name from group headers

## Solution Approach

1. **Enhanced CSV Parser**
   - Detect employee name rows (rows with fewer columns)
   - Track current employee for subsequent rows
   - Create employee if not exists

2. **Column Detection**
   - Auto-detect based on data patterns
   - Handle both inline and grouped employee formats

3. **Data Integration**
   - Ensure all 416 shifts are imported
   - Link shifts to correct employees
   - Display shifts under employee records