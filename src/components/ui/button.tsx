import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.96]",
  {
    variants: {
      variant: {
        default: "gradient-primary text-primary-foreground shadow-md hover:shadow-xl hover:shadow-primary/30 hover:brightness-110",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md hover:shadow-xl hover:shadow-destructive/30",
        outline: "border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-xl hover:shadow-primary/20",
        secondary: "gradient-secondary text-secondary-foreground shadow-md hover:shadow-xl hover:shadow-secondary/30 hover:brightness-105",
        ghost: "hover:bg-accent hover:text-accent-foreground hover:-translate-y-0 hover:scale-100",
        link: "text-primary underline-offset-4 hover:underline hover:-translate-y-0 hover:scale-100",
        mtn: "gradient-mtn text-black shadow-md hover:shadow-xl hover:shadow-yellow-500/30 font-bold",
        telecel: "gradient-telecel text-white shadow-md hover:shadow-xl hover:shadow-red-500/30 font-bold",
        airteltigo: "gradient-airteltigo text-white shadow-md hover:shadow-xl hover:shadow-blue-500/30 font-bold",
        success: "gradient-success text-white shadow-md hover:shadow-xl hover:shadow-success/30 font-semibold",
        warning: "gradient-warning text-amber-900 shadow-md hover:shadow-xl hover:shadow-warning/30 font-semibold",
        info: "gradient-info text-white shadow-md hover:shadow-xl hover:shadow-info/30 font-semibold",
        glass: "bg-card/80 backdrop-blur-sm border border-border text-foreground hover:bg-card hover:shadow-xl shadow-card",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
