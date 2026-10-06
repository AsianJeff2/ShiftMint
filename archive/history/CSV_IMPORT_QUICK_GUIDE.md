# CSV Import Quick Guide

## Required CSV Format
Your CSV must have these 9 columns (in ANY order):

```csv
Employee Name,Start Date,End Date,Duration,Regular Wage,Hourly Rate,Station Number,Position,Overtime Wage
```

## Example Data
```csv
Employee Name,Start Date,End Date,Duration,Regular Wage,Hourly Rate,Station Number,Position,Overtime Wage
John Doe,2024-01-15 09:00,2024-01-15 17:00,8:00,120.00,15.00,A1,Server,0.00
Jane Smith,2024-01-16 10:00,2024-01-16 19:00,9:00,135.00,15.00,Bar-1,Bartender,22.50
Mike Johnson,2024-01-15 12:00,2024-01-15 12:30,-,0.00,0.00,Break Room,Break,0.00
```

## Key Features

### ✅ Automatic Employee Creation
- If employee doesn't exist, they're created automatically
- Uses name from CSV
- Sets hourly rate from CSV
- Generates temporary email/phone (update later)

### ✅ Flexible Column Order
- Columns can be in ANY order
- System auto-detects headers
- Case doesn't matter

### ✅ Break Handling
- Use "-" in Duration for breaks
- Or use "Break" in Position
- Breaks automatically have $0 wages

### ✅ Smart Defaults
- Missing hourly rate defaults to $15.00
- Total wage auto-calculated from regular + overtime
- Position defaults to "Team Member" if blank

## Import Steps
1. Navigate to **Shifts** page
2. Click **Import from CSV**
3. Select your file
4. Review preview
5. Click **Import**

## After Import
- Check **Employees** page for new employees
- Update employee emails/phones as needed
- Verify wage calculations in **Payroll**

## Tips
- Use consistent employee names
- Dates can be in various formats
- Include ".00" for wage accuracy
- Use "-" for break periods

## Simplified Requirements
- **No EIN needed** - removed tax complexity
- **Minimal employee info** - just name and rate
- **Auto-generated IDs** - system handles it
- **Update later** - fix details when convenient

---
*This system follows your 4-point decision matrix: Least Invasive, Most Comprehensive, Most Simple, Most Integrative*