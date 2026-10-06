const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// In-memory "database" for demo
let isSetupComplete = false;
let userData = null;
let businessData = null;
let shiftsData = [];
let tipsData = [];
let employeesData = [];
let nextShiftId = 1;
let nextTipId = 1;
let nextEmployeeId = 1;

// No demo data - start with empty system

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'ShiftMint Backend Server is running',
    timestamp: new Date().toISOString()
  });
});

// Auth status endpoint
app.get('/api/auth/status', (req, res) => {
  res.json({
    success: true,
    configured: isSetupComplete,
    requiresSetup: !isSetupComplete,
  });
});

// Setup endpoint
app.post('/api/auth/setup', (req, res) => {
  const { email, password, firstName, lastName, businessName } = req.body;
  
  if (!email || !password || !firstName || !lastName || !businessName) {
    return res.status(400).json({ 
      success: false,
      message: 'All fields are required' 
    });
  }
  
  // Store user and business data
  userData = { email, firstName, lastName, role: 'owner' };
  businessData = { name: businessName };
  isSetupComplete = true;
  
  // Mock JWT token
  const token = 'mock-jwt-token-' + Date.now();
  
  res.json({
    success: true,
    message: 'Setup completed successfully',
    token,
    user: userData
  });
});

// Login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!isSetupComplete) {
    return res.status(400).json({ 
      success: false,
      message: 'Setup required first' 
    });
  }
  
  if (!userData || userData.email !== email) {
    return res.status(401).json({ 
      success: false,
      message: 'Invalid credentials' 
    });
  }
  
  const token = 'mock-jwt-token-' + Date.now();
  
  res.json({
    success: true,
    message: 'Login successful',
    token,
    user: userData
  });
});

// Current user endpoint
app.get('/api/auth/me', (req, res) => {
  if (!userData) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  res.json({
    success: true,
    user: userData
  });
});

// ===== EMPLOYEES MANAGEMENT =====

// Get all employees
app.get('/api/employees', (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  
  let filteredEmployees = [...employeesData];
  
  // Apply status filter
  if (status) {
    filteredEmployees = filteredEmployees.filter(emp => emp.status === status);
  }
  
  // Apply pagination
  const startIndex = parseInt(offset);
  const endIndex = startIndex + parseInt(limit);
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    employees: paginatedEmployees,
    count: filteredEmployees.length
  });
});

