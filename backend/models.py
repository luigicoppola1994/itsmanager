# ==============================================================================
# models.py — Modelli ORM (Object-Relational Mapping)
# Ogni classe in questo file rappresenta UNA TABELLA del database.
# SQLAlchemy traduce automaticamente le operazioni Python in query SQL.
#
# COME AGGIUNGERE UNA NUOVA TABELLA:
# 1. Crea una nuova classe che eredita da Base
# 2. Definisci __tablename__ con il nome esatto della tabella nel DB
# 3. Aggiungi le colonne con i tipi corretti
# 4. Aggiorna schemas.py con i Pydantic schema corrispondenti
# 5. Aggiungi gli endpoint in main.py
# ==============================================================================

from sqlalchemy import Column, Integer, String, Enum, Date, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship  # Per definire relazioni tra tabelle
from database import Base               # La Base dichiarativa da cui tutti i modelli ereditano


# ------------------------------------------------------------------------------
# MODELLO: Ruolo
# Mappa la tabella "Ruoli" del database.
# ------------------------------------------------------------------------------
class Ruolo(Base):
    __tablename__ = "ruoli"
    id_ruolo = Column("id_ruolo", Integer, primary_key=True, index=True)
    Nome = Column("nome", String(255), nullable=False)
    Descrizione = Column("descrizione", Text, nullable=True)

    utenti = relationship("Utente", back_populates="ruolo")


# ------------------------------------------------------------------------------
# MODELLO: Utente
# Mappa la tabella "utenti" del database its-manager_db.
# Ogni attributo della classe corrisponde a una colonna della tabella.
# ------------------------------------------------------------------------------
class Utente(Base):
    __tablename__ = "utenti"  # Nome ESATTO della tabella nel DB (case-sensitive su Linux!)

    # Column(tipo, opzioni) definisce una colonna del DB
    # Integer: numero intero
    # primary_key=True: chiave primaria (identificatore univoco della riga)
    # index=True: crea un indice per velocizzare le ricerche su questo campo
    id_utente = Column("id_utente", Integer, primary_key=True, index=True)

    # String(100): testo fino a 100 caratteri — corrisponde a VARCHAR(100) in SQL
    # nullable=False: campo obbligatorio, non può essere NULL
    Nome = Column("nome", String(100), nullable=False)
    Cognome = Column("cognome", String(100), nullable=False)

    # Enum: accetta solo uno dei valori specificati — corrisponde a ENUM in SQL
    # nullable=True: campo opzionale, può essere NULL
    Genere = Column("genere", Enum('Maschio', 'Femmina', 'Altro'), nullable=True)

    # unique=True: non possono esistere due righe con lo stesso valore
    Codice_Fiscale = Column("codice_fiscale", String(16), unique=True, nullable=True)

    # Date: data senza orario — corrisponde a DATE in SQL (formato YYYY-MM-DD)
    Data_Nascita = Column("data_nascita", Date, nullable=True)

    Citta_Nascita = Column("citta_nascita", String(100), nullable=True)
    Indirizzo_Residenza = Column("indirizzo_residenza", String(255), nullable=True)
    Citta_Residenza = Column("citta_residenza", String(100), nullable=True)
    Cap_Residenza = Column("cap_residenza", String(10), nullable=True)
    Provincia_Residenza = Column("provincia_residenza", String(2), nullable=True)
    Telefono = Column("telefono", String(20), nullable=True)

    # Email deve essere unica nel sistema (nessun duplicato)
    Email = Column("email", String(255), unique=True, nullable=False)

    # Password viene sempre salvata come HASH bcrypt, mai in chiaro
    Password = Column("password", String(255), nullable=False)

    # Boolean: True/False — corrisponde a TINYINT(1) in MySQL (1=True, 0=False)
    # default=True: al momento della creazione, il campo viene impostato a True
    Primo_Accesso = Column("primo_accesso", Boolean, default=True)

    # Chiave esterna che punta alla tabella ruoli
    # ForeignKey("ruoli.id_ruolo"): questo valore deve esistere nella tabella ruoli
    id_ruolo = Column("id_ruolo", Integer, ForeignKey("ruoli.id_ruolo"), nullable=False)

    ruolo = relationship("Ruolo", back_populates="utenti")


# ==============================================================================
# DOVE AGGIUNGERE NUOVI MODELLI:
# Sotto questo commento, aggiungi le classi per le altre tabelle del DB.
# Ogni classe deve ereditare da Base e avere __tablename__ corretto.
# ==============================================================================

# --- ESEMPIO: Modello per la tabella Ruoli ---
# class Ruolo(Base):
#     __tablename__ = "Ruoli"
#     id_ruolo = Column(Integer, primary_key=True, index=True)
#     Nome = Column(String(255), nullable=False)
#     Descrizione = Column(Text, nullable=True)

# --- ESEMPIO: Modello per la tabella Corso ---
# class Corso(Base):
#     __tablename__ = "corso"
#     id_corso = Column(Integer, primary_key=True, index=True)
#     Nome = Column(String(255), nullable=False)
#     Descrizione = Column(Text, nullable=True)

# --- ESEMPIO: Modello per la tabella Presenze ---
# class Presenza(Base):
#     __tablename__ = "presenze"
#     id_presenza = Column(Integer, primary_key=True, index=True)
#     id_utente = Column(Integer, ForeignKey("Utenti.id_utente"), nullable=False)
#     data_presenza = Column(Date, nullable=False)
#     ora_ingresso = Column(String(8), nullable=True)   # formato HH:MM:SS
#     ora_uscita = Column(String(8), nullable=True)
#     note = Column(Text, nullable=True)
