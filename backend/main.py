# ==============================================================================
# main.py — Punto di ingresso dell'API FastAPI
# Questo è il file principale del backend. Definisce tutti gli endpoint HTTP
# (le "rotte") che il frontend può chiamare.
#
# STRUTTURA DI UN ENDPOINT:
# @app.metodo("/percorso")
# def nome_funzione(parametri):
#     # logica
#     return risultato
#
# COME AGGIUNGERE NUOVE FUNZIONALITÀ:
# 1. Aggiungi il modello in models.py
# 2. Aggiungi gli schemi in schemas.py
# 3. Aggiungi gli endpoint qui sotto, seguendo i commenti "DOVE AGGIUNGERE"
# ==============================================================================

# --- Importazioni da FastAPI ---
from fastapi import FastAPI, Depends, HTTPException, Response, Cookie, status
# FastAPI: la classe principale che crea l'app
# Depends: sistema di "dependency injection" per iniettare dipendenze (es. DB, utente corrente)
# HTTPException: per restituire errori HTTP (es. 401 Unauthorized, 404 Not Found)
# Response: oggetto risposta HTTP, usato per impostare cookie
# Cookie: per leggere cookie dalla richiesta HTTP
# status: costanti per i codici HTTP (es. status.HTTP_200_OK)

from sqlalchemy.orm import Session     # Tipo della sessione database SQLAlchemy
from typing import List                # Per dichiarare liste come tipo di ritorno (es. List[UtenteResponse])
from fastapi.middleware.cors import CORSMiddleware  # Middleware per gestire le policy CORS
from fastapi.security import OAuth2PasswordRequestForm  # Form standard per login (username + password)
import jwt                             # Libreria PyJWT per decodificare i token

# --- Importazioni dai nostri moduli ---
import models         # I modelli SQLAlchemy (tabelle del DB)
import schemas        # Gli schemi Pydantic (validazione dati)
from database import engine, get_db   # L'engine DB e la funzione per ottenere una sessione
import auth           # Le funzioni di autenticazione (hash, token JWT)

# ------------------------------------------------------------------------------
# NOTA: create_all è commentato perché il database ha già le tabelle e i dati.
# Da usare solo se si crea un DB da zero — crea le tabelle definite in models.py.
# ATTENZIONE: non elimina dati esistenti, ma potrebbe causare conflitti se le
# definizioni in models.py non corrispondono esattamente al DB reale.
# ------------------------------------------------------------------------------
# models.Base.metadata.create_all(bind=engine)

# ------------------------------------------------------------------------------
# CREAZIONE DELL'APP FastAPI
# title: nome mostrato nella documentazione automatica su http://localhost:8000/docs
# ------------------------------------------------------------------------------
app = FastAPI(title="ITS Manager API")

# ------------------------------------------------------------------------------
# CONFIGURAZIONE CORS (Cross-Origin Resource Sharing)
# CORS controlla quali domini possono fare richieste al backend.
# È necessario perché il frontend (porta 3000) chiama il backend (porta 8000):
# il browser considera questi domini "diversi" e blocca la richiesta senza CORS.
#
# allow_origins: lista dei domini frontend autorizzati
# allow_credentials=True: permette l'invio di cookie nelle richieste cross-origin
# allow_methods=["*"]: accetta tutti i metodi HTTP (GET, POST, PUT, DELETE...)
# allow_headers=["*"]: accetta tutti gli header HTTP (incluso Authorization con JWT)
# ------------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",     # Frontend Docker in sviluppo
        "http://127.0.0.1:3000",
        "http://localhost:5500",     # Live Server di VS Code
        "http://127.0.0.1:5500"
        # ⚠️ In produzione, sostituire con l'URL reale del frontend (es. https://myapp.com)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# DEPENDENCY: get_current_user
