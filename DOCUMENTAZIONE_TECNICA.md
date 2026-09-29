# ITS Manager - Documentazione Tecnica

## 📋 Sommario

1. [Introduzione](#introduzione)
2. [Architettura del Sistema](#architettura-del-sistema)
3. [Stack Tecnologico](#stack-tecnologico)
4. [Componenti Backend](#componenti-backend)
5. [Componenti Frontend](#componenti-frontend)
6. [Database e Modelli Dati](#database-e-modelli-dati)
7. [Sicurezza e Autenticazione](#sicurezza-e-autenticazione)
8. [DevOps e Deployment](#devops-e-deployment)
9. [Funzionalità Principali](#funzionalità-principali)
10. [Performance e Scalabilità](#performance-e-scalabilità)

---

## 🎯 Introduzione

**ITS Manager** è un gestionale didattico completo per istituti di formazione tecnica superiore (ITS), progettato per gestire corsi, edizioni, studenti, docenti, presenze e calendario didattico in modo integrato ed efficiente.

### Obiettivi del Progetto

- ✅ Gestione centralizzata di corsi ed edizioni
- ✅ Tracciamento presenze studenti e docenti
- ✅ Calendario didattico interattivo
- ✅ Sistema di timbratura via QR code
- ✅ Dashboard analitiche per studenti e segreteria
- ✅ Interfaccia responsive mobile-first

### Target Users

- **Segreteria Didattica**: Gestione completa dell'istituto
- **Studenti**: Visualizzazione corsi, lezioni e presenze
- **Docenti**: Gestione lezioni e registrazioni presenze

---

## 🏗️ Architettura del Sistema

### Architettura Generale

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT BROWSER                           │
│              (Desktop, Tablet, Mobile)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              NGINX REVERSE PROXY (Port 3000)                │
│           - Serve file statici frontend                      │
│           - Routing client-side SPA                          │
│           - Compressione Gzip                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP API Calls
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              FASTAPI BACKEND (Port 8000)                     │
│              - Uvicorn ASGI Server                          │
│              - API RESTful                                   │
│              - JWT Authentication                            │
│              - Business Logic Layer                          │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQLAlchemy ORM
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              MYSQL DATABASE                                 │
│              - Relational Data Storage                      │
│              - Foreign Keys & Constraints                   │
│              - Stored Procedures & Triggers                  │
└─────────────────────────────────────────────────────────────┘
```

### Architettura a Microservizi

Il sistema adotta un'architettura modulare containerizzata:

1. **Frontend Container**: NGINX + HTML/CSS/JS statici
2. **Backend Container**: FastAPI + Python logic
3. **Database Container**: MySQL (esterno in produzione)

### Communication Pattern

- **Frontend → Backend**: REST API (JSON over HTTP)
- **Backend → Database**: SQLAlchemy ORM
- **Authentication**: JWT Bearer Tokens + HttpOnly Cookies

---

## 🛠️ Stack Tecnologico

### Frontend Stack

| Tecnologia | Versione | Utilizzo |
|------------|----------|---------|
| **HTML5** | - | Struttura semantica delle pagine |
| **CSS3** | - | Styling e layout responsive |
| **JavaScript (ES6+)** | - | Logica client-side |
| **Bootstrap 5** | 5.x | Framework UI responsive |
| **Bootstrap Icons** | 1.x | Icone vettoriali |
| **FullCalendar** | 6.1.10 | Calendario interattivo |
| **QRCode.js** | 1.5.3 | Generazione QR code |
| **Google Fonts** | Inter | Tipografia moderna |

### Backend Stack

| Tecnologia | Versione | Utilizzo |
|------------|----------|---------|
| **Python** | 3.10 | Linguaggio principale |
| **FastAPI** | Latest | Framework API REST |
| **Uvicorn** | Latest | Server ASGI |
| **SQLAlchemy** | Latest | ORM Database |
| **PyMySQL** | Latest | Driver MySQL |
| **PyJWT** | Latest | Gestione JWT |
| **python-jose** | Latest | Crittografia JWT |
| **passlib** | Latest | Hashing password |
| **Pydantic** | Latest | Validazione dati |

### Database Stack

| Tecnologia | Versione | Utilizzo |
|------------|----------|---------|
| **MySQL** | 8.x | Database relazionale |
| **InnoDB** | - | Storage engine |

### DevOps Stack

| Tecnologia | Versione | Utilizzo |
|------------|----------|---------|
| **Docker** | Latest | Containerizzazione |
| **Docker Compose** | Latest | Orchestrazione container |
| **NGINX** | Alpine | Web server frontend |
| **Git** | Latest | Version control |

---

## 🔧 Componenti Backend

### FastAPI Application Structure

```
backend/
├── main.py                 # Entry point API & endpoints
├── models.py               # SQLAlchemy models (tabelle DB)
├── schemas.py              # Pydantic schemas (validazione)
├── auth.py                 # Autenticazione & JWT logic
├── database.py             # Database connection & session
├── requirements.txt        # Python dependencies
├── Dockerfile             # Container definition
└── comuni.json            # Data comuni italiani
```

### API Endpoints Principali

#### Autenticazione
- `POST /auth/login` - Login utente
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Logout

#### Utenti
- `GET /users` - Lista utenti
- `POST /users` - Crea utente
- `PUT /users/{id}` - Aggiorna utente
- `DELETE /users/{id}` - Elimina utente

#### Corsi
- `GET /corsi` - Lista corsi master
- `POST /corsi` - Crea corso
- `PUT /corsi/{id}` - Aggiorna corso
- `DELETE /corsi/{id}` - Elimina corso

#### Edizioni
- `GET /corsi-attivi` - Lista edizioni attive
- `POST /corsi-attivi` - Crea edizione
- `PUT /corsi-attivi/{id}` - Aggiorna edizione

#### Calendario
- `GET /calendario` - Lista lezioni
- `POST /calendario` - Crea lezione
- `PUT /calendario/{id}` - Aggiorna lezione
- `DELETE /calendario/{id}` - Elimina lezione

#### Presenze
- `GET /presenze` - Lista presenze
- `POST /presenze` - Crea presenza
- `PUT /presenze/{id}` - Aggiorna presenza
- `POST /presenze/batch` - Batch presenze

#### Studente (QR Code)
- `GET /studente/lezione-oggi` - Verifica lezioni oggi
- `POST /studente/genera-qr` - Genera QR code
- `POST /studente/timbra-qr` - Registra timbratura

### Business Logic Layer

#### Authentication System
- **JWT Access Token**: Scadenza 15 minuti
- **Refresh Token**: Cookie HttpOnly, scadenza 7 giorni
- **Password Hashing**: bcrypt con salt
- **Role-based Access**: Studente, Segreteria, Docente

#### Validation Layer
- **Pydantic Schemas**: Validazione automatica input
- **SQLAlchemy Constraints**: Validazione a livello database
- **Custom Validators**: Logica business specifica

#### Error Handling
- **HTTP Exception Handling**: Messaggi errore standardizzati
- **Database Error Parsing**: Estrazione dettagli errori SQL
- **Logging**: Tracciamento operazioni per debug

---

## 🎨 Componenti Frontend

### Frontend Structure

```
frontend/
├── index.html              # Landing page
├── login.html              # Login page
├── shared/                 # Componenti condivisi
│   ├── styles.css         # CSS globale
│   └── auth.js            # Auth & API client
├── segreteria/            # Area segreteria
│   ├── dashboard.html
│   ├── calendario.html
│   ├── timbrature.html
│   ├── corsi.html
│   ├── aule.html
│   └── [altre pagine...]
├── studente/              # Area studente
│   ├── dashboard.html
│   ├── lezioni.html
│   ├── timbrature.html
│   ├── app.js             # Logic studente
│   └── studente.css       # CSS studente
├── assets/                # Risorse statiche
│   ├── bootstrap.min.css
│   ├── bootstrap-icons.css
│   ├── bootstrap.bundle.min.js
│   └── img/
└── Dockerfile             # Container definition
```

### Frontend Architecture

#### CSS Architecture
- **Shared Styles**: Global CSS utility classes
- **Segreteria CSS**: Specifico area segreteria
- **Studente CSS**: Specifico area studente
- **Mobile-First**: Responsive design priority
- **Design System**: Colori, tipografia, componenti riutilizzabili

#### JavaScript Architecture
- **Modular Pattern**: Separazione per area funzionale
- **API Client**: Centralizzato in auth.js
- **State Management**: Gestione stato locale
- **Error Handling**: Toast notifications
- **SPA Routing**: Navigazione client-side

#### Responsive Design
- **Breakpoints**: 576px (mobile), 768px (tablet), 992px (desktop)
- **Mobile Navigation**: Bottom bar per studenti
- **Touch Optimization**: Target minimi 44px per iOS
- **Performance**: Lazy loading, CSS optimization

---

## 🗄️ Database e Modelli Dati

### Schema Database

#### Tabelle Principali

**utenti**
```sql
- id_utente (PK)
- Nome
- Cognome
- Email
- Password_Hash
- Ruolo (studente/segreteria/docente)
- Telefono
- Data_Nascita
- Citta_Nascita
- Email_Parenti
- Telefono_Parenti
```

**corsi**
```sql
- id_corso (PK)
- Nome
- Descrizione
- Area_Tematica
- Durata_Ore
```

**corsi_attivi**
```sql
- id_corso_attivo (PK)
- id_corso (FK)
- data_inizio
- data_fine
- archiviato
```

**calendario**
```sql
- id (PK)
- data
- ora_inizio
- ora_fine
- id_modulo (FK)
- id_utente (FK - docente)
- id_corso_attivo (FK)
- note
```

**presenze**
```sql
- id_presenza (PK)
- id_utente (FK)
- id_corso_attivo (FK)
- data_presenza
- ora_ingresso
- ora_uscita
- note
```

**utenti_corsi_attivi**
```sql
- id_utente (FK, PK)
- id_corso_attivo (FK, PK)
```

### Relazioni Database

- **corsi → corsi_attivi**: One-to-Many
- **corsi_attivi → calendario**: One-to-Many
- **corsi_attivi → utenti_corsi_attivi**: One-to-Many
- **utenti → presenze**: One-to-Many
- **utenti → calendario**: One-to-Many (docenti)

### Trigger e Constraints

- **Foreign Key Constraints**: Integrità referenziale
- **Unique Constraints**: Prevenzione duplicati
- **Check Constraints**: Validazione dati
- **Trigger Automatici**: Aggiornamenti timestamp

---

## 🔒 Sicurezza e Autenticazione

### Authentication Flow

```
1. User → POST /auth/login (username, password)
2. Backend → Valida credenziali
3. Backend → Genera JWT Access Token (15min)
4. Backend → Set HttpOnly Refresh Token Cookie (7giorni)
5. Frontend → Salva Access Token in localStorage
6. Richieste API → Include Authorization: Bearer {token}
7. Token scaduto → POST /auth/refresh (automatico)
8. Refresh fallito → Logout automatico
```

### Security Measures

#### Backend Security
- **Password Hashing**: bcrypt con salt rounds
- **JWT Validation**: Signature verification
- **CORS Configuration**: Origins whitelist
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Input sanitization
- **Rate Limiting**: (implementabile)

#### Frontend Security
- **HttpOnly Cookies**: Refresh token protetto
- **Secure Flag**: HTTPS only in produzione
- **SameSite Policy**: CSRF protection
- **Content Security Policy**: (implementabile)
- **Input Validation**: Client-side + server-side

#### QR Code Security
- **Timelimited Tokens**: Validità 5 minuti
- **User-specific QR**: Binding allo studente
- **Date Validation**: Solo lezioni del giorno
- **Course Verification**: Solo corsi iscritti
- **One-time Use**: Token monouso

---

## 🚀 DevOps e Deployment

### Docker Configuration

#### Backend Dockerfile
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Frontend Dockerfile
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

#### Docker Compose
```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - DATABASE_URL=mysql+pymysql://...
    volumes:
      - ./backend:/app
    command: uvicorn main:app --reload

  frontend:
    build: ./frontend
    ports: ["3000:80"]
    volumes:
      - ./frontend:/usr/share/nginx/html
    depends_on:
      - backend
```

### Deployment Strategy

#### Development
- **Hot Reload**: `--reload` flag per sviluppo
- **Volume Mounts**: Live code editing
- **Local Database**: MySQL locale o remote

#### Production
- **Multi-stage Builds**: Ottimizzazione immagini
- **Environment Variables**: Configurazione esterna
- **Reverse Proxy**: NGINX production configuration
- **SSL/TLS**: HTTPS con Let's Encrypt
- **Health Checks**: Container monitoring
- **Logging**: Centralized logging
- **Backup Strategy**: Database dumps regolari

### Monitoring & Logging

- **Application Logs**: FastAPI logging
- **Access Logs**: NGINX access logs
- **Error Tracking**: (Sentry integrabile)
- **Performance Monitoring**: (APM tools)
- **Database Monitoring**: MySQL slow query log

---

## 📱 Funzionalità Principali

### Area Segreteria

#### Gestione Corsi
- CRUD completo corsi master
- Gestione aree tematiche
- Definizione durata ore
- Archiviazione corsi

#### Gestione Edizioni
- Creazione edizioni da corsi master
- Definizione periodi didattici
- Gestione stato archiviazione
- Assegnazione studenti

#### Calendario Didattico
- Creazione lezioni singole
- Generazione settimane complete
- Assegnazione docenti e moduli
- Gestione orari differenziati
- Budget ore per unità formative

#### Gestione Presenze
- Registro presenze giornaliero
- Appello rapido per classe
- Statistiche presenze/assenze
- Export dati presenze

#### Gestione Aule
- Assegnazione studenti a aule
- Gestione capacità aule
- Visualizzazione composizione classi

### Area Studente

#### Dashboard
- Panoramica corsi ed edizioni
- Statistiche presenze
- Lezioni del giorno
- Ultima timbratura

#### Lezioni
- Calendario personale interattivo
- Dettagli lezioni (docente, modulo, orario)
- Filtri per periodo

#### Timbrature QR Code
- Verifica lezioni del giorno
- Generazione QR code timbratura
- Timbratura ingresso/uscita
- Storico presenze

### Sistema Timbratura QR Code

#### Workflow
1. **Verifica Lezione**: Sistema controlla lezioni odierne
2. **Generazione QR**: QR code con dati crittografati
3. **Validazione**: Scansione e validazione token
4. **Registrazione**: Salvataggio automatico presenze
5. **Feedback**: Conferma immediata all'utente

#### Sicurezza QR
- Validità temporale (5 minuti)
- Binding utente-specifico
- Verifica corso iscrizione
- Anti-replay protection

---

## ⚡ Performance e Scalabilità

### Performance Optimization

#### Frontend
- **Minification**: CSS/JS compressi
- **Lazy Loading**: Caricamento on-demand
- **Image Optimization**: Formati webp, lazy load
- **Caching Strategy**: Browser caching headers
- **CDN Integration**: (implementabile)

#### Backend
- **Database Indexing**: Indici su colonne frequenti
- **Query Optimization**: N+1 prevention
- **Connection Pooling**: SQLAlchemy connection pool
- **Async Operations**: Operazioni I/O asincrone
- **Response Compression**: Gzip encoding

#### Database
- **Index Strategy**: Indici su foreign keys
- **Query Optimization**: EXPLAIN analysis
- **Connection Pooling**: Gestione connessioni
- **Partitioning**: (implementabile per grandi dataset)

### Scalability Strategy

#### Horizontal Scaling
- **Load Balancing**: NGINX load balancer
- **Multiple Backend Instances**: Uvicorn workers
- **Database Replication**: Read replicas
- **Caching Layer**: Redis integration

#### Vertical Scaling
- **Resource Allocation**: CPU/RAM optimization
- **Database Tuning**: MySQL configuration
- **Connection Limits**: Optimized pool sizes

### Monitoring & Analytics

- **Performance Metrics**: Response times, throughput
- **Error Tracking**: Exception monitoring
- **User Analytics**: Usage patterns
- **Business Metrics**: Attendance rates, engagement

---

## 📊 Metriche di Successo

### Technical KPIs
- **API Response Time**: < 200ms (p95)
- **Uptime**: > 99.9%
- **Error Rate**: < 0.1%
- **Page Load Time**: < 2s

### Business KPIs
- **User Adoption**: > 80% studenti attivi
- **Attendance Tracking**: > 95%覆盖率
- **System Usage**: Daily active users
- **User Satisfaction**: Feedback surveys

---

## 🔮 Future Enhancements

### Planned Features
- **Mobile App**: Native iOS/Android
- **Push Notifications**: Lezioni e promemoria
- **Advanced Analytics**: Dashboard predittive
- **Integration Systems**: ERP/CRM integration
- **Offline Mode**: PWA capabilities
- **AI Features**: Pattern recognition presenze

### Technical Improvements
- **Microservices Architecture**: Service separation
- **Event-Driven**: Message queue integration
- **Advanced Caching**: Redis implementation
- **API Versioning**: Backward compatibility
- **Testing Suite**: Unit/integration tests
- **CI/CD Pipeline**: Automated deployment

---

## 📞 Supporto e Manutenzione

### Documentation
- **API Documentation**: FastAPI auto-docs (/docs)
- **User Manuals**: Guide per studenti/segreteria
- **Technical Docs**: Architettura e deployment
- **Troubleshooting**: Common issues guide

### Support Process
- **Issue Tracking**: Sistema ticketing
- **Emergency Contacts**: On-call rotation
- **Maintenance Windows**: Planned downtime
- **Update Policy**: Release cycle definito

---

## 🎓 Conclusioni

ITS Manager rappresenta una soluzione completa e moderna per la gestione didattica di istituti ITS, combinando:

- **Architettura moderna**: Microservizi containerizzati
- **Stack tecnologico avanzato**: FastAPI, Python, NGINX
- **Sicurezza robusta**: JWT, encryption, validation
- **UX eccellente**: Responsive design, mobile-first
- **Scalabilità**: Progettato per la crescita
- **Manutenibilità**: Codice modulare e documentato

Il sistema è pronto per deployment in produzione e può essere facilmente esteso con nuove funzionalità secondo le esigenze dell'istituto.

---

**Documento Versione**: 1.0  
**Data**: 29 Settembre 2026  
**Autore**: Team di Sviluppo ITS Manager  
**Stato**: Completo per Presentazione Aziendale