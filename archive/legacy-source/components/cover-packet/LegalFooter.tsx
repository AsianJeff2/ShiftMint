import React from 'react';

export const LegalFooter: React.FC = () => {
  return (
    <div className="py-12 text-center space-y-4 border-t border-muted/30 print:break-before-page">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">
          ShiftMint v1.0 • © 2025 ShiftMint, Inc.
        </p>
        <p className="text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          All rights reserved. For informational purposes only. Data integrity and 
          compliance features vary by implementation. This document is confidential 
          and proprietary to ShiftMint, Inc.
        </p>
      </div>
      
      <div className="flex justify-center space-x-6 text-xs text-muted-foreground">
        <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
        <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
        <a href="#" className="hover:text-primary transition-colors">Security</a>
        <a href="#" className="hover:text-primary transition-colors">Compliance</a>
      </div>
    </div>
  );
};