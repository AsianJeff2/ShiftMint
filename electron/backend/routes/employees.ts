import { logger } from '../../../lib/infrastructure/Logger';
import { Router } from 'express';
import { managedRouter } from '../middleware/request-lifecycle';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../database';
import { protect } from './auth';
import {
  CreateEmployeeRequestSchema,
  UpdateEmployeeRequestSchema,
  validateRequest,
  type ApiResponse,
} from '../../../lib/types/api-dtos';
import { AuthenticatedRequest, IdParamRequest, getBusinessId } from '../types/express';
import { randomUUID } from 'node:crypto';
import { employeeResponse, encryptedBankFields } from '../middleware/sensitive-fields';

const router = managedRouter();

// @route   GET /api/employees
// @desc    Get all employees
// @access  Private
router.get('/', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const businessId = getBusinessId(req);

    const employees = await prisma.employee.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      employees: employees.map(employeeResponse),
      count: employees.length
    });
  } catch (error) {
    logger.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employees'
    });
  }
});

// @route   GET /api/employees/:id
// @desc    Get employee by ID
// @access  Private
router.get('/:id', protect, async (req: IdParamRequest, res, next) => {
  if (req.params.id === 'stats') { next(); return; }
  try {
    const prisma = getPrismaClient();
    const { id } = req.params;

    const employee = await prisma.employee.findFirst({
      where: { 
        id, 
        businessId: getBusinessId(req) 
      }
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    res.json({
      success: true,
      employee: employeeResponse(employee)
    });
  } catch (error) {
    logger.error('Error fetching employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employee'
    });
  }
});

// @route   POST /api/employees
// @desc    Create new employee
// @access  Private
router.post('/', protect, async (req: AuthenticatedRequest, res) => {
  try {
    // Validate request body with shared DTO
    const validation = validateRequest(CreateEmployeeRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const validatedData = validation.data;
    const prisma = getPrismaClient();

    // Check if employee with email already exists
    const existingEmployee = await prisma.employee.findFirst({
      where: {
        email: validatedData.email,
        businessId: getBusinessId(req)
      }
    });

    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'Employee with this email already exists'
      });
    }

    // Generate employee number
    const employeeNumber = `EMP-${randomUUID()}`;

    // Create employee with auto-calculated overtime rate
    const createData: Prisma.EmployeeUncheckedCreateInput = {
      ...encryptedBankFields(validatedData),
      businessId: getBusinessId(req),
      employeeNumber,
      startDate: new Date(validatedData.startDate),
      ...(validatedData.terminationDate !== undefined ? { terminationDate: new Date(validatedData.terminationDate) } : {}),
    };
    
    // Always calculate overtime rate as 1.5x hourly rate
    if (createData.hourlyRate) {
      createData.overtimeRate = createData.hourlyRate * 1.5;
    }
    
    const employee = await prisma.employee.create({
      data: createData
    });

    res.status(201).json({
      success: true,
      employee: employeeResponse(employee),
      message: 'Employee created successfully'
    });
  } catch (error) {
    logger.error('Error creating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating employee'
    });
  }
});

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private
router.put('/:id', protect, async (req: IdParamRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { id } = req.params;

    // Validate request body with shared DTO
    const validation = validateRequest(UpdateEmployeeRequestSchema, req.body);

    if (validation.success === false) {
      return res.status(400).json({
        success: false,
        errors: validation.errors,
      });
    }

    const validatedData = validation.data;

    // Check if employee exists
    const existingEmployee = await prisma.employee.findFirst({
      where: { 
        id, 
        businessId: getBusinessId(req) 
      }
    });

    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Check email uniqueness if email is being updated
    if (validatedData.email && validatedData.email !== existingEmployee.email) {
      const emailExists = await prisma.employee.findFirst({
        where: {
          email: validatedData.email,
          businessId: getBusinessId(req),
          id: { not: id }
        }
      });

      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Employee with this email already exists'
        });
      }
    }

    // Update employee with auto-calculated overtime rate
    const updateData: Prisma.EmployeeUpdateInput = { ...encryptedBankFields(validatedData) };
    if (validatedData.startDate) {
      updateData.startDate = new Date(validatedData.startDate);
    }
    if (validatedData.terminationDate !== undefined) updateData.terminationDate = new Date(validatedData.terminationDate);
    
    // Always recalculate overtime rate when hourly rate changes
    if (typeof updateData.hourlyRate === 'number') {
      updateData.overtimeRate = updateData.hourlyRate * 1.5;
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      employee: employeeResponse(employee),
      message: 'Employee updated successfully'
    });
  } catch (error) {
    logger.error('Error updating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating employee'
    });
  }
});

