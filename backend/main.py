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
from fastapi import FastAPI, Depends, HTTPException, Response, Cookie, status, Request
from fastapi.responses import JSONResponse
# FastAPI: la classe principale che crea l'app
# Depends: sistema di "dependency injection" per iniettare dipendenze (es. DB, utente corrente)
# HTTPException: per restituire errori HTTP (es. 401 Unauthorized, 404 Not Found)
# Response: oggetto risposta HTTP, usato per impostare cookie
# Cookie: per leggere cookie dalla richiesta HTTP
# status: costanti per i codici HTTP (es. status.HTTP_200_OK)

from sqlalchemy.orm import Session     # Tipo della sessione database SQLAlchemy
from sqlalchemy import func            # Per funzioni SQL come func.lower
from typing import List, Optional                # Per dichiarare liste e tipi opzionali come parametri
from fastapi.middleware.cors import CORSMiddleware  # Middleware per gestire le policy CORS
from fastapi.security import OAuth2PasswordRequestForm  # Form standard per login (username + password)
import jwt                             # Libreria PyJWT per decodificare i token
import re                              # Regex per parsing errori DB
from pydantic import BaseModel         # Per definire modelli di richiesta inline
from datetime import date, timedelta   # Per i campi data e calcolo date nei modelli Pydantic

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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Ritorna i log dell'eccezione interna con intestazioni CORS in modo che il frontend non mostri errori CORS per gli errori 500
    origin = request.headers.get("origin", "*")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers={
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*"
        }
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
# ENDPOINT: POST /logout
# Effettua il logout eliminando il cookie refresh_token lato server.
# Anche se il client ha ancora l'access token, esso scadrà entro 30 minuti
# e NON potrà essere rinnovato perché il cookie di refresh è stato rimosso.
# ==============================================================================
@app.post("/logout")
def logout(response: Response):
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        samesite="lax",
        secure=False,     # ⚠️ Impostare True in produzione con HTTPS!
    )
    return {"message": "Logout effettuato con successo"}


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
    users = db.query(models.Utente).all()
    return users

