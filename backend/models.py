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

from sqlalchemy import Column, Integer, String, Enum, Date, Time, Boolean, Text, Float, ForeignKey
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
    Nazione_Nascita = Column("nazione_nascita", String(100), nullable=True)
    Provincia_Nascita = Column("provincia_nascita", String(2), nullable=True)
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


# --- Modello per la tabella Corsi ---
class Corso(Base):
    __tablename__ = "corso"
    id_corso = Column("id_corso", Integer, primary_key=True, index=True)
    Nome = Column("nome", String(255), unique=True, nullable=False)
    Descrizione = Column("descrizione", Text, nullable=True)

    corsi_attivi = relationship("CorsoAttivo", back_populates="corso")


# --- Modello per la tabella Corsi Attivi ---
class CorsoAttivo(Base):
    __tablename__ = "corsi_attivi"
    id_corso_attivo = Column("id_corso_attivo", Integer, primary_key=True, index=True)
    id_corso = Column("id_corso", Integer, ForeignKey("corso.id_corso"), nullable=False)
    etichetta = Column("etichetta", String(100), nullable=True)  # es. 'Gruppo A', 'Turno Mattina'
    data_inizio = Column("data_inizio", Date, nullable=True)
    data_fine = Column("data_fine", Date, nullable=True)
    durata_ore = Column("durata_ore", Integer, nullable=True)
    ore_stage = Column("ore_stage", Integer, nullable=True)
    ore_teoria_aula = Column("ore_teoria_aula", Integer, nullable=True)
    percentuale_ore_assenza = Column("percentuale_ore_assenza", Float, nullable=True)
    tolleranza_ingresso_minuti = Column("tolleranza_ingresso_minuti", Integer, nullable=True)
    tolleranza_uscita_minuti = Column("tolleranza_uscita_minuti", Integer, nullable=True)
    archiviato = Column("archiviato", Boolean, default=False)

    corso = relationship("Corso", back_populates="corsi_attivi")
    lezioni = relationship("Calendario", back_populates="corso_attivo")


# --- Modello per la tabella Unita Formative ---
class UnitaFormativa(Base):
    __tablename__ = "unita_formativa"
    id_unita_formativa = Column("id_unita_formativa", Integer, primary_key=True, index=True)
    Nome = Column("nome", String(255), nullable=False)
    Descrizione = Column("descrizione", Text, nullable=True)

    moduli = relationship("Modulo", back_populates="unita_formativa")


# --- Modello per la tabella Moduli ---
class Modulo(Base):
    __tablename__ = "modulo"
    id_modulo = Column("id_modulo", Integer, primary_key=True, index=True)
    Nome = Column("nome", String(255), nullable=False)
    Descrizione = Column("descrizione", Text, nullable=True)
    id_unita_formativa = Column("id_unita_formativa", Integer, ForeignKey("unita_formativa.id_unita_formativa"), nullable=False)

    unita_formativa = relationship("UnitaFormativa", back_populates="moduli")
    lezioni = relationship("Calendario", back_populates="modulo")


# --- Modello per la tabella Corsi Attivi - Unità Formative (Piano Studio) ---
class CorsoAttivoUnitaFormativa(Base):
    __tablename__ = "corsi_attivi_unita_formative"
    id_corso_attivo = Column("id_corso_attivo", Integer, ForeignKey("corsi_attivi.id_corso_attivo"), primary_key=True)
    id_unita_formativa = Column("id_unita_formativa", Integer, ForeignKey("unita_formativa.id_unita_formativa"), primary_key=True)
    ore_dedicate = Column("ore_dedicate", Integer, nullable=False)

    corso_attivo = relationship("CorsoAttivo", backref="piano_studio")
    unita_formativa = relationship("UnitaFormativa")


# --- Modello per la tabella Calendario ---
class Calendario(Base):
    __tablename__ = "calendario"
    id = Column("id", Integer, primary_key=True, index=True)
    data = Column("data", Date, nullable=False)
    ora_inizio = Column("ora_inizio", Time, nullable=False)
    ora_fine = Column("ora_fine", Time, nullable=False)
    id_modulo = Column("id_modulo", Integer, ForeignKey("modulo.id_modulo"), nullable=True)
    id_utente = Column("id_utente", Integer, ForeignKey("utenti.id_utente"), nullable=True)
    id_corso_attivo = Column("id_corso_attivo", Integer, ForeignKey("corsi_attivi.id_corso_attivo"), nullable=False)
    note = Column("note", Text, nullable=True)

    modulo = relationship("Modulo", back_populates="lezioni")
    corso_attivo = relationship("CorsoAttivo", back_populates="lezioni")
    docente = relationship("Utente", foreign_keys=[id_utente])
