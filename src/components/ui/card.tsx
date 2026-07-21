import * as React from "react";

import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'network' | 'elevated' | 'mtn' | 'telecel' | 'airteltigo' | 'gradient' | 'accent' | 'glass' | 'clay' | 'spatial';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border bg-card text-card-foreground transition-all duration-300",
        variant === 'default' && "shadow-card hover:shadow-lg hover:border-border/80",
        variant === 'elevated' && "shadow-lg hover:shadow-xl hover:-translate-y-1",
        variant === 'network' && "shadow-card hover:shadow-lg border-2 hover:scale-[1.02]",
        variant === 'mtn' && "border-2 border-yellow-400/50 bg-gradient-to-br from-yellow-400/5 to-yellow-500/10 shadow-card hover:shadow-mtn hover:border-yellow-400",
        variant === 'telecel' && "border-2 border-red-500/50 bg-gradient-to-br from-red-500/5 to-red-600/10 shadow-card hover:shadow-telecel hover:border-red-500",
        variant === 'airteltigo' && "border-2 border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-blue-600/10 shadow-card hover:shadow-airteltigo hover:border-blue-500",
        variant === 'gradient' && "bg-gradient-to-br from-card to-muted shadow-card hover:shadow-lg",
        variant === 'accent' && "border-l-4 border-l-primary shadow-card hover:shadow-lg",
        variant === 'glass' && "bg-card/45 backdrop-blur-md border border-border/40 shadow-md hover:shadow-xl hover:bg-card/65",
        variant === 'clay' && "bg-card border-none rounded-2xl shadow-[inset_2px_2px_4px_rgba(255,255,255,0.6),_inset_-2px_-2px_4px_rgba(0,0,0,0.05),_0_10px_20px_-5px_rgba(0,0,0,0.1)] dark:shadow-[inset_1px_1px_2px_rgba(255,255,255,0.05),_inset_-2px_-2px_4px_rgba(0,0,0,0.3),_0_10px_20px_-5px_rgba(0,0,0,0.25)]",
        variant === 'spatial' && "shadow-card hover:shadow-2xl border-border/60 hover:-translate-y-1.5 hover:scale-[1.01] hover:border-primary/30 [transform-style:preserve-3d]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-display text-xl font-bold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
