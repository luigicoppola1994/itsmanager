# ==============================================================================
# auth.py — Modulo di autenticazione e sicurezza
# Questo file contiene tutte le funzioni legate alla gestione di:
# - Hashing delle password (bcrypt)
# - Creazione e verifica dei token JWT (access + refresh)
# ==============================================================================

from datetime import datetime, timedelta
import jwt                                    # Libreria PyJWT per creare/verificare token JWT
from passlib.context import CryptContext      # Libreria per hashing sicuro delle password
from fastapi.security import OAuth2PasswordBearer  # Schema OAuth2 per leggere il token dall'header

# ------------------------------------------------------------------------------
# CONFIGURAZIONE SICUREZZA
# In produzione, questi valori devono essere caricati da variabili d'ambiente
# e non scritti direttamente nel codice (es. tramite python-dotenv o os.environ)
# ------------------------------------------------------------------------------

SECRET_KEY = "la_tua_chiave_segreta_molto_sicura"  # ⚠️ CAMBIARE in produzione!
ALGORITHM = "HS256"                                  # Algoritmo di firma del token JWT
ACCESS_TOKEN_EXPIRE_MINUTES = 30                     # L'access token scade dopo 30 minuti
REFRESH_TOKEN_EXPIRE_DAYS = 7                        # Il refresh token dura 7 giorni

# Configura il contesto per l'hashing con l'algoritmo bcrypt.
# bcrypt è l'algoritmo raccomandato per le password: è lento e aggiunge un "salt" automaticamente.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# oauth2_scheme è usato da FastAPI per estrarre il token JWT dall'header HTTP:
# "Authorization: Bearer <token>"
# tokenUrl="login" indica a FastAPI dove trovare l'endpoint di login per la documentazione.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


# ------------------------------------------------------------------------------
# FUNZIONE: verify_password
# Verifica se la password inserita dall'utente corrisponde a quella nel database.
# ------------------------------------------------------------------------------
def verify_password(plain_password, hashed_password):
    try:
        # Prima prova a verificare come hash bcrypt (password moderne create dal backend)
        if pwd_context.verify(plain_password, hashed_password):
            return True
    except Exception:
        # Se il formato non è un hash bcrypt, cattura l'eccezione e prova il fallback
        pass
    # Fallback: confronto diretto in testo chiaro per password legacy nel DB
    return plain_password == hashed_password


# ------------------------------------------------------------------------------
# FUNZIONE: get_password_hash
# Trasforma una password in chiaro nel suo hash bcrypt per salvarla nel DB.
# USARE SEMPRE questa funzione quando si salva una nuova password!
# ------------------------------------------------------------------------------
def get_password_hash(password):
    return pwd_context.hash(password)


# ------------------------------------------------------------------------------
# FUNZIONE: create_access_token
# Crea un token JWT di breve durata (30 min) usato per autenticare le richieste API.
# Il token viene inviato dal frontend nell'header: Authorization: Bearer <token>
# ------------------------------------------------------------------------------
def create_access_token(data: dict):
    to_encode = data.copy()                             # Copia i dati da codificare (es. email)
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})  # Aggiunge scadenza e tipo al payload
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)  # Firma il token con la chiave


# ------------------------------------------------------------------------------
# FUNZIONE: create_refresh_token
# Crea un token JWT di lunga durata (7 giorni) usato per rinnovare l'access token
# senza richiedere un nuovo login. Viene salvato in un cookie HttpOnly (invisibile a JS).
# ------------------------------------------------------------------------------
def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})  # "type":"refresh" lo distingue dall'access
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ==============================================================================
# DOVE AGGIUNGERE NUOVO CODICE:
# - Per gestire ruoli (es. solo admin può fare X), aggiungere una funzione
#   "get_current_admin_user" che controlla user.id_ruolo == 1
# - Per gestire il logout, creare una lista nera di token revocati (o Redis)
# - Per maggiore sicurezza, caricare SECRET_KEY da variabili d'ambiente:
#     import os
#     SECRET_KEY = os.environ.get("SECRET_KEY", "fallback_key")
# ==============================================================================
