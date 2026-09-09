import { 
  Users,
  Buildings,
  Briefcase,
  Handshake,
  Package,
  Flask,
  Scales,
  ChartLine
} from '@phosphor-icons/react';

export interface DepartmentConfig {
  name: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  icon: typeof Users;
  description: string;
}

export const DEPARTMENT_CONFIGS: Record<string, DepartmentConfig> = {
  Engineering: {
    name: 'Engineering',
    color: 'oklch(0.60 0.20 260)',
    bgColor: 'oklch(0.60 0.20 260 / 0.1)',
    textColor: 'oklch(0.40 0.16 260)',
    borderColor: 'oklch(0.60 0.20 260 / 0.3)',
    icon: Buildings,
    description: 'Software engineering and development'
  },
  Marketing: {
    name: 'Marketing',
    color: 'oklch(0.65 0.22 340)',
    bgColor: 'oklch(0.65 0.22 340 / 0.1)',
    textColor: 'oklch(0.45 0.18 340)',
    borderColor: 'oklch(0.65 0.22 340 / 0.3)',
    icon: ChartLine,
    description: 'Marketing and brand management'
  },
  Sales: {
    name: 'Sales',
    color: 'oklch(0.58 0.18 120)',
    bgColor: 'oklch(0.58 0.18 120 / 0.1)',
    textColor: 'oklch(0.38 0.14 120)',
    borderColor: 'oklch(0.58 0.18 120 / 0.3)',
    icon: Handshake,
    description: 'Sales and business development'
  },
  HR: {
    name: 'HR',
    color: 'oklch(0.62 0.19 280)',
    bgColor: 'oklch(0.62 0.19 280 / 0.1)',
    textColor: 'oklch(0.42 0.15 280)',
    borderColor: 'oklch(0.62 0.19 280 / 0.3)',
    icon: Users,
    description: 'Human resources and people operations'
  },
  Support: {
    name: 'Support',
    color: 'oklch(0.63 0.16 200)',
    bgColor: 'oklch(0.63 0.16 200 / 0.1)',
    textColor: 'oklch(0.43 0.13 200)',
    borderColor: 'oklch(0.63 0.16 200 / 0.3)',
    icon: Users,
    description: 'Customer support and success'
  },
  Operations: {
    name: 'Operations',
    color: 'oklch(0.52 0.14 30)',
    bgColor: 'oklch(0.52 0.14 30 / 0.1)',
    textColor: 'oklch(0.32 0.10 30)',
    borderColor: 'oklch(0.52 0.14 30 / 0.3)',
    icon: Briefcase,
    description: 'Business operations and processes'
  },
  Product: {
    name: 'Product',
    color: 'oklch(0.64 0.20 180)',
    bgColor: 'oklch(0.64 0.20 180 / 0.1)',
    textColor: 'oklch(0.44 0.16 180)',
    borderColor: 'oklch(0.64 0.20 180 / 0.3)',
    icon: Package,
    description: 'Product strategy and development'
  },
  Legal: {
    name: 'Legal',
    color: 'oklch(0.50 0.12 240)',
    bgColor: 'oklch(0.50 0.12 240 / 0.1)',
    textColor: 'oklch(0.30 0.10 240)',
    borderColor: 'oklch(0.50 0.12 240 / 0.3)',
    icon: Scales,
    description: 'Legal compliance and contracts'
  },
  Research: {
    name: 'Research',
    color: 'oklch(0.66 0.18 280)',
    bgColor: 'oklch(0.66 0.18 280 / 0.1)',
    textColor: 'oklch(0.46 0.15 280)',
    borderColor: 'oklch(0.66 0.18 280 / 0.3)',
    icon: Flask,
    description: 'Research and development'
  },
  Executive: {
    name: 'Executive',
    color: 'oklch(0.52 0.14 30)',
    bgColor: 'oklch(0.52 0.14 30 / 0.1)',
    textColor: 'oklch(0.32 0.10 30)',
    borderColor: 'oklch(0.52 0.14 30 / 0.3)',
    icon: Briefcase,
    description: 'Executive leadership and strategy'
  },
  Partnerships: {
    name: 'Partnerships',
    color: 'oklch(0.61 0.19 160)',
    bgColor: 'oklch(0.61 0.19 160 / 0.1)',
    textColor: 'oklch(0.41 0.16 160)',
    borderColor: 'oklch(0.61 0.19 160 / 0.3)',
    icon: Handshake,
    description: 'Strategic partnerships and alliances'
  }
};

