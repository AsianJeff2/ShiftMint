import React from 'react';
import { EmployeeList } from '@/components/employees/EmployeeList';
import { EmployeeCSVImport } from '@/components/employees/EmployeeCSVImport';

const Employees: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <EmployeeList />
    </div>
  );
};

export default Employees; 