import React from 'react';
import { Card } from '@/components/ui/card';
import { ArrowRight, Clock, CheckCircle, FileText } from 'lucide-react';

export const WhatIsShiftMintPage: React.FC = () => {
  const features = [
    "Real-time payroll validation using TIEE (Time-Entry Integrity Engine)",
    "Immutable audit logs for IRS/FLSA review",
    "Manager dashboards with flag resolution tools", 
    "Automatic tip-pool balancing and anomaly detection"
  ];

  const flowSteps = [
    { icon: Clock, label: "Timecards", color: "from-slate-500 to-slate-600" },
    { icon: CheckCircle, label: "ShiftMint", color: "from-primary to-primary/80" },
    { icon: FileText, label: "Paycheck", color: "from-accent to-accent/80" }
  ];

  return (
    <div className="min-h-screen flex flex-col justify-center p-8 print:break-after-page">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold text-foreground">
            What is ShiftMint?
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-primary to-accent mx-auto rounded-full"></div>
        </div>

        {/* Summary */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xl leading-relaxed text-muted-foreground">
            ShiftMint is an <span className="font-semibold text-foreground">all-in-one payroll validation, tip tracking, 
            and shift documentation platform</span> built for small business owners, especially in 
            <span className="font-semibold text-primary"> hospitality and service industries</span>.
          </p>
        </div>

        {/* Process Flow */}
        <Card className="p-8 bg-gradient-to-r from-background to-muted/20 border-muted/50">
          <h3 className="text-2xl font-semibold text-center mb-8 text-foreground">How It Works</h3>
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {flowSteps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="text-center space-y-3">
                  <div className={`w-16 h-16 bg-gradient-to-br ${step.color} rounded-full flex items-center justify-center shadow-lg`}>
                    <step.icon className="h-8 w-8 text-white" />
                  </div>
                  <p className="font-medium text-foreground">{step.label}</p>
                </div>
                {index < flowSteps.length - 1 && (
                  <ArrowRight className="h-6 w-6 text-muted-foreground mx-6" />
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Key Features */}
        <div className="space-y-6">
          <h3 className="text-2xl font-semibold text-center text-foreground">Key Features</h3>
          <div className="grid gap-4 max-w-3xl mx-auto">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 rounded-lg hover:bg-muted/20 transition-colors">
                <CheckCircle className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground leading-relaxed">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center pt-8">
          <p className="text-lg text-muted-foreground">
            Purpose-built for the unique challenges of <span className="font-semibold text-primary">tipped workforces</span>
          </p>
        </div>
      </div>
    </div>
  );
};