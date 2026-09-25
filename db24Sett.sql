-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Host: mysql-its-manager.alwaysdata.net
-- Generation Time: Sep 24, 2026 at 02:19 PM
-- Server version: 11.4.13-MariaDB
-- PHP Version: 8.4.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `its-manager_db`
--
CREATE DATABASE IF NOT EXISTS `its-manager_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `its-manager_db`;

-- --------------------------------------------------------

--
-- Table structure for table `calendario`
--

DROP TABLE IF EXISTS `calendario`;
CREATE TABLE `calendario` (
  `id` int(11) NOT NULL,
  `data` date NOT NULL,
  `ora_inizio` time NOT NULL,
  `ora_fine` time NOT NULL,
  `id_modulo` int(11) NOT NULL,
  `id_utente` int(11) NOT NULL,
  `id_corso_attivo` int(11) NOT NULL,
  `note` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `calendario`
--
DROP TRIGGER IF EXISTS `chk_calendario_budget_ore_insert`;
DELIMITER $$
CREATE TRIGGER `chk_calendario_budget_ore_insert` BEFORE INSERT ON `calendario` FOR EACH ROW BEGIN
    DECLARE unita_id INT;
    DECLARE budget_ore DECIMAL(10,2);
    DECLARE ore_gia_pianificate DECIMAL(10,2) DEFAULT 0;
    DECLARE ore_nuova_lezione DECIMAL(10,2);

    -- 1. Trovo l'id_unita_formativa a cui appartiene il modulo che stiamo inserendo
    SELECT id_unita_formativa INTO unita_id 
    FROM modulo 
    WHERE id_modulo = NEW.id_modulo;

    -- 2. Trovo il budget di ore stabilito per questa Unita Formativa nel Corso Attivo
    SELECT ore_dedicate INTO budget_ore
    FROM corsi_attivi_unita_formative
    WHERE id_corso_attivo = NEW.id_corso_attivo AND id_unita_formativa = unita_id;

    -- 3. Calcolo la durata della nuova lezione in ore (es. 90 minuti / 60 = 1.5 ore)
    SET ore_nuova_lezione = TIMESTAMPDIFF(MINUTE, NEW.ora_inizio, NEW.ora_fine) / 60.0;

    -- 4. Sommo le ore di tutte le lezioni già pianificate per la stessa Unita Formativa in questo corso
    SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, c.ora_inizio, c.ora_fine) / 60.0), 0)
    INTO ore_gia_pianificate
    FROM calendario c
    JOIN modulo m ON c.id_modulo = m.id_modulo
    WHERE c.id_corso_attivo = NEW.id_corso_attivo
      AND m.id_unita_formativa = unita_id;

    -- 5. Controllo finale: se la somma supera il budget, blocco l'inserimento
    IF (ore_gia_pianificate + ore_nuova_lezione) > budget_ore THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore: Inserimento bloccato. La durata di questa lezione supera il budget massimo di ore stabilito per questa Unità Formativa.';
    END IF;
END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `chk_calendario_budget_ore_update`;
DELIMITER $$
CREATE TRIGGER `chk_calendario_budget_ore_update` BEFORE UPDATE ON `calendario` FOR EACH ROW BEGIN
    DECLARE unita_id INT;
    DECLARE budget_ore DECIMAL(10,2);
    DECLARE ore_gia_pianificate DECIMAL(10,2) DEFAULT 0;
    DECLARE ore_nuova_lezione DECIMAL(10,2);

    -- 1. Trovo l'id_unita_formativa del modulo aggiornato
    SELECT id_unita_formativa INTO unita_id 
    FROM modulo 
    WHERE id_modulo = NEW.id_modulo;

    -- 2. Trovo il budget di ore stabilito
    SELECT ore_dedicate INTO budget_ore
    FROM corsi_attivi_unita_formative
    WHERE id_corso_attivo = NEW.id_corso_attivo AND id_unita_formativa = unita_id;

    -- 3. Calcolo la durata della lezione aggiornata in ore
    SET ore_nuova_lezione = TIMESTAMPDIFF(MINUTE, NEW.ora_inizio, NEW.ora_fine) / 60.0;

    -- 4. Sommo le ore delle lezioni già pianificate (ESCLUDENDO la riga che sto modificando)
    SELECT COALESCE(SUM(TIMESTAMPDIFF(MINUTE, c.ora_inizio, c.ora_fine) / 60.0), 0)
    INTO ore_gia_pianificate
    FROM calendario c
    JOIN modulo m ON c.id_modulo = m.id_modulo
    WHERE c.id_corso_attivo = NEW.id_corso_attivo
      AND m.id_unita_formativa = unita_id
      AND c.id != NEW.id;

    -- 5. Controllo finale
    IF (ore_gia_pianificate + ore_nuova_lezione) > budget_ore THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore in modifica: Il nuovo orario esteso supera il budget massimo di ore stabilito per questa Unità Formativa.';
    END IF;
END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `chk_calendario_coerenza_modulo_insert`;
DELIMITER $$
CREATE TRIGGER `chk_calendario_coerenza_modulo_insert` BEFORE INSERT ON `calendario` FOR EACH ROW BEGIN
    DECLARE coerenza_valida INT;

    -- Conta se esiste un collegamento valido tra il modulo e il corso attivo
    SELECT COUNT(*) INTO coerenza_valida
    FROM modulo m
    JOIN corsi_attivi_unita_formative cauf ON m.id_unita_formativa = cauf.id_unita_formativa
    WHERE m.id_modulo = NEW.id_modulo
      AND cauf.id_corso_attivo = NEW.id_corso_attivo;

    -- Se il conteggio è 0, significa che il modulo non appartiene a quel corso
    IF coerenza_valida = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore: Il modulo selezionato non fa parte delle unità formative assegnate a questo corso attivo.';
    END IF;
END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `chk_calendario_coerenza_modulo_update`;
DELIMITER $$
CREATE TRIGGER `chk_calendario_coerenza_modulo_update` BEFORE UPDATE ON `calendario` FOR EACH ROW BEGIN
    DECLARE coerenza_valida INT;

    -- Esegue il controllo di coerenza sui nuovi dati (NEW) in fase di aggiornamento
    SELECT COUNT(*) INTO coerenza_valida
    FROM modulo m
    JOIN corsi_attivi_unita_formative cauf ON m.id_unita_formativa = cauf.id_unita_formativa
    WHERE m.id_modulo = NEW.id_modulo
      AND cauf.id_corso_attivo = NEW.id_corso_attivo;

    IF coerenza_valida = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore in modifica: Il modulo selezionato non fa parte delle unità formative assegnate a questo corso attivo.';
    END IF;
END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `chk_calendario_docente`;
DELIMITER $$
CREATE TRIGGER `chk_calendario_docente` BEFORE INSERT ON `calendario` FOR EACH ROW BEGIN
    DECLARE nome_ruolo VARCHAR(255);
    
    -- Recupera dinamicamente il NOME del ruolo convertendolo in minuscolo
    SELECT LOWER(r.nome) INTO nome_ruolo 
    FROM utenti u
    JOIN ruoli r ON u.id_ruolo = r.id_ruolo
    WHERE u.id_utente = NEW.id_utente;
    
    -- Controlla la stringa testuale in minuscolo
    IF nome_ruolo != 'docente' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore: L''utente assegnato al calendario deve possedere il ruolo di docente.';
    END IF;
END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `chk_calendario_sovrapposizioni_insert`;
DELIMITER $$
CREATE TRIGGER `chk_calendario_sovrapposizioni_insert` BEFORE INSERT ON `calendario` FOR EACH ROW BEGIN
    DECLARE conflitti_docente INT;
    DECLARE conflitti_classe INT;

    -- 1. Controllo sovrapposizione per il DOCENTE
    SELECT COUNT(*) INTO conflitti_docente
    FROM calendario
    WHERE id_utente = NEW.id_utente -- Stesso docente
      AND data = NEW.data           -- Stesso giorno
      AND (NEW.ora_inizio < ora_fine AND NEW.ora_fine > ora_inizio); -- Sovrapposizione di orario

    IF conflitti_docente > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore: Il docente selezionato ha già una lezione programmata in questa fascia oraria.';
    END IF;

    -- 2. Controllo sovrapposizione per la CLASSE (Corso Attivo)
    SELECT COUNT(*) INTO conflitti_classe
    FROM calendario
    WHERE id_corso_attivo = NEW.id_corso_attivo -- Stesso corso
      AND data = NEW.data                       -- Stesso giorno
      AND (NEW.ora_inizio < ora_fine AND NEW.ora_fine > ora_inizio); -- Sovrapposizione di orario

    IF conflitti_classe > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore: Questa classe ha già un''altra lezione programmata in questa fascia oraria.';
    END IF;
END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `chk_calendario_sovrapposizioni_update`;
DELIMITER $$
CREATE TRIGGER `chk_calendario_sovrapposizioni_update` BEFORE UPDATE ON `calendario` FOR EACH ROW BEGIN
    DECLARE conflitti_docente INT;
    DECLARE conflitti_classe INT;

    -- 1. Controllo sovrapposizione per il DOCENTE (escludendo la lezione corrente)
    SELECT COUNT(*) INTO conflitti_docente
    FROM calendario
    WHERE id_utente = NEW.id_utente 
      AND data = NEW.data 
      AND id != NEW.id -- Fondamentale: ignora la riga che stiamo modificando
      AND (NEW.ora_inizio < NEW.ora_fine AND NEW.ora_fine > NEW.ora_inizio);

    IF conflitti_docente > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore in modifica: Il docente ha già un''altra lezione programmata in questa fascia oraria.';
    END IF;

    -- 2. Controllo sovrapposizione per la CLASSE (escludendo la lezione corrente)
    SELECT COUNT(*) INTO conflitti_classe
    FROM calendario
    WHERE id_corso_attivo = NEW.id_corso_attivo 
      AND data = NEW.data 
      AND id != NEW.id -- Fondamentale: ignora la riga che stiamo modificando
      AND (NEW.ora_inizio < NEW.ora_fine AND NEW.ora_fine > NEW.ora_inizio);

    IF conflitti_classe > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore in modifica: Questa classe ha già un''altra lezione programmata in questa fascia oraria.';
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `corsi_attivi`
--

DROP TABLE IF EXISTS `corsi_attivi`;
CREATE TABLE `corsi_attivi` (
  `id_corso_attivo` int(11) NOT NULL,
  `id_corso` int(11) NOT NULL,
  `etichetta` varchar(100) DEFAULT NULL,
  `data_inizio` date NOT NULL,
  `data_fine` date NOT NULL,
  `durata_ore` int(11) NOT NULL,
  `ore_stage` int(11) NOT NULL DEFAULT 0,
  `ore_teoria_aula` int(11) NOT NULL DEFAULT 0,
  `percentuale_ore_assenza` int(11) DEFAULT NULL CHECK (`percentuale_ore_assenza` >= 0 and `percentuale_ore_assenza` <= 30),
  `tolleranza_ingresso_minuti` int(11) DEFAULT 0 CHECK (`tolleranza_ingresso_minuti` >= 0 and `tolleranza_ingresso_minuti` <= 30),
  `tolleranza_uscita_minuti` int(11) DEFAULT 0 CHECK (`tolleranza_uscita_minuti` >= 0 and `tolleranza_uscita_minuti` <= 45),
  `archiviato` tinyint(1) DEFAULT 0
) ;

-- --------------------------------------------------------

--
-- Table structure for table `corsi_attivi_unita_formative`
--

DROP TABLE IF EXISTS `corsi_attivi_unita_formative`;
CREATE TABLE `corsi_attivi_unita_formative` (
  `id_corso_attivo` int(11) NOT NULL,
  `id_unita_formativa` int(11) NOT NULL,
  `ore_dedicate` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `corso`
--

DROP TABLE IF EXISTS `corso`;
CREATE TABLE `corso` (
  `id_corso` int(11) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `descrizione` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `modulo`
--

DROP TABLE IF EXISTS `modulo`;
CREATE TABLE `modulo` (
  `id_modulo` int(11) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `descrizione` text DEFAULT NULL,
  `id_unita_formativa` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `presenze`
--

DROP TABLE IF EXISTS `presenze`;
CREATE TABLE `presenze` (
  `id_presenza` int(11) NOT NULL,
  `id_utente` int(11) NOT NULL,
  `data_presenza` date NOT NULL,
  `ora_ingresso` time DEFAULT NULL,
  `ora_uscita` time DEFAULT NULL,
  `note` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Triggers `presenze`
--
DROP TRIGGER IF EXISTS `chk_presenze_ruolo`;
DELIMITER $$
CREATE TRIGGER `chk_presenze_ruolo` BEFORE INSERT ON `presenze` FOR EACH ROW BEGIN
    DECLARE ruolo_utente INT;
    
    -- Recupera l'id_ruolo dell'utente che sta timbrando
    SELECT id_ruolo INTO ruolo_utente FROM utenti WHERE id_utente = NEW.id_utente;
    
    -- Se non è 2 (Docente) o 3 (Studente), blocca l'inserimento
    IF ruolo_utente NOT IN (2, 3) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore: Solo docenti e studenti possono registrare le presenze.';
    END IF;
END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `chk_presenze_validita_insert`;
DELIMITER $$
CREATE TRIGGER `chk_presenze_validita_insert` BEFORE INSERT ON `presenze` FOR EACH ROW BEGIN
    DECLARE nome_ruolo VARCHAR(255);
    DECLARE lezioni_previste INT;
    
    -- Recupera il NOME del ruolo convertendolo in minuscolo
    SELECT LOWER(r.nome) INTO nome_ruolo 
    FROM utenti u
    JOIN ruoli r ON u.id_ruolo = r.id_ruolo
    WHERE u.id_utente = NEW.id_utente;
    
    -- Controllo base
    IF nome_ruolo NOT IN ('docente', 'studente') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore: Solo docenti e studenti possono registrare le presenze.';
    END IF;

    -- Controllo dinamico per il DOCENTE
    IF nome_ruolo = 'docente' THEN
        SELECT COUNT(*) INTO lezioni_previste 
        FROM calendario 
        WHERE id_utente = NEW.id_utente AND data = NEW.data_presenza;
        
        IF lezioni_previste = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Errore: Il docente non può timbrare perché non ha lezioni assegnate in questa data.';
        END IF;
    END IF;

    -- Controllo dinamico per lo STUDENTE
    IF nome_ruolo = 'studente' THEN
        SELECT COUNT(*) INTO lezioni_previste
        FROM calendario c
        JOIN utenti_corsi_attivi uca ON c.id_corso_attivo = uca.id_corso_attivo
        WHERE uca.id_utente = NEW.id_utente AND c.data = NEW.data_presenza;
        
        IF lezioni_previste = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Errore: Lo studente non può timbrare perché il suo corso non ha lezioni in questa data.';
        END IF;
    END IF;

END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `chk_presenze_validita_update`;
DELIMITER $$
CREATE TRIGGER `chk_presenze_validita_update` BEFORE UPDATE ON `presenze` FOR EACH ROW BEGIN
    DECLARE nome_ruolo VARCHAR(255);
    DECLARE lezioni_previste INT;
    
    -- Recupera il NOME del ruolo convertendolo in minuscolo
    SELECT LOWER(r.nome) INTO nome_ruolo 
    FROM utenti u
    JOIN ruoli r ON u.id_ruolo = r.id_ruolo
    WHERE u.id_utente = NEW.id_utente;
    
    -- Controllo base
    IF nome_ruolo NOT IN ('docente', 'studente') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Errore in modifica: Solo docenti e studenti possono registrare le presenze.';
    END IF;

    -- Controllo dinamico per il DOCENTE
    IF nome_ruolo = 'docente' THEN
        SELECT COUNT(*) INTO lezioni_previste 
        FROM calendario 
        WHERE id_utente = NEW.id_utente AND data = NEW.data_presenza;
        
        IF lezioni_previste = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Errore in modifica: Il docente non ha lezioni assegnate in questa nuova data.';
        END IF;
    END IF;

    -- Controllo dinamico per lo STUDENTE
    IF nome_ruolo = 'studente' THEN
        SELECT COUNT(*) INTO lezioni_previste
        FROM calendario c
        JOIN utenti_corsi_attivi uca ON c.id_corso_attivo = uca.id_corso_attivo
        WHERE uca.id_utente = NEW.id_utente AND c.data = NEW.data_presenza;
        
        IF lezioni_previste = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Errore in modifica: Lo studente non può avere presenze in questa data perché il suo corso non prevede lezioni.';
        END IF;
    END IF;

END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `province`
--

DROP TABLE IF EXISTS `province`;
CREATE TABLE `province` (
  `id` int(11) NOT NULL,
  `citta_capoluogo` varchar(100) NOT NULL,
  `nome_provincia` varchar(100) NOT NULL,
  `sigla` char(2) NOT NULL,
  `regione_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `regioni`
