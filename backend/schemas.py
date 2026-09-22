# ==============================================================================
# schemas.py — Schemi Pydantic (validazione dati in ingresso e in uscita)
# Pydantic valida automaticamente i dati delle richieste HTTP e le risposte.
# Ogni schema definisce la "forma" dei dati che un endpoint accetta o restituisce.
#
# DIFFERENZA CON models.py:
# - models.py descrive la struttura del DATABASE (SQLAlchemy)
# - schemas.py descrive la struttura dei DATI HTTP (Pydantic)
# I due livelli sono separati per sicurezza e flessibilità.
#
# COME AGGIUNGERE SCHEMI PER NUOVE TABELLE:
# 1. Crea una classe Base con i campi comuni
# 2. Crea una classe Create (per le richieste POST) che eredita da Base
# 3. Crea una classe Response (per le risposte GET) che aggiunge i campi del DB (es. id)
# ==============================================================================

from pydantic import BaseModel, model_validator  # Classe base di Pydantic e validatore per gli schemi
from typing import Optional     # Permette di dichiarare campi opzionali (possono essere None)
from datetime import date, time  # Tipo date e time per i campi data/orario


# ------------------------------------------------------------------------------
# SCHEMA BASE: UtenteBase
# Contiene i campi condivisi tra la creazione e la risposta dell'utente.
# Non viene usato direttamente come tipo in un endpoint, serve come "mattone" base.
# ------------------------------------------------------------------------------
class UtenteBase(BaseModel):
    Nome: str                              # Campo obbligatorio: deve essere una stringa
    Cognome: str                           # Campo obbligatorio
    Email: str                             # Campo obbligatorio
    Password: str                          # Campo obbligatorio
    id_ruolo: int                          # Campo obbligatorio: intero (1=admin, 2=docente, 3=studente...)

    # Optional[tipo] = None: il campo è facoltativo, se non inviato vale None
    Genere: Optional[str] = None
    Codice_Fiscale: Optional[str] = None
    Data_Nascita: Optional[str] = None    # Stringa ISO (es. "1990-05-15") o None
    Citta_Nascita: Optional[str] = None
    Provincia_Nascita: Optional[str] = None
    Indirizzo_Residenza: Optional[str] = None
    Citta_Residenza: Optional[str] = None
    Cap_Residenza: Optional[str] = None
    Provincia_Residenza: Optional[str] = None
    Telefono: Optional[str] = None
    Primo_Accesso: Optional[bool] = None


# ------------------------------------------------------------------------------
# SCHEMA CREAZIONE: UtenteCreate
# Usato come tipo nei metodi POST per creare un nuovo utente.
# Eredita tutti i campi da UtenteBase senza modifiche.
# FastAPI legge automaticamente il body JSON della richiesta e lo valida.
#
# USO NELL'ENDPOINT (main.py):
#   @app.post("/users")
#   def create_user(user: UtenteCreate, ...):
#       print(user.Nome)  # accede ai campi validati
# ------------------------------------------------------------------------------
class UtenteCreate(UtenteBase):
    Password: str  # Richiediamo esplicitamente la password in chiaro (verrà poi hashata)


# ------------------------------------------------------------------------------
# SCHEMA RISPOSTA: UtenteResponse
# Usato come tipo di ritorno nei metodi GET.
# Aggiunge l'id_utente (generato dal DB) che non è presente nella creazione.
# Pydantic usa questo schema per serializzare l'oggetto SQLAlchemy in JSON.
#
# IMPORTANTE: il campo Password è incluso — in produzione considera di escluderlo
# usando un campo separato "UtentePublic" senza Password.
# ------------------------------------------------------------------------------
class UtenteResponse(UtenteBase):
    id_utente: int             # ID generato automaticamente dal database
    Primo_Accesso: Optional[bool] = None
    # Override: il DB restituisce datetime.date, non una stringa
    Data_Nascita: Optional[date] = None

    class Config:
        from_attributes = True  # Necessario per convertire oggetti SQLAlchemy in Pydantic
                                # (in versioni vecchie si chiamava orm_mode = True)