const DEFAULT_DEPARTMENT_CONFIG: DepartmentConfig = {
  name: 'Other',
  color: 'oklch(0.55 0.10 220)',
  bgColor: 'oklch(0.55 0.10 220 / 0.1)',
  textColor: 'oklch(0.35 0.08 220)',
  borderColor: 'oklch(0.55 0.10 220 / 0.3)',
  icon: Buildings,
  description: 'Other department'
};

export const COLOR_POOL = [
  { hue: 260, name: 'Blue' },
  { hue: 340, name: 'Pink' },
  { hue: 120, name: 'Green' },
  { hue: 280, name: 'Purple' },
  { hue: 200, name: 'Cyan' },
  { hue: 30, name: 'Orange' },
  { hue: 180, name: 'Teal' },
  { hue: 240, name: 'Indigo' },
  { hue: 160, name: 'Emerald' },
  { hue: 350, name: 'Rose' },
  { hue: 45, name: 'Amber' },
  { hue: 290, name: 'Violet' },
  { hue: 140, name: 'Lime' },
  { hue: 220, name: 'Sky' },
  { hue: 15, name: 'Red' },
  { hue: 60, name: 'Yellow' },
  { hue: 300, name: 'Fuchsia' },
  { hue: 190, name: 'Aqua' },
];

function stringToHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function generateColorFromName(name: string, existingColors: string[]): string {
  const hash = stringToHash(name);
  const colorIndex = hash % COLOR_POOL.length;
  const baseHue = COLOR_POOL[colorIndex].hue;
  
  const lightness = 0.55 + ((hash % 15) / 100);
  const chroma = 0.15 + ((hash % 8) / 100);
  const hueVariation = (hash % 20) - 10;
  const finalHue = baseHue + hueVariation;
  
  const generatedColor = `oklch(${lightness.toFixed(2)} ${chroma.toFixed(2)} ${finalHue})`;
  
  if (existingColors.includes(generatedColor)) {
    const alternateIndex = (colorIndex + Math.floor(hash / COLOR_POOL.length)) % COLOR_POOL.length;
    const alternateHue = COLOR_POOL[alternateIndex].hue;
    return `oklch(${lightness.toFixed(2)} ${chroma.toFixed(2)} ${alternateHue})`;
  }
  
  return generatedColor;
}

export function createColorVariants(baseColor: string) {
  const match = baseColor.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) {
    return {
      color: baseColor,
      bgColor: baseColor,
      textColor: baseColor,
      borderColor: baseColor
    };
  }
  
  const [, l, c, h] = match;
  const lightness = parseFloat(l);
  const chroma = parseFloat(c);
  const hue = parseFloat(h);
  
  return {
    color: baseColor,
    bgColor: `oklch(${lightness} ${chroma} ${hue} / 0.1)`,
    textColor: `oklch(${Math.max(0.30, lightness - 0.20)} ${Math.max(0.10, chroma - 0.05)} ${hue})`,
    borderColor: `oklch(${lightness} ${chroma} ${hue} / 0.3)`
  };
}

export function getDepartmentConfig(departmentName?: string, customDepartments?: Array<{ name: string; color: string }>): DepartmentConfig {
  if (!departmentName) return DEFAULT_DEPARTMENT_CONFIG;

  const config = DEPARTMENT_CONFIGS[departmentName];
  if (config) return config;
  
  const customDept = customDepartments?.find(d => d.name.toLowerCase() === departmentName.toLowerCase());
  if (customDept) {
    const variants = createColorVariants(customDept.color);
    return {
      name: departmentName,
      ...variants,
      icon: Buildings,
      description: `${departmentName} department`
    };
  }
  
  const existingColors = customDepartments?.map(d => d.color) || [];
  const generatedColor = generateColorFromName(departmentName, existingColors);
  const variants = createColorVariants(generatedColor);
  
  return {
    name: departmentName,
    ...variants,
    icon: Buildings,
    description: `${departmentName} department`
  };
}

export function getDepartmentIcon(departmentName?: string) {
  const config = getDepartmentConfig(departmentName);
  return config.icon;
}

export function getDepartmentColor(departmentName?: string, customDepartments?: Array<{ name: string; color: string }>): string {
  const config = getDepartmentConfig(departmentName, customDepartments);
  return config.color;
}

export function getAllDepartments(): string[] {
  return Object.keys(DEPARTMENT_CONFIGS);
}

export const COMMON_DEPARTMENTS = [
  'Engineering',
  'Marketing',
  'Sales',
  'HR',
  'Support',
  'Operations',
  'Product',
  'Legal',
  'Research',
  'Executive',
  'Partnerships'
];
