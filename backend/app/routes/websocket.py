from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.connections import ConnectionManager
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter()
manager = ConnectionManager()

# Route WebSocket pour les managers (interface d'administration)
@router.websocket("/ws/manager")
async def websocket_manager_endpoint(websocket: WebSocket):
    """
    Endpoint WebSocket pour les connexions manager.
    - Permet à l'interface manager de recevoir en temps réel la liste des clients connectés/déconnectés.
    - Chaque fois qu'un client se connecte ou se déconnecte, la liste est envoyée à tous les managers connectés.
    - Peut être étendu pour recevoir des commandes du manager (ex: démarrer un jeu, envoyer un message à tous, etc.).
    """
    await manager.connect_master(websocket)
    try:
        while True:
            # Pour l'instant, on attend simplement les messages du manager (non utilisé, mais extensible)
            await websocket.receive_text()
    except WebSocketDisconnect:
        # Si le master se déconnecte, on le retire de la liste
        manager.disconnect_master(websocket)

# Route WebSocket pour les clients (participants au jeu)
@router.websocket("/ws/{wallet_address}")
async def websocket_endpoint(websocket: WebSocket, wallet_address: str):
    """
    Endpoint WebSocket pour les connexions client.
    - Permet à chaque client de recevoir les messages du serveur (ex: début du compte à rebours, notifications).
    - Le client doit fournir son wallet_address pour s'authentifier.
    - Si l'adresse n'est pas reconnue, la connexion est refusée.
    - Reçoit les résultats du jeu (geste, image) à la fin du compte à rebours.
    """
    logger.info(f"Tentative de connexion WebSocket pour le wallet: {wallet_address}")
    
    # Vérifier si le client est enregistré
    is_registered = manager.is_client_registered(wallet_address)
    logger.info(f"Client {wallet_address} est enregistré: {is_registered}")
    
    connection_successful = await manager.connect(websocket, wallet_address)
    if not connection_successful:
        logger.warning(f"Connexion refusée pour le wallet: {wallet_address}")
        return

    logger.info(f"Client {wallet_address} connecté avec succès")

    try:
        while True:
            # Attendre les messages du client
            data = await websocket.receive_text()
            try:
                game_data = json.loads(data)
                if game_data["type"] == "game_result":
                    # Log les données reçues
                    logger.info(f"Résultat reçu du client {wallet_address}: {game_data['gesture']}")
                    # Envoyer les résultats aux masters
                    for master in manager.master_connections:
                        await master.send_text(json.dumps({
                            "type": "game_result",
                            "wallet": wallet_address,
                            "gesture": game_data["gesture"],
                            "image": game_data["image"]
                        }))
            except json.JSONDecodeError:
                logger.error(f"Erreur de décodage JSON pour le client {wallet_address}")
    except WebSocketDisconnect:
        logger.info(f"Client {wallet_address} déconnecté")
        manager.disconnect(wallet_address)
        await manager.broadcast(f"Client #{wallet_address} left the chat")