@app.get("/users/{id_utente}", response_model=schemas.UtenteResponse)
def get_user(id_utente: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce un utente specifico tramite ID."""
    user = db.query(models.Utente).filter(models.Utente.id_utente == id_utente).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return user

@app.post("/users", response_model=schemas.UtenteResponse, status_code=status.HTTP_201_CREATED)
def create_user(user: schemas.UtenteCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Crea un nuovo utente."""
    # Verifica se l'email esiste già
    db_user = db.query(models.Utente).filter(models.Utente.Email == user.Email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email già registrata")
    
    # Verifica se il ruolo esiste
    ruolo = db.query(models.Ruolo).filter(models.Ruolo.id_ruolo == user.id_ruolo).first()
    if not ruolo:
        raise HTTPException(status_code=400, detail="Ruolo specificato non valido")
    
    hashed_pwd = auth.get_password_hash(user.Password)
    nuovo_utente = models.Utente(
        Nome=user.Nome,
        Cognome=user.Cognome,
        Email=user.Email,
        Password=hashed_pwd,
        id_ruolo=user.id_ruolo,
        Genere=user.Genere,
        Codice_Fiscale=user.Codice_Fiscale,
        Data_Nascita=user.Data_Nascita,
        Citta_Nascita=user.Citta_Nascita,
        Provincia_Nascita=user.Provincia_Nascita,
        Indirizzo_Residenza=user.Indirizzo_Residenza,
        Citta_Residenza=user.Citta_Residenza,
        Cap_Residenza=user.Cap_Residenza,
        Provincia_Residenza=user.Provincia_Residenza,
        Telefono=user.Telefono,
        Primo_Accesso=user.Primo_Accesso if user.Primo_Accesso is not None else True
    )
    db.add(nuovo_utente)
    db.commit()
    db.refresh(nuovo_utente)
    return nuovo_utente

@app.put("/users/{id_utente}", response_model=schemas.UtenteResponse)
def update_user(id_utente: int, user_data: schemas.UtenteUpdate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Aggiorna un utente esistente con tutti i campi previsti nel database."""
    user = db.query(models.Utente).filter(models.Utente.id_utente == id_utente).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Verifica email duplicata
    if user_data.Email is not None and user_data.Email != user.Email:
        db_user = db.query(models.Utente).filter(models.Utente.Email == user_data.Email).first()
        if db_user:
            raise HTTPException(status_code=400, detail="Email già registrata")
        user.Email = user_data.Email
    
    # Verifica ruolo se specificato
    if user_data.id_ruolo is not None:
        ruolo = db.query(models.Ruolo).filter(models.Ruolo.id_ruolo == user_data.id_ruolo).first()
        if not ruolo:
            raise HTTPException(status_code=400, detail="Ruolo specificato non valido")
        user.id_ruolo = user_data.id_ruolo
    
    if user_data.Nome is not None:
        user.Nome = user_data.Nome.strip()
    if user_data.Cognome is not None:
        user.Cognome = user_data.Cognome.strip()
    
    # Se la password viene cambiata ed è non vuota e non è l'hash corrente
    if user_data.Password and user_data.Password.strip() and user_data.Password != user.Password:
        user.Password = auth.get_password_hash(user_data.Password)
    
    if user_data.Genere is not None:
        user.Genere = user_data.Genere.strip() if user_data.Genere and user_data.Genere.strip() else None
    if user_data.Codice_Fiscale is not None:
        user.Codice_Fiscale = user_data.Codice_Fiscale.strip().upper() if user_data.Codice_Fiscale and user_data.Codice_Fiscale.strip() else None
    if user_data.Data_Nascita is not None:
        user.Data_Nascita = user_data.Data_Nascita if user_data.Data_Nascita and str(user_data.Data_Nascita).strip() else None
    if user_data.Citta_Nascita is not None:
        user.Citta_Nascita = user_data.Citta_Nascita.strip() if user_data.Citta_Nascita and user_data.Citta_Nascita.strip() else None
    if user_data.Provincia_Nascita is not None:
        user.Provincia_Nascita = user_data.Provincia_Nascita.strip().upper() if user_data.Provincia_Nascita and user_data.Provincia_Nascita.strip() else None
    if user_data.Indirizzo_Residenza is not None:
        user.Indirizzo_Residenza = user_data.Indirizzo_Residenza.strip() if user_data.Indirizzo_Residenza and user_data.Indirizzo_Residenza.strip() else None
    if user_data.Citta_Residenza is not None:
        user.Citta_Residenza = user_data.Citta_Residenza.strip() if user_data.Citta_Residenza and user_data.Citta_Residenza.strip() else None
    if user_data.Cap_Residenza is not None:
        user.Cap_Residenza = user_data.Cap_Residenza.strip() if user_data.Cap_Residenza and user_data.Cap_Residenza.strip() else None
    if user_data.Provincia_Residenza is not None:
        user.Provincia_Residenza = user_data.Provincia_Residenza.strip().upper() if user_data.Provincia_Residenza and user_data.Provincia_Residenza.strip() else None
    if user_data.Telefono is not None:
        user.Telefono = user_data.Telefono.strip() if user_data.Telefono and user_data.Telefono.strip() else None
    if user_data.Primo_Accesso is not None:
        user.Primo_Accesso = bool(user_data.Primo_Accesso)
        
    db.commit()
    db.refresh(user)
    return user

@app.delete("/users/{id_utente}")
def delete_user(id_utente: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Elimina un utente esistente."""
    user = db.query(models.Utente).filter(models.Utente.id_utente == id_utente).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    db.delete(user)
    db.commit()
    return {"message": "Utente eliminato con successo"}


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

# --- Endpoint per i Ruoli ---
@app.get("/ruoli", response_model=List[schemas.RuoloResponse])
def get_ruoli(db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce la lista di tutti i ruoli."""
    return db.query(models.Ruolo).all()

@app.get("/ruoli/{id_ruolo}", response_model=schemas.RuoloResponse)
def get_ruolo(id_ruolo: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce un ruolo specifico tramite ID."""
    ruolo = db.query(models.Ruolo).filter(models.Ruolo.id_ruolo == id_ruolo).first()
    if ruolo is None:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")
    return ruolo

@app.post("/ruoli", response_model=schemas.RuoloResponse, status_code=status.HTTP_201_CREATED)
def create_ruolo(ruolo: schemas.RuoloCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Crea un nuovo ruolo."""
    nuovo_ruolo = models.Ruolo(Nome=ruolo.Nome, Descrizione=ruolo.Descrizione)
    db.add(nuovo_ruolo)
    db.commit()
    db.refresh(nuovo_ruolo)
    return nuovo_ruolo

@app.put("/ruoli/{id_ruolo}", response_model=schemas.RuoloResponse)
def update_ruolo(id_ruolo: int, ruolo_data: schemas.RuoloCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Aggiorna un ruolo esistente."""
    ruolo = db.query(models.Ruolo).filter(models.Ruolo.id_ruolo == id_ruolo).first()
    if ruolo is None:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")
    
    ruolo.Nome = ruolo_data.Nome
    ruolo.Descrizione = ruolo_data.Descrizione
    
    db.commit()
    db.refresh(ruolo)
    return ruolo

@app.delete("/ruoli/{id_ruolo}")
def delete_ruolo(id_ruolo: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Elimina un ruolo esistente."""
    ruolo = db.query(models.Ruolo).filter(models.Ruolo.id_ruolo == id_ruolo).first()
    if ruolo is None:
        raise HTTPException(status_code=404, detail="Ruolo non trovato")
    
    db.delete(ruolo)
    db.commit()
    return {"message": "Ruolo eliminato con successo"}

# ------------------------------------------------------------------------------
# HELPER: Mappatura pulita degli errori del DB e Validazione Date/Ore Coerenti
# ------------------------------------------------------------------------------
def handle_db_exception(e: Exception) -> str:
    msg_raw = str(e.orig) if hasattr(e, 'orig') else str(e)
    msg_lower = msg_raw.lower()
    
    # 1. Messaggi inviati da trigger SQL (SIGNAL SQLSTATE / MESSAGE_TEXT)
    match_err = re.search(r"'([^']*Errore[^']*)'", msg_raw, re.IGNORECASE)
    if match_err:
        return match_err.group(1)
        
    match_signal = re.search(r"MESSAGE_TEXT\s*=\s*'([^']+)'", msg_raw, re.IGNORECASE)
    if match_signal:
        return match_signal.group(1)

    # 2. Key duplicata / Unique constraint
    if "1062" in msg_raw or "duplicate entry" in msg_lower or "unique constraint" in msg_lower:
        if "corso.nome" in msg_lower or "nome" in msg_lower:
            return "Un corso con questo nome è già presente nel catalogo."
        if "email" in msg_lower:
            return "Un utente con questa email risulta già registrato."
        if "codice_fiscale" in msg_lower:
            return "Un utente con questo codice fiscale risulta già registrato."
        return "Un record con questi dati identificativi è già esistente nel database."

    # 3. Violazione Foreign Key (RESTRICT / DELETE CASCADE restriction)
    if "1451" in msg_raw or "1452" in msg_raw or "foreign key constraint" in msg_lower or "cannot delete or update a parent row" in msg_lower:
        return "Impossibile completare l'operazione: l'elemento è collegato ad altre risorse (es. edizioni, lezioni o studenti)."

    return f"Errore del database: {msg_raw}"


def calcola_giorni_lavorativi(d_inizio: date, d_fine: date) -> int:
    if not d_inizio or not d_fine or d_inizio > d_fine:
        return 0
    giorni = 0
    curr = d_inizio
    while curr <= d_fine:
        if curr.weekday() < 5:  # Lunedì = 0, Venerdì = 4
            giorni += 1
        curr += timedelta(days=1)
    return giorni


def valida_ediz_ore_e_date(
    data_inizio: Optional[date],
    data_fine: Optional[date],
    ore_teoria_aula: Optional[int],
    ore_stage: Optional[int],
    percentuale_ore_assenza: Optional[float] = None,
    tolleranza_ingresso_minuti: Optional[int] = None,
    tolleranza_uscita_minuti: Optional[int] = None
):
    if ore_teoria_aula is None or ore_teoria_aula <= 0:
        raise HTTPException(status_code=400, detail="Le ore in aula sono obbligatorie e devono essere maggiori di 0.")
    if ore_stage is None or ore_stage < 0:
        raise HTTPException(status_code=400, detail="Le ore di stage sono obbligatorie (possono essere 0 se non previste).")

    if percentuale_ore_assenza is not None and not (0 <= percentuale_ore_assenza <= 30):
        raise HTTPException(status_code=400, detail="La percentuale di assenza massima deve essere compresa tra 0% e 30%.")
    if tolleranza_ingresso_minuti is not None and not (0 <= tolleranza_ingresso_minuti <= 30):
        raise HTTPException(status_code=400, detail="La tolleranza in ingresso deve essere compresa tra 0 e 30 minuti.")
    if tolleranza_uscita_minuti is not None and not (0 <= tolleranza_uscita_minuti <= 45):
        raise HTTPException(status_code=400, detail="La tolleranza in uscita deve essere compresa tra 0 e 45 minuti.")

    totale_ore = ore_teoria_aula + ore_stage
    if totale_ore <= 0:
        raise HTTPException(status_code=400, detail="Il monte ore totale calcolato deve essere maggiore di 0.")

    if data_inizio and data_fine:
        if data_inizio > data_fine:
            raise HTTPException(status_code=400, detail="La data di inizio non può essere successiva alla data di fine.")
        giorni_lav = calcola_giorni_lavorativi(data_inizio, data_fine)
        max_ore_possibili = giorni_lav * 8
        if max_ore_possibili < totale_ore:
            raise HTTPException(
                status_code=400,
                detail=f"Il periodo compreso tra il {data_inizio.strftime('%d/%m/%Y')} e il {data_fine.strftime('%d/%m/%Y')} ha {giorni_lav} giorni lavorativi (max {max_ore_possibili}h a 8h/giorno, 40h/settimana). Impossibile coprire le {totale_ore}h totali del corso."
            )

# --- Endpoint per i Corsi ---
@app.get("/corsi", response_model=List[schemas.CorsoResponse])
def get_corsi(db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce la lista di tutti i corsi."""
    return db.query(models.Corso).all()

@app.get("/corsi/{id_corso}", response_model=schemas.CorsoResponse)
def get_corso(id_corso: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce un corso specifico tramite ID."""
    corso = db.query(models.Corso).filter(models.Corso.id_corso == id_corso).first()
    if corso is None:
        raise HTTPException(status_code=404, detail="Corso non trovato")
    return corso

@app.post("/corsi", response_model=schemas.CorsoResponse, status_code=status.HTTP_201_CREATED)
def create_corso(corso: schemas.CorsoCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Crea un nuovo corso."""
    esistente = db.query(models.Corso).filter(func.lower(models.Corso.Nome) == func.lower(corso.Nome.strip())).first()
    if esistente:
        raise HTTPException(status_code=400, detail="Un corso con questo nome esiste già nel catalogo.")
        
    nuovo_corso = models.Corso(Nome=corso.Nome, Descrizione=corso.Descrizione)
    db.add(nuovo_corso)
    db.commit()
    db.refresh(nuovo_corso)
    return nuovo_corso

@app.put("/corsi/{id_corso}", response_model=schemas.CorsoResponse)
def update_corso(id_corso: int, corso_data: schemas.CorsoCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Aggiorna un corso esistente."""
    corso = db.query(models.Corso).filter(models.Corso.id_corso == id_corso).first()
    if corso is None:
        raise HTTPException(status_code=404, detail="Corso non trovato")
        
    if corso_data.Nome != corso.Nome:
        esistente = db.query(models.Corso).filter(func.lower(models.Corso.Nome) == func.lower(corso_data.Nome.strip())).first()
        if esistente:
            raise HTTPException(status_code=400, detail="Un corso con questo nome esiste già nel catalogo.")
    
    corso.Nome = corso_data.Nome
    corso.Descrizione = corso_data.Descrizione
    
    db.commit()
    db.refresh(corso)
    return corso

@app.delete("/corsi/{id_corso}")
def delete_corso(id_corso: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Elimina un corso esistente."""
    corso = db.query(models.Corso).filter(models.Corso.id_corso == id_corso).first()
    if corso is None:
        raise HTTPException(status_code=404, detail="Corso non trovato")
        
    # Controlla se ci sono edizioni attive
    if corso.corsi_attivi:
        raise HTTPException(status_code=400, detail="Impossibile eliminare il corso perché ha edizioni associate.")
    
    db.delete(corso)
    db.commit()
    return {"message": "Corso eliminato con successo"}


# ==============================================================================
# ENDPOINT ATOMICO: POST /corsi/nuovo
# Crea un nuovo corso a catalogo E la sua prima edizione attiva in un'unica
# transazione SQL. Se la creazione dell'edizione fallisce (es. date errate,
# vincoli violati), ANCHE il corso viene annullato tramite rollback.
# Questo previene la creazione di corsi "orfani" a catalogo.
# ==============================================================================
class NuovoCorsoConEdizione(BaseModel):
    # Campi Corso
    nome_corso: str
    descrizione_corso: Optional[str] = None
    # Campi Edizione
    etichetta: Optional[str] = None
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    durata_ore: Optional[int] = None
    ore_stage: Optional[int] = None
    ore_teoria_aula: Optional[int] = None
    percentuale_ore_assenza: Optional[float] = None
    tolleranza_ingresso_minuti: Optional[int] = None
    tolleranza_uscita_minuti: Optional[int] = None

class NuovoCorsoConEdizioneResponse(BaseModel):
    corso: schemas.CorsoResponse
    edizione: schemas.CorsoAttivoResponse
    class Config:
        from_attributes = True

@app.post("/corsi/nuovo", response_model=NuovoCorsoConEdizioneResponse, status_code=status.HTTP_201_CREATED)
def create_corso_con_edizione(
    payload: NuovoCorsoConEdizione,
    db: Session = Depends(get_db),
    current_user: models.Utente = Depends(get_current_user)
):
    """
    Endpoint atomico: crea corso + edizione in un'unica transazione.
    Se l'edizione non può essere creata, il corso viene annullato (rollback).
    """
    if not payload.nome_corso or not payload.nome_corso.strip():
        raise HTTPException(status_code=422, detail="Il nome del corso è obbligatorio.")

    # Validazione ore in aula (>0), ore stage (>=0), totale ore e coerenza range date (max 40h/settimana)
    valida_ediz_ore_e_date(
        payload.data_inizio,
        payload.data_fine,
        payload.ore_teoria_aula,
        payload.ore_stage
    )

    if payload.percentuale_ore_assenza is not None and not (0 <= payload.percentuale_ore_assenza <= 100):
        raise HTTPException(status_code=422, detail="La percentuale di assenza deve essere tra 0 e 100.")

    esistente = db.query(models.Corso).filter(func.lower(models.Corso.Nome) == func.lower(payload.nome_corso.strip())).first()
    if esistente:
        raise HTTPException(status_code=400, detail="Un corso con questo nome esiste già nel catalogo. Selezionalo dal menu 'Usa Corso Esistente'.")

    durata_calcolata = (payload.ore_teoria_aula or 0) + (payload.ore_stage or 0)

    try:
        # STEP 1: Crea il corso (non ancora committed)
        nuovo_corso = models.Corso(
            Nome=payload.nome_corso.strip(),
            Descrizione=payload.descrizione_corso.strip() if payload.descrizione_corso else None
        )
        db.add(nuovo_corso)
        db.flush()  # Assegna l'ID al corso senza fare commit definitivo

        # STEP 2: Crea l'edizione usando l'ID appena generato
        nuova_edizione = models.CorsoAttivo(
            id_corso=nuovo_corso.id_corso,
            etichetta=payload.etichetta.strip() if payload.etichetta else None,
            data_inizio=payload.data_inizio,
            data_fine=payload.data_fine,
            durata_ore=durata_calcolata,
            ore_stage=payload.ore_stage or 0,
            ore_teoria_aula=payload.ore_teoria_aula or 0,
            percentuale_ore_assenza=payload.percentuale_ore_assenza or 0,
            tolleranza_ingresso_minuti=payload.tolleranza_ingresso_minuti or 0,
            tolleranza_uscita_minuti=payload.tolleranza_uscita_minuti or 0,
            archiviato=False
        )
        db.add(nuova_edizione)

        # COMMIT unico: o tutto va a buon fine, o niente viene salvato
        db.commit()
        db.refresh(nuovo_corso)
        db.refresh(nuova_edizione)

        return {"corso": nuovo_corso, "edizione": nuova_edizione}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=handle_db_exception(e))




# --- Endpoint per i Corsi Attivi ---
@app.get("/corsi-attivi", response_model=List[schemas.CorsoAttivoResponse])
def get_corsi_attivi(stato: Optional[str] = None, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce la lista di tutti i corsi attivi, con filtri opzionali per stato (attivi, conclusi, archiviati)."""
    from datetime import date
    query = db.query(models.CorsoAttivo)
    
    oggi = date.today()
    if stato == "attivi":
        query = query.filter(
            models.CorsoAttivo.archiviato == False,
            models.CorsoAttivo.data_inizio <= oggi,
            models.CorsoAttivo.data_fine >= oggi
        )
    elif stato == "conclusi":
        query = query.filter(
            (models.CorsoAttivo.data_fine < oggi) | (models.CorsoAttivo.archiviato == True)
        )
    elif stato == "archiviati":
        query = query.filter(models.CorsoAttivo.archiviato == True)
        
    return query.all()

@app.get("/corsi-attivi/{id_corso_attivo}", response_model=schemas.CorsoAttivoResponse)
def get_corso_attivo(id_corso_attivo: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce un corso attivo specifico tramite ID."""
    corso_attivo = db.query(models.CorsoAttivo).filter(models.CorsoAttivo.id_corso_attivo == id_corso_attivo).first()
    if corso_attivo is None:
        raise HTTPException(status_code=404, detail="Corso attivo non trovato")
    return corso_attivo

@app.post("/corsi-attivi", response_model=schemas.CorsoAttivoResponse, status_code=status.HTTP_201_CREATED)
def create_corso_attivo(corso_attivo: schemas.CorsoAttivoCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Crea una nuova edizione di corso attivo."""
    corso = db.query(models.Corso).filter(models.Corso.id_corso == corso_attivo.id_corso).first()
    if corso is None:
        raise HTTPException(status_code=400, detail="Il corso specificato non esiste")

    valida_ediz_ore_e_date(
        corso_attivo.data_inizio,
        corso_attivo.data_fine,
        corso_attivo.ore_teoria_aula,
        corso_attivo.ore_stage
    )
    durata_calcolata = (corso_attivo.ore_teoria_aula or 0) + (corso_attivo.ore_stage or 0)

    try:
        nuovo_corso_attivo = models.CorsoAttivo(
            id_corso=corso_attivo.id_corso,
            etichetta=corso_attivo.etichetta.strip() if corso_attivo.etichetta else None,
            data_inizio=corso_attivo.data_inizio,
            data_fine=corso_attivo.data_fine,
            durata_ore=durata_calcolata,
            ore_stage=corso_attivo.ore_stage or 0,
            ore_teoria_aula=corso_attivo.ore_teoria_aula or 0,
            percentuale_ore_assenza=corso_attivo.percentuale_ore_assenza,
            tolleranza_ingresso_minuti=corso_attivo.tolleranza_ingresso_minuti,
            tolleranza_uscita_minuti=corso_attivo.tolleranza_uscita_minuti,
            archiviato=corso_attivo.archiviato if corso_attivo.archiviato is not None else False
        )
        db.add(nuovo_corso_attivo)
        db.commit()
        db.refresh(nuovo_corso_attivo)
        return nuovo_corso_attivo
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=handle_db_exception(e))

@app.put("/corsi-attivi/{id_corso_attivo}", response_model=schemas.CorsoAttivoResponse)
def update_corso_attivo(id_corso_attivo: int, corso_attivo_data: schemas.CorsoAttivoCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Aggiorna un corso attivo esistente."""
    corso_attivo = db.query(models.CorsoAttivo).filter(models.CorsoAttivo.id_corso_attivo == id_corso_attivo).first()
    if corso_attivo is None:
        raise HTTPException(status_code=404, detail="Corso attivo non trovato")
        
    corso = db.query(models.Corso).filter(models.Corso.id_corso == corso_attivo_data.id_corso).first()
    if corso is None:
        raise HTTPException(status_code=400, detail="Il corso specificato non esiste")

    valida_ediz_ore_e_date(
        corso_attivo_data.data_inizio,
        corso_attivo_data.data_fine,
        corso_attivo_data.ore_teoria_aula,
        corso_attivo_data.ore_stage
    )
    durata_calcolata = (corso_attivo_data.ore_teoria_aula or 0) + (corso_attivo_data.ore_stage or 0)

    try:
        corso_attivo.id_corso = corso_attivo_data.id_corso
        corso_attivo.etichetta = corso_attivo_data.etichetta.strip() if corso_attivo_data.etichetta else None
        corso_attivo.data_inizio = corso_attivo_data.data_inizio
        corso_attivo.data_fine = corso_attivo_data.data_fine
        corso_attivo.durata_ore = durata_calcolata
        corso_attivo.ore_stage = corso_attivo_data.ore_stage or 0
        corso_attivo.ore_teoria_aula = corso_attivo_data.ore_teoria_aula or 0
        corso_attivo.percentuale_ore_assenza = corso_attivo_data.percentuale_ore_assenza
        corso_attivo.tolleranza_ingresso_minuti = corso_attivo_data.tolleranza_ingresso_minuti
        corso_attivo.tolleranza_uscita_minuti = corso_attivo_data.tolleranza_uscita_minuti
        if corso_attivo_data.archiviato is not None:
            corso_attivo.archiviato = corso_attivo_data.archiviato
        
        db.commit()
        db.refresh(corso_attivo)
        return corso_attivo
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=handle_db_exception(e))

@app.delete("/corsi-attivi/{id_corso_attivo}")
def delete_corso_attivo(id_corso_attivo: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Elimina un corso attivo esistente."""
    corso_attivo = db.query(models.CorsoAttivo).filter(models.CorsoAttivo.id_corso_attivo == id_corso_attivo).first()
    if corso_attivo is None:
        raise HTTPException(status_code=404, detail="Corso attivo non trovato")
        
    try:
        db.delete(corso_attivo)
        db.commit()
        return {"message": "Corso attivo eliminato con successo"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=handle_db_exception(e))


# --- Endpoint per le Unità Formative ---
@app.get("/unita_formative", response_model=List[schemas.UnitaFormativaResponse])
def get_unita_formative(db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce la lista di tutte le unità formative."""
    return db.query(models.UnitaFormativa).all()

@app.get("/unita_formative/{id_unita_formativa}", response_model=schemas.UnitaFormativaResponse)
def get_unita_formativa(id_unita_formativa: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce un'unità formativa specifica tramite ID."""
    uf = db.query(models.UnitaFormativa).filter(models.UnitaFormativa.id_unita_formativa == id_unita_formativa).first()
    if uf is None:
        raise HTTPException(status_code=404, detail="Unità formativa non trovata")
    return uf

@app.post("/unita_formative", response_model=schemas.UnitaFormativaResponse, status_code=status.HTTP_201_CREATED)
def create_unita_formativa(uf: schemas.UnitaFormativaCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Crea una nuova unità formativa."""
    nuova_uf = models.UnitaFormativa(Nome=uf.Nome, Descrizione=uf.Descrizione)
    db.add(nuova_uf)
    db.commit()
    db.refresh(nuova_uf)
    return nuova_uf

@app.put("/unita_formative/{id_unita_formativa}", response_model=schemas.UnitaFormativaResponse)
def update_unita_formativa(id_unita_formativa: int, uf_data: schemas.UnitaFormativaCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Aggiorna un'unità formativa esistente."""
    uf = db.query(models.UnitaFormativa).filter(models.UnitaFormativa.id_unita_formativa == id_unita_formativa).first()
    if uf is None:
        raise HTTPException(status_code=404, detail="Unità formativa non trovata")
    
    uf.Nome = uf_data.Nome
    uf.Descrizione = uf_data.Descrizione
    
    db.commit()
    db.refresh(uf)
    return uf

@app.delete("/unita_formative/{id_unita_formativa}")
def delete_unita_formativa(id_unita_formativa: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Elimina un'unità formativa esistente."""
    uf = db.query(models.UnitaFormativa).filter(models.UnitaFormativa.id_unita_formativa == id_unita_formativa).first()
    if uf is None:
        raise HTTPException(status_code=404, detail="Unità formativa non trovata")
    
    db.delete(uf)
    db.commit()
    return {"message": "Unità formativa eliminata con successo"}

# ==============================================================================
# ENDPOINT PROXY PER AUTOCOMPLETAMENTO COMUNI/PROVINCE
# Bypass CORS
# ==============================================================================
import urllib.request
import urllib.parse
import json

@app.get("/proxy/province")
def proxy_province():
    req = urllib.request.Request("https://daticomuni.it/api/v1/province?limit=150", headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

@app.get("/proxy/comuni")
def proxy_comuni(q: str):
    q_enc = urllib.parse.quote(q)
    req = urllib.request.Request(f"https://daticomuni.it/api/v1/search?q={q_enc}", headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())


# --- Endpoint per i Moduli ---
@app.get("/moduli", response_model=List[schemas.ModuloResponse])
def get_moduli(db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce la lista di tutti i moduli."""
    return db.query(models.Modulo).all()

@app.get("/moduli/{id_modulo}", response_model=schemas.ModuloResponse)
def get_modulo(id_modulo: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce un modulo specifico tramite ID."""
    modulo = db.query(models.Modulo).filter(models.Modulo.id_modulo == id_modulo).first()
    if modulo is None:
        raise HTTPException(status_code=404, detail="Modulo non trovato")
    return modulo

@app.post("/moduli", response_model=schemas.ModuloResponse, status_code=status.HTTP_201_CREATED)
def create_modulo(modulo: schemas.ModuloCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Crea un nuovo modulo."""
    # Verifica esistenza unità formativa
    uf = db.query(models.UnitaFormativa).filter(models.UnitaFormativa.id_unita_formativa == modulo.id_unita_formativa).first()
    if uf is None:
        raise HTTPException(status_code=400, detail="L'unità formativa specificata non esiste")
        
    nuovo_modulo = models.Modulo(
        Nome=modulo.Nome,
        Descrizione=modulo.Descrizione,
        id_unita_formativa=modulo.id_unita_formativa
    )
    db.add(nuovo_modulo)
    db.commit()
    db.refresh(nuovo_modulo)
    return nuovo_modulo

@app.put("/moduli/{id_modulo}", response_model=schemas.ModuloResponse)
def update_modulo(id_modulo: int, modulo_data: schemas.ModuloCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Aggiorna un modulo esistente."""
    modulo = db.query(models.Modulo).filter(models.Modulo.id_modulo == id_modulo).first()
    if modulo is None:
        raise HTTPException(status_code=404, detail="Modulo non trovato")
        
    # Verifica esistenza unità formativa
    uf = db.query(models.UnitaFormativa).filter(models.UnitaFormativa.id_unita_formativa == modulo_data.id_unita_formativa).first()
    if uf is None:
        raise HTTPException(status_code=400, detail="L'unità formativa specificata non esiste")
    
    modulo.Nome = modulo_data.Nome
    modulo.Descrizione = modulo_data.Descrizione
    modulo.id_unita_formativa = modulo_data.id_unita_formativa
    
    db.commit()
    db.refresh(modulo)
    return modulo

@app.delete("/moduli/{id_modulo}")
def delete_modulo(id_modulo: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Elimina un modulo esistente."""
    modulo = db.query(models.Modulo).filter(models.Modulo.id_modulo == id_modulo).first()
    if modulo is None:
        raise HTTPException(status_code=404, detail="Modulo non trovato")
    
    db.delete(modulo)
    db.commit()
    return {"message": "Modulo eliminato con successo"}


# --- Endpoint per il Piano Studio (Corsi Attivi - Unità Formative) ---
@app.get("/piano-studio", response_model=List[schemas.CorsoAttivoUnitaFormativaResponse])
def get_tutti_piani_studio(db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce tutte le associazioni del Piano Studio tra Corsi Attivi ed Unità Formative."""
    return db.query(models.CorsoAttivoUnitaFormativa).all()

@app.get("/corsi-attivi/{id_corso_attivo}/piano-studio", response_model=List[schemas.CorsoAttivoUnitaFormativaResponse])
def get_piano_studio_corso(id_corso_attivo: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce il Piano Studio (Unità Formative e ore dedicate) per un specifico Corso Attivo."""
    return db.query(models.CorsoAttivoUnitaFormativa).filter(models.CorsoAttivoUnitaFormativa.id_corso_attivo == id_corso_attivo).all()

@app.post("/piano-studio", response_model=schemas.CorsoAttivoUnitaFormativaResponse, status_code=status.HTTP_201_CREATED)
def create_o_aggiorna_piano_studio(item: schemas.CorsoAttivoUnitaFormativaCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Crea o aggiorna un'associazione nel Piano Studio per un Corso Attivo."""
    corso_attivo = db.query(models.CorsoAttivo).filter(models.CorsoAttivo.id_corso_attivo == item.id_corso_attivo).first()
    if not corso_attivo:
        raise HTTPException(status_code=400, detail="Il corso attivo specificato non esiste")
    
    uf = db.query(models.UnitaFormativa).filter(models.UnitaFormativa.id_unita_formativa == item.id_unita_formativa).first()
    if not uf:
        raise HTTPException(status_code=400, detail="L'unità formativa specificata non esiste")

    esistente = db.query(models.CorsoAttivoUnitaFormativa).filter(
        models.CorsoAttivoUnitaFormativa.id_corso_attivo == item.id_corso_attivo,
        models.CorsoAttivoUnitaFormativa.id_unita_formativa == item.id_unita_formativa
    ).first()

    if esistente:
        esistente.ore_dedicate = item.ore_dedicate
        db.commit()
        db.refresh(esistente)
        return esistente
    else:
        nuova_associazione = models.CorsoAttivoUnitaFormativa(
            id_corso_attivo=item.id_corso_attivo,
            id_unita_formativa=item.id_unita_formativa,
            ore_dedicate=item.ore_dedicate
        )
        db.add(nuova_associazione)
        db.commit()
        db.refresh(nuova_associazione)
        return nuova_associazione

@app.delete("/piano-studio/{id_corso_attivo}/{id_unita_formativa}")
def delete_piano_studio_item(id_corso_attivo: int, id_unita_formativa: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Rimuove un'Unità Formativa dal Piano Studio di un Corso Attivo."""
    item = db.query(models.CorsoAttivoUnitaFormativa).filter(
        models.CorsoAttivoUnitaFormativa.id_corso_attivo == id_corso_attivo,
        models.CorsoAttivoUnitaFormativa.id_unita_formativa == id_unita_formativa
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Voce del piano studio non trovata")
    
    db.delete(item)
    db.commit()
    return {"message": "Voce del piano studio rimossa con successo"}


# --- Endpoint per il Calendario ---
@app.get("/calendario", response_model=List[schemas.CalendarioResponse])
def get_calendario(
    id_corso_attivo: Optional[int] = None,
    id_utente: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.Utente = Depends(get_current_user)
):
    """Restituisce le lezioni del calendario. Filtrabile per corso attivo e/o docente."""
    query = db.query(models.Calendario)
    if id_corso_attivo:
        query = query.filter(models.Calendario.id_corso_attivo == id_corso_attivo)
    if id_utente:
        query = query.filter(models.Calendario.id_utente == id_utente)
    return query.order_by(models.Calendario.data, models.Calendario.ora_inizio).all()


class CalendarioSettimanaleResponse(BaseModel):
    lezioni_create: int
    ore_totali: float
    lezioni: List[schemas.CalendarioResponse]
    messaggio: str

@app.post("/calendario/settimanale", response_model=CalendarioSettimanaleResponse, status_code=status.HTTP_201_CREATED)
def create_lezioni_settimanali(
    payload: schemas.CalendarioSettimanaleCreate,
    db: Session = Depends(get_db),
    current_user: models.Utente = Depends(get_current_user)
):
    """
    Crea in batch un'intera settimana (o N settimane) di lezioni per un modulo e docente.
    Gestisce orari standard ed eventuali orari differenziati per specifico giorno della settimana.
    Valida il periodo dell'edizione del corso attivo, budget ore dell'UF e vincoli.
    """
    corso_attivo = db.query(models.CorsoAttivo).filter(models.CorsoAttivo.id_corso_attivo == payload.id_corso_attivo).first()
    if corso_attivo is None:
        raise HTTPException(status_code=400, detail="Corso attivo non trovato")
    if corso_attivo.archiviato:
        raise HTTPException(status_code=400, detail="Impossibile aggiungere lezioni: il corso è archiviato")

    modulo = db.query(models.Modulo).filter(models.Modulo.id_modulo == payload.id_modulo).first()
    if not modulo:
        raise HTTPException(status_code=400, detail="Modulo non trovato")

    ensure_piano_studio_associazione(payload.id_corso_attivo, payload.id_modulo, db)

    # Determina l'intervallo di date
    d_inizio = payload.data_inizio
    if payload.data_fine:
        d_fine = payload.data_fine
    else:
        n_settimane = max(payload.numero_settimane or 1, 1)
        d_fine = d_inizio + timedelta(days=(n_settimane * 7) - 1)

    if d_inizio > d_fine:
        raise HTTPException(status_code=400, detail="La data di inizio non può essere successiva alla data di fine.")

    if corso_attivo.data_inizio and d_inizio < corso_attivo.data_inizio:
        raise HTTPException(
            status_code=400,
            detail=f"La data di inizio ({d_inizio.strftime('%d/%m/%Y')}) è precedente all'inizio dell'edizione ({corso_attivo.data_inizio.strftime('%d/%m/%Y')})."
        )
    if corso_attivo.data_fine and d_fine > corso_attivo.data_fine:
        raise HTTPException(
            status_code=400,
            detail=f"La data di fine ({d_fine.strftime('%d/%m/%Y')}) supera la fine dell'edizione ({corso_attivo.data_fine.strftime('%d/%m/%Y')})."
        )

    giorni_abilitati = set(payload.giorni_attivi if payload.giorni_attivi is not None else [0, 1, 2, 3, 4])
    orari_diff = payload.orari_differenziati or {}

    lezioni_da_creare = []
    curr_date = d_inizio

    while curr_date <= d_fine:
        wd = curr_date.weekday()  # 0 = Lunedì, 6 = Domenica
        str_wd = str(wd)
        
        is_active = False
        ora_i = payload.ora_inizio_default
        ora_f = payload.ora_fine_default

        if str_wd in orari_diff:
            cfg = orari_diff[str_wd]
            if cfg.attivo:
                is_active = True
                if cfg.ora_inizio:
                    ora_i = cfg.ora_inizio
                if cfg.ora_fine:
                    ora_f = cfg.ora_fine
            else:
                is_active = False
        elif wd in giorni_abilitati:
            is_active = True

        if is_active:
            if ora_i >= ora_f:
                raise HTTPException(
                    status_code=400,
                    detail=f"L'ora di inizio ({ora_i}) deve essere precedente all'ora di fine ({ora_f}) per la data {curr_date.strftime('%d/%m/%Y')}."
                )

            lez = models.Calendario(
                data=curr_date,
                ora_inizio=ora_i,
                ora_fine=ora_f,
                id_modulo=payload.id_modulo,
                id_utente=payload.id_utente,
                id_corso_attivo=payload.id_corso_attivo,
                note=payload.note
            )
            lezioni_da_creare.append(lez)

        curr_date += timedelta(days=1)

    if not lezioni_da_creare:
        raise HTTPException(status_code=400, detail="Nessuna lezione generata per le opzioni selezionate.")

    try:
        db.add_all(lezioni_da_creare)
        db.commit()
        for l in lezioni_da_creare:
            db.refresh(l)

        totale_minuti = sum(
            (l.ora_fine.hour * 60 + l.ora_fine.minute) - (l.ora_inizio.hour * 60 + l.ora_inizio.minute)
            for l in lezioni_da_creare
        )
        totale_ore = round(totale_minuti / 60, 2)

        return {
            "lezioni_create": len(lezioni_da_creare),
            "ore_totali": totale_ore,
            "lezioni": lezioni_da_creare,
            "messaggio": f"Generate con successo {len(lezioni_da_creare)} lezioni per un totale di {totale_ore}h."
        }

    except Exception as e:
        db.rollback()
        error_msg = extract_sql_error_message(e)
        raise HTTPException(status_code=400, detail=error_msg)


@app.get("/calendario/{id_lezione}", response_model=schemas.CalendarioResponse)
def get_lezione(id_lezione: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Restituisce una lezione specifica tramite ID."""
    lezione = db.query(models.Calendario).filter(models.Calendario.id == id_lezione).first()
    if lezione is None:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    return lezione

def ensure_piano_studio_associazione(id_corso_attivo: int, id_modulo: int, db: Session):
    """
    Assicura che l'associazione tra CorsoAttivo ed Unità Formativa del Modulo
    esista nella tabella `corsi_attivi_unita_formative`.
    Questo previene l'errore del trigger SQL del database per edizioni che non hanno
    ancora il Piano Studio popolato manualmente.
    """
    if not id_modulo or not id_corso_attivo:
        return
    
    modulo = db.query(models.Modulo).filter(models.Modulo.id_modulo == id_modulo).first()
    if not modulo or not modulo.id_unita_formativa:
        return
    
    id_uf = modulo.id_unita_formativa
    assoc = db.query(models.CorsoAttivoUnitaFormativa).filter(
        models.CorsoAttivoUnitaFormativa.id_corso_attivo == id_corso_attivo,
        models.CorsoAttivoUnitaFormativa.id_unita_formativa == id_uf
    ).first()

    if not assoc:
        nuova_assoc = models.CorsoAttivoUnitaFormativa(
            id_corso_attivo=id_corso_attivo,
            id_unita_formativa=id_uf,
            ore_dedicate=100  # Default 100 ore per abilitare automaticamente la programmazione
        )
        db.add(nuova_assoc)
        db.flush()


def extract_sql_error_message(e: Exception) -> str:
    """Estrae un messaggio di errore chiaro e leggibile da eccezioni SQL e Trigger."""
    raw_str = str(e)
    if hasattr(e, 'orig'):
        orig = getattr(e, 'orig')
        if hasattr(orig, 'args') and len(orig.args) > 1:
            raw_str = str(orig.args[1])
        else:
            raw_str = str(orig)
    
    import re
    # Cerca l'inizio del messaggio 'Errore...' fino a fine riga per preservare gli apostrofi (es. un'altra)
    match = re.search(r"(Errore[^\r\n\t\(\)]+)", raw_str, re.IGNORECASE)
    if match:
        clean = match.group(1).strip().rstrip("'\"`")
        return clean
    
    if "foreign key constraint" in raw_str.lower():
        return "Impossibile salvare la lezione: riferimento non valido a modulo, docente o corso."
    
    return raw_str

@app.post("/calendario", response_model=schemas.CalendarioResponse, status_code=status.HTTP_201_CREATED)
def create_lezione(lezione: schemas.CalendarioCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Crea una nuova lezione nel calendario. I trigger SQL validano automaticamente
    ruolo docente, conflitti orari e budget ore delle unità formative."""
    corso_attivo = db.query(models.CorsoAttivo).filter(models.CorsoAttivo.id_corso_attivo == lezione.id_corso_attivo).first()
    if corso_attivo is None:
        raise HTTPException(status_code=400, detail="Corso attivo non trovato")
    if corso_attivo.archiviato:
        raise HTTPException(status_code=400, detail="Impossibile aggiungere lezioni: il corso è archiviato")
    
    nuova_lezione = models.Calendario(
        data=lezione.data,
        ora_inizio=lezione.ora_inizio,
        ora_fine=lezione.ora_fine,
        id_modulo=lezione.id_modulo,
        id_utente=lezione.id_utente,
        id_corso_attivo=lezione.id_corso_attivo,
        note=lezione.note
    )
    db.add(nuova_lezione)
    try:
        db.commit()
        db.refresh(nuova_lezione)
        return nuova_lezione
    except Exception as e:
        db.rollback()
        error_msg = extract_sql_error_message(e)
        raise HTTPException(status_code=400, detail=error_msg)

@app.put("/calendario/{id_lezione}", response_model=schemas.CalendarioResponse)
def update_lezione(id_lezione: int, lezione_data: schemas.CalendarioCreate, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Aggiorna una lezione esistente nel calendario."""
    lezione = db.query(models.Calendario).filter(models.Calendario.id == id_lezione).first()
    if lezione is None:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    
    corso_attivo = db.query(models.CorsoAttivo).filter(models.CorsoAttivo.id_corso_attivo == lezione_data.id_corso_attivo).first()
    if corso_attivo and corso_attivo.archiviato:
        raise HTTPException(status_code=400, detail="Impossibile modificare lezioni di un corso archiviato")
    
    lezione.data = lezione_data.data
    lezione.ora_inizio = lezione_data.ora_inizio
    lezione.ora_fine = lezione_data.ora_fine
    lezione.id_modulo = lezione_data.id_modulo
    lezione.id_utente = lezione_data.id_utente
    lezione.id_corso_attivo = lezione_data.id_corso_attivo
    lezione.note = lezione_data.note
    
    try:
        db.commit()
        db.refresh(lezione)
        return lezione
    except Exception as e:
        db.rollback()
        error_msg = extract_sql_error_message(e)
        raise HTTPException(status_code=400, detail=error_msg)

@app.delete("/calendario/{id_lezione}")
def delete_lezione(id_lezione: int, db: Session = Depends(get_db), current_user: models.Utente = Depends(get_current_user)):
    """Elimina una lezione dal calendario."""
    lezione = db.query(models.Calendario).filter(models.Calendario.id == id_lezione).first()
    if lezione is None:
        raise HTTPException(status_code=404, detail="Lezione non trovata")
    
    db.delete(lezione)
    db.commit()
    return {"message": "Lezione eliminata con successo"}


