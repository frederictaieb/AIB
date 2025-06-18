# logging_config.py
import logging


class CustomFormatter(logging.Formatter):
    GREEN = "\033[92m"   # Vert pour INFO
    YELLOW = "\033[93m"  # Jaune pour le nom de fichier
    BLUE = "\033[94m"    # Bleu clair pour l'heure
    RED = "\033[91m"     # Rouge pour ERROR
    CYAN = "\033[96m"    # Cyan pour DEBUG
    MAGENTA = "\033[95m" # Magenta pour WARNING
    WHITE = "\033[97m"   # Blanc pour CRITICAL
    BOLD = "\033[1m"     # Gras pour les niveaux importants
    RESET = "\033[0m"    # Reset pour la couleur

    def format(self, record):
        dt = self.formatTime(record, datefmt="%d/%m/%y - %H:%M:%S")
        dt_colored = f"[{self.BLUE}{dt}{self.RESET}]"
        levelname = record.levelname
        if record.levelno == logging.INFO:
            levelname = f"[{self.GREEN}{levelname}{self.RESET}]"
        filename_colored = f"[{self.YELLOW}{record.filename}{self.RESET}]"
        funcName_colored = f"[{self.BOLD}{record.funcName}{self.RESET}]"
        
        base_msg = f"{dt_colored} {levelname} {filename_colored} {funcName_colored}\n{record.getMessage()}\n"
        return base_msg

def logger_init(level=logging.INFO):
    handler = logging.StreamHandler()
    handler.setFormatter(CustomFormatter())
    root_logger = logging.getLogger()
    root_logger.handlers = [handler]
    root_logger.setLevel(level)