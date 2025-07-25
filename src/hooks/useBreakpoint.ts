'use client';

import { useState, useEffect } from 'react';
import { breakpoints } from '@/lib/responsive-config';

type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export const useBreakpoint = (): Breakpoint => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      
      if (width <= breakpoints.mobileMax) {
        setBreakpoint('mobile');
      } else if (width <= breakpoints.tabletMax) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    // Definir breakpoint inicial
    updateBreakpoint();

    // Listener para mudanças de tamanho
    window.addEventListener('resize', updateBreakpoint);
    
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
};

// Hook para verificar breakpoint específico
export const useIsMobile = (): boolean => {
  const breakpoint = useBreakpoint();
  return breakpoint === 'mobile';
};

export const useIsTablet = (): boolean => {
  const breakpoint = useBreakpoint();
  return breakpoint === 'tablet';
};

export const useIsDesktop = (): boolean => {
  const breakpoint = useBreakpoint();
  return breakpoint === 'desktop';
}; 