import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'light' | 'dark';
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className, 
  size = 'md', 
  variant = 'default', 
  showText = true 
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl'
  };

  const logoColors = {
    default: 'from-blue-600 to-blue-800',
    light: 'from-white to-gray-100',
    dark: 'from-gray-800 to-gray-900'
  };

  const textColors = {
    default: 'text-foreground',
    light: 'text-white',
    dark: 'text-gray-900'
  };

  return (
    <div className={cn("flex items-center space-x-3", className)}>
      <div className={cn(
        "relative rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl",
        `bg-gradient-to-br ${logoColors[variant]}`,
        sizeClasses[size]
      )}>
        {/* Custom ShiftMint Logo Design */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 32 32"
            className="w-3/4 h-3/4 text-white"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Clock/Time Element */}
            <circle 
              cx="16" 
              cy="16" 
              r="12" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5"
              className="opacity-90"
            />
            
            {/* Clock Hands */}
            <line 
              x1="16" 
              y1="16" 
              x2="16" 
              y2="8" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round"
            />
            <line 
              x1="16" 
              y1="16" 
              x2="22" 
              y2="16" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round"
            />
            
            {/* Dollar Sign in Center */}
            <path 
              d="M14 11h4M14 21h4M16 9v14M18 11c0-1.1-.9-2-2-2s-2 .9-2 2M16 19c1.1 0 2-.9 2-2s-.9-2-2-2h-2c-1.1 0-2-.9-2-2s.9-2 2-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-80"
            />
          </svg>
        </div>
        
        {/* Accent dots */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full shadow-md"></div>
        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-gradient-to-br from-green-400 to-green-600 rounded-full shadow-md"></div>
      </div>
      
      {showText && (
        <div className="flex flex-col">
          <span className={cn(
            "font-bold tracking-tight",
            textSizeClasses[size],
            textColors[variant]
          )}>
            ShiftMint
          </span>
          {size === 'lg' || size === 'xl' ? (
            <span className={cn(
              "text-xs font-medium tracking-wide opacity-75",
              textColors[variant]
            )}>
              PAYROLL OS
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default Logo; 