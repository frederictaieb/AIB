import json
import asyncio
import logging
from app.utils.logger import logger_init
from fastapi import APIRouter, HTTPException, Form, File, UploadFile, Query, Body
from app.models.schemas import Countdown, ClientList, Client
from app.routes.websocket import manager
from app.services.xrp import create_wallet, get_xrp_balance
from fastapi.responses import JSONResponse
from app.services.ai import fer_score, tts_google, tts_x3
from datetime import datetime

from pydantic import BaseModel

logger = logging.getLogger(__name__)
logger_init()

router = APIRouter()
global last_result# 0: pierre, 1: feuille, 2: ciseaux

# Route POST /api/broadcast
# Cette route est appelée par l'interface master pour démarrer un compte à rebours
# Paramètres:
#   - countdown: Objet Countdown contenant la durée en secondes (duration)
# Retourne:
#   - Un message de confirmation que le compte à rebours a démarré
# Exemple d'appel:
#   POST /api/broadcast
#   Body: {"duration": 10}
@router.post("/broadcast_countdown")
async def broadcast_message(countdown: Countdown):
    """Lance un compte à rebours pour tous les clients."""
    for i in range(countdown.duration, -1, -1):
        message = json.dumps({"type": "countdown", "value": i})
        await manager.broadcast_countdown(message)
        await asyncio.sleep(1)
    return {"message": "Countdown started"}

class GameResultRequest(BaseModel):
    game_result: str

@router.post("/broadcast_game_result")
async def broadcast_game_result(req: GameResultRequest):
    message = json.dumps({"type": "game_result", "value": req.game_result})
    await manager.broadcast_game_result(message)
    return {"message": "Game result broadcasted"}


# Route GET /api/clients
# Retourne la liste de tous les clients enregistrés et leur état de connexion
# Cette route est utilisée par l'interface master pour afficher l'état des clients
# Retourne:
#   - Un objet ClientList contenant un tableau de clients
# Exemple de réponse:
#   {
#     "clients": [
#       {"client_id": "a1b2c3d4", "is_connected": true},
#       {"client_id": "e5f6g7h8", "is_connected": false}
#     ]
#   }
@router.get("/clients", response_model=ClientList)
async def get_clients():
    """Récupère la liste des clients."""
    clients = [
        Client(wallet_address=wallet_address, is_connected=wallet_address in manager.active_connections)
        for wallet_address in manager.registered_clients
    ]
    return ClientList(clients=clients) 

