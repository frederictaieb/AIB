// components/WebSocketClient.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const useWebSocket = () => {
  const [currentCount, setCurrentCount] = useState<number | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const sendCountdownResponse = async () => {
    if (!walletAddress) return

    try {
      const formData = new FormData()
      formData.append('wallet_address', walletAddress)
      formData.append('value', '42')
      
      const mockImage = new Blob(['test image content'], { type: 'image/jpeg' })
      formData.append('image', mockImage, 'response.jpg')

      const response = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/countdown-response`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()
      console.log('📤 Réponse API:', result)
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de la réponse:', error)
    }
  }

  // Obtenir l'ID du serveur
  useEffect(() => {
    const getClientId = async () => {
      try {
        console.log(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/generate-client-id`)
        const response = await fetch(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR}/api/generate-client-id`)
        const data = await response.json()
        setWalletAddress(data.wallet_address)
      } catch (error) {
        console.error('❌ Erreur lors de l\'obtention de l\'ID client:', error)
      } finally {
        setIsLoading(false)
      }
    }

    getClientId()
  }, [])

  // Établir la connexion WebSocket une fois l'ID obtenu
  useEffect(() => {
    if (!walletAddress) return

    let ws: WebSocket | null = null
    
    try {
      ws = new WebSocket(`${process.env.NEXT_PUBLIC_FASTAPI_ADDR_WS}/ws/${walletAddress}`)
      //ws = new WebSocket(`${process.env.FASTAPI_ADDR_WS}/ws/${clientId}`);
      socketRef.current = ws

      ws.onopen = () => {
        console.log(`✅ WebSocket connecté avec son wallet: ${walletAddress}`)
        setIsConnected(true)
      }

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'countdown' && typeof data.value === 'number') {
            setCurrentCount(data.value);
            if (data.value === 0) {
              sendCountdownResponse();
            }
          }
        } catch {
          // fallback pour les anciens messages texte
          const countMatch = event.data.match(/Compteur: (\d+)/);
          if (countMatch) {
            const count = parseInt(countMatch[1]);
            setCurrentCount(count);
            if (count === 0) {
              sendCountdownResponse();
            }
          }
        }
      }

      ws.onclose = () => {
        console.log(`❎ WebSocket déconnecté (Client: ${walletAddress})`)
        setIsConnected(false)
      }
    } catch (error) {
      console.error(`Failed to create WebSocket connection (Client: ${walletAddress}):`, error)
      setIsConnected(false)
    }

    return () => {
      if (ws) {
        ws.close()
      }
    }
  }, [walletAddress])

  return { currentCount, isConnected, walletAddress, isLoading }
}

const WebSocketClient = () => {
  const { currentCount, isConnected, walletAddress, isLoading } = useWebSocket()

  if (isLoading) {
    return <div className="p-4">Obtention de l'ID client...</div>
  }

  if (!walletAddress) {
    return <div className="p-4">Impossible d'obtenir un ID client</div>
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-2 items-center">
        <span className={`inline-block px-2 py-1 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {isConnected ? '🟢 Connecté' : '🔴 Déconnecté'}
        </span>
        <span className="text-sm text-gray-600">
          ID: {walletAddress}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center mt-8">
        {currentCount !== null ? (
          <>
            <div className="text-sm text-gray-600 mb-2">Compte à rebours</div>
            <div className="text-6xl font-bold bg-blue-100 text-blue-800 rounded-full w-24 h-24 flex items-center justify-center">
              {currentCount}
            </div>
          </>
        ) : (
          <div className="text-gray-500">En attente du compte à rebours...</div>
        )}
      </div>
    </div>
  )
}

export default WebSocketClient
