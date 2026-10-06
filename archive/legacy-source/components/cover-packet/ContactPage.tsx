import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Globe, Calendar, Github, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ContactPage: React.FC = () => {
  const navigate = useNavigate();

  const contactMethods = [
    {
      icon: Mail,
      label: "Email",
      value: "support@shiftmint.io",
      action: "mailto:support@shiftmint.io"
    },
    {
      icon: Phone,
      label: "Phone",
      value: "1-888-MINT-TIP",
      action: "tel:1-888-646-8847"
    },
    {
      icon: Globe,
      label: "Website",
      value: "www.shiftmint.io",
      action: "https://shiftmint.io"
    },
    {
      icon: Github,
      label: "GitHub",
      value: "github.com/shiftmint",
      action: "https://github.com/shiftmint"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col justify-center p-8 print:break-after-page">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-6">
          <h1 className="text-5xl font-bold text-foreground">
            Let's Get to Work
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-primary to-accent mx-auto rounded-full"></div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Ready to transform your payroll process? Get in touch with our team 
            or try ShiftMint today.
          </p>
        </div>

        {/* Contact Methods */}
        <div className="grid md:grid-cols-2 gap-6">
          {contactMethods.map((contact, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 border-muted/50 group cursor-pointer">
              <a 
                href={contact.action} 
                className="flex items-center space-x-4"
                target={contact.action.startsWith('http') ? '_blank' : undefined}
                rel={contact.action.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <contact.icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{contact.label}</p>
                  <p className="text-foreground font-semibold">{contact.value}</p>
                </div>
              </a>
            </Card>
          ))}
        </div>

        {/* Demo Section */}
        <div className="text-center space-y-8">
          <Card className="p-8 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <div className="space-y-6">
              <div className="flex items-center justify-center space-x-3">
                <Calendar className="h-8 w-8 text-primary" />
                <h3 className="text-2xl font-semibold text-foreground">
                  Ready for a Demo?
                </h3>
              </div>
              
              <p className="text-muted-foreground max-w-2xl mx-auto">
                See ShiftMint in action with your own data. Schedule a personalized 
                demo or try our live demo environment.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center print:hidden">
                <Button 
                  size="lg" 
                  className="px-8 py-3 text-lg font-semibold"
                  onClick={() => navigate('/dashboard')}
                >
                  Live Demo
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="px-8 py-3 text-lg font-semibold border-2"
                  onClick={() => window.open('https://calendly.com/shiftmint-demo', '_blank')}
                >
                  Schedule Demo
                </Button>
              </div>
            </div>
          </Card>

          {/* QR Code Section */}
          <div className="flex justify-center print:block hidden">
            <Card className="p-6 inline-block">
              <div className="text-center space-y-4">
                <QrCode className="h-24 w-24 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Scan for Live Demo
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center pt-8">
          <p className="text-lg text-muted-foreground">
            Questions? We're here to help. Reach out anytime.
          </p>
        </div>
      </div>
    </div>
  );
};