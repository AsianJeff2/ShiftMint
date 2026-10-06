
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  DollarSign, 
  Clock, 
  Calculator, 
  Shield, 
  ArrowRight,
  CheckCircle
} from 'lucide-react';

const Index: React.FC = () => {
  const isDesktop = 'electronAPI' in window;
  const navigate = useNavigate();

  const features = [
    {
      icon: DollarSign,
      title: 'Tip Tracking',
      description: 'Record and manage all your tip income with detailed categorization'
    },
    {
      icon: Clock,
      title: 'Shift Management',
      description: 'Record hours, breaks, and shift rates for reviewed wage estimates'
    },
    {
      icon: Calculator,
      title: 'Payroll Estimates',
      description: 'Review wages and overtime with estimated withholding; payment and tax filing require a payroll provider'
    },
    {
      icon: Shield,
      title: 'Workspace Storage',
      description: isDesktop ? 'Records stay in the desktop workspace; POS features access the selected provider' : 'Records stay on the configured host; POS features access the selected provider'
    }
  ];

  const benefits = [
    'Desktop and hosted workspace options',
    'Business-scoped access to records',
    'Square and Toast data previews',
    'CSV and JSON exports for review',
    'Manual backups and validated restore',
    'Wage and overtime estimates'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center items-center mb-6">
            <div className="h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center">
              <DollarSign className="h-10 w-10 text-white" />
            </div>
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Welcome to <span className="text-blue-600">ShiftMint</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            The tip tracking and payroll review workspace designed
            for restaurant workers and service industry professionals.
          </p>

          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              onClick={() => navigate('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3"
            >
              Open Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/settings')}
              className="px-8 py-3"
            >
              Workspace Settings
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="text-center pb-3">
                <div className="mx-auto h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Review Your Workspace
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Track shifts and tips for your business, then review the resulting wage estimates.
              Hosting and connected providers depend on the deployment you choose.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-blue-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Review your employees, shifts, and tips before calculating a payroll estimate.
          </p>
          
          <div className="flex justify-center gap-4">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/dashboard')}
              className="px-8 py-3"
            >
              Dashboard
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/settings')}
              className="px-8 py-3 border-white text-white hover:bg-white hover:text-blue-600"
            >
              Settings
            </Button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-12 text-gray-500">
          <p className="text-sm">
            ShiftMint v2.1 - Shifts, tips, and payroll review
          </p>
          <p className="text-xs mt-2">
            {isDesktop ? 'Desktop records are stored on this device.' : 'Hosted records are stored on the configured server.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
