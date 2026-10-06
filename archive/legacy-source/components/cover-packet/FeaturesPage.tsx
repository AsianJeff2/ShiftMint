import React from 'react';
import { Card } from '@/components/ui/card';
import { Search, Calculator, FileCheck, Brain } from 'lucide-react';

export const FeaturesPage: React.FC = () => {
  const features = [
    {
      icon: Search,
      title: "TIEE (Time-Entry Integrity Engine)",
      description: "Flag and resolve anomalies before they become liabilities",
      color: "from-primary to-primary/80"
    },
    {
      icon: Calculator,
      title: "Smart Tip Logic", 
      description: "Sales-to-tip ratio calculators and warning flags",
      color: "from-accent to-accent/80"
    },
    {
      icon: FileCheck,
      title: "Audit-Proof Logs",
      description: "Immutable shift records for peace of mind",
      color: "from-slate-500 to-slate-600"
    },
    {
      icon: Brain,
      title: "Human-in-the-loop AI",
      description: "Learns your workplace's unique rhythms",
      color: "from-emerald-500 to-emerald-600"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col justify-center p-8 print:break-after-page">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold text-foreground">
            Features That Matter
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-primary to-accent mx-auto rounded-full"></div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built specifically for the complexities of tip-based businesses
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="p-8 space-y-6 hover:shadow-xl transition-all duration-300 border-muted/50 group">
              <div className="flex items-center space-x-4">
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
              </div>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>

        {/* Bottom Section */}
        <div className="text-center pt-12 space-y-6">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-8 border border-muted/50">
            <h3 className="text-2xl font-semibold text-foreground mb-4">
              Why ShiftMint?
            </h3>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Traditional payroll systems weren't built for the hospitality industry. ShiftMint understands 
              the unique challenges of tip pools, split shifts, and complex wage calculations. We don't just 
              process payroll—we <span className="font-semibold text-primary">protect your business</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};