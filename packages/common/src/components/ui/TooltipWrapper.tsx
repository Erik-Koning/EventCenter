"use client";

import React, { forwardRef, ReactElement, useEffect } from "react";

import { ButtonProps } from "./Button";
import { Arrow, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { cn } from "../../lib/utils";

interface TooltipWrapper extends ButtonProps {
  tooltipText: string;
  hoverDelay?: number;
  onClickText?: string;
  forceShowOnClickText?: boolean;
  tooltipOnClickTextDuration?: number;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
  classNameChildren?: string;
  stopMouseEventPropagation?: boolean;
  showArrow?: boolean;
  arrowColour?: string;
  disabled?: boolean;
  tooltipJSX?: ReactElement;
}

export const TooltipWrapper = React.forwardRef<HTMLButtonElement, TooltipWrapper>(
  (
    {
      tooltipText,
      tooltipJSX,
      side = "bottom",
      sideOffset = 4,
      className = "backdrop-blur-[2.5px] bg-white/65",
      classNameChildren,
      showArrow = false,
      arrowColour = "gray",
      hoverDelay = 0,
      onClickText = true,
      forceShowOnClickText = false,
      tooltipOnClickTextDuration = 2000,
      stopMouseEventPropagation = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const [showTooltip, setShowTooltip] = React.useState<boolean>(false); // [showTooltip, setShowTooltip
    const [showTooltipClickText, setShowTooltipClickText] = React.useState<boolean>(false);
    const [avoidFlash, setAvoidFlash] = React.useState<boolean>(false);
    const [tooltipTextState, setTooltipTextState] = React.useState<string>(tooltipText);
    const [tooltipClicked, setTooltipClicked] = React.useState<boolean>(false);

    const tooltipContentClassName = cn("max-w-[50vw] pl-4", { "data-[side=right]:slide-in-from-left-4 duration-500": side === "right" }, className);

    useEffect(() => {
      if (forceShowOnClickText) {
        setShowTooltipClickText(true);
        setAvoidFlash(true);
        setTimeout(async () => {
          setShowTooltipClickText(false);
          setTimeout(async () => {
            setAvoidFlash(false);
          }, 200);
        }, tooltipOnClickTextDuration);
      }
    }, [forceShowOnClickText]);

    useEffect(() => {
      if (tooltipClicked) {
        if (typeof onClickText !== "boolean" && onClickText.length > 0) {
          setShowTooltipClickText(true);
          setTimeout(async () => {
            setShowTooltipClickText(false);
          }, tooltipOnClickTextDuration);
        }

        setTimeout(async () => {
          setTooltipClicked(false);
        }, tooltipOnClickTextDuration);
      }
    }, [tooltipClicked]);

    const handleTooltipOnClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      //console.log("handleTooltipOnClick");
      if (onClickText) {
        //console.log("onClickText");
        setTooltipClicked(true);
      } else {
        const dataState = e.currentTarget.getAttribute("data-state");
        ////console.log("dataState", dataState);
        if (dataState === "open") {
          setShowTooltip(false);
        } else {
          setShowTooltip(true);
          setTimeout(async () => {
            setShowTooltip(false);
          }, 6000);
        }
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      const delay = 1000;
      if (onClickText) {
        if (showTooltipClickText) setAvoidFlash(true);
        setTimeout(async () => {
          setShowTooltipClickText(false);
        }, delay);
        setTimeout(async () => {
          setAvoidFlash(false);
        }, delay + 150);
      }
    };

    return (
      <TooltipProvider>
        <Tooltip delayDuration={hoverDelay} open={disabled ? false : showTooltipClickText ? true : showTooltip ? true : undefined}>
          <TooltipTrigger
            onClick={(e) => {
              if (stopMouseEventPropagation) {
                e.stopPropagation();
              }
              handleTooltipOnClick;
            }}
            onMouseLeave={handleMouseLeave}
            className={cn("", classNameChildren)}
          asChild
            {...props}
            //disabled={disabled}
          >
            {children}
          </TooltipTrigger>
          {showTooltipClickText || avoidFlash ? (
            <TooltipContent
              className={tooltipContentClassName}
              align="center"
              side={side}
              showArrow={showArrow}
              arrowColour={arrowColour}
              hidden={disabled}
            >
              <span style={{ whiteSpace: "pre-line" }}>{onClickText}</span>
            </TooltipContent>
          ) : (
            <TooltipContent
              className={tooltipContentClassName}
              side={side}
              onClick={(e) => {
                if (stopMouseEventPropagation) {
                  e.stopPropagation();
                }
              }}
              sideOffset={sideOffset}
              showArrow={showArrow}
              arrowColour={arrowColour}
              hidden={disabled}
            >
              {tooltipJSX ? tooltipJSX : <span style={{ whiteSpace: "pre-line" }}>{tooltipText}</span>}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }
);
TooltipWrapper.displayName = "TooltipWrapper";
