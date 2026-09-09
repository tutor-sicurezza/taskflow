import { getDepartmentConfig } from '@/lib/departments';
import { cn } from '@/lib/utils';

interface DepartmentBadgeProps {
  departmentName?: string;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'solid';
  className?: string;
  customDepartments?: Array<{ name: string; color: string }>;
}

export function DepartmentBadge({
  departmentName,
  showIcon = true,
  showLabel = true,
  size = 'md',
  variant = 'default',
  className,
  customDepartments
}: DepartmentBadgeProps) {
  const config = getDepartmentConfig(departmentName, customDepartments);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const variantStyles = {
    default: {
      backgroundColor: config.bgColor,
      color: config.textColor,
      borderColor: config.borderColor
    },
    outline: {
      backgroundColor: 'transparent',
      color: config.color,
      borderColor: config.color
    },
    solid: {
      backgroundColor: config.color,
      color: 'white',
      borderColor: config.color
    }
  };

  const style = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border whitespace-nowrap',
        sizeClasses[size],
        className
      )}
      style={style}
      title={config.description}
    >
      {showIcon && <Icon className={iconSizes[size]} weight="fill" />}
      {showLabel && <span>{config.name}</span>}
    </span>
  );
}
