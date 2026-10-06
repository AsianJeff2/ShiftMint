import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { DataProvider } from '@/contexts/DataContext';
import { LocalAuthProvider } from '@/contexts/LocalAuthContext';

interface AllTheProvidersProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that provides all necessary contexts for testing
 */
const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  return (
    <MemoryRouter>
      <LocalAuthProvider>
        <DataProvider>
          {children}
        </DataProvider>
      </LocalAuthProvider>
    </MemoryRouter>
  );
};

/**
 * Custom render function that wraps components with all necessary providers
 * Use this instead of plain render() from @testing-library/react
 */
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything from @testing-library/react
export * from '@testing-library/react';
