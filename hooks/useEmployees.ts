import { useData } from '@/contexts/DataContext';

export const useEmployees = () => {
  const {
    employees, loadingEmployees, errorEmployees,
    createEmployee, updateEmployee, deleteEmployee, getEmployees,
  } = useData();

  return {
    employees,
    loading: loadingEmployees,
    error: errorEmployees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    refreshEmployees: getEmployees,
  };
};