# ------------------------------------------------------------------------------
# SCHEMA AGGIORNAMENTO: UtenteUpdate
# Usato come tipo nei metodi PUT per aggiornare un utente esistente.
# Tutti i campi sono opzionali; la password viene aggiornata solo se specificata.
# ------------------------------------------------------------------------------
class UtenteUpdate(BaseModel):
    Nome: Optional[str] = None
    Cognome: Optional[str] = None
    Email: Optional[str] = None
    Password: Optional[str] = None
    id_ruolo: Optional[int] = None
    Genere: Optional[str] = None
    Codice_Fiscale: Optional[str] = None
    Data_Nascita: Optional[str] = None
    Citta_Nascita: Optional[str] = None
    Provincia_Nascita: Optional[str] = None
    Indirizzo_Residenza: Optional[str] = None
    Citta_Residenza: Optional[str] = None
    Cap_Residenza: Optional[str] = None
    Provincia_Residenza: Optional[str] = None
    Telefono: Optional[str] = None
    Primo_Accesso: Optional[bool] = None


# ==============================================================================
# DOVE AGGIUNGERE NUOVI SCHEMI:
# Sotto questo commento, aggiungi schemi per le altre tabelle del DB.
# Segui il pattern Base/Create/Response per ogni entità.
# ==============================================================================


# --- Schema per la tabella Ruoli ---
class RuoloBase(BaseModel):
    Nome: str
    Descrizione: Optional[str] = None

class RuoloCreate(RuoloBase):
    pass

class RuoloResponse(RuoloBase):
    id_ruolo: int
    class Config:
        from_attributes = True


# --- Schema per la tabella Corsi ---
class CorsoBase(BaseModel):
    Nome: str
    Descrizione: Optional[str] = None

class CorsoCreate(CorsoBase):
    pass

class CorsoResponse(CorsoBase):
    id_corso: int
    class Config:
        from_attributes = True


# --- Schema per la tabella Corsi Attivi ---
class CorsoAttivoBase(BaseModel):
    id_corso: int
    etichetta: Optional[str] = None  # es. 'Gruppo A', 'Turno Mattina'
    data_inizio: Optional[date] = None
    data_fine: Optional[date] = None
    durata_ore: Optional[int] = None
    ore_stage: Optional[int] = None
    ore_teoria_aula: Optional[int] = None
    percentuale_ore_assenza: Optional[float] = None
    tolleranza_ingresso_minuti: Optional[int] = None
    tolleranza_uscita_minuti: Optional[int] = None
    archiviato: Optional[bool] = False

class CorsoAttivoCreate(CorsoAttivoBase):
    pass

class CorsoAttivoResponse(CorsoAttivoBase):
    id_corso_attivo: int
    class Config:
        from_attributes = True


# --- Schema per la tabella Unita Formative ---
class UnitaFormativaBase(BaseModel):
    Nome: str
    Descrizione: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def handle_column_names(cls, data):
        if isinstance(data, dict):
            if 'nome' in data and 'Nome' not in data:
                data['Nome'] = data['nome']
            if 'descrizione' in data and 'Descrizione' not in data:
                data['Descrizione'] = data['descrizione']
        return data

class UnitaFormativaCreate(UnitaFormativaBase):
    pass

class UnitaFormativaResponse(UnitaFormativaBase):
    id_unita_formativa: int
    class Config:
        from_attributes = True


# --- Schema per la tabella Moduli ---
class ModuloBase(BaseModel):
    Nome: str
    Descrizione: Optional[str] = None
    id_unita_formativa: int

    @model_validator(mode='before')
    @classmethod
    def handle_column_names(cls, data):
        if isinstance(data, dict):
            if 'nome' in data and 'Nome' not in data:
                data['Nome'] = data['nome']
            if 'descrizione' in data and 'Descrizione' not in data:
                data['Descrizione'] = data['descrizione']
        return data

class ModuloCreate(ModuloBase):
    pass

class ModuloResponse(ModuloBase):
    id_modulo: int
    class Config:
        from_attributes = True


# --- Schema per Corsi Attivi - Unità Formative (Piano Studio) ---
class CorsoAttivoUnitaFormativaBase(BaseModel):
    id_corso_attivo: int
    id_unita_formativa: int
    ore_dedicate: int

class CorsoAttivoUnitaFormativaCreate(CorsoAttivoUnitaFormativaBase):
    pass

class CorsoAttivoUnitaFormativaResponse(CorsoAttivoUnitaFormativaBase):
    class Config:
        from_attributes = True


# --- Schema per la tabella Calendario ---
class CalendarioBase(BaseModel):
    data: date
    ora_inizio: time
    ora_fine: time
    id_modulo: Optional[int] = None
    id_utente: Optional[int] = None
    id_corso_attivo: int
    note: Optional[str] = None

class CalendarioCreate(CalendarioBase):
    pass

class CalendarioResponse(CalendarioBase):
    id: int
    class Config:
        from_attributes = True