@router.post("/game-result")
async def submit_game_result(
    wallet_address: str = Form(...),
    gesture: str = Form(...),
    image: UploadFile = File(...)
):
    """
    Reçoit le résultat d'une partie de pierre-feuille-ciseaux
    - wallet_address: l'adresse du wallet du joueur
    - gesture: le geste détecté (pierre, feuille, ciseaux)
    - image: capture d'écran du moment du geste
    """
    try:
        # Vérifier que le client est enregistré
        if not manager.is_client_registered(wallet_address):
            raise HTTPException(status_code=404, detail="Client non trouvé")

        # Récupérer le username du client
        username = manager.registered_clients[wallet_address]["username"]
        logger.info(f"Résultat reçu de {username} ({wallet_address})")

        # Analyse émotionnelle de l'image
        emotion_result = fer_score(image)
        logger.info(f"Analyse émotionnelle pour {username}: {emotion_result}")
        
        # Réinitialiser le pointeur du fichier pour la lecture suivante
        await image.seek(0)
        image_content = await image.read()
        
        # Log du résultat
        logger.info(f"Résultat du client {username} ({wallet_address}): {gesture}")

        # Notifier les masters via WebSocket
        message = json.dumps({
            "type": "game_result",
            "wallet": wallet_address,
            "username": username,
            "gesture": gesture,
            "emotions": emotion_result.get("emotions", {}),
            "emotion_score": emotion_result.get("score", 0),
            "timestamp": datetime.now().isoformat()
        })
        
        for master in manager.master_connections:
            try:
                await master.send_text(message)
            except Exception as e:
                logger.error(f"Erreur d'envoi au master: {e}")

        return {
            "status": "success",
            "wallet_address": wallet_address,
            "username": username,
            "gesture": gesture,
            "emotions": emotion_result.get("emotions", {}),
            "emotion_score": emotion_result.get("score", 0),
            "image_size": len(image_content)
        }
    except Exception as e:
        logger.error(f"Erreur lors du traitement du résultat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Création utilisateur
@router.get("/create_user/{username}", response_class=JSONResponse)
def create_user(username: str):
    wallet = create_wallet()
    # Enregistre le client dans le manager
    manager.register_client(username, wallet)
    return {
        "username": username,
        "wallet_address": wallet.address,
        "wallet_seed": wallet.seed,
        "xrp_balance": getattr(wallet, "balance", 0.0),
        "is_connected": False
    }

# Route GET /api/get_username/{wallet_address}
@router.get("/get_username/{wallet_address}", response_class=JSONResponse)
def get_username(wallet_address: str):
    client = manager.registered_clients.get(wallet_address)
    if client:
        logger.info(f"Username de {wallet_address}: {client['username']}")
        return {"username": client["username"]}
    raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

@router.get("/get_balance/{wallet_address}", response_class=JSONResponse)
def get_balance(wallet_address: str):
    balance = get_xrp_balance(wallet_address)
    if balance:
        logger.info(f"Balance de {wallet_address}: {balance}")
        return {"xrp_balance": balance}
    raise HTTPException(status_code=404, detail="Balance non trouvée")

@router.post("/fer_score/")
async def fer_score_endpoint(file: UploadFile = File(...)):
    return fer_score(file)

@router.post("/tts_google/")
def tts_google_endpoint(data: dict = Body(...)):
    text = data.get("text")
    lang = data.get("lang", "fr")
    if not text:
        return {"error": "Missing 'text'"}
    logger.info(f"TTS Google: {text} - {lang}")
    return tts_google(text=text, lang=lang)

@router.post("/tts_x3/")
def tts_x3_endpoint(data: dict = Body(...)):
    text = data.get("text")
    lang = data.get("lang", "fr")
    if not text:
        return {"error": "Missing 'text'"}
    logger.info(f"TTS X3: {text} - {lang}")
    return tts_x3(text=text, lang=lang)

@router.post("/save-last-result")
async def save_last_result(result: int = Body(...)):
    """
    Sauvegarde le dernier résultat du master (0: pierre, 1: feuille, 2: ciseaux)
    """
    if result not in [0, 1, 2]:
        raise HTTPException(status_code=400, detail="Le geste doit être 0 (pierre), 1 (feuille) ou 2 (ciseaux)")
    last_result = result
    logger.info(f"Dernier résultat du master: {last_result}")
    return {"status": "success", "last_result": last_result}

@router.get("/last-result")
async def get_last_result():
    return {"last_result": last_result}

@router.post("/has-won")
async def hasWon(result: int = Body(...)):
    """
    Retourne True si le résultat reçu est égal à last_result, sinon False
    """
    if last_result is None:
        raise HTTPException(status_code=400, detail="Aucun résultat master enregistré")
    return {"hasWon": result == last_result}

@router.post("/countdown-response")
async def submit_countdown_response(wallet_address: str = Form(...), value: int = Form(...), image: UploadFile = File(...)):
    """
    Reçoit la réponse à un compte à rebours
    - wallet_address: l'adresse du wallet du joueur
    - value: la valeur du compte à rebours
    - image: capture d'écran du moment de la réponse
    """
    try:
        # Vérifier que le client est enregistré
        if not manager.is_client_registered(wallet_address):
            raise HTTPException(status_code=404, detail="Client non trouvé")

        # Lire l'image
        image_content = await image.read()
        
        # Log de la réponse
        logger.info(f"Réponse du client {wallet_address}: {value}")

        # Notifier les masters via WebSocket
        message = json.dumps({
            "type": "countdown_response",
            "wallet": wallet_address,
            "value": value,
            "timestamp": datetime.now().isoformat()
        })
        
        for master in manager.master_connections:
            try:
                await master.send_text(message)
            except Exception as e:
                logger.error(f"Erreur d'envoi au master: {e}")

        return {
            "status": "success",
            "wallet_address": wallet_address,
            "value": value,
            "image_size": len(image_content)
        }
    except Exception as e:
        logger.error(f"Erreur lors du traitement de la réponse: {e}")
        raise HTTPException(status_code=500, detail=str(e))
