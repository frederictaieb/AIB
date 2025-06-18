import React from 'react'

interface Client {
  username: string
  wallet_address: string
  is_connected: boolean
}

interface ClientsDrawerProps {
  open: boolean
  onClose: () => void
  clients: Client[]
}

const ClientsDrawer: React.FC<ClientsDrawerProps> = ({ open, onClose, clients }) => {
  return (
    <>
      {/* Overlay transparent pour garder la page visible */}
      {open && (
        <div
          className="fixed inset-0 bg-transparent z-40"
          onClick={onClose}
        />
      )}
      {/* Drawer en bas, glissant vers le haut */}
      <aside
        className={`fixed left-0 bottom-0 w-full max-w-full bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ minHeight: '220px', borderTopLeftRadius: '1rem', borderTopRightRadius: '1rem' }}
        aria-label="Liste des clients"
      >
        <div className="flex items-center justify-between p-4 border-b rounded-t-xl">
          <h2 className="text-xl font-semibold">Clients ({clients.length})</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>
        <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
          {clients.map((client) => (
            <div
              key={client.wallet_address}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
            >
              <span className="font-mono">{client.username} - {client.wallet_address}</span>
              <span className={`px-2 py-1 rounded-full text-sm ${
                client.is_connected
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {client.is_connected ? '🟢 Connecté' : '🔴 Déconnecté'}
              </span>
            </div>
          ))}
          {clients.length === 0 && (
            <p className="text-gray-500 text-center py-4">
              Aucun client enregistré
            </p>
          )}
        </div>
      </aside>
    </>
  )
}

// Détermine le résultat du jeu pierre-feuille-ciseaux
export function getGameOutcome(lastPlayedGesture: string, masterResult: string): 'gagné' | 'perdu' | 'égalité' | 'invalide' {
  const normalize = (s: string) => s.trim().toLowerCase();
  const player = normalize(lastPlayedGesture);
  const master = normalize(masterResult);
  if (player === master) return 'égalité';
  if (
    (player === 'ciseau' && master === 'feuille') ||
    (player === 'feuille' && master === 'pierre') ||
    (player === 'pierre' && master === 'ciseau')
  ) {
    return 'gagné';
  }
  if (["pierre", "feuille", "ciseau"].includes(player) && ["pierre", "feuille", "ciseau"].includes(master)) {
    return 'perdu';
  }
  return 'invalide';
}

export default ClientsDrawer 