// Create new employee
app.post('/api/employees', (req, res) => {
  try {
    const { firstName, lastName, email, phone, hourlyRate, overtimeRate, role, department, tipEligible, payType } = req.body;
    
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and email are required'
      });
    }
    
    // Check if employee with email already exists
    const existingEmployee = employeesData.find(emp => emp.email === email);
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Employee with this email already exists'
      });
    }
    
    const employee = {
      id: `emp_${nextEmployeeId++}`,
      firstName,
      lastName,
      email,
      phone: phone || '',
      hourlyRate: parseFloat(hourlyRate) || 15.00,
      overtimeRate: parseFloat(overtimeRate) || (parseFloat(hourlyRate) || 15.00) * 1.5,
      role: role || 'server',
      department: department || 'general',
      status: 'active',
      tipEligible: tipEligible !== false,
      payType: payType || 'hourly',
      startDate: new Date().toISOString().split('T')[0],
      employeeNumber: `EMP${String(employeesData.length + 1).padStart(4, '0')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    employeesData.push(employee);
    
    res.status(201).json({
      success: true,
      employee,
      message: 'Employee created successfully'
    });
  } catch (error) {
    console.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating employee'
    });
  }
});

// Get employee stats
app.get('/api/employees/stats', (req, res) => {
  const stats = {
    total: employeesData.length,
    active: employeesData.filter(emp => emp.status === 'active').length,
    inactive: employeesData.filter(emp => emp.status === 'inactive').length,
    tipEligible: employeesData.filter(emp => emp.tipEligible).length,
    averageWage: employeesData.reduce((sum, emp) => sum + emp.hourlyRate, 0) / employeesData.length || 0
  };
  
  res.json({
    success: true,
    stats
  });
});

// ===== SHIFTS MANAGEMENT =====

// Get all shifts
app.get('/api/shifts', (req, res) => {
  const { startDate, endDate, status, limit = 50, offset = 0 } = req.query;
  
  let filteredShifts = [...shiftsData];
  
  // Apply date filters
  if (startDate || endDate) {
    filteredShifts = filteredShifts.filter(shift => {
      const shiftDate = new Date(shift.startTime);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      if (start && shiftDate < start) return false;
      if (end && shiftDate > end) return false;
      return true;
    });
  }
  
  // Apply status filter
  if (status) {
    filteredShifts = filteredShifts.filter(shift => shift.status === status);
  }
  
  // Apply pagination
  const startIndex = parseInt(offset);
  const endIndex = startIndex + parseInt(limit);
  const paginatedShifts = filteredShifts.slice(startIndex, endIndex);
  
  res.json({ 
    success: true, 
    shifts: paginatedShifts,
    total: filteredShifts.length
  });
});

// Create new shift
app.post('/api/shifts', (req, res) => {
  try {
    const { startTime, endTime, jobCode, locationId, status, notes, employeeId } = req.body;
    
    if (!startTime) {
      return res.status(400).json({
        success: false,
        message: 'Start time is required'
      });
    }
    
    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee selection is required'
      });
    }
    
    // Find the employee to get their wage information
    const employee = employeesData.find(emp => emp.id === employeeId);
    if (!employee) {
      return res.status(400).json({
        success: false,
        message: 'Selected employee not found'
      });
    }
    
    const startDate = new Date(startTime);
    const endDate = endTime ? new Date(endTime) : null;
    const durationMin = endDate ? Math.floor((endDate - startDate) / (1000 * 60)) : null;
    
    // Calculate wages if shift is completed
    let regularPay = 0;
    let overtimePay = 0;
    let totalPay = 0;
    
    if (durationMin && status === 'completed') {
      const hoursWorked = durationMin / 60;
      const regularHours = Math.min(hoursWorked, 8); // Regular hours (up to 8)
      const overtimeHours = Math.max(hoursWorked - 8, 0); // Overtime hours (over 8)
      
      regularPay = regularHours * employee.hourlyRate;
      overtimePay = overtimeHours * employee.overtimeRate;
      totalPay = regularPay + overtimePay;
    }
    
    const shift = {
      id: `shift_${nextShiftId++}`,
      businessId: businessData?.id || 'default_business',
      employeeId: employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeNumber: employee.employeeNumber,
      shiftDate: startDate.toISOString().split('T')[0],
      startTime: startDate.toISOString(),
      endTime: endDate ? endDate.toISOString() : null,
      durationMin: durationMin,
      hoursWorked: durationMin ? (durationMin / 60).toFixed(2) : null,
      jobCode: jobCode || employee.role,
      locationId: locationId || 'main',
      status: status || 'active',
      hourlyRate: employee.hourlyRate,
      overtimeRate: employee.overtimeRate,
      regularPay: parseFloat(regularPay.toFixed(2)),
      overtimePay: parseFloat(overtimePay.toFixed(2)),
      totalPay: parseFloat(totalPay.toFixed(2)),
      totalSales: 0,
      cashSales: 0,
      creditCardSales: 0,
      totalTips: 0,
      cashTips: 0,
      creditCardTips: 0,
      notes: notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tipEntries: [],
      punchEvents: []
    };
    
    shiftsData.push(shift);
    
    res.status(201).json({
      success: true,
      data: shift,
      message: 'Shift created successfully'
    });
  } catch (error) {
    console.error('Error creating shift:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating shift'
    });
  }
});

// Update shift
app.put('/api/shifts/:id', (req, res) => {
  try {
    const shiftId = req.params.id;
    const { startTime, endTime, jobCode, locationId, status, notes } = req.body;
    
    const shiftIndex = shiftsData.findIndex(shift => shift.id === shiftId);
    if (shiftIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }
    
    const shift = shiftsData[shiftIndex];
    
    // Update fields
    if (startTime) {
      shift.startTime = new Date(startTime).toISOString();
      shift.shiftDate = new Date(startTime).toISOString().split('T')[0];
    }
    if (endTime) {
      shift.endTime = new Date(endTime).toISOString();
    }
    if (startTime && endTime) {
      shift.durationMin = Math.floor((new Date(endTime) - new Date(startTime)) / (1000 * 60));
    }
    if (jobCode) shift.jobCode = jobCode;
    if (locationId) shift.locationId = locationId;
    if (status) shift.status = status;
    if (notes !== undefined) shift.notes = notes;
    
    shift.updatedAt = new Date().toISOString();
    
    res.json({
      success: true,
      data: shift,
      message: 'Shift updated successfully'
    });
  } catch (error) {
    console.error('Error updating shift:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating shift'
    });
  }
});

// Delete shift
app.delete('/api/shifts/:id', (req, res) => {
  try {
    const shiftId = req.params.id;
    const shiftIndex = shiftsData.findIndex(shift => shift.id === shiftId);
    
    if (shiftIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Shift not found'
      });
    }
    
    shiftsData.splice(shiftIndex, 1);
    
    res.json({
      success: true,
      message: 'Shift deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting shift:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting shift'
    });
  }
});

// CSV Import endpoint for shifts
app.post('/api/shifts/import-csv', (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CSV data format'
      });
    }
    
    const importedShifts = [];
    const errors = [];
    
    csvData.forEach((row, index) => {
      try {
        // Expected CSV format: employeeName, startTime, endTime, jobCode, locationId, status, notes
        const { employeeName, startTime, endTime, jobCode, locationId, status, notes } = row;
        
        if (!startTime) {
          errors.push(`Row ${index + 1}: Start time is required`);
          return;
        }
        
        // Find employee by name
        let employee = null;
        if (employeeName) {
          employee = employeesData.find(emp => 
            `${emp.firstName} ${emp.lastName}`.toLowerCase() === employeeName.toLowerCase() ||
            emp.firstName.toLowerCase() === employeeName.toLowerCase() ||
            emp.lastName.toLowerCase() === employeeName.toLowerCase()
          );
        }
        
                 // Employee is required for CSV import
         if (!employee) {
           errors.push(`Row ${index + 1}: Employee name is required or employee not found`);
           return;
         }
        
        const startDate = new Date(startTime);
        const endDate = endTime ? new Date(endTime) : null;
        const durationMin = endDate ? Math.floor((endDate - startDate) / (1000 * 60)) : null;
        
        // Calculate wages if shift is completed
        let regularPay = 0;
        let overtimePay = 0;
        let totalPay = 0;
        
        if (durationMin && (status === 'completed' || !status)) {
          const hoursWorked = durationMin / 60;
          const regularHours = Math.min(hoursWorked, 8);
          const overtimeHours = Math.max(hoursWorked - 8, 0);
          
          regularPay = regularHours * employee.hourlyRate;
          overtimePay = overtimeHours * employee.overtimeRate;
          totalPay = regularPay + overtimePay;
        }
        
        const shift = {
          id: `shift_${nextShiftId++}`,
          businessId: businessData?.id || 'default_business',
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          employeeNumber: employee.employeeNumber,
          shiftDate: startDate.toISOString().split('T')[0],
          startTime: startDate.toISOString(),
          endTime: endDate ? endDate.toISOString() : null,
          durationMin: durationMin,
          hoursWorked: durationMin ? (durationMin / 60).toFixed(2) : null,
          jobCode: jobCode || employee.role,
          locationId: locationId || 'main',
          status: status || 'completed',
          hourlyRate: employee.hourlyRate,
          overtimeRate: employee.overtimeRate,
          regularPay: parseFloat(regularPay.toFixed(2)),
          overtimePay: parseFloat(overtimePay.toFixed(2)),
          totalPay: parseFloat(totalPay.toFixed(2)),
          totalSales: 0,
          cashSales: 0,
          creditCardSales: 0,
          totalTips: 0,
          cashTips: 0,
          creditCardTips: 0,
          notes: notes || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tipEntries: [],
          punchEvents: []
        };
        
        shiftsData.push(shift);
        importedShifts.push(shift);
      } catch (error) {
        errors.push(`Row ${index + 1}: ${error.message}`);
      }
    });
    
    res.json({
      success: true,
      message: `Successfully imported ${importedShifts.length} shifts`,
      imported: importedShifts.length,
      errors: errors.length > 0 ? errors : undefined,
      data: importedShifts
    });
  } catch (error) {
    console.error('Error importing CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Server error importing CSV data'
    });
  }
});

// Get shifts grouped by employee
app.get('/api/shifts/by-employee', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let filteredShifts = [...shiftsData];
    
    // Apply date filters
    if (startDate || endDate) {
      filteredShifts = filteredShifts.filter(shift => {
        const shiftDate = new Date(shift.startTime);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (start && shiftDate < start) return false;
        if (end && shiftDate > end) return false;
        return true;
      });
    }
    
    // Group shifts by employee
    const employeeShifts = {};
    
    filteredShifts.forEach(shift => {
      const employeeId = shift.employeeId;
      
      if (!employeeShifts[employeeId]) {
        const employee = employeesData.find(emp => emp.id === employeeId);
        employeeShifts[employeeId] = {
          employee: employee || {
            id: employeeId,
            firstName: shift.employeeName?.split(' ')[0] || 'Unknown',
            lastName: shift.employeeName?.split(' ')[1] || 'Employee',
            employeeNumber: shift.employeeNumber || 'N/A',
            hourlyRate: shift.hourlyRate || 15.00,
            overtimeRate: shift.overtimeRate || 22.50
          },
          shifts: [],
          totalHours: 0,
          regularHours: 0,
          overtimeHours: 0,
          totalPay: 0,
          regularPay: 0,
          overtimePay: 0,
          shiftsCount: 0
        };
      }
      
      employeeShifts[employeeId].shifts.push(shift);
      employeeShifts[employeeId].shiftsCount++;
      
      if (shift.hoursWorked) {
        const hours = parseFloat(shift.hoursWorked);
        employeeShifts[employeeId].totalHours += hours;
        
        const regularHours = Math.min(hours, 8);
        const overtimeHours = Math.max(hours - 8, 0);
        
        employeeShifts[employeeId].regularHours += regularHours;
        employeeShifts[employeeId].overtimeHours += overtimeHours;
      }
      
      if (shift.totalPay) {
        employeeShifts[employeeId].totalPay += shift.totalPay;
        employeeShifts[employeeId].regularPay += shift.regularPay || 0;
        employeeShifts[employeeId].overtimePay += shift.overtimePay || 0;
      }
    });
    
    // Sort shifts within each employee group by date
    Object.values(employeeShifts).forEach(empData => {
      empData.shifts.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      
      // Round totals
      empData.totalHours = parseFloat(empData.totalHours.toFixed(2));
      empData.regularHours = parseFloat(empData.regularHours.toFixed(2));
      empData.overtimeHours = parseFloat(empData.overtimeHours.toFixed(2));
      empData.totalPay = parseFloat(empData.totalPay.toFixed(2));
      empData.regularPay = parseFloat(empData.regularPay.toFixed(2));
      empData.overtimePay = parseFloat(empData.overtimePay.toFixed(2));
    });
    
    res.json({
      success: true,
      data: Object.values(employeeShifts),
      total: Object.keys(employeeShifts).length
    });
  } catch (error) {
    console.error('Error fetching shifts by employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching shifts by employee'
    });
  }
});

// Get shifts for specific employee
app.get('/api/shifts/employee/:employeeId', (req, res) => {
  try {
    const { employeeId } = req.params;
    const { startDate, endDate } = req.query;
    
    let employeeShifts = shiftsData.filter(shift => shift.employeeId === employeeId);
    
    // Apply date filters
    if (startDate || endDate) {
      employeeShifts = employeeShifts.filter(shift => {
        const shiftDate = new Date(shift.startTime);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (start && shiftDate < start) return false;
        if (end && shiftDate > end) return false;
        return true;
      });
    }
    
    // Sort by date (newest first)
    employeeShifts.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    // Calculate totals
    const totalHours = employeeShifts.reduce((sum, shift) => sum + (parseFloat(shift.hoursWorked) || 0), 0);
    const totalPay = employeeShifts.reduce((sum, shift) => sum + (shift.totalPay || 0), 0);
    const regularPay = employeeShifts.reduce((sum, shift) => sum + (shift.regularPay || 0), 0);
    const overtimePay = employeeShifts.reduce((sum, shift) => sum + (shift.overtimePay || 0), 0);
    
    res.json({
      success: true,
      shifts: employeeShifts,
      summary: {
        totalShifts: employeeShifts.length,
        totalHours: parseFloat(totalHours.toFixed(2)),
        totalPay: parseFloat(totalPay.toFixed(2)),
        regularPay: parseFloat(regularPay.toFixed(2)),
        overtimePay: parseFloat(overtimePay.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error fetching employee shifts:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching employee shifts'
    });
  }
});

// ===== TIPS MANAGEMENT =====

// Get all tips
app.get('/api/tips', (req, res) => {
  const { startDate, endDate, limit = 50, offset = 0 } = req.query;
  
  let filteredTips = [...tipsData];
  
  // Apply date filters
  if (startDate || endDate) {
    filteredTips = filteredTips.filter(tip => {
      const tipDate = new Date(tip.timestamp);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      if (start && tipDate < start) return false;
      if (end && tipDate > end) return false;
      return true;
    });
  }
  
  // Apply pagination
  const startIndex = parseInt(offset);
  const endIndex = startIndex + parseInt(limit);
  const paginatedTips = filteredTips.slice(startIndex, endIndex);
  
  res.json({ 
    success: true, 
    tips: paginatedTips,
    total: filteredTips.length
  });
});

// Create new tip
app.post('/api/tips', (req, res) => {
  try {
    const { amount, tipType, source, tableNumber, notes, timestamp } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }
    
    const tip = {
      id: `tip_${nextTipId++}`,
      businessId: businessData?.id || 'default_business',
      employeeId: null, // Tips can be unassigned to employees initially
      shiftId: null,
      amount: parseFloat(amount),
      tipType: tipType || 'credit',
      source: source || 'manual',
      tableNumber: tableNumber || null,
      notes: notes || null,
      timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      processed: false,
      processedAt: null,
      transactionId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    tipsData.push(tip);
    
    res.status(201).json({
      success: true,
      data: tip,
      message: 'Tip created successfully'
    });
  } catch (error) {
    console.error('Error creating tip:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating tip'
    });
  }
});

// Payroll periods data store
let payrollPeriodsData = [];
let nextPayrollPeriodId = 1;

app.get('/api/payroll/periods', (req, res) => {
  res.json({ success: true, periods: payrollPeriodsData, total: payrollPeriodsData.length });
});

// Create payroll period
app.post('/api/payroll/periods', (req, res) => {
  try {
    const { startDate, endDate, notes } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    // Convert date strings to Date objects for validation
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check for overlapping periods
    const overlappingPeriod = payrollPeriodsData.find(period => {
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      return (start <= periodEnd && end >= periodStart);
    });

    if (overlappingPeriod) {
      return res.status(400).json({
        success: false,
        message: 'Payroll period overlaps with existing period',
        overlappingPeriod
      });
    }

    const period = {
      id: `period_${nextPayrollPeriodId++}`,
      businessId: businessData?.id || 'default_business',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      status: 'open',
      totalTips: 0,
      totalSales: 0,
      notes: notes || '',
      payrollEntries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    payrollPeriodsData.push(period);

    res.status(201).json({
      success: true,
      data: period,
      message: 'Payroll period created successfully'
    });
  } catch (error) {
    console.error('Error creating payroll period:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating payroll period',
      error: error.message
    });
  }
});

// Calculate payroll for a period
app.post('/api/payroll/periods/:id/calculate', (req, res) => {
  try {
    const periodId = req.params.id;
    const period = payrollPeriodsData.find(p => p.id === periodId);
    
    if (!period) {
      return res.status(404).json({ 
        success: false,
        message: 'Payroll period not found' 
      });
    }

    // Get shifts in this period
    const periodStart = new Date(period.startDate);
    const periodEnd = new Date(period.endDate);
    
    const shiftsInPeriod = shiftsData.filter(shift => {
      const shiftDate = new Date(shift.startTime);
      return shiftDate >= periodStart && shiftDate <= periodEnd;
    });

    // Get tips in this period
    const tipsInPeriod = tipsData.filter(tip => {
      const tipDate = new Date(tip.timestamp);
      return tipDate >= periodStart && tipDate <= periodEnd;
    });

    // Group by employee
    const employeeData = new Map();
    
    // Process shifts
    shiftsInPeriod.forEach(shift => {
      if (!shift.employeeId) return;
      
      if (!employeeData.has(shift.employeeId)) {
        const employee = employeesData.find(emp => emp.id === shift.employeeId);
        if (!employee) return;
        
        employeeData.set(shift.employeeId, {
          employee,
          shifts: [],
          tips: [],
          totalHours: 0,
          totalTips: 0
        });
      }
      
      const empData = employeeData.get(shift.employeeId);
      empData.shifts.push(shift);
      
      // Calculate hours for this shift
      if (shift.startTime && shift.endTime) {
        const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
        empData.totalHours += duration;
      }
    });

    // Process tips
    tipsInPeriod.forEach(tip => {
      if (!tip.employeeId) return;
      
      if (employeeData.has(tip.employeeId)) {
        const empData = employeeData.get(tip.employeeId);
        empData.tips.push(tip);
        empData.totalTips += tip.amount;
      }
    });

    // Calculate payroll for each employee
    let totalHours = 0;
    let totalGrossPay = 0;
    let totalTips = 0;
    let totalTaxes = 0;
    let totalNetPay = 0;
    const employeePayroll = [];

    for (const [employeeId, empData] of employeeData) {
      const { employee } = empData;
      const employeeHours = empData.totalHours;
      const employeeTips = empData.totalTips;
      
      const hourlyWage = employee.hourlyRate || 15.0;
      const overtimeRate = employee.overtimeRate || (hourlyWage * 1.5);
      
      // Calculate daily overtime (8-hour daily, not 40-hour weekly)
      let totalRegularHours = 0;
      let totalOvertimeHours = 0;
      
      empData.shifts.forEach(shift => {
        if (shift.startTime && shift.endTime) {
          const shiftHours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
          const dailyRegularHours = Math.min(shiftHours, 8);
          const dailyOvertimeHours = Math.max(shiftHours - 8, 0);
          
          totalRegularHours += dailyRegularHours;
          totalOvertimeHours += dailyOvertimeHours;
        }
      });
      
      const regularPay = totalRegularHours * hourlyWage;
      const overtimePay = totalOvertimeHours * overtimeRate;
      const grossPay = regularPay + overtimePay;
      
      const taxRate = 0.22;
      const taxes = grossPay * taxRate;
      const netPay = grossPay - taxes + employeeTips;
      
      totalHours += employeeHours;
      totalGrossPay += grossPay;
      totalTips += employeeTips;
      totalTaxes += taxes;
      totalNetPay += netPay;
      
      employeePayroll.push({
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        regularHours: totalRegularHours,
        overtimeHours: totalOvertimeHours,
        regularPay,
        overtimePay,
        grossPay,
        totalTips: employeeTips,
        totalTaxes: taxes,
        netPay,
        hoursWorked: employeeHours,
        hourlyWage,
        overtimeRate,
        shiftsCount: empData.shifts.length,
        tipsCount: empData.tips.length
      });
    }

    // Update period status
    period.status = 'calculated';
    period.payrollEntries = employeePayroll;
    period.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      calculation: {
        summary: {
          totalHours,
          totalGrossPay,
          totalTips,
          totalTaxes,
          totalNetPay,
          employeeCount: employeePayroll.length,
          shiftsCount: shiftsInPeriod.length,
          tipsCount: tipsInPeriod.length
        },
        employees: employeePayroll
      },
      message: 'Payroll calculated successfully'
    });
  } catch (error) {
    console.error('Error calculating payroll:', error);
    res.status(500).json({
      success: false,
      message: 'Server error calculating payroll',
      error: error.message
    });
  }
});

// Employee CSV Import
app.post('/api/employees/import-csv', (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CSV data format'
      });
    }
    
    const importedEmployees = [];
    const errors = [];
    
    csvData.forEach((row, index) => {
      try {
        const { firstName, lastName, email, phone, hourlyRate, role, department, tipEligible, startDate } = row;
        
        // Validate required fields
        if (!firstName || !lastName) {
          errors.push(`Row ${index + 1}: First name and last name are required`);
          return;
        }
        
        if (!email) {
          errors.push(`Row ${index + 1}: Email is required`);
          return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push(`Row ${index + 1}: Invalid email format`);
          return;
        }
        
        // Check for duplicate email
        const existingEmployee = employeesData.find(emp => emp.email.toLowerCase() === email.toLowerCase());
        if (existingEmployee) {
          errors.push(`Row ${index + 1}: Employee with email ${email} already exists`);
          return;
        }
        
        // Validate hourly rate
        const parsedHourlyRate = parseFloat(hourlyRate);
        if (!hourlyRate || isNaN(parsedHourlyRate) || parsedHourlyRate <= 0) {
          errors.push(`Row ${index + 1}: Valid hourly rate is required`);
          return;
        }
        
        // Validate start date if provided
        let employeeStartDate = new Date().toISOString();
        if (startDate) {
          const parsedStartDate = new Date(startDate);
          if (isNaN(parsedStartDate.getTime())) {
            errors.push(`Row ${index + 1}: Invalid start date format`);
            return;
          }
          employeeStartDate = parsedStartDate.toISOString();
        }
        
        // Create employee
        const employee = {
          id: `emp_${nextEmployeeId++}`,
          businessId: businessData?.id || 'default_business',
          employeeNumber: `EMP${String(nextEmployeeId).padStart(4, '0')}`,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone || '',
          hourlyRate: parsedHourlyRate,
          overtimeRate: parsedHourlyRate * 1.5,
          role: role || 'server',
          department: department || 'food service',
          tipEligible: tipEligible === 'true' || tipEligible === 'yes' || tipEligible === '1' || tipEligible !== 'false',
          payType: 'hourly',
          status: 'active',
          startDate: employeeStartDate,
          taxExemptions: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        employeesData.push(employee);
        importedEmployees.push(employee);
        
      } catch (error) {
        errors.push(`Row ${index + 1}: ${error.message}`);
      }
    });
    
    res.json({
      success: true,
      imported: importedEmployees.length,
      errors,
      message: `Successfully imported ${importedEmployees.length} employees`,
    });
  } catch (error) {
    console.error('Error importing employees from CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Server error importing employees',
      error: error.message
    });
  }
});

// Tips CSV Import
app.post('/api/tips/import-csv', (req, res) => {
  try {
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CSV data format'
      });
    }
    
    const importedTips = [];
    const errors = [];
    
    csvData.forEach((row, index) => {
      try {
        const { employeeName, amount, tipType, tableNumber, serverName, timestamp, notes } = row;
        
        // Validate required fields
        if (!amount) {
          errors.push(`Row ${index + 1}: Tip amount is required`);
          return;
        }
        
        // Parse and validate amount
        const parsedAmount = parseFloat(amount.toString().replace(/[$,]/g, ''));
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          errors.push(`Row ${index + 1}: Invalid tip amount format`);
          return;
        }
        
        // Find employee by name if provided
        let employeeId = null;
        if (employeeName && employeeName.trim()) {
          const employee = employeesData.find(emp => {
            const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
            const searchName = employeeName.toLowerCase().trim();
            return fullName === searchName ||
                   emp.firstName.toLowerCase() === searchName ||
                   emp.lastName.toLowerCase() === searchName;
          });
          
          if (employee) {
            employeeId = employee.id;
          } else {
            console.warn(`Employee "${employeeName}" not found for row ${index + 1}`);
          }
        }
        
        // Validate timestamp if provided
        let tipTimestamp = new Date().toISOString();
        if (timestamp) {
          const parsedTimestamp = new Date(timestamp);
          if (isNaN(parsedTimestamp.getTime())) {
            errors.push(`Row ${index + 1}: Invalid timestamp format`);
            return;
          }
          tipTimestamp = parsedTimestamp.toISOString();
        }
        
        // Validate tip type
        const validTipTypes = ['cash', 'credit', 'pos_pretax', 'pos_posttax', 'pos_pooled', 'other'];
        const normalizedTipType = (tipType || 'credit').toLowerCase();
        const finalTipType = validTipTypes.includes(normalizedTipType) ? normalizedTipType : 'credit';
        
        // Create tip entry
        const tip = {
          id: `tip_${nextTipId++}`,
          businessId: businessData?.id || 'default_business',
          employeeId: employeeId,
          shiftId: null,
          amount: parsedAmount,
          tipType: finalTipType,
          source: 'csv_import',
          tableNumber: tableNumber || null,
          serverName: serverName || employeeName || null,
          notes: notes || null,
          timestamp: tipTimestamp,
          processed: false,
          processedAt: null,
          transactionId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        tipsData.push(tip);
        importedTips.push(tip);
        
        // Update shift tip totals if employee has active shifts
        if (employeeId) {
          const recentShifts = shiftsData.filter(shift => 
            shift.employeeId === employeeId && 
            shift.status === 'active' && 
            Math.abs(new Date(shift.startTime).getTime() - new Date(tipTimestamp).getTime()) < 24 * 60 * 60 * 1000 // Within 24 hours
          );
          
          if (recentShifts.length > 0) {
            const latestShift = recentShifts[recentShifts.length - 1];
            latestShift.totalTips += parsedAmount;
            if (finalTipType === 'cash') {
              latestShift.cashTips += parsedAmount;
            } else {
              latestShift.creditCardTips += parsedAmount;
            }
            tip.shiftId = latestShift.id;
          }
        }
        
      } catch (error) {
        errors.push(`Row ${index + 1}: ${error.message}`);
      }
    });
    
    res.json({
      success: true,
      imported: importedTips.length,
      errors,
      message: `Successfully imported ${importedTips.length} tips`,
      integrationInfo: {
        updatedShifts: importedTips.filter(tip => tip.shiftId).length,
        triggeredPayrollPeriods: importedTips.length > 0 ? 'Check payroll periods for potential recalculation' : null
      }
    });
  } catch (error) {
    console.error('Error importing tips from CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Server error importing tips',
      error: error.message
    });
  }
});

app.get('/api/business', (req, res) => {
  res.json({ success: true, data: businessData || {} });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Endpoint not found' });
});

// Start server
app.listen(PORT, 'localhost', () => {
  console.log(`🚀 ShiftMint Backend Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/api/health`);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
}); 