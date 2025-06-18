# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import api, websocket
from app.utils.logger import logger_init
import dotenv
import logging
import os

# Initialize logging
logger_init()
logger = logging.getLogger(__name__)

dotenv.load_dotenv()

app = FastAPI(title="AIcebreaker Backend",
             description="Backend pour l'application de compte à rebours en temps réel",
             version="1.0.0")

# Configuration CORS
FRONTEND_ADDR = os.environ.get('FRONTEND_ADDR')
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"{FRONTEND_ADDR}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routersx
app.include_router(api.router, prefix="/api", tags=["api"])
app.include_router(websocket.router, tags=["websocket"])