// @route   DELETE /api/employees/:id
// @desc    Delete employee (soft delete - mark as terminated)
// @access  Private
router.delete('/:id', protect, async (req: IdParamRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { id } = req.params;

    // Check if employee exists
    const existingEmployee = await prisma.employee.findFirst({
      where: { 
        id, 
        businessId: getBusinessId(req) 
      }
    });

    if (!existingEmployee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    // Soft delete by marking as terminated
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        status: 'terminated',
        terminationDate: new Date()
      }
    });

    res.json({
      success: true,
      employee: employeeResponse(employee),
      message: 'Employee terminated successfully'
    });
  } catch (error) {
    logger.error('Error terminating employee:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while terminating employee'
    });
  }
});

// @route   GET /api/employees/stats
// @desc    Get employee statistics
// @access  Private
router.get('/stats', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();

    const stats = await prisma.employee.groupBy({
      by: ['status'],
      where: { businessId: getBusinessId(req) },
      _count: true
    });

    const totalEmployees = await prisma.employee.count({
      where: { businessId: getBusinessId(req) }
    });

    const activeEmployees = await prisma.employee.count({
      where: { 
        businessId: getBusinessId(req),
        status: 'active'
      }
    });

    const tipEligibleEmployees = await prisma.employee.count({
      where: { 
        businessId: getBusinessId(req),
        status: 'active',
        tipEligible: true
      }
    });

    res.json({
      success: true,
      stats: {
        total: totalEmployees,
        active: activeEmployees,
        tipEligible: tipEligibleEmployees,
        byStatus: stats.reduce((acc: Record<string, number>, stat: any) => {
          acc[stat.status] = stat._count;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    logger.error('Error fetching employee stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching employee statistics'
    });
  }
});

// CSV Import validation schema
const csvEmployeeSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional(),
  hourlyRate: z.string().transform((val) => Number(val)).pipe(z.number().finite().positive()),
  role: z.string().default('server'),
  department: z.string().default('food service'),
  tipEligible: z.boolean(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Actual hire date must use YYYY-MM-DD').refine(val => Number.isFinite(Date.parse(val)) && new Date(val).toISOString().slice(0, 10) === val, 'Actual hire date must be a valid calendar date'),
});

// @route   POST /api/employees/import-csv
// @desc    Import employees from CSV data
// @access  Private
router.post('/import-csv', protect, async (req: AuthenticatedRequest, res) => {
  try {
    const prisma = getPrismaClient();
    const { csvData } = req.body;
    
    if (!csvData || !Array.isArray(csvData)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid CSV data format'
      });
    }
    
    const businessId = getBusinessId(req);
    if (!businessId) {
      return res.status(400).json({ message: 'Business ID not found in token' });
    }
    
    const importedEmployees = [];
    const errors = [];
    
    for (let index = 0; index < csvData.length; index++) {
      const row = csvData[index];
      
      try {
        const validatedRow = csvEmployeeSchema.parse(row);
        
        // Check for duplicate email within the business
        const existingEmployee = await prisma.employee.findFirst({
          where: {
            businessId,
            email: validatedRow.email
          }
        });
        
        if (existingEmployee) {
          errors.push(`Row ${index + 1}: Employee with email ${validatedRow.email} already exists`);
          continue;
        }
        
        // Generate employee number
        const employeeNumber = `EMP-${randomUUID()}`;
        
        // Create employee
        const employee = await prisma.employee.create({
          data: {
            businessId,
            employeeNumber,
            firstName: validatedRow.firstName,
            lastName: validatedRow.lastName,
            email: validatedRow.email,
            phone: validatedRow.phone,
            hourlyRate: validatedRow.hourlyRate,
            overtimeRate: validatedRow.hourlyRate * 1.5,
            role: validatedRow.role,
            department: validatedRow.department,
            tipEligible: validatedRow.tipEligible,
            payType: 'hourly',
            status: 'active',
            startDate: new Date(validatedRow.startDate),
            taxExemptions: 0,
          },
        });
        
        importedEmployees.push(employee);
        
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          errors.push(`Row ${index + 1}: ${validationError.issues.map(i => i.message).join(', ')}`);
        } else {
          errors.push(`Row ${index + 1}: ${validationError instanceof Error ? validationError.message : 'Unknown error'}`);
        }
      }
    }
    
    res.json({
      success: true,
      imported: importedEmployees.length,
      errors,
      message: `Successfully imported ${importedEmployees.length} employees`,
    });
  } catch (error) {
    logger.error('Error importing employees from CSV:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error importing employees',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
