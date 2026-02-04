"use client";

import { cn } from "../../lib/utils";
import { VariantProps, cva } from "class-variance-authority";
import React, { HTMLAttributes, RefObject, forwardRef, useLayoutEffect, useRef, useState } from "react";
import useOverflowDetection from "@common/hooks/useOverflowDetection";
import useElementsChangeDetector from "@common/hooks/useElementsChangeDetector";

//TODO make duration a global variable
// Flex-col and justify-between are used to push the footer to the bottom of the page
const classNameVariants = cva("transition-all duration-200", {
  variants: {
    variant: {
      default: "xl:max-w-10/12 relative h-full-minus-navbar max-w-[2800px] overflow-x-auto overflow-y-scroll bg-background",
      blank: "",
      padded: "xl:max-w-10/12 relative h-full-minus-navbar max-w-[2800px] bg-background px-1 md:px-4 lg:px-8 xl:px-16 2xl:px-40",
      onlyPadding: "px-1 md:px-4 lg:px-8 xl:px-16 2xl:px-40",
      onlyPaddingSmall: "px-1 md:px-2 lg:px-3 xl:px-5 2xl:px-16 pt-1 md:pt-2 lg:pt-4 xl:pt-6",
      noScroll: "xl:max-w-10/12 fixed h-full-minus-navbar max-w-[2800px] bg-background px-1 md:px-4 lg:px-16 xl:px-24 2xl:px-40",
      centeredXY: "mx-auto max-w-[2200px] py-4 flex h-full w-full justify-center bg-background-blue xxs:px-2.5 sm:px-6 lg:px-8 pb-28",
    },
    width: {
      default: "left-sideMenu-width-half w-full-minus-sideMenu",
      defaultNoSideMenu: "w-full",
      sideMenuExpanded: "left-sideMenu-widthExpanded-half w-full-minus-sideMenuExpanded max-w-full-minus-sideMenuExpanded",
      full: "w-full justify-center max-w-full",
      blank: "w-full max-w-full",
      screen: "w-screen",
      none: "",
    },
    height: {
      default: "min-h-screen-minus-navbar",
      nav: "top-navbar-height",
      navWithBanner: "h-full-minus-navbar-banner top-navbar-banner-height",
      paddedNav: "pt-navbar-height",
      blank: "min-h-full",
      full: "h-full justify-center max-h-full",
      screen: "h-screen overflow-scroll",
      screenScroll: "min-h-screen h-full",
      none: "",
    },
  },
  defaultVariants: {
    variant: "default",
    width: "default",
    height: "default",
  },
});

export interface PageContentContainerProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof classNameVariants> {
  children?: React.ReactNode; // If you want to explicitly type the children prop
  blank?: boolean;
  className?: string;
  UIState?: { bannerOpen: boolean; sideMenuOpen: boolean };
  useUIState?: boolean;
  fadeInOnPageLoad?: boolean;
  sizingDependentDivs?: RefObject<HTMLDivElement | null>[];
  considerSideMenu?: boolean;
}

export const PageContentContainer = forwardRef<HTMLDivElement, PageContentContainerProps>(
  (
    {
      children,
      blank,
      className,
      fadeInOnPageLoad = false,
      variant = undefined,
      UIState,
      useUIState = UIState === undefined ? false : true,
      sizingDependentDivs,
      considerSideMenu = false,
      width: widthProp,
      height: heightProp,
      ...props
    },
    ref
  ) => {
    const [isPageLoaded, setIsPageLoaded] = useState(fadeInOnPageLoad ? false : true);
    useLayoutEffect(() => {
      if (!fadeInOnPageLoad) return;
      window.onload = () => {
        setIsPageLoaded(true);
      };
      //also a timeout to ensure it's loaded
      setTimeout(() => {
        setIsPageLoaded(true);
      }, 100);
    }, []);

    const centeredDiv = useRef<HTMLDivElement>(null);

    // Track changes in the spacing of necesary divs
    const changeCounter = useElementsChangeDetector([centeredDiv], { debounceMs: 100 });

    // Detect overflow, using changeCounter as optional dependency
    const overflowDetection = useOverflowDetection(centeredDiv, 100, [changeCounter]);

    let width = widthProp;
    let height = heightProp;

    // Determine margin based on sidemenu state
    const sideMenuMargin = considerSideMenu && UIState 
      ? (UIState.sideMenuOpen ? "224px" : "64px") 
      : undefined;

    if (useUIState && UIState) {
      if (UIState?.bannerOpen) {
        height = "navWithBanner";
      } else {
        height = "nav";
      }
    }

    if (variant === "blank" || blank === true) {
      width = "blank";
      height = "blank";
    }

    // Wrapper function to dynamically adjust variants
    const getClassNameVariants = ({ variant, height, width, ...rest }: VariantProps<typeof classNameVariants>) => {
      // If the variant is centeredXY and height is not explicitly passed, set it to "screenScroll"
      const adjustedHeight: VariantProps<typeof classNameVariants>["height"] = variant === "centeredXY" && !height ? "screenScroll" : height;
      const adjustedWidth: VariantProps<typeof classNameVariants>["width"] = variant === "centeredXY" && !width ? "screen" : width;

      // Return the computed class name
      return classNameVariants({
        variant,
        height: adjustedHeight,
        width: adjustedWidth,
        ...rest,
      });
    };
    return (
      <div
        key={`PageContentContainer-${variant}-${width}-${height}`}
        ref={ref}
        className={cn(
          "transition-opacity duration-300",
          { "opacity-100": isPageLoaded, "opacity-0": !isPageLoaded },
          getClassNameVariants({ variant, width, height }),
          className
        )}
        style={{
          paddingLeft: sideMenuMargin,
          transition: sideMenuMargin ? "padding-left 300ms" : undefined,
          ...props.style,
        }}
        {...props}
      >
        {variant === "centeredXY" ? (
          <div
            ref={centeredDiv}
            id="Center-Me"
            className={cn("", "flex w-full flex-col items-center justify-center", overflowDetection.vertical && "justify-start")}
          >
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    );
  }
);

PageContentContainer.displayName = "PageContentContainer";
