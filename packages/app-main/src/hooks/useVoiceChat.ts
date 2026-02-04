"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface UseVoiceChatOptions {
  /** Called when silence countdown reaches 0 — parent should send the message */
  onAutoSend?: (text: string) => void;
  /** Called with final transcript text — parent should append to its input value */
  onTranscript?: (text: string) => void;
}

interface VoiceChatControls {
  // State
  isListening: boolean;
  isVoiceSupported: boolean;
  isTtsEnabled: boolean;
  isSpeaking: boolean;
  countdownActive: boolean;
  countdownSeconds: number;

  // Actions
  startListening: () => void;
  stopListening: () => void;
  toggleTts: () => void;
  stopSpeaking: (restartListening?: boolean) => void;
  speakText: (text: string) => void;
  cancelCountdown: () => void;
  markLastInputAsVoice: () => void;
  markLastInputAsManual: () => void;
}

export type { VoiceChatControls, UseVoiceChatOptions };

export function useVoiceChat(options: UseVoiceChatOptions = {}): VoiceChatControls {
  const { onAutoSend, onTranscript } = options;

  const [isListening, setIsListening] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenWordsRef = useRef(false);
  const lastInputWasVoiceRef = useRef(false);
  const startListeningRef = useRef<(() => void) | null>(null);

  // Accumulated transcript for auto-send (reset each listening session)
  const accumulatedTranscriptRef = useRef("");

  // Stable refs for callbacks to avoid stale closures
  const onAutoSendRef = useRef(onAutoSend);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => { onAutoSendRef.current = onAutoSend; }, [onAutoSend]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);

  // Detect voice support on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsVoiceSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    }
  }, []);

  // Text-to-speech using Web Speech API
  const speakText = useCallback((text: string) => {
    if (!isTtsEnabled || typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    // Clean markdown for better speech
    const cleanText = text
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/•/g, "")
      .replace(/\n+/g, ". ");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Prefer natural/enhanced English voices
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Enhanced"))
    ) || voices.find((v) => v.lang.startsWith("en"));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Restart listening after TTS ends if last input was voice
      if (lastInputWasVoiceRef.current && startListeningRef.current) {
        startListeningRef.current();
      }
    };
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isTtsEnabled]);

  // Stop speech and optionally restart listening
  const stopSpeaking = useCallback((restartListening = false) => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      if (restartListening && lastInputWasVoiceRef.current && startListeningRef.current) {
        startListeningRef.current();
      }
    }
  }, []);

  // Cancel any pending countdowns
  const cancelCountdown = useCallback(() => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownActive(false);
    setCountdownSeconds(3);
    // Clear accumulated transcript so a stale auto-send cannot fire
    accumulatedTranscriptRef.current = "";
  }, []);

  // Voice input handling
  const startListening = useCallback(async () => {
    const SpeechRecognitionAPI = typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
    if (!SpeechRecognitionAPI) return;

    // Stop any existing recognition before starting a new one
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }

    // Explicitly request mic permission — this triggers the browser prompt
    // if permission was dismissed or revoked
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the stream immediately — SpeechRecognition manages its own
      stream.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.error("Microphone permission denied:", err);
      alert("Microphone access is required for voice input. Please allow microphone permission in your browser settings and try again.");
      return;
    }

    hasSpokenWordsRef.current = false;
    accumulatedTranscriptRef.current = "";

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      // Only enable TTS once recognition actually starts
      setIsTtsEnabled(true);
    };
    recognition.onend = () => setIsListening(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let hasInterimResults = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          hasInterimResults = true;
        }
      }

      // Cancel countdown when user starts speaking (interim results)
      if (hasInterimResults) {
        cancelCountdown();
      }

      if (finalTranscript) {
        // Notify parent to append transcript to input
        onTranscriptRef.current?.(finalTranscript);
        accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? " " : "") + finalTranscript;
        hasSpokenWordsRef.current = true;

        // Reset/cancel any existing countdown
        cancelCountdown();

        // Start 3-second silence detection → then visible countdown
        silenceTimeoutRef.current = setTimeout(() => {
          setCountdownActive(true);
          setCountdownSeconds(3);

          countdownIntervalRef.current = setInterval(() => {
            setCountdownSeconds((prev) => {
              if (prev <= 0.1) {
                return 0;
              }
              return prev - 0.1;
            });
          }, 100);
        }, 3000);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [cancelCountdown]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    cancelCountdown();
    hasSpokenWordsRef.current = false;
  }, [cancelCountdown]);

  // Store startListening in ref for use in TTS onend callback
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Auto-send when countdown reaches 0
  useEffect(() => {
    if (countdownActive && countdownSeconds <= 0 && accumulatedTranscriptRef.current.trim()) {
      // Stop listening and countdown
      recognitionRef.current?.stop();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdownActive(false);
      setCountdownSeconds(3);
      setIsListening(false);
      hasSpokenWordsRef.current = false;

      // Mark voice input for auto-restart after TTS
      lastInputWasVoiceRef.current = true;

      const text = accumulatedTranscriptRef.current.trim();
      accumulatedTranscriptRef.current = "";

      onAutoSendRef.current?.(text);
    }
  }, [countdownActive, countdownSeconds]);

  // Toggle TTS on/off
  const toggleTts = useCallback(() => {
    if (isTtsEnabled) {
      stopSpeaking();
    }
    setIsTtsEnabled((prev) => !prev);
  }, [isTtsEnabled, stopSpeaking]);

  const markLastInputAsVoice = useCallback(() => {
    lastInputWasVoiceRef.current = true;
  }, []);

  const markLastInputAsManual = useCallback(() => {
    lastInputWasVoiceRef.current = false;
  }, []);

  return {
    isListening,
    isVoiceSupported,
    isTtsEnabled,
    isSpeaking,
    countdownActive,
    countdownSeconds,
    startListening,
    stopListening,
    toggleTts,
    stopSpeaking,
    speakText,
    cancelCountdown,
    markLastInputAsVoice,
    markLastInputAsManual,
  };
}
