"use client";

import { Textarea } from "@/src/components/ui/textarea";
import { RotatingBorder } from "@common/components/ui/ShineBorder";
import { IconSend, IconMicrophone, IconPlayerStop, IconVolume, IconVolumeOff } from "@tabler/icons-react";
import { cn } from "@/src/lib/utils";
import type { VoiceChatControls } from "@/src/hooks/useVoiceChat";

interface VoiceChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  voice: VoiceChatControls;
  /** Show animated rotating border around the textarea */
  showRotatingBorder?: boolean;
  /** Minimum height of the textarea, e.g. "80px" or "44px" */
  minHeight?: string;
  /** Number of textarea rows */
  rows?: number;
}

/** Countdown overlay — render inside a messages scroll area */
function VoiceCountdown({ countdownActive, countdownSeconds }: Pick<VoiceChatControls, "countdownActive" | "countdownSeconds">) {
  if (!countdownActive) return null;

  return (
    <div className="sticky bottom-2 flex justify-center pointer-events-none">
      <div className="w-12 h-12 rounded-xl bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center shadow-lg border pointer-events-auto">
        <svg className="w-7 h-7" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted"
          />
          <circle
            cx="12"
            cy="12"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${(countdownSeconds / 3) * 62.83} 62.83`}
            strokeLinecap="round"
            className="text-primary -rotate-90 origin-center transition-all duration-100"
            style={{ transformOrigin: "center" }}
          />
        </svg>
        <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">
          {countdownSeconds.toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

function VoiceChatInput({
  value,
  onChange,
  onSend,
  isLoading = false,
  disabled = false,
  placeholder = "Type a message...",
  className,
  voice,
  showRotatingBorder = false,
  minHeight = "80px",
  rows = 2,
}: VoiceChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const textareaElement = (
    <>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        rows={rows}
        className={cn(
          "transition-all duration-200 resize-none pr-12 border-0 rounded-[14px] focus-visible:ring-2 focus-visible:ring-offset-2",
          voice.isListening && "ring-2 ring-primary/20",
        )}
        style={{ minHeight }}
      />
      {/* Voice controls inside textarea */}
      {voice.isVoiceSupported && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {/* TTS toggle */}
          <button
            type="button"
            onClick={voice.isSpeaking ? () => voice.stopSpeaking(true) : voice.toggleTts}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              voice.isTtsEnabled
                ? voice.isSpeaking
                  ? "bg-primary text-primary-foreground animate-pulse"
                  : "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title={voice.isSpeaking ? "Stop speaking" : voice.isTtsEnabled ? "TTS enabled" : "Enable TTS"}
          >
            {voice.isTtsEnabled ? (
              <IconVolume className="h-4 w-4" />
            ) : (
              <IconVolumeOff className="h-4 w-4" />
            )}
          </button>
          {/* Mic button */}
          <button
            type="button"
            onClick={voice.isListening ? voice.stopListening : voice.startListening}
            disabled={isLoading}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              voice.isListening
                ? "bg-destructive text-destructive-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title={voice.isListening ? "Stop listening" : "Start voice input"}
          >
            {voice.isListening ? (
              <IconPlayerStop className="h-4 w-4" />
            ) : (
              <IconMicrophone className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
      {voice.isListening && (
        <div className="absolute bottom-2.5 right-20 flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        </div>
      )}
    </>
  );

  return (
    <div className={cn("flex gap-2", className)}>
      {showRotatingBorder ? (
        <RotatingBorder
          borderRadius={16}
          borderWidth={2}
          colors={["#6792bf"]}
          rotationSpeed={0.15}
          colorSpread={0.2}
          gapColor="#2d68e8"
          className="flex-1"
        >
          {textareaElement}
        </RotatingBorder>
      ) : (
        <div className="relative flex-1">
          {textareaElement}
        </div>
      )}
      <button
        type="button"
        onClick={onSend}
        disabled={isLoading || !value.trim()}
        className={cn(
          "shrink-0 rounded-md border-2 border-primary flex items-center justify-center transition-colors",
          "text-foreground hover:bg-primary hover:text-white",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-foreground",
        )}
        style={{ minHeight, width: "3rem" }}
      >
        <IconSend className="h-5 w-5" />
      </button>
    </div>
  );
}

export { VoiceChatInput, VoiceCountdown };
export type { VoiceChatInputProps };
