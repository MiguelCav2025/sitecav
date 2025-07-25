// Configuração de Responsividade do Site CAV
// Sistema mobile-first com breakpoints, espaçamentos e tipografia consistentes

export const breakpoints = {
  mobile: '0px',     // 0-640px
  tablet: '641px',   // 641-1024px  
  desktop: '1025px', // 1025px+
  
  // Valores numéricos para uso em JS
  mobileMax: 640,
  tabletMin: 641,
  tabletMax: 1024,
  desktopMin: 1025,
} as const;

// Sistema de espaçamentos responsivos baseado em múltiplos de 4px
export const spacing = {
  // Containers principais
  container: {
    mobile: 'px-4',      // 16px laterais
    tablet: 'px-8',      // 32px laterais  
    desktop: 'px-12',    // 48px laterais
  },
  
  // Seções e componentes
  section: {
    mobile: 'py-8',      // 32px vertical
    tablet: 'py-12',     // 48px vertical
    desktop: 'py-16',    // 64px vertical
  },
  
  // Cards e elementos
  card: {
    mobile: 'p-4',       // 16px interno
    tablet: 'p-6',       // 24px interno
    desktop: 'p-8',      // 32px interno
  },
  
  // Gaps entre elementos
  gap: {
    mobile: 'gap-4',     // 16px
    tablet: 'gap-6',     // 24px  
    desktop: 'gap-8',    // 32px
  }
} as const;

// Sistema de tipografia responsiva
export const typography = {
  // Títulos principais (h1)
  hero: {
    mobile: 'text-3xl',     // 30px
    tablet: 'text-4xl',     // 36px
    desktop: 'text-5xl',    // 48px
    weight: 'font-extrabold',
    lineHeight: 'leading-tight'
  },
  
  // Títulos de seção (h2)  
  section: {
    mobile: 'text-2xl',     // 24px
    tablet: 'text-3xl',     // 30px
    desktop: 'text-4xl',    // 36px
    weight: 'font-extrabold', 
    lineHeight: 'leading-tight'
  },
  
  // Subtítulos (h3)
  subsection: {
    mobile: 'text-xl',      // 20px
    tablet: 'text-2xl',     // 24px
    desktop: 'text-3xl',    // 30px
    weight: 'font-bold',
    lineHeight: 'leading-snug'
  },
  
  // Títulos de cards (h4)
  card: {
    mobile: 'text-lg',      // 18px
    tablet: 'text-xl',      // 20px  
    desktop: 'text-2xl',    // 24px
    weight: 'font-bold',
    lineHeight: 'leading-snug'
  },
  
  // Texto base
  body: {
    mobile: 'text-sm',      // 14px
    tablet: 'text-base',    // 16px
    desktop: 'text-lg',     // 18px
    weight: 'font-normal',
    lineHeight: 'leading-relaxed'
  },
  
  // Texto pequeno
  small: {
    mobile: 'text-xs',      // 12px
    tablet: 'text-sm',      // 14px
    desktop: 'text-base',   // 16px
    weight: 'font-normal',
    lineHeight: 'leading-normal'
  }
} as const;

// Aspect ratios responsivos para banners/imagens
export const aspectRatios = {
  banner: {
    mobile: '16 / 10',    // Mais quadrado para mobile
    tablet: '16 / 8',     // Intermediário
    desktop: '1920 / 600' // Original desktop
  },
  
  card: {
    mobile: '4 / 3',      // Mais quadrado
    tablet: '16 / 10',    // Intermediário  
    desktop: '16 / 9'     // Widescreen
  }
} as const;

// Grid systems responsivos
export const grids = {
  gallery: {
    mobile: 'grid-cols-2',   // 2 colunas mobile
    tablet: 'grid-cols-4',   // 4 colunas tablet
    desktop: 'grid-cols-6'   // 6 colunas desktop
  },
  
  projects: {
    mobile: 'grid-cols-1',   // 1 coluna mobile
    tablet: 'grid-cols-2',   // 2 colunas tablet  
    desktop: 'grid-cols-3'   // 3 colunas desktop
  },
  
  testimonials: {
    mobile: 'grid-cols-1',   // 1 coluna mobile
    tablet: 'grid-cols-2',   // 2 colunas tablet
    desktop: 'grid-cols-3'   // 3 colunas desktop
  }
} as const;

// Utilitários para gerar classes responsivas
export const responsive = {
  // Gera classes de container responsivo
  container: () => `${spacing.container.mobile} ${spacing.container.tablet} ${spacing.container.desktop}`,
  
  // Gera classes de seção responsiva
  section: () => `${spacing.section.mobile} ${spacing.section.tablet} ${spacing.section.desktop}`,
  
  // Gera classes de tipografia responsiva
  hero: () => `${typography.hero.mobile} md:${typography.hero.tablet} lg:${typography.hero.desktop} ${typography.hero.weight} ${typography.hero.lineHeight}`,
  sectionTitle: () => `${typography.section.mobile} md:${typography.section.tablet} lg:${typography.section.desktop} ${typography.section.weight} ${typography.section.lineHeight}`,
  subsectionTitle: () => `${typography.subsection.mobile} md:${typography.subsection.tablet} lg:${typography.subsection.desktop} ${typography.subsection.weight} ${typography.subsection.lineHeight}`,
  cardTitle: () => `${typography.card.mobile} md:${typography.card.tablet} lg:${typography.card.desktop} ${typography.card.weight} ${typography.card.lineHeight}`,
  bodyText: () => `${typography.body.mobile} md:${typography.body.tablet} lg:${typography.body.desktop} ${typography.body.weight} ${typography.body.lineHeight}`,
  smallText: () => `${typography.small.mobile} md:${typography.small.tablet} lg:${typography.small.desktop} ${typography.small.weight} ${typography.small.lineHeight}`,
  
  // Gera classes de grid responsivo
  galleryGrid: () => `grid ${grids.gallery.mobile} md:${grids.gallery.tablet} lg:${grids.gallery.desktop}`,
  projectsGrid: () => `grid ${grids.projects.mobile} md:${grids.projects.tablet} lg:${grids.projects.desktop}`,
  testimonialsGrid: () => `grid ${grids.testimonials.mobile} md:${grids.testimonials.tablet} lg:${grids.testimonials.desktop}`,
} as const;

export type ResponsiveConfig = typeof responsive; 