--

DROP TABLE IF EXISTS `regioni`;
CREATE TABLE `regioni` (
  `id` int(11) NOT NULL,
  `nome` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ruoli`
--

DROP TABLE IF EXISTS `ruoli`;
CREATE TABLE `ruoli` (
  `id_ruolo` int(11) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `descrizione` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `unita_formativa`
--

DROP TABLE IF EXISTS `unita_formativa`;
CREATE TABLE `unita_formativa` (
  `id_unita_formativa` int(11) NOT NULL,
  `nome` varchar(255) NOT NULL,
  `descrizione` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `utenti`
--

DROP TABLE IF EXISTS `utenti`;
CREATE TABLE `utenti` (
  `id_utente` int(11) NOT NULL,
  `nome` varchar(100) NOT NULL,
  `cognome` varchar(100) NOT NULL,
  `genere` enum('Maschio','Femmina','Altro') DEFAULT NULL,
  `codice_fiscale` varchar(16) DEFAULT NULL,
  `data_nascita` date DEFAULT NULL,
  `citta_nascita` varchar(100) DEFAULT NULL,
  `nazionalita` varchar(100) DEFAULT 'Italia',
  `indirizzo_residenza` varchar(255) DEFAULT NULL,
  `citta_residenza` varchar(100) DEFAULT NULL,
  `cap_residenza` varchar(10) DEFAULT NULL,
  `provincia_residenza` varchar(2) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `primo_accesso` tinyint(1) DEFAULT 1,
  `id_ruolo` int(11) NOT NULL,
  `provincia_nascita` varchar(2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `utenti_corsi_attivi`
--

DROP TABLE IF EXISTS `utenti_corsi_attivi`;
CREATE TABLE `utenti_corsi_attivi` (
  `id_utente` int(11) NOT NULL,
  `id_corso_attivo` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `calendario`
--
ALTER TABLE `calendario`
  ADD PRIMARY KEY (`id`),
  ADD KEY `id_modulo` (`id_modulo`),
  ADD KEY `id_utente` (`id_utente`),
  ADD KEY `id_corso_attivo` (`id_corso_attivo`);

--
-- Indexes for table `corsi_attivi`
--
ALTER TABLE `corsi_attivi`
  ADD PRIMARY KEY (`id_corso_attivo`),
  ADD KEY `id_corso` (`id_corso`);

--
-- Indexes for table `corsi_attivi_unita_formative`
--
ALTER TABLE `corsi_attivi_unita_formative`
  ADD PRIMARY KEY (`id_corso_attivo`,`id_unita_formativa`),
  ADD KEY `id_unita_formativa` (`id_unita_formativa`);

--
-- Indexes for table `corso`
--
ALTER TABLE `corso`
  ADD PRIMARY KEY (`id_corso`);

--
-- Indexes for table `modulo`
--
ALTER TABLE `modulo`
  ADD PRIMARY KEY (`id_modulo`),
  ADD KEY `id_unita_formativa` (`id_unita_formativa`);

--
-- Indexes for table `presenze`
--
ALTER TABLE `presenze`
  ADD PRIMARY KEY (`id_presenza`),
  ADD KEY `id_utente` (`id_utente`);

--
-- Indexes for table `province`
--
ALTER TABLE `province`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sigla` (`sigla`),
  ADD KEY `regione_id` (`regione_id`);

--
-- Indexes for table `regioni`
--
ALTER TABLE `regioni`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nome` (`nome`);

--
-- Indexes for table `ruoli`
--
ALTER TABLE `ruoli`
  ADD PRIMARY KEY (`id_ruolo`);

--
-- Indexes for table `unita_formativa`
--
ALTER TABLE `unita_formativa`
  ADD PRIMARY KEY (`id_unita_formativa`);

--
-- Indexes for table `utenti`
--
ALTER TABLE `utenti`
  ADD PRIMARY KEY (`id_utente`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `codice_fiscale` (`codice_fiscale`),
  ADD KEY `id_ruolo` (`id_ruolo`);

--
-- Indexes for table `utenti_corsi_attivi`
--
ALTER TABLE `utenti_corsi_attivi`
  ADD PRIMARY KEY (`id_utente`,`id_corso_attivo`),
  ADD KEY `id_corso_attivo` (`id_corso_attivo`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `calendario`
--
ALTER TABLE `calendario`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `corsi_attivi`
--
ALTER TABLE `corsi_attivi`
  MODIFY `id_corso_attivo` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `corso`
--
ALTER TABLE `corso`
  MODIFY `id_corso` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `modulo`
--
ALTER TABLE `modulo`
  MODIFY `id_modulo` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `presenze`
--
ALTER TABLE `presenze`
  MODIFY `id_presenza` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `province`
--
ALTER TABLE `province`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `regioni`
--
ALTER TABLE `regioni`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ruoli`
--
ALTER TABLE `ruoli`
  MODIFY `id_ruolo` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `unita_formativa`
--
ALTER TABLE `unita_formativa`
  MODIFY `id_unita_formativa` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `utenti`
--
ALTER TABLE `utenti`
  MODIFY `id_utente` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `calendario`
--
ALTER TABLE `calendario`
  ADD CONSTRAINT `calendario_ibfk_1` FOREIGN KEY (`id_modulo`) REFERENCES `modulo` (`id_modulo`),
  ADD CONSTRAINT `calendario_ibfk_2` FOREIGN KEY (`id_utente`) REFERENCES `utenti` (`id_utente`),
  ADD CONSTRAINT `calendario_ibfk_3` FOREIGN KEY (`id_corso_attivo`) REFERENCES `corsi_attivi` (`id_corso_attivo`);

--
-- Constraints for table `corsi_attivi`
--
ALTER TABLE `corsi_attivi`
  ADD CONSTRAINT `corsi_attivi_ibfk_1` FOREIGN KEY (`id_corso`) REFERENCES `corso` (`id_corso`);

--
-- Constraints for table `corsi_attivi_unita_formative`
--
ALTER TABLE `corsi_attivi_unita_formative`
  ADD CONSTRAINT `corsi_attivi_unita_formative_ibfk_1` FOREIGN KEY (`id_corso_attivo`) REFERENCES `corsi_attivi` (`id_corso_attivo`),
  ADD CONSTRAINT `corsi_attivi_unita_formative_ibfk_2` FOREIGN KEY (`id_unita_formativa`) REFERENCES `unita_formativa` (`id_unita_formativa`);

--
-- Constraints for table `modulo`
--
ALTER TABLE `modulo`
  ADD CONSTRAINT `modulo_ibfk_1` FOREIGN KEY (`id_unita_formativa`) REFERENCES `unita_formativa` (`id_unita_formativa`);

--
-- Constraints for table `presenze`
--
ALTER TABLE `presenze`
  ADD CONSTRAINT `presenze_ibfk_1` FOREIGN KEY (`id_utente`) REFERENCES `utenti` (`id_utente`);

--
-- Constraints for table `province`
--
ALTER TABLE `province`
  ADD CONSTRAINT `province_ibfk_1` FOREIGN KEY (`regione_id`) REFERENCES `regioni` (`id`);

--
-- Constraints for table `utenti`
--
ALTER TABLE `utenti`
  ADD CONSTRAINT `utenti_ibfk_1` FOREIGN KEY (`id_ruolo`) REFERENCES `ruoli` (`id_ruolo`);

--
-- Constraints for table `utenti_corsi_attivi`
--
ALTER TABLE `utenti_corsi_attivi`
  ADD CONSTRAINT `utenti_corsi_attivi_ibfk_1` FOREIGN KEY (`id_utente`) REFERENCES `utenti` (`id_utente`),
  ADD CONSTRAINT `utenti_corsi_attivi_ibfk_2` FOREIGN KEY (`id_corso_attivo`) REFERENCES `corsi_attivi` (`id_corso_attivo`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
