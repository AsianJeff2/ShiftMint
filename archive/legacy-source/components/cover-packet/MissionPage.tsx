import React from 'react';
import { Card } from '@/components/ui/card';
import { DollarSign, BarChart3, Shield } from 'lucide-react';

export const MissionPage: React.FC = () => {
  const features = [
    {
      icon: DollarSign,
      title: "Payroll Clarity",
      description: "Intuitive tools that simplify paychecks"
    },
    {
      icon: BarChart3,
      title: "Tip Transparency", 
      description: "Every tip tracked, every dollar accounted for"
    },
    {
      icon: Shield,
      title: "Compliance Confidence",
      description: "Built-in FLSA, IRS, and state adherence"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col justify-center p-8 print:break-after-page">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold text-foreground">
            Our Mission
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-primary to-accent mx-auto rounded-full"></div>
        </div>

        {/* Mission Statement */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-xl leading-relaxed text-muted-foreground">
            ShiftMint is on a mission to <span className="font-semibold text-foreground">demystify and streamline</span> the 
            payroll and tip documentation process for small businesses. We transform chaos into clarity—automating 
            compliance, protecting your business, and freeing you to focus on what matters: <span className="font-semibold text-primary">your people</span>.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          {features.map((feature, index) => (
            <Card key={index} className="p-8 text-center space-y-4 hover:shadow-lg transition-shadow duration-300 border-muted/50">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                <feature.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>

        {/* Bottom Quote */}
        <div className="text-center pt-12">
          <blockquote className="text-2xl font-medium text-foreground italic">
            "Building trust through transparency, one shift at a time."
          </blockquote>
        </div>
      </div>
    </div>
  );
};