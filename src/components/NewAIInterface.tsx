"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

type AIState = "idle" | "listening" | "processing" | "speaking";

interface NewAIInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  aiText: string;
  aiState: AIState;
  onMicClick: () => void;
}

const NewAIInterface: React.FC<NewAIInterfaceProps> = ({
  isOpen,
  onClose,
  aiText,
  aiState,
  onMicClick,
}) => {
  const [showDataViz, setShowDataViz] = useState(false);
  const dataVizTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Controla a aparição das visualizações holográficas no estado 'processing'
  useEffect(() => {
    if (aiState === "processing") {
      setShowDataViz(true);
      if (dataVizTimeoutRef.current) clearTimeout(dataVizTimeoutRef.current);
      dataVizTimeoutRef.current = setTimeout(() => {
        setShowDataViz(false);
      }, 2000); // Duração da animação de fade-out
    } else {
      setShowDataViz(false);
      if (dataVizTimeoutRef.current) {
        clearTimeout(dataVizTimeoutRef.current);
        dataVizTimeoutRef.current = null;
      }
    }
  }, [aiState]);

  // Fechar modal com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="ai-modal"
      className="fixed inset-0 z-[9999] w-screen h-screen bg-black/50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-labelledby="ai-modal-title"
      aria-describedby="ai-modal-desc"
      onClick={onClose}
    >
      <div
        id="modal-background"
        className="absolute inset-0 bg-gradient-to-br from-blue-900 to-purple-900 animate-backgroundPulse"
        aria-hidden="true"
      ></div>

      <div
        className="relative z-10 flex flex-col items-center justify-center w-96 h-96 rounded-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Orbe da IA */}
        <div
          id="ai-orb"
          className={cn(
            "w-72 h-72 rounded-full shadow-[0_0_30px_10px] transition-all duration-500",
            {
              "bg-blue-700 shadow-blue-500 animate-pulseSlow": aiState === "idle",
              "bg-blue-500 shadow-blue-400 animate-pulseSlow": aiState === "listening",
              "bg-violet-700 shadow-violet-500 animate-pulseFast": aiState === "processing",
              "bg-cyan-500 shadow-cyan-400": aiState === "speaking",
            }
          )}
        >
          {/* Forma de onda de áudio */}
          <div
            id="audio-waveform"
            className={cn(
              "absolute bottom-8 left-1/2 -translate-x-1/2 flex space-x-1",
              {
                "opacity-100 animate-audioWaveform": aiState === "speaking",
                "opacity-0": aiState !== "speaking",
              }
            )}
          >
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className="block w-2 h-6 bg-white rounded-full"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>

        {/* Caixa de diálogo */}
        <div
          id="dialog-box"
          className="absolute top-[calc(100%+1rem)] w-80 bg-black/70 backdrop-blur-md rounded-lg p-4 text-white font-poppins text-center text-lg leading-relaxed tracking-wide select-text shadow-neon"
          aria-live="polite"
          aria-atomic="true"
        >
          <p id="ai-text" className="whitespace-pre-wrap break-words">
            {aiText || "Olá! Como posso ajudar?"}
          </p>
        </div>

        {/* Visualizações de dados holográficas */}
        <div
          className={cn(
            "absolute top-0 left-0 w-full h-full pointer-events-none flex flex-wrap justify-center items-center gap-4 opacity-0 transition-opacity duration-700",
            {
              "opacity-80": showDataViz,
            }
          )}
          aria-hidden="true"
        >
          {/* Exemplos de hologramas */}
          <div className="data-viz bg-cyan-400/20 border border-cyan-400 rounded-lg p-3 w-20 h-20 shadow-glow animate-fadeInOut">
            <svg
              className="w-full h-full text-cyan-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l2 2 4-4" />
            </svg>
          </div>
          <div className="data-viz bg-purple-400/20 border border-purple-400 rounded-lg p-3 w-20 h-20 shadow-glow animate-fadeInOut delay-200">
            <svg
              className="w-full h-full text-purple-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
              <path d="M8 12h8" />
            </svg>
          </div>
          <div className="data-viz bg-blue-400/20 border border-blue-400 rounded-lg p-3 w-20 h-20 shadow-glow animate-fadeInOut delay-400">
            <svg
              className="w-full h-full text-blue-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </div>

        {/* Ícone do microfone */}
        <button
          id="mic-icon"
          aria-label="Ativar microfone"
          onClick={onMicClick}
          className={cn(
            "absolute bottom-[-3.5rem] left-1/2 -translate-x-1/2 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 rounded-full p-4 shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-cyan-400",
            {
              "ring-4 ring-cyan-400": aiState === "listening",
              "ring-0": aiState !== "listening",
            }
          )}
        >
          <Mic className="text-white w-8 h-8" />
        </button>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap');

        .font-poppins {
          font-family: 'Poppins', sans-serif;
        }

        .shadow-neon {
          text-shadow:
            0 0 5px #00ffff,
            0 0 10px #00ffff,
            0 0 20px #00ffff,
            0 0 40px #00ffff;
        }

        .shadow-glow {
          box-shadow:
            0 0 10px rgba(0, 255, 255, 0.5),
            0 0 20px rgba(0, 255, 255, 0.3),
            0 0 30px rgba(0, 255, 255, 0.2);
        }

        @keyframes pulseSlow {
          0%, 100% {
            box-shadow: 0 0 30px 10px rgba(0, 0, 255, 0.6);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 40px 15px rgba(0, 0, 255, 0.9);
            transform: scale(1.05);
          }
        }

        @keyframes pulseFast {
          0%, 100% {
            box-shadow: 0 0 30px 10px rgba(128, 0, 255, 0.8);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 50px 20px rgba(128, 0, 255, 1);
            transform: scale(1.1);
          }
        }

        .animate-pulseSlow {
          animation: pulseSlow 3s ease-in-out infinite;
        }

        .animate-pulseFast {
          animation: pulseFast 1.5s ease-in-out infinite;
        }

        @keyframes audioWaveform {
          0%, 100% {
            transform: scaleY(0.25);
            opacity: 0.5;
          }
          50% {
            transform: scaleY(1);
            opacity: 1;
          }
        }

        .animate-audioWaveform > span {
          animation: audioWaveform 1.5s infinite ease-in-out;
          transform-origin: center bottom;
          display: inline-block;
        }

        @keyframes backgroundPulse {
          0%, 100% {
            filter: brightness(0.8);
          }
          50% {
            filter: brightness(1);
          }
        }

        .animate-backgroundPulse {
          animation: backgroundPulse 6s ease-in-out infinite;
        }

        @keyframes fadeInOut {
          0%, 100% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
        }

        .animate-fadeInOut {
          animation: fadeInOut 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default NewAIInterface;