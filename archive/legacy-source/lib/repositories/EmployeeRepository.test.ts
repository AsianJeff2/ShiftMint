import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEmployeeRepository } from './InMemoryEmployeeRepository';
import type { CreateEmployeeData } from './IEmployeeRepository';

describe('EmployeeRepository', () => {
  let repository: InMemoryEmployeeRepository;
  const businessId = 'biz_test123';

  beforeEach(() => {
    repository = new InMemoryEmployeeRepository();
  });

  describe('create', () => {
    it('creates employee with all fields', async () => {
      const employeeData: CreateEmployeeData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        hourlyRate: 15.0,
        role: 'server',
        startDate: new Date('2024-01-01'),
      };

      const employee = await repository.create(employeeData, businessId);

      expect(employee.id).toBeTruthy();
      expect(employee.firstName).toBe('John');
      expect(employee.lastName).toBe('Doe');
      expect(employee.email).toBe('john@example.com');
      expect(employee.hourlyRate).toBe(15.0);
      expect(employee.businessId).toBe(businessId);
      expect(employee.status).toBe('active');
      expect(employee.tipEligible).toBe(true);
    });

    it('sets default overtime rate to 1.5x hourly', async () => {
      const employeeData: CreateEmployeeData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        hourlyRate: 20.0,
        role: 'bartender',
        startDate: new Date('2024-01-01'),
      };

      const employee = await repository.create(employeeData, businessId);

      expect(employee.overtimeRate).toBe(30.0); // 20 * 1.5
    });

    it('allows custom overtime rate', async () => {
      const employeeData: CreateEmployeeData = {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@example.com',
        hourlyRate: 25.0,
        overtimeRate: 50.0, // Custom rate
        role: 'manager',
        startDate: new Date('2024-01-01'),
      };

      const employee = await repository.create(employeeData, businessId);

      expect(employee.overtimeRate).toBe(50.0);
    });
  });

  describe('findById', () => {
    it('returns employee by ID', async () => {
      const created = await repository.create(
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          hourlyRate: 15.0,
          role: 'server',
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      const found = await repository.findById(created.id, businessId);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe('john@example.com');
    });

    it('returns null for non-existent ID', async () => {
      const found = await repository.findById('nonexistent', businessId);

      expect(found).toBeNull();
    });

    it('returns null for wrong business ID', async () => {
      const created = await repository.create(
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          hourlyRate: 15.0,
          role: 'server',
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      const found = await repository.findById(created.id, 'biz_different');

      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('returns employee by email', async () => {
      await repository.create(
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          hourlyRate: 15.0,
          role: 'server',
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      const found = await repository.findByEmail('john@example.com', businessId);

      expect(found).not.toBeNull();
      expect(found?.email).toBe('john@example.com');
    });

    it('returns null for non-existent email', async () => {
      const found = await repository.findByEmail('nonexistent@example.com', businessId);

      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns all employees for business', async () => {
      await repository.create(
        {
          firstName: 'Alice',
          lastName: 'Anderson',
          email: 'alice@example.com',
          hourlyRate: 15.0,
          role: 'server',
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      await repository.create(
        {
          firstName: 'Bob',
          lastName: 'Brown',
          email: 'bob@example.com',
          hourlyRate: 18.0,
          role: 'bartender',
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      const employees = await repository.findAll(businessId);

      expect(employees).toHaveLength(2);
      // Should be sorted by last name
      expect(employees[0]!.lastName).toBe('Anderson');
      expect(employees[1]!.lastName).toBe('Brown');
    });

    it('filters by business ID', async () => {
      await repository.create(
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          hourlyRate: 15.0,
          role: 'server',
          startDate: new Date('2024-01-01'),
        },
        'biz_1'
      );

      await repository.create(
        {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          hourlyRate: 18.0,
          role: 'server',
          startDate: new Date('2024-01-01'),
        },
        'biz_2'
      );

      const business1Employees = await repository.findAll('biz_1');
      const business2Employees = await repository.findAll('biz_2');

      expect(business1Employees).toHaveLength(1);
      expect(business2Employees).toHaveLength(1);
      expect(business1Employees[0]!.email).toBe('john@example.com');
      expect(business2Employees[0]!.email).toBe('jane@example.com');
    });
  });

  describe('findActive', () => {
    it('returns only active employees', async () => {
      await repository.create(
        {
          firstName: 'Active',
          lastName: 'Employee',
          email: 'active@example.com',
          hourlyRate: 15.0,
          role: 'server',
          status: 'active',
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      await repository.create(
        {
          firstName: 'Inactive',
          lastName: 'Employee',
          email: 'inactive@example.com',
          hourlyRate: 15.0,
          role: 'server',
          status: 'inactive',
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      const activeEmployees = await repository.findActive(businessId);

      expect(activeEmployees).toHaveLength(1);
      expect(activeEmployees[0]!.status).toBe('active');
    });
  });

  describe('findTipEligible', () => {
    it('returns only tip-eligible active employees', async () => {
      await repository.create(
        {
          firstName: 'Server',
          lastName: 'One',
          email: 'server1@example.com',
          hourlyRate: 15.0,
          role: 'server',
          tipEligible: true,
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      await repository.create(
        {
          firstName: 'Cook',
          lastName: 'One',
          email: 'cook1@example.com',
          hourlyRate: 18.0,
          role: 'cook',
          tipEligible: false,
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      const tipEligible = await repository.findTipEligible(businessId);

      expect(tipEligible).toHaveLength(1);
      expect(tipEligible[0]!.tipEligible).toBe(true);
    });
  });

  describe('update', () => {
    it('updates employee fields', async () => {
      const created = await repository.create(
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          hourlyRate: 15.0,
          role: 'server',
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      const updated = await repository.update(
        created.id,
        {
          hourlyRate: 18.0,
          role: 'bartender',
        },
        businessId
      );

      expect(updated.hourlyRate).toBe(18.0);
      expect(updated.role).toBe('bartender');
      expect(updated.firstName).toBe('John'); // Unchanged fields preserved
    });

    it('throws error for non-existent employee', async () => {
      await expect(
        repository.update('nonexistent', { hourlyRate: 20.0 }, businessId)
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('soft deletes employee (sets status to inactive)', async () => {
      const created = await repository.create(
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          hourlyRate: 15.0,
          role: 'server',
          startDate: new Date('2024-01-01'),
        },
        businessId
      );

      await repository.delete(created.id, businessId);

      const found = await repository.findById(created.id, businessId);
      expect(found).not.toBeNull();
      expect(found?.status).toBe('inactive');
      expect(found?.terminationDate).toBeTruthy();
    });

    it('throws error for non-existent employee', async () => {
      await expect(repository.delete('nonexistent', businessId)).rejects.toThrow();
    });
  });
});
