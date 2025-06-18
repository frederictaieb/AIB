import logging
from fastapi import WebSocket
from typing import Dict, List, Set
import asyncio
import uuid
import json

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.registered_clients: Dict[str, dict] = {}  # clé = wallet_address
        self.master_connections: List[WebSocket] = []

    def register_client(self, username: str, wallet):
        wallet_address = wallet.address
        self.registered_clients[wallet_address] = {
            "username": username,
            "wallet_address": wallet_address,
            "wallet_seed": wallet.seed,
            "xrp_balance": getattr(wallet, "balance", 0.0),
            "is_connected": False
        }
        logger.info(f"Client enregistré: {username} - {wallet_address}")
        logger.info(f"Liste des clients enregistrés: {list(self.registered_clients.keys())}")

    def is_client_registered(self, wallet_address: str) -> bool:
        is_registered = wallet_address in self.registered_clients
        logger.info(f"Vérification d'enregistrement pour {wallet_address}: {is_registered}")
        return is_registered

    async def connect_master(self, websocket: WebSocket):
        """Connecte un master WebSocket."""
        await websocket.accept()
        self.master_connections.append(websocket)
        await self.broadcast_client_list()

    def disconnect_master(self, websocket: WebSocket):
        """Déconnecte un master WebSocket."""
        if websocket in self.master_connections:
            self.master_connections.remove(websocket)

    async def connect(self, websocket: WebSocket, wallet_address: str) -> bool:
        """Connecte un client WebSocket."""
        if not self.is_client_registered(wallet_address):
            logger.warning(f"Tentative de connexion d'un client non enregistré: {wallet_address}")
            await websocket.close(code=4001, reason="Wallet address non reconnu")
            return False
            
        await websocket.accept()
        self.active_connections[wallet_address] = websocket
        # Marque le client comme connecté
        if wallet_address in self.registered_clients:
            self.registered_clients[wallet_address]["is_connected"] = True
            logger.info(f"Client {wallet_address} marqué comme connecté")
            
        await self.broadcast_client_list()
        logger.info(f"Clients actifs après connexion: {list(self.active_connections.keys())}")
        return True

    def disconnect(self, wallet_address: str):
        """Déconnecte un client."""
        logger.info(f"Déconnexion du client: {wallet_address}")
        self.active_connections.pop(wallet_address, None)
        # Marque le client comme déconnecté
        if wallet_address in self.registered_clients:
            self.registered_clients[wallet_address]["is_connected"] = False
            logger.info(f"Client {wallet_address} marqué comme déconnecté")
        asyncio.create_task(self.broadcast_client_list())

    async def send_personal_message(self, message: str, wallet_address: str):
        """Envoie un message à un client spécifique."""
        if wallet_address in self.active_connections:
            await self.active_connections[wallet_address].send_text(message)

    async def broadcast(self, message: str):
        """Diffuse un message à tous les clients."""
        for connection in self.active_connections.values():
            await connection.send_text(message)
    
    async def broadcast_countdown(self, message: str):
        """Diffuse un message de compte à rebours à tous les clients."""
        for connection in self.active_connections.values():
            await connection.send_text(message)
        for master in self.master_connections:
            await master.send_text(message)
    
    async def broadcast_game_result(self, message: str):
        """Diffuse un message de résultat de jeu à tous les clients."""
        for connection in self.active_connections.values():
            await connection.send_text(message)
        for master in self.master_connections:
            await master.send_text(message)

    async def broadcast_client_list(self):
        """Envoie la liste mise à jour des clients à tous les masters."""
        if not self.master_connections:
            return
        clients = list(self.registered_clients.values())
        message = json.dumps({
            "type": "clients_update",
            "clients": clients
        })
        for master in self.master_connections:
            try:
                await master.send_text(message)
            except Exception as e:
                logger.error(f"Erreur lors de l'envoi au master: {e}")
                pass 