import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CoverPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center p-8 overflow-hidden print:break-after-page">
      {/* Background Geometric Shapes */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full blur-xl"></div>
        <div className="absolute top-40 right-20 w-48 h-48 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg rotate-12 blur-lg"></div>
        <div className="absolute bottom-32 left-1/4 w-24 h-24 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-20 right-1/3 w-40 h-40 bg-gradient-to-br from-primary/15 to-primary/5 rounded-lg -rotate-6 blur-xl"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center space-y-8 max-w-3xl">
        {/* Logo */}
        <div className="flex items-center justify-center space-x-3 mb-12">
          <div className="p-3 bg-gradient-to-br from-primary to-primary/80 rounded-xl shadow-lg">
            <Zap className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            ShiftMint
          </h1>
        </div>

        {/* Tagline */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-primary tracking-wide">
            Tips. Payroll. Clarity.
          </h2>
          
          {/* Subheading */}
          <h3 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
            The Modern Payroll OS for{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Tipped Workforces
            </span>
          </h3>
        </div>

        {/* Description */}
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Transform payroll chaos into clarity with intelligent automation, 
          real-time validation, and audit-proof documentation.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8 print:hidden">
          <Button 
            size="lg" 
            className="px-8 py-3 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
            onClick={() => navigate('/dashboard')}
          >
            Enter ShiftMint
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          
          <Button 
            variant="outline" 
            size="lg" 
            className="px-8 py-3 text-lg font-semibold border-2 hover:bg-accent/10"
            onClick={() => navigate('/login')}
          >
            Demo Login
          </Button>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce print:hidden">
          <div className="w-6 h-10 border-2 border-muted-foreground/30 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-muted-foreground/30 rounded-full mt-2"></div>
          </div>
        </div>
      </div>
    </div>
  );
};