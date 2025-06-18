// Détermine le résultat du jeu pierre-feuille-ciseaux
export function getGameOutcome(lastPlayedGesture: string, masterResult: string): 'gagné' | 'perdu' | 'égalité' | 'invalide' {
  const normalize = (s: string) => s.trim().toLowerCase();
  const player = normalize(lastPlayedGesture);
  const master = normalize(masterResult);
  if (player === master) return 'gagné';
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


