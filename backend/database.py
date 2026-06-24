# ==============================================================================
# database.py — Configurazione della connessione al database
# Questo file crea il "motore" SQLAlchemy che gestisce tutte le connessioni al DB.
# Viene importato dagli altri moduli tramite:
#   from database import engine, get_db, Base
# ==============================================================================

import os                                               # Per leggere le variabili d'ambiente
from sqlalchemy import create_engine                    # Crea il motore di connessione al DB
from sqlalchemy.orm import sessionmaker                 # Crea fabbriche di sessioni DB
from sqlalchemy.ext.declarative import declarative_base # Base per i modelli ORM

# ------------------------------------------------------------------------------
# CONFIGURAZIONE URL DEL DATABASE
# L'URL viene letto dalla variabile d'ambiente DATABASE_URL (impostata in docker-compose.yml).
# Se la variabile non esiste (es. sviluppo locale senza Docker), usa il valore di fallback.
#
# Formato dell'URL:
#   mysql+pymysql://<utente>:<password>@<host>:<porta>/<nome_database>
#   - mysql+pymysql: dialetto MySQL usando il driver PyMySQL
#   - utente/password: credenziali del database
#   - host: indirizzo del server (es. mysql-its-manager.alwaysdata.net)
#   - porta: 3306 è la porta standard di MySQL/MariaDB
#   - nome_database: lo schema specifico da usare
# ------------------------------------------------------------------------------
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://user:user_password@localhost:3306/its_db"  # Fallback locale
)

# ------------------------------------------------------------------------------
# CONFIGURAZIONE SSL
# Per connessioni a database remoti (cloud), attiviamo SSL automaticamente.
# ssl={} dice a PyMySQL di usare SSL senza richiedere certificati CA specifici.
# In locale (localhost/127.0.0.1), SSL non è necessario.
# ------------------------------------------------------------------------------
connect_args = {}
if "localhost" not in SQLALCHEMY_DATABASE_URL and "127.0.0.1" not in SQLALCHEMY_DATABASE_URL:
    connect_args["ssl"] = {}  # Abilita SSL per connessioni remote

# ------------------------------------------------------------------------------
# CREAZIONE ENGINE
# L'engine è il "ponte" tra il codice Python e il database.
# Gestisce il pool di connessioni: invece di aprire/chiudere una connessione ad ogni
# richiesta, mantiene un pool di connessioni pronte all'uso.
# ------------------------------------------------------------------------------
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)

# ------------------------------------------------------------------------------
# CREAZIONE SessionLocal
# sessionmaker crea una fabbrica di sessioni. Ogni "sessione" è un'unità di lavoro
# con il database: raggruppa più operazioni (SELECT, INSERT, UPDATE) in una transazione.
#   - autocommit=False: le modifiche non vengono salvate automaticamente, usiamo db.commit()
#   - autoflush=False: le modifiche non vengono inviate automaticamente prima delle query
# ------------------------------------------------------------------------------
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ------------------------------------------------------------------------------
# BASE per i modelli ORM
# Tutti i modelli (in models.py) devono ereditare da questa Base.
# SQLAlchemy la usa per mappare le classi Python alle tabelle del database.
# ------------------------------------------------------------------------------
Base = declarative_base()


# ------------------------------------------------------------------------------
# FUNZIONE: get_db (Dependency Injection)
# Questa funzione viene "iniettata" negli endpoint FastAPI tramite Depends(get_db).
# Apre una sessione DB per gestire la richiesta e la chiude sempre al termine,
# anche in caso di errore (il blocco finally garantisce la chiusura).
#
# USO NEGLI ENDPOINT:
#   def get_users(db: Session = Depends(get_db)):
#       users = db.query(...)
# ------------------------------------------------------------------------------
def get_db():
    db = SessionLocal()  # Apre una nuova sessione
    try:
        yield db         # "Presta" la sessione all'endpoint che la richiede
    finally:
        db.close()       # Chiude sempre la sessione al termine della richiesta


# ==============================================================================
# DOVE AGGIUNGERE NUOVO CODICE:
# - Se vuoi aggiungere altri database (es. PostgreSQL), cambia il prefisso dell'URL:
#     "postgresql+psycopg2://utente:password@host:5432/db"
# - Per vedere le query SQL eseguite (debug), aggiungi echo=True all'engine:
#     engine = create_engine(SQLALCHEMY_DATABASE_URL, echo=True, connect_args=connect_args)
# ==============================================================================
