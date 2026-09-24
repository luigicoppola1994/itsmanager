"""
Script per creare le tabelle mancanti nel database remoto.
Esegui questo script UNA SOLA VOLTA per creare le tabelle:
  python create_tables.py
"""

import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://its-manager:progettoits2026@mysql-its-manager.alwaysdata.net:3306/its-manager_db"
)

connect_args = {}
if "localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL:
    connect_args["ssl"] = {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

SQL_CREATE_UNITA_FORMATIVA = """
CREATE TABLE IF NOT EXISTS `unita_formativa` (
    `id_unita_formativa` INT AUTO_INCREMENT PRIMARY KEY,
    `nome` VARCHAR(255) NOT NULL,
    `descrizione` TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

SQL_CREATE_MODULO = """
CREATE TABLE IF NOT EXISTS `modulo` (
    `id_modulo` INT AUTO_INCREMENT PRIMARY KEY,
    `nome` VARCHAR(255) NOT NULL,
    `descrizione` TEXT NULL,
    `id_unita_formativa` INT NOT NULL,
    CONSTRAINT `fk_modulo_uf` FOREIGN KEY (`id_unita_formativa`) 
        REFERENCES `unita_formativa` (`id_unita_formativa`)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

SQL_CREATE_CORSI_ATTIVI_UNITA_FORMATIVE = """
CREATE TABLE IF NOT EXISTS `corsi_attivi_unita_formative` (
    `id_corso_attivo` INT NOT NULL,
    `id_unita_formativa` INT NOT NULL,
    `ore_dedicate` INT NOT NULL,
    PRIMARY KEY (`id_corso_attivo`, `id_unita_formativa`),
    CONSTRAINT `fk_cauf_corso_attivo` FOREIGN KEY (`id_corso_attivo`) REFERENCES `corsi_attivi` (`id_corso_attivo`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_cauf_unita_formativa` FOREIGN KEY (`id_unita_formativa`) REFERENCES `unita_formativa` (`id_unita_formativa`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""

# Aggiunge la colonna id_modulo alla tabella calendario se non esiste già
SQL_ADD_MODULO_TO_CALENDARIO = """
ALTER TABLE `calendario`
ADD COLUMN IF NOT EXISTS `id_modulo` INT NULL,
ADD CONSTRAINT `fk_calendario_modulo` FOREIGN KEY (`id_modulo`) 
    REFERENCES `modulo` (`id_modulo`) ON DELETE SET NULL ON UPDATE CASCADE;
"""

def create_missing_tables():
    with engine.connect() as conn:
        print("Connessione al database riuscita!")
        
        print("Creazione tabella 'unita_formativa'...")
        conn.execute(text(SQL_CREATE_UNITA_FORMATIVA))
        print("  ✓ Tabella 'unita_formativa' creata (o già esistente).")
        
        print("Creazione tabella 'modulo'...")
        conn.execute(text(SQL_CREATE_MODULO))
        print("  ✓ Tabella 'modulo' creata (o già esistente).")

        print("Creazione tabella 'corsi_attivi_unita_formative'...")
        conn.execute(text(SQL_CREATE_CORSI_ATTIVI_UNITA_FORMATIVE))
        print("  ✓ Tabella 'corsi_attivi_unita_formative' creata (o già esistente).")

        print("Creazione tabella 'utenti_corsi_attivi'...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS `utenti_corsi_attivi` (
                `id_utente` INT NOT NULL,
                `id_corso_attivo` INT NOT NULL,
                PRIMARY KEY (`id_utente`, `id_corso_attivo`),
                CONSTRAINT `fk_uca_utente` FOREIGN KEY (`id_utente`) 
                    REFERENCES `utenti` (`id_utente`) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT `fk_uca_corso_attivo` FOREIGN KEY (`id_corso_attivo`) 
                    REFERENCES `corsi_attivi` (`id_corso_attivo`) ON DELETE CASCADE ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        """))
        print("  ✓ Tabella 'utenti_corsi_attivi' creata (o già esistente).")

        
        # Verifica se la colonna id_modulo esiste già nel calendario
        result = conn.execute(text("""
            SELECT COUNT(*) as cnt 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'calendario' 
              AND COLUMN_NAME = 'id_modulo'
        """))
        row = result.fetchone()
        if row[0] == 0:
            print("Aggiunta colonna 'id_modulo' alla tabella 'calendario'...")
            try:
                conn.execute(text("""
                    ALTER TABLE `calendario`
                    ADD COLUMN `id_modulo` INT NULL,
                    ADD CONSTRAINT `fk_calendario_modulo` FOREIGN KEY (`id_modulo`) 
                        REFERENCES `modulo` (`id_modulo`) ON DELETE SET NULL ON UPDATE CASCADE
                """))
                print("  ✓ Colonna 'id_modulo' aggiunta a 'calendario'.")
            except Exception as e:
                print(f"  ⚠ Errore su calendario: {e}")
        else:
            print("  ✓ Colonna 'id_modulo' già presente in 'calendario'.")
        
        # Aggiunge la colonna 'etichetta' a corsi_attivi se non esiste già
        result = conn.execute(text("""
            SELECT COUNT(*) as cnt 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'corsi_attivi' 
              AND COLUMN_NAME = 'etichetta'
        """))
        row = result.fetchone()
        if row[0] == 0:
            print("Aggiunta colonna 'etichetta' alla tabella 'corsi_attivi'...")
            try:
                conn.execute(text("""
                    ALTER TABLE `corsi_attivi`
                    ADD COLUMN `etichetta` VARCHAR(100) NULL AFTER `id_corso`
                """))
                print("  ✓ Colonna 'etichetta' aggiunta a 'corsi_attivi'.")
            except Exception as e:
                print(f"  ⚠ Errore su corsi_attivi: {e}")
        else:
            print("  ✓ Colonna 'etichetta' già presente in 'corsi_attivi'.")

        # Aggiunge la colonna 'nazionalita' a utenti se non esiste già
        result = conn.execute(text("""
            SELECT COUNT(*) as cnt 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'utenti' 
              AND COLUMN_NAME = 'nazionalita'
        """))
        row = result.fetchone()
        if row[0] == 0:
            print("Aggiunta colonna 'nazionalita' alla tabella 'utenti'...")
            try:
                conn.execute(text("""
                    ALTER TABLE `utenti`
                    ADD COLUMN `nazionalita` VARCHAR(100) NULL DEFAULT 'Italiana' AFTER `citta_nascita`
                """))
                print("  ✓ Colonna 'nazionalita' aggiunta a 'utenti'.")
            except Exception as e:
                print(f"  ⚠ Errore su utenti (nazionalita): {e}")
        else:
            print("  ✓ Colonna 'nazionalita' già presente in 'utenti'.")

        # Se la vecchia colonna 'nazione_nascita' esiste ancora, migra i dati e rimuovila
        result_old = conn.execute(text("""
            SELECT COUNT(*) as cnt 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'utenti' 
              AND COLUMN_NAME = 'nazione_nascita'
        """))
        row_old = result_old.fetchone()
        if row_old[0] > 0:
            print("Migrazione da 'nazione_nascita' a 'nazionalita' e pulizia vecchia colonna...")
            try:
                conn.execute(text("UPDATE `utenti` SET `nazionalita` = `nazione_nascita` WHERE `nazione_nascita` IS NOT NULL AND `nazione_nascita` != ''"))
                conn.execute(text("ALTER TABLE `utenti` DROP COLUMN `nazione_nascita`"))
                print("  ✓ Colonna 'nazione_nascita' migrata e rimossa con successo.")
            except Exception as e:
                print(f"  ⚠ Errore rimozione nazione_nascita: {e}")

        conn.commit()
        print("\n✅ Tutte le tabelle sono state create con successo!")

if __name__ == "__main__":
    create_missing_tables()
