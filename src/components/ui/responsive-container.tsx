import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { responsive } from '@/lib/responsive-config';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'main' | 'article';
  variant?: 'container' | 'section' | 'page';
}

export const ResponsiveContainer = ({ 
  children, 
  className = '', 
  as: Component = 'div',
  variant = 'container'
}: ResponsiveContainerProps) => {
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'container':
        return 'container mx-auto px-4 md:px-8 lg:px-12';
      case 'section':
        return 'container mx-auto px-4 md:px-8 lg:px-12 py-8 md:py-12 lg:py-16';
      case 'page':
        return 'min-h-screen px-4 md:px-8 lg:px-12 py-8 md:py-12';
      default:
        return 'container mx-auto px-4 md:px-8 lg:px-12';
    }
  };

  return (
    <Component className={cn(getVariantClasses(), className)}>
      {children}
    </Component>
  );
};

// Componentes específicos baseados no ResponsiveContainer
export const PageContainer = ({ children, className }: { children: ReactNode; className?: string }) => (
  <ResponsiveContainer variant="page" className={className}>
    {children}
  </ResponsiveContainer>
);

export const SectionContainer = ({ children, className }: { children: ReactNode; className?: string }) => (
  <ResponsiveContainer variant="section" as="section" className={className}>
    {children}
  </ResponsiveContainer>
);

// Títulos responsivos padronizados
interface ResponsiveTitleProps {
  children: ReactNode;
  className?: string;
  variant?: 'hero' | 'section' | 'subsection' | 'card';
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const ResponsiveTitle = ({ 
  children, 
  className = '', 
  variant = 'section',
  as: Component = 'h2'
}: ResponsiveTitleProps) => {
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'hero':
        return responsive.hero();
      case 'section':
        return responsive.sectionTitle();
      case 'subsection':
        return responsive.subsectionTitle();
      case 'card':
        return responsive.cardTitle();
      default:
        return responsive.sectionTitle();
    }
  };

  return (
    <Component className={cn(getVariantClasses(), className)}>
      {children}
    </Component>
  );
};

// Texto responsivo padronizado
interface ResponsiveTextProps {
  children: ReactNode;
  className?: string;
  variant?: 'body' | 'small';
  as?: 'p' | 'span' | 'div';
}

export const ResponsiveText = ({ 
  children, 
  className = '', 
  variant = 'body',
  as: Component = 'p'
}: ResponsiveTextProps) => {
  
  const getVariantClasses = () => {
    switch (variant) {
      case 'body':
        return responsive.bodyText();
      case 'small':
        return responsive.smallText();
      default:
        return responsive.bodyText();
    }
  };

  return (
    <Component className={cn(getVariantClasses(), className)}>
      {children}
    </Component>
  );
}; 