from xrpl.wallet import Wallet
from xrpl.constants import CryptoAlgorithm
from xrpl.clients import WebsocketClient
from xrpl.models.transactions import Payment, Memo
from xrpl.utils import xrp_to_drops
from xrpl.transaction import autofill_and_sign
from xrpl.transaction import submit_and_wait
from xrpl.clients import JsonRpcClient
from xrpl.models.requests import AccountInfo
from app.utils.logger import logger_init
from xrpl.utils import drops_to_xrp
import logging


logger_init()
logger = logging.getLogger(__name__) 

def create_wallet():
    from xrpl.wallet import generate_faucet_wallet
    JSON_RPC_URL = "https://s.altnet.rippletest.net:51234/"
    client = JsonRpcClient(JSON_RPC_URL)
    wallet = generate_faucet_wallet(client)
    logger.info(f"Wallet created: {wallet}")
    return wallet

def get_xrp_balance(wallet_address):
    from xrpl.clients import JsonRpcClient
    JSON_RPC_URL = "https://s.altnet.rippletest.net:51234/"
    client = JsonRpcClient(JSON_RPC_URL)
    req = AccountInfo(account=wallet_address, ledger_index="validated", strict=True)
    response = client.request(req)
    logger.info(f"Balance: {response.result['account_data']['Balance']}")
    return drops_to_xrp(response.result['account_data']['Balance'])

