import React from 'react';
import { cn } from '@/lib/utils';

export type PremiumIconVariant =
    | 'primary' | 'secondary' | 'accent' | 'ghost'
    | 'emerald' | 'amber' | 'rose' | 'blue' | 'indigo' | 'violet' | 'cyan';

interface PremiumIconProps {
    icon: React.ElementType;
    variant?: PremiumIconVariant;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    iconClassName?: string;
    showBackground?: boolean;
    animate?: boolean;
}

export const PremiumIcon = ({
    icon: Icon,
    variant = 'primary',
    size = 'md',
    className,
    iconClassName,
    showBackground = true,
    animate = true
}: PremiumIconProps) => {
    const sizeMap = {
        xs: { container: 'w-6 h-6', icon: 'w-3 h-3' },
        sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
        md: { container: 'w-10 h-10', icon: 'w-5 h-5' },
        lg: { container: 'w-12 h-12', icon: 'w-6 h-6' },
        xl: { container: 'w-16 h-16', icon: 'w-8 h-8' }
    };

    const textClasses: Record<PremiumIconVariant, string> = {
        primary: 'text-primary',
        secondary: 'text-emerald-500',
        accent: 'text-indigo-500',
        ghost: 'text-muted-foreground',
        emerald: 'text-emerald-500',
        amber: 'text-amber-500',
        rose: 'text-rose-500',
        blue: 'text-blue-500',
        indigo: 'text-indigo-500',
        violet: 'text-violet-500',
        cyan: 'text-cyan-500',
    };

    const variantClasses: Record<PremiumIconVariant, string> = {
        primary: 'bg-primary/10 border-primary/20 shadow-primary/20',
        secondary: 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/20',
        accent: 'bg-indigo-500/10 border-indigo-500/20 shadow-indigo-500/20',
        ghost: 'bg-transparent border-transparent shadow-none',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/20',
        amber: 'bg-amber-500/10 border-amber-500/20 shadow-amber-500/20',
        rose: 'bg-rose-500/10 border-rose-500/20 shadow-rose-500/20',
        blue: 'bg-blue-500/10 border-blue-500/20 shadow-blue-500/20',
        indigo: 'bg-indigo-500/10 border-indigo-500/20 shadow-indigo-500/20',
        violet: 'bg-violet-500/10 border-violet-500/20 shadow-violet-500/20',
        cyan: 'bg-cyan-500/10 border-cyan-500/20 shadow-cyan-500/20',
    };

    return (
        <div className={cn(
            "relative flex items-center justify-center rounded-xl transition-all duration-300",
            textClasses[variant],
            showBackground && "border backdrop-blur-md bg-opacity-20 shadow-lg",
            showBackground && variantClasses[variant],
            animate && "group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
            sizeMap[size].container,
            className
        )}>
            {/* Glossy overlay */}
            {showBackground && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            )}

            <Icon
                className={cn(
                    "relative z-10 transition-all duration-300",
                    animate && "group-hover:scale-110",
                    sizeMap[size].icon,
                    iconClassName
                )}
                strokeWidth={1.8}
            />
        </div>
    );
};
