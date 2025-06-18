'use client'

import { useState, useEffect, useRef } from 'react'
import ClientsDrawer from './ClientsDrawer'
import React from 'react'
import { speak } from "@/lib/tts"

interface Client {
  username: string
  wallet_address: string
  is_connected: boolean
}

export default function MasterPage() {
  const [countdownValue, setCountdownValue] = useState(5)
  const [isLoading, setIsLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<any>(null)
  const prevValueRef = useRef<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [roundResult, setRoundResult] = useState(false)
  const [roundValue, setRoundValue] = useState<number | null>(null)

  // Connexion au WebSocket
  useEffect(() => {
    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR_WS}/ws/manager`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('✅ Manager WebSocket connecté')
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'clients_update') {
          setClients(data.clients)
        }
        if (data.type === 'countdown' && typeof data.value === 'number') {
          setCountdown(data.value)
        }

        if (data.type === 'master_result') {
          console.log('🎲 Résultat du master reçu:', data.value);
        }
        if (data.type === 'game_result') {
          console.log('🎮 Résultat reçu:', {
            username: data.username,
            wallet: data.wallet,
            gesture: data.gesture,
            emotions: data.emotions,
            emotion_score: data.emotion_score,
            timestamp: data.timestamp
          });

          // Afficher un résumé des émotions
          const topEmotion = Object.entries(data.emotions || {})
            .sort(([,a], [,b]) => (b as number) - (a as number))[0];
          
          if (topEmotion) {
            console.log(`😊 Émotion principale de ${data.username}: ${topEmotion[0]} (${Math.round(topEmotion[1] as number)}%)`);
          }
          console.log(`📊 Score émotionnel global: ${Math.round(data.emotion_score)}%`);
        }
      } catch (error) {
        console.error('Erreur de parsing du message:', error)
      }
    }

    ws.onclose = () => {
      console.log('❎ Manager WebSocket déconnecté')
      setIsConnected(false)
    }

    ws.onerror = (error) => {
      console.error('❌ Manager WebSocket erreur:', error)
      setIsConnected(false)
    }

    return () => {
      ws.close()
    }
  }, [])

  // Démarrer le compte à rebours
  const startCountdown = async () => {
    // Réinitialise l'affichage du résultat
    setRoundResult(false);
    setRoundValue(null);
    setCountdown(countdownValue); // Affiche directement le bon chiffre
    // Parle au lancement du jeu
    speak("Attention! Le jeu commence !", "fr", "google");
    await new Promise(resolve => setTimeout(resolve, 2500));
    speak("Préparez-vous!", "fr", "google");
    // Initialiser l'AudioContext lors du premier clic utilisateur
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext);
      audioCtxRef.current = new AudioCtx();
    }
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/broadcast_countdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ duration: countdownValue }),
      })
      const data = await response.json()
      console.log('Countdown started:', data)
    } catch (error) {
      console.error('Error starting countdown:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const broadcast_result = async () => {
    const randomValue = Math.floor(Math.random() * 3); // 0: pierre, 1: feuille, 2: ciseaux
    let gameResult = "";
    if (randomValue === 0) {
      gameResult = "Pierre";
    } else if (randomValue === 1) {
      gameResult = "Feuille";
    } else if (randomValue === 2) {
      gameResult = "Ciseaux";
    }

    setRoundValue(randomValue);
    setRoundResult(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/broadcast_game_result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_result: gameResult })
      })
      const data = await response.json()
      console.log('Game result broadcasted:', data)
    } catch (error) {
      console.error('Error broadcasting game result:', error)
    }

  }

  // Détermine la couleur et l'animation du rectangle selon la valeur
  const currentValue = countdown !== null ? countdown : countdownValue;
  let rectangleClass = "bg-blue-100 text-blue-800";
  let animateClass = "";
  if ([3,2,1].includes(currentValue)) {
    rectangleClass = "bg-red-100 text-red-800";
    animateClass = "animate-blink-fast";
  } else if (currentValue === 0) {
    rectangleClass = "bg-red-100 text-red-800";
    animateClass = "";
  }

  // Effet pour jouer un bip à 3, 2, 1
  useEffect(() => {
    if (countdown !== null) {
      if (countdown === 3 && prevValueRef.current !== 3) {
        speak("3", "fr", "google");
      }
      if (countdown === 2 && prevValueRef.current !== 2) {
        speak("2", "fr", "google");
      }
      if (countdown === 1 && prevValueRef.current !== 1) {
        speak("1", "fr", "google");
      }

      if (countdown === 0 && prevValueRef.current !== 0) {
        speak("Ciseaux!", "fr", "google");
        broadcast_result();
      }
    }
    prevValueRef.current = countdown;
  }, [countdown]);


  // Bip sonore (fréquence 880Hz, 200ms)
  function playBeep() {
    if (typeof window === 'undefined') return;
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.2;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  // Bip sonore long (fréquence 1760Hz, 1s)
  function playLongBeep() {
    if (typeof window === 'undefined') return;
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 1760;
    g.gain.value = 0.2;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 1.0);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  return (
    <main className="p-8 min-h-screen flex flex-col">
      <div className="mb-8 w-full flex justify-center">
        <h1 className="text-5xl font-extrabold text-center w-full">AIcebreaker</h1>
      </div>
      <ClientsDrawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} clients={clients} />
      <div className="flex-grow flex flex-col items-center justify-center pb-40">
        <div className="w-full flex justify-center mt-6">
          {isEditing ? (
            <input
              ref={inputRef}
              type="number"
              min={1}
              inputMode="numeric"
              pattern="[0-9]*"
              className={`w-[420px] min-w-[420px] max-w-[420px] px-12 py-12 bg-blue-100 text-blue-800 rounded-xl shadow-lg font-extrabold flex items-center justify-center text-center outline-none border-2 border-blue-300 focus:border-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              style={{ fontSize: '18rem', lineHeight: 1, MozAppearance: 'textfield' }}
              value={countdownValue}
              onChange={e => {
                setCountdownValue(Math.max(1, parseInt(e.target.value) || 0));
                setCountdown(null);
              }}
              onBlur={() => setIsEditing(false)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setIsEditing(false);
                }
              }}
              autoFocus
            />
          ) : (
            <div
              className={`min-w-[420px] min-h-[420px] w-[420px] h-[420px] rounded-xl shadow-lg font-extrabold flex items-center justify-center ${roundResult ? 'bg-green-200 text-green-900' : rectangleClass} ${animateClass}`}
              style={{ fontSize: roundResult ? '12rem' : '18rem', lineHeight: 1, cursor: 'pointer', padding: 0 }}
              onClick={() => setIsEditing(true)}
              title="Cliquez pour modifier le compte à rebours"
            >
              {roundResult
                ? (roundValue === 0 ? "👊" : roundValue === 1 ? "🖐️" : roundValue === 2 ? "✌️" : "-")
                : (currentValue)
              }
            </div>
          )}
        </div>
        {/* Bouton start sous le compteur */}
        <div className="w-full flex justify-center mt-8">
          <button
            onClick={startCountdown}
            disabled={isLoading || !isConnected || (countdown !== null && countdown !== 0)}
            className={`w-32 h-32 rounded-full bg-red-700 shadow-lg flex items-center justify-center text-white text-3xl font-bold transition-opacity duration-200 ${
              isLoading || !isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
            }`}
            style={{ boxShadow: '0 4px 24px 0 rgba(0,0,0,0.15)' }}
          >
            START
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Bouton rectangle centré en bas de la page, masqué si drawer ouvert */}
        {!isDrawerOpen && (
          <div className="fixed bottom-6 left-0 w-full flex justify-center z-50">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="px-24 py-3 rounded-xl bg-white text-black shadow-lg border border-gray-300 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
              aria-label="Voir les clients"
            >
              {/* Bouton sans texte pour l'instant */}
            </button>
          </div>
        )}
      </div>
      {/* Animation CSS pour le clignotement rapide */}
      <style jsx>{`
        .animate-blink-fast {
          animation: blink-fast 1s steps(2, start) infinite;
        }
        @keyframes blink-fast {
          to {
            visibility: hidden;
          }
        }
      `}</style>
    </main>
  );
}
