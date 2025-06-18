"use client";
import { useEffect, useRef, useState } from "react";
import { getGameOutcome } from "@/lib/gestures";

// Déclarations globales MediaPipe
declare const Hands: any;
declare const Camera: any;

// 👊✋✌️ Détection de pierre-feuille-ciseaux
function detectGesture(landmarks: any[]): string {
    const isFingerExtended = (tip: number, pip: number): boolean =>
      landmarks[tip].y < landmarks[pip].y;
  
    const index = isFingerExtended(8, 6);
    const middle = isFingerExtended(12, 10);
    const ring = isFingerExtended(16, 14);
    const pinky = isFingerExtended(20, 18);
  
    const extended = [index, middle, ring, pinky];
    const numExtended = extended.filter(Boolean).length;
  
    if (numExtended === 0) return "pierre";
    if (numExtended === 4) return "feuille";
    if (index && middle && !ring && !pinky) return "ciseau";
  
    return "inconnu";
  }
  
  // 🎯 Dessin des landmarks
  function drawLandmarks(ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) {
    ctx.fillStyle = "red";
    landmarks.forEach(({ x, y }: { x: number; y: number }) => {
      ctx.beginPath();
      ctx.arc(x * width, y * height, 5, 0, 2 * Math.PI);
      ctx.fill();
    });
  }
  

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gesture, setGesture] = useState<string>("...");
  const [currentCount, setCurrentCount] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState<string>("");
  const [balance, setBalance] = useState<number | null>(null);
  const [displayedBalance, setDisplayedBalance] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [masterResult, setMasterResult] = useState<string | null>(null);
  const [lastPlayedGesture, setLastPlayedGesture] = useState<string | null>(null);
  const lastPlayedGestureRef = useRef<string | null>(null);
  const prevCountRef = useRef<number | null>(null);
  const [fadeToBlack, setFadeToBlack] = useState(false);
  const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showVictoryIcon, setShowVictoryIcon] = useState(false);
  const victoryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showDefeatIcon, setShowDefeatIcon] = useState(false);
  const defeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Responsive dimensions
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });
  // Main droite/gauche
  const [handedness, setHandedness] = useState<string | null>(null);

  useEffect(() => {
    function updateDimensions() {
      const isMobile = window.innerWidth < 640;
      if (isMobile) {
        const width = Math.min(window.innerWidth, 360);
        const height = Math.round(width * 4 / 3);
        setDimensions({ width, height });
      } else {
        setDimensions({ width: 640, height: 480 });
      }
    }
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const videoElement = videoRef.current!;
    const canvasElement = canvasRef.current!;
    const canvasCtx = canvasElement.getContext("2d")!;

    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.8,
      minTrackingConfidence: 0.8,
    });

    hands.onResults((results: any) => {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      canvasCtx.drawImage(
        results.image as CanvasImageSource,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        drawLandmarks(canvasCtx, landmarks, canvasElement.width, canvasElement.height);
        const gestureName = detectGesture(landmarks);
        setGesture(gestureName);
        // Détection main droite/gauche
        if (results.multiHandedness && results.multiHandedness.length > 0) {
          setHandedness(results.multiHandedness[0].label); // "Right" ou "Left"
        } else {
          setHandedness(null);
        }
      } else {
        setGesture("...");
        setHandedness(null);
      }

      canvasCtx.restore();
    });

    const startCamera = async () => {
      const camera = new Camera(videoElement, {
        onFrame: async () => {
          await hands.send({ image: videoElement });
        },
        width: dimensions.width,
        height: dimensions.height,
      });
      await camera.start();
    };

    if (typeof window !== "undefined") {
      startCamera();
    }
  }, [dimensions]);

  useEffect(() => {

    const fetchUsername = async () => {
      if (!walletAddress) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/get_username/${walletAddress}`);
        console.log('walletAddress:', walletAddress, 'status:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('username:', data.username);
          setUsername(data.username);
        } else {
          setUsername("");
        }
      } catch (e) {
        setUsername("");
        console.error(e);
      }
    };

    const fetchBalance = async () => {
      if (!walletAddress) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/get_balance/${walletAddress}`);
        if (res.ok) {
          const data = await res.json();
          console.log('balance:', data.xrp_balance);
          setBalance(data.xrp_balance);
        } else {
          setBalance(null);
        }
      } catch (e) {
        setBalance(null);
        console.error(e);
      }
    }

    fetchUsername();
    fetchBalance();
  }, [walletAddress]);

  useEffect(() => {
    setDisplayedBalance(balance);
  }, [balance]);

  // Récupérer le wallet_address du localStorage
  useEffect(() => {
    const stored = localStorage.getItem('wallet_address');
    console.log('Wallet address from localStorage:', stored);
    if (stored) {
      setWalletAddress(stored);
    }
    setIsLoading(false);
  }, []);

  // Connexion WebSocket
  useEffect(() => {
    if (!walletAddress) {
      console.log('Pas de wallet_address, connexion WebSocket impossible');
      return;
    }
    
    console.log('Tentative de connexion WebSocket avec wallet:', walletAddress);
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR_WS}/ws/${walletAddress}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ Client WebSocket connecté avec wallet:', walletAddress);
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Message WebSocket reçu:', data);
        if (data.type === 'countdown' && typeof data.value === 'number') {
          setCurrentCount(data.value);
        }
        if (data.type === 'game_result') {
          console.log('Résultat du master reçu :', data.value);
          setMasterResult(data.value);
        }
      } catch (error) {
        console.error('Erreur de parsing WebSocket:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('❎ Client WebSocket déconnecté. Code:', event.code, 'Raison:', event.reason);
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('❌ Client WebSocket erreur:', error);
      setIsConnected(false);
    };

    return () => {
      console.log('Fermeture de la connexion WebSocket');
      ws.close();
    };
  }, [walletAddress]);

  // Fonction pour envoyer les données à la fin du décompte
  const sendGameData = async () => {
    if (!canvasRef.current || !walletAddress) return;

    try {
      // Capturer l'image du canvas
      const imageBlob = await new Promise<Blob>((resolve) => {
        canvasRef.current!.toBlob((blob) => {
          resolve(blob!);
        }, 'image/jpeg');
      });

      // Créer le FormData
      const formData = new FormData();
      formData.append('wallet_address', walletAddress);
      formData.append('gesture', gesture);
      formData.append('image', imageBlob, 'gesture.jpg');

      // Envoyer via l'API REST
      const response = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/game-result`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const result = await response.json();
      console.log('Résultat envoyé avec succès:', result);
    } catch (error) {
      console.error('Erreur lors de l\'envoi des données:', error);
    }
  };

  // Observer le décompte
  useEffect(() => {
    // Efface le résultat quand le countdown passe à 5 (début d'un nouveau round)
    if (prevCountRef.current !== 5 && currentCount === 5) {
      setMasterResult(null);
      setLastPlayedGesture(null);
      lastPlayedGestureRef.current = null;
      setFadeToBlack(false); // Réinitialise le fondu au début d'un nouveau round
      setShowVictoryIcon(false);
      if (victoryTimeoutRef.current) clearTimeout(victoryTimeoutRef.current);
    }
    // Quand le décompte arrive à 0, on enregistre le geste joué et on envoie les données
    if (currentCount === 0) {
      setLastPlayedGesture(gesture);
      lastPlayedGestureRef.current = gesture;
      sendGameData();
    }
    prevCountRef.current = currentCount;
  }, [currentCount]);

  // Affiche le résultat dès qu'il est reçu, même si le geste a été joué juste avant
  useEffect(() => {
    if (masterResult) {
      // Si le geste n'est pas encore dans le state, on prend la dernière valeur connue
      if (!lastPlayedGesture) {
        setLastPlayedGesture(lastPlayedGestureRef.current);
      }
      // Si c'est une victoire, affiche l'icône et lance le timer de disparition
      if (lastPlayedGestureRef.current && masterResult) {
        const outcome = getGameOutcome(lastPlayedGestureRef.current, masterResult);
        if (outcome === 'gagné') {
          setShowVictoryIcon(true);
          if (victoryTimeoutRef.current) clearTimeout(victoryTimeoutRef.current);
          victoryTimeoutRef.current = setTimeout(() => {
            setShowVictoryIcon(false);
          }, 5000);
        } else {
          setShowVictoryIcon(false);
        }
      } else {
        setShowVictoryIcon(false);
      }
    } else {
      setShowVictoryIcon(false);
    }
  }, [masterResult]);

  // Déclenche la séquence défaite : croix 3s puis fondu 7s
  useEffect(() => {
    if (masterResult && lastPlayedGesture) {
      const outcome = getGameOutcome(lastPlayedGesture, masterResult);
      if (outcome === 'perdu') {
        setShowDefeatIcon(true);
        setFadeToBlack(false);
        if (defeatTimeoutRef.current) clearTimeout(defeatTimeoutRef.current);
        if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
        // Après 3s, lance le fondu au noir
        defeatTimeoutRef.current = setTimeout(() => {
          setFadeToBlack(true);
          // Après 7s de fondu, masque la croix
          fadeTimeoutRef.current = setTimeout(() => {
            setShowDefeatIcon(false);
          }, 7000);
        }, 3000);
      } else {
        setShowDefeatIcon(false);
        setFadeToBlack(false);
      }
    } else {
      setShowDefeatIcon(false);
      setFadeToBlack(false);
    }
  }, [masterResult, lastPlayedGesture]);

  // Réinitialise la séquence au début d'un nouveau round
  useEffect(() => {
    if (prevCountRef.current !== 5 && currentCount === 5) {
      setShowDefeatIcon(false);
      if (defeatTimeoutRef.current) clearTimeout(defeatTimeoutRef.current);
      setFadeToBlack(false);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    }
  }, [currentCount]);

  // Animation de la balance en cas de défaite
  useEffect(() => {
    if (masterResult && lastPlayedGesture) {
      const outcome = getGameOutcome(lastPlayedGesture, masterResult);
      if (outcome === 'perdu' && displayedBalance !== null && displayedBalance > 0) {
        const duration = 2000; // 2 secondes
        const steps = 60; // nombre d'étapes pour l'animation
        const start = displayedBalance;
        let currentStep = 0;
        const stepValue = start / steps;
        const interval = setInterval(() => {
          currentStep++;
          setDisplayedBalance(prev => {
            if (prev === null) return 0;
            const next = prev - stepValue;
            return next > 0 ? next : 0;
          });
          if (currentStep >= steps) {
            setDisplayedBalance(0);
            clearInterval(interval);
          }
        }, duration / steps);
        return () => clearInterval(interval);
      }
    }
  }, [masterResult, lastPlayedGesture]);

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-gray-50">
      {/* Header avec nom utilisateur (à remplacer dynamiquement) */}
      <header className="w-full py-4 flex justify-center items-center bg-white shadow">
        <span className="text-xl font-semibold text-gray-800">
          {username ? username : "Nom d'utilisateur"}{displayedBalance !== null ? ` - ${displayedBalance.toFixed(2)} XRP` : ""}
        </span>
      </header>

      {/* Caméra centrée */}
      <main className="flex-1 flex flex-col justify-center items-center w-full">
        <div className="relative flex flex-col items-center">
          {/* Indicateur de connexion en haut à droite, au-dessus de l'émoticône */}
          <span
            className={`absolute right-2 top-0 text-xs z-20 select-none px-2 py-1 rounded mb-1 ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            style={{ pointerEvents: 'none', transform: 'translateY(-120%)' }}
          >
            {isConnected ? '🟢 Connecté' : '🔴 Déconnecté'}
          </span>
          {/* Emoticône du geste détecté en haut à droite ou gauche du canvas */}
          {gesture !== "..." && gesture !== "inconnu" && (
            <span
              className={`absolute top-2 ${handedness === 'Right' ? 'left-2' : 'right-2'} text-7xl z-10 select-none`}
              style={{
                pointerEvents: 'none',
                transform: handedness === 'Left' ? 'scaleX(-1)' : undefined
              }}
            >
              {gesture === "feuille" && "🖐️"}
              {gesture === "pierre" && "👊"}
              {gesture === "ciseau" && "✌️"}
            </span>
          )}
          <video
            ref={videoRef}
            style={{ display: "none" }}
            playsInline
          />
          <canvas
            ref={canvasRef}
            width={dimensions.width}
            height={dimensions.height}
            className="rounded-lg shadow-lg border-4 border-blue-300 bg-black"
            style={{ maxWidth: '100vw', height: 'auto', transform: 'scaleX(-1)' }}
          />
          {/* Overlay fondu au noir si perdu */}
          {fadeToBlack && (
            <div
              className="absolute top-0 left-0 w-full h-full pointer-events-none z-50 fade-black-overlay"
              style={{ borderRadius: '0.75rem' }}
            />
          )}
          {/* Affichage du résultat visuel (croix/coche) CENTRÉ SUR LE CANVAS */}
          {masterResult && lastPlayedGesture && (() => {
            const outcome = getGameOutcome(lastPlayedGesture, masterResult);
            if (outcome === 'gagné' && showVictoryIcon) {
              return (
                <span className="absolute inset-0 flex items-center justify-center text-[18rem] z-50 select-none pointer-events-none fade-out-victory">✅</span>
              );
            }
            if (outcome === 'perdu' && showDefeatIcon) {
              return (
                <span className="absolute inset-0 flex items-center justify-center text-[12rem] z-40 select-none defeat-static" style={{ pointerEvents: 'none', left: 0, top: 0, width: '100%', height: '100%' }}>❌</span>
              );
            }
            return null;
          })()}
          {/* Décompte juste sous la caméra, rectangle centré, grand, shadow */}
          {/* Dynamique de couleur et clignotement du compteur */}
          {(() => {
            const value = currentCount;
            let rectangleClass = "bg-blue-100 text-blue-800";
            let animateClass = "";
            if (value !== null && [3,2,1].includes(value)) {
              rectangleClass = "bg-red-100 text-red-800";
              animateClass = "animate-blink-fast";
            } else if (value === 0) {
              rectangleClass = "bg-red-100 text-red-800";
              animateClass = "";
            }
            return (
              <div className="w-full flex justify-center mt-6">
                <div className={`min-w-[120px] px-8 py-4 rounded-xl shadow-lg text-5xl font-extrabold flex items-center justify-center ${rectangleClass} ${animateClass}`}>
                  {value !== null ? value : '-'}
                </div>
              </div>
            );
          })()}
        </div>
      </main>

      {/* Footer pour messages de connexion/erreur */}
      <footer className="w-full flex justify-center items-center py-6">
        {isLoading ? (
          <div className="text-gray-500">Connexion au serveur...</div>
        ) : !walletAddress ? (
          <div className="text-red-500">Erreur de connexion</div>
        ) : null}
      </footer>
      {/* Animation CSS pour le clignotement rapide et le fondu au noir */}
      <style jsx>{`
        .animate-blink-fast {
          animation: blink-fast 1s steps(2, start) infinite;
        }
        @keyframes blink-fast {
          to {
            visibility: hidden;
          }
        }
        .fade-black-overlay {
          background: black;
          opacity: 0;
          animation: fadeToBlack 2s forwards;
        }
        @keyframes fadeToBlack {
          to {
            opacity: 1;
          }
        }
        .fade-out-victory {
          opacity: 0.5;
          animation: fadeVictory 5s forwards;
        }
        @keyframes fadeVictory {
          to {
            opacity: 0;
          }
        }
        .defeat-static {
          opacity: 0.5;
        }
        .fade-out-defeat {
          /* plus utilisée */
        }
      `}</style>
    </div>
  );
}