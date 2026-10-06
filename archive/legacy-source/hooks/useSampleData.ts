
import { useState } from 'react';

export const useSampleData = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const generateSampleData = async () => {
    setIsGenerating(true);
    // Mock implementation - in a real app this would generate sample data
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsGenerating(false);
    return { success: true };
  };
  
  return {
    generateSampleData,
    isGenerating
  };
};
