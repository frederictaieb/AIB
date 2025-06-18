from pydantic import BaseModel
from typing import List, Optional

# Modèle pour démarrer le compte à rebours
class Countdown(BaseModel):
    duration: int  # Durée du compte à rebours en secondes

# Modèle pour la réponse du client à la fin du compte à rebours
class ClientResponse(BaseModel):
    wallet_address: str
    image: Optional[str] = None
    value: Optional[str] = None

# Modèle pour la liste des clients connectés
class Client(BaseModel):
    wallet_address: str
    username: str
    wallet_seed: str
    xrp_balance: float
    is_connected: bool

# Modèle pour la liste des clients connectés
class ClientList(BaseModel):
    clients: List[Client] 

class GameResultRequest(BaseModel):
    game_result: str