# Questa funzione non è un endpoint ma una "dipendenza riutilizzabile".
# Viene iniettata negli endpoint protetti con: Depends(get_current_user)
# Legge il token JWT dall'header Authorization, lo verifica e restituisce l'utente.
# Se il token è assente, scaduto o non valido, lancia un errore 401.
# ==============================================================================
def get_current_user(token: str = Depends(auth.oauth2_scheme), db: Session = Depends(get_db)):
    try:
        # Decodifica il token JWT usando la chiave segreta e l'algoritmo configurati in auth.py
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])

        # Controlla che sia un access token (non un refresh token per sicurezza)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token non valido")

        # Estrae l'email dell'utente dal campo "sub" (subject) del payload JWT
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Credenziali non valide")

    except jwt.PyJWTError:
        # Cattura qualsiasi errore JWT: token scaduto, firma errata, formato invalido
        raise HTTPException(status_code=401, detail="Token scaduto o non valido")

    # Cerca l'utente nel DB con l'email estratta dal token
    user = db.query(models.Utente).filter(models.Utente.Email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Utente non trovato")

    return user  # Restituisce l'oggetto Utente SQLAlchemy


# ==============================================================================
# ENDPOINT: POST /login
# Gestisce l'autenticazione dell'utente.
# Riceve username (=email) e password dal form HTML, verifica le credenziali
# e restituisce un access token JWT + imposta un refresh token come cookie HttpOnly.
# ==============================================================================
@app.post("/login")
def login(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm legge automaticamente "username" e "password" dal body
    # Cerca l'utente nel DB tramite email (nel form OAuth2, l'email va nel campo "username")
    user = db.query(models.Utente).filter(models.Utente.Email == form_data.username).first()

    # Se l'utente non esiste O la password non corrisponde → errore 401
    if not user or not auth.verify_password(form_data.password, user.Password):
        raise HTTPException(status_code=401, detail="Credenziali errate")

    # Crea i due token: access (breve durata) e refresh (lunga durata)
    access_token = auth.create_access_token(data={"sub": user.Email})
    refresh_token = auth.create_refresh_token(data={"sub": user.Email})

    # Imposta il refresh token come cookie HttpOnly (non accessibile da JavaScript)
    # Questo protegge da attacchi XSS: JS malevolo non può leggere il cookie
    response.set_cookie(
        key="refresh_token",      # Nome del cookie
        value=refresh_token,      # Valore: il token JWT
        httponly=True,            # Non accessibile da JavaScript
        samesite="lax",           # Inviato solo in richieste dello stesso sito (protegge da CSRF)
        secure=False,             # ⚠️ Impostare True in produzione con HTTPS!
        max_age=auth.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600  # Durata in secondi
    )

    ruolo_nome = user.ruolo.Nome if user.ruolo else "studente"

    # Restituisce l'access token al frontend nel body JSON
    return {"access_token": access_token, "token_type": "bearer", "ruolo": ruolo_nome}


# ==============================================================================
# ENDPOINT: POST /refresh
# Rinnova l'access token usando il refresh token contenuto nel cookie.
# Il frontend chiama questo endpoint automaticamente quando riceve un 401
# (access token scaduto) e poi riprova la richiesta originale.
# ==============================================================================
@app.post("/refresh")
def refresh(refresh_token: str = Cookie(None)):
    # Cookie(None): legge il cookie "refresh_token" dalla richiesta, None se assente
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token mancante. Effettua il login.")

    try:
        # Decodifica il refresh token
        payload = jwt.decode(refresh_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])

        # Verifica che sia effettivamente un refresh token (non un access token riutilizzato)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token non valido")

        email: str = payload.get("sub")  # Estrae l'email dal token

        # Crea un nuovo access token con la stessa email
        new_access_token = auth.create_access_token(data={"sub": email})
        return {"access_token": new_access_token, "token_type": "bearer"}

    except jwt.PyJWTError:
        # Refresh token scaduto o manomesso → l'utente deve rifare il login
        raise HTTPException(status_code=401, detail="Refresh token scaduto o non valido")


# ==============================================================================
# ENDPOINT: GET /users
# Restituisce la lista di tutti gli utenti dal database.
# È un endpoint PROTETTO: richiede un token JWT valido nell'header Authorization.
# response_model=List[schemas.UtenteResponse]: FastAPI serializza automaticamente
# la lista di oggetti SQLAlchemy in JSON seguendo lo schema UtenteResponse.
# ==============================================================================
@app.get("/users", response_model=List[schemas.UtenteResponse])
def get_users(db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce la lista di tutti gli utenti. Richiede autenticazione JWT."""
    # db.query(models.Utente).all() → SELECT * FROM Utenti
    users = db.query(models.Utente).all()
    return users





# ==============================================================================
# DOVE AGGIUNGERE NUOVI ENDPOINT:
# Aggiungi qui sotto i gruppi di endpoint per le altre tabelle/funzionalità.
# Ogni gruppo dovrebbe seguire il pattern CRUD:
#   GET    /risorsa        → lista tutte le risorse
#   GET    /risorsa/{id}   → ottieni una risorsa specifica
#   POST   /risorsa        → crea una nuova risorsa
#   PUT    /risorsa/{id}   → aggiorna una risorsa esistente
#   DELETE /risorsa/{id}   → elimina una risorsa
# ==============================================================================

# --- ESEMPIO: Endpoint per i Ruoli ---
# @app.get("/ruoli", response_model=List[schemas.RuoloResponse])
# def get_ruoli(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
#     return db.query(models.Ruolo).all()

# --- ESEMPIO: Endpoint per i Corsi ---
# @app.get("/corsi", response_model=List[schemas.CorsoResponse])
# def get_corsi(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
#     return db.query(models.Corso).all()
#
# @app.post("/corsi", response_model=schemas.CorsoResponse)
# def create_corso(corso: schemas.CorsoCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
#     nuovo_corso = models.Corso(Nome=corso.Nome, Descrizione=corso.Descrizione)
#     db.add(nuovo_corso)
#     db.commit()
#     db.refresh(nuovo_corso)
#     return nuovo_corso

# --- ESEMPIO: Endpoint per le Presenze ---
# @app.get("/presenze/{id_utente}", response_model=List[schemas.PresenzaResponse])
# def get_presenze_utente(id_utente: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
#     return db.query(models.Presenza).filter(models.Presenza.id_utente == id_utente).all()
