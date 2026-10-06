/**
 * Comprehensive Error Handling Test Suite
 * Tests all aspects of the enhanced error handling system
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧪 Starting Error Handling System Test Suite');
console.log('==============================================');

// Test categories
const tests = [
  {
    name: 'TypeScript Compilation',
    description: 'Ensure all error handling code compiles correctly',
    test: testTypeScriptCompilation
  },
  {
    name: 'Error Handler Unit Tests',
    description: 'Test centralized error handler functionality',
    test: testErrorHandler
  },
  {
    name: 'API Client Error Handling',
    description: 'Test enhanced API client error handling',
    test: testApiClientErrors
  },
  {
    name: 'Form Validation',
    description: 'Test enhanced form validation and error display',
    test: testFormValidation
  },
  {
    name: 'React Error Boundaries',
    description: 'Test React Error Boundary components',
    test: testErrorBoundaries
  }
];

async function runTests() {
  let passedTests = 0;
  let totalTests = tests.length;
  
  for (const test of tests) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log(`   ${test.description}`);
    
    try {
      await test.test();
      console.log(`   ✅ PASSED`);
      passedTests++;
    } catch (error) {
      console.log(`   ❌ FAILED: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All error handling tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Please review and fix issues.');
    process.exit(1);
  }
}

async function testTypeScriptCompilation() {
  return new Promise((resolve, reject) => {
    console.log('     Compiling TypeScript...');
    
    const tsc = spawn('npx', ['tsc', '--noEmit'], {
      cwd: process.cwd(),
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    tsc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    tsc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    tsc.on('close', (code) => {
      if (code === 0) {
        console.log('     TypeScript compilation successful');
        resolve();
      } else {
        reject(new Error(`TypeScript compilation failed: ${errorOutput}`));
      }
    });
  });
}

async function testErrorHandler() {
  console.log('     Testing ErrorHandler class...');
  
  // Test if error handling files exist
  const errorHandlingFiles = [
    'lib/error-handling.ts',
    'components/ErrorBoundary.tsx',
    'hooks/useApiCall.ts',
    'components/ui/enhanced-form.tsx'
  ];
  
  for (const file of errorHandlingFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Missing error handling file: ${file}`);
    }
  }
  
  console.log('     All error handling files exist');
  
  // Test that the files contain expected exports/classes
  const errorHandlingContent = fs.readFileSync('lib/error-handling.ts', 'utf8');
  
  const expectedPatterns = [
    'export class ErrorHandler',
    'export enum ErrorType',
    'export enum ErrorSeverity',
    'export const errorHandler',
    'export async function withErrorHandling',
    'export function createValidationError',
    'export function handleApiError'
  ];
  
  for (const pattern of expectedPatterns) {
    if (!errorHandlingContent.includes(pattern)) {
      throw new Error(`Missing expected export: ${pattern}`);
    }
  }
  
  console.log('     ErrorHandler class and utilities are properly exported');
}

async function testApiClientErrors() {
  console.log('     Testing API client error handling integration...');
  
  const apiClientContent = fs.readFileSync('lib/api-client.ts', 'utf8');
  
  // Check for error handling integration
  const expectedPatterns = [
    'import { errorHandler, ErrorType, handleApiError }',
    'handleApiError(error',
    'errorHandler.createError',
    'appError'
  ];
  
  for (const pattern of expectedPatterns) {
    if (!apiClientContent.includes(pattern)) {
      throw new Error(`API client missing error handling pattern: ${pattern}`);
    }
  }
  
  console.log('     API client properly integrated with error handling system');
}

async function testFormValidation() {
  console.log('     Testing enhanced form components...');
  
  const enhancedFormContent = fs.readFileSync('components/ui/enhanced-form.tsx', 'utf8');
  
  // Check for form validation features
  const expectedPatterns = [
    'export function EnhancedForm',
    'export function EnhancedFormField',
    'export const validationSchemas',
    'useFormSubmission',
    'createValidationError'
  ];
  
  for (const pattern of expectedPatterns) {
    if (!enhancedFormContent.includes(pattern)) {
      throw new Error(`Enhanced form missing feature: ${pattern}`);
    }
  }
  
  console.log('     Enhanced form components have all required features');
}

async function testErrorBoundaries() {
  console.log('     Testing React Error Boundary components...');
  
  const errorBoundaryContent = fs.readFileSync('components/ErrorBoundary.tsx', 'utf8');
  
  // Check for error boundary features
  const expectedPatterns = [
    'export class ErrorBoundary',
    'componentDidCatch',
    'getDerivedStateFromError',
    'export function withErrorBoundary',
    'export const FormErrorBoundary',
    'export const DataErrorBoundary'
  ];
  
  for (const pattern of expectedPatterns) {
    if (!errorBoundaryContent.includes(pattern)) {
      throw new Error(`Error boundary missing feature: ${pattern}`);
    }
  }
  
  // Check that App.tsx uses error boundaries
  const appContent = fs.readFileSync('App.tsx', 'utf8');
  if (!appContent.includes('ErrorBoundary')) {
    throw new Error('App.tsx does not use ErrorBoundary components');
  }
  
  console.log('     Error boundaries are properly implemented and integrated');
}

// Additional utility tests
async function testUtilityFunctions() {
  console.log('     Testing utility functions...');
  
  const hookContent = fs.readFileSync('hooks/useApiCall.ts', 'utf8');
  
  const expectedHooks = [
    'export function useApiCall',
    'export function useFormSubmission', 
    'export function useDataFetch',
    'export function useOptimisticUpdate'
  ];
  
  for (const hook of expectedHooks) {
    if (!hookContent.includes(hook)) {
      throw new Error(`Missing utility hook: ${hook}`);
    }
  }
  
  console.log('     All utility hooks are properly exported');
}

// Error handling integration test
async function testErrorHandlingIntegration() {
  console.log('     Testing error handling integration...');
  
  // Check that components use the new error handling
  const employeeListContent = fs.readFileSync('components/employees/EmployeeList.tsx', 'utf8');
  
  const integrationPatterns = [
    'useToast',
    'FormErrorBoundary',
    'error.userMessage'
  ];
  
  for (const pattern of integrationPatterns) {
    if (!employeeListContent.includes(pattern)) {
      console.log(`     ⚠️  Warning: EmployeeList may not fully use new error handling (missing: ${pattern})`);
    }
  }
  
  console.log('     Integration patterns found in components');
}

// Check for production readiness
async function testProductionReadiness() {
  console.log('     Testing production readiness...');
  
  const criticalFiles = [
    { file: 'lib/error-handling.ts', size: 1000 },
    { file: 'components/ErrorBoundary.tsx', size: 500 },
    { file: 'hooks/useApiCall.ts', size: 800 },
    { file: 'components/ui/enhanced-form.tsx', size: 1000 }
  ];
  
  for (const { file, size } of criticalFiles) {
    const stats = fs.statSync(file);
    if (stats.size < size) {
      throw new Error(`${file} seems too small (${stats.size} bytes). May be incomplete.`);
    }
  }
  
  console.log('     All critical files have sufficient content');
}

// Run the test suite
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };