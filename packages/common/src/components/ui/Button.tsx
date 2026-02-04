"use client";

import React, { useRef, useState } from "react";
import { Slot } from "@radix-ui/react-slot";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@common/lib/utils";
import { Loader2 } from "lucide-react";

import { useItemSizeUL } from "../../hooks/useItemSizeUL";
import { HoverCard, HoverCardContent, HoverCardProps, HoverCardTrigger } from "./hover-card";
import { navigateToPath } from "@common/utils/DOM";
import { useRouter } from "next/navigation";

const buttonVariants = cva(
  "flex items-center justify-center rounded-md p-[10px] font-normal border border-[1.5px] border-offset-background hover:border-border-hovered transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 hover:cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        light: "bg-secondary/30 text-secondary-foreground hover:bg-secondary",
        purple: "bg-purple hover:bg-darkPurple text-primary-light justify-center",
        purpleInvert: "bg-primary-light text-purple border border-purple hover:border-darkPurple hover:text-darkPurple hover:bg-faintPurple",
        dashedPill: "border border-dashed border-border hover:bg-slate-50 rounded-full",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        destructiveSubtle: "transition-all duration-200 text-primary hover:underline underline-offset-1 hover:text-red-600",
        destructiveGraySubtle: "transition-all bg-faintGray hover:bg-red-50 duration-200 text-primary hover:text-red-600",
        outline: "outline outline-input outline-1 bg-background hover:bg-accent hover:text-accent-foreground hover:outline-secondary-dark",
        border: "border border-[1.5px] border-border",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-secondary-dark hover:bg-faintPurple dark:hover:bg-accent",
        ghostBorder: "text-secondary-dark hover:bg-faintPurple dark:hover:bg-accent border border-1 border-offset-background",
        blueLink: "text-skyBlue underline hover:text-darkPurple",
        link: "text-primary underline-offset-4 hover:underline p-[4px]",
        shine: "group relative h-12 overflow-hidden rounded-md bg-purple px-6 text-neutral-50 transition hover:bg-darkPurple",
        blank: "",
      },
      size: {
        default: "h-[42px] w-min inline-flex justify-center",
        tight: "h-fit px-2 py-1",
        slim: "h-[36px] px-2",
        xs: "flex flex-col p-0 m-0 h-[22px] min-w-[22px]",
        sm_xs: "flex flex-col p-0 m-0 h-[32px] min-w-[32px]",
        sm: "h-[38px] px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
        full: "inline-flex min-w-full w-full h-full justify-center",
        fullTall: "inline-flex min-w-full w-full h-[54px] justify-center",
        fullLine: "flex flex-col w-full justify-center min-w-full",
        fit: "inline-flex w-fit h-fit max-w-full",
        blank: "flex flex-col p-0 m-0",
      },
      textSize: {
        default: "text-base",
        blank: "",
      },
      widthVariant: {
        default: "w-auto",
        full: "w-full",
        fit: "w-fit",
      },
      bg: {
        default: "",
        accent: "bg-accent hover:bg-faintPurple",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      textSize: "default",
      widthVariant: "default",
      bg: "default",
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  id?: string;
  title?: string;
  asChild?: boolean;
  isLoading?: boolean;
  preventInitialClick?: number;
  ignoreFirstClick?: boolean;
  onClick?: any;
  url?: string;
  className?: string;
  underlineAnimation?: boolean;
  moveInTop?: boolean;
  moveInBottom?: boolean;
  moveOutTop?: boolean;
  moveOutBottom?: boolean;
  moveInRight?: boolean;
  moveInLeft?: boolean;
  moveOutRight?: boolean;
  moveOutLeft?: boolean;
  moveUp?: boolean;
  isSelected?: boolean;
  stopMouseEventPropagation?: boolean;
  hidden?: boolean;
  buttonContentClassName?: string;
  innerClassName?: string;
  tooltip?: string;
  tooltipDelay?: number;
  tooltipVariant?: HoverCardProps["variant"];
  tooltipSize?: HoverCardProps["size"];
  tooltipClassName?: string;
  autoLoadingOnClick?: boolean; // New prop to enable auto-loading for async functions
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      id = "Submit",
      title,
      className,
      variant,
      size,
      textSize,
      widthVariant,
      bg,
      asChild = false,
      isLoading = false,
      preventInitialClick = 0,
      ignoreFirstClick = false,
      onClick,
      url,
      underlineAnimation = false,
      moveInTop = false,
      moveInBottom = false,
      moveInLeft = false,
      moveInRight = false,
      moveOutTop = false,
      moveOutBottom = false,
      moveOutLeft = false,
      moveOutRight = false,
      moveUp = false,
      isSelected = false,
      stopMouseEventPropagation = false,
      hidden = false,
      innerClassName = "px-1.5 gap-x-2",
      tooltip,
      tooltipDelay = 700,
      tooltipVariant = "tooltip",
      tooltipSize = "fit",
      tooltipClassName = "px-2",
      buttonContentClassName,
      autoLoadingOnClick = false, // Default to false for backward compatibility
      ...props
    },
    ref
  ) => {
    const renderTimestampRef = useRef(Date.now());
    const ignoreFirstClickRef = useRef(ignoreFirstClick);
    const Comp = asChild ? Slot : "button";
    const blank = variant === "blank" && size === "blank";

    let compRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    const { upperLeftPosition, width, height } = useItemSizeUL(compRef);

    const mergedRef = (node: HTMLButtonElement) => {
      // Assign to compRef

      // Forward the ref
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      }
    };

    const [internalLoading, setInternalLoading] = useState(false);

    // Use internal loading state if autoLoading is enabled, otherwise use the passed isLoading
    const effectiveIsLoading = isLoading ? isLoading : autoLoadingOnClick ? internalLoading : false;

    const buttonJSX = (
      <button
        id={id}
        ref={mergedRef}
        className={cn(
          "pointer-events-auto relative",
          !blank && buttonVariants({ variant, size, bg, widthVariant, textSize }),
          {
            //underlineAnimation: "hover:hover-underline-animation",
            //isClicked: "static-underline",
            underlineAnimation: "",
            blank: "appearance-none",
          },
          className
        )}
        onClick={async (e) => {
          if (ignoreFirstClickRef.current) {
            ignoreFirstClickRef.current = false;
            return;
          }
          if (preventInitialClick > 0 && Date.now() - renderTimestampRef.current < preventInitialClick) {
            return;
          }
          if (effectiveIsLoading) return;
          if (stopMouseEventPropagation) {
            e.stopPropagation();
          }

          if (onClick && autoLoadingOnClick) {
            // Check if onClick returns a Promise
            const result = onClick(e);
            if (result && typeof result.then === "function") {
              setInternalLoading(true);
              try {
                await result;
              } catch (error) {
                // Optionally handle errors here
                console.error("Button onClick error:", error);
              } finally {
                setInternalLoading(false);
              }
            }
          } else if (onClick) {
            onClick(e);
          }

          if (url) navigateToPath(router, url);
        }}
        {...props}
      >
        <div className={cn("w-full", { "flex items-center justify-center": effectiveIsLoading }, buttonContentClassName)}>
          <span
            className={cn(
              " whitespace-nowrap",
              { "flex items-center justify-center": !effectiveIsLoading, relative: variant === "shine" },
              innerClassName,
              {
                invisible: effectiveIsLoading,
              }
            )}
          >
            {props.children ? props.children : <h1>{title ?? id ?? "Submit"}</h1>}
          </span>
          {effectiveIsLoading && <Loader2 className="absolute animate-spin" size={20} />}
        </div>{" "}
        {!effectiveIsLoading && variant === "shine" && (
          <div className="absolute inset-0 -top-[20px] flex h-[calc(100%+40px)] w-full animate-shine-infinite justify-center blur-[12px]">
            <div className="relative h-full w-8 bg-white/25"></div>
          </div>
        )}
      </button>
    );

    // Check if toolTip has text and wrap buttonJSX accordingly
    if (tooltip) {
      return (
        <HoverCard openDelay={tooltipDelay}>
          <HoverCardTrigger asChild>{buttonJSX}</HoverCardTrigger>
          <HoverCardContent className={cn("w-full", tooltipClassName)} variant={tooltipVariant} size={tooltipSize}>
            {tooltip}
          </HoverCardContent>
        </HoverCard>
      );
    }

    return buttonJSX;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
