# Guida Passo-Passo: Creare un Sistema di Autenticazione JWT da Zero

Questa guida è pensata per gli studenti che desiderano implementare da zero un sistema di autenticazione e sicurezza basato su **JSON Web Token (JWT)**, collegando un Backend **FastAPI (Python)** a un Frontend **HTML/JS**.

---

## Passo 1: Installare le Librerie (Dipendenze)
Nel file `backend/requirements.txt` inseriamo le librerie necessarie per gestire l'autenticazione e la cifratura:

```text
fastapi[all]
sqlalchemy
pymysql
cryptography
passlib[bcrypt]
pyjwt
```
* **`passlib[bcrypt]`**: Serve a crittografare (hashare) in modo sicuro le password.
* **`pyjwt`**: Serve a generare e verificare i JSON Web Token.

---

## Passo 2: Creare il Database e i Modelli (`models.py`)
Prima di autenticare gli utenti, dobbiamo definire come sono fatti nel database.

1. Creiamo la classe `Utente` che eredita dal gestore del database SQLAlchemy (`Base`).
2. Definiamo i campi principali: `id_utente`, `Email`, `Password` (dove salveremo l'hash della password), ed `id_ruolo` (chiave esterna collegata alla tabella dei ruoli).

```python
# backend/models.py
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Ruolo(Base):
    __tablename__ = "Ruoli"
    id_ruolo = Column(Integer, primary_key=True, index=True)
    Nome = Column(String(255), nullable=False)
    
    utenti = relationship("Utente", back_populates="ruolo")

class Utente(Base):
    __tablename__ = "Utenti"
    id_utente = Column(Integer, primary_key=True, index=True)
    Email = Column(String(255), unique=True, nullable=False)
    Password = Column(String(255), nullable=False) # Contiene la password cifrata
    id_ruolo = Column(Integer, ForeignKey("Ruoli.id_ruolo"), nullable=False)
    
    ruolo = relationship("Ruolo", back_populates="utenti")
```

---

## Passo 3: Scrivere la Logica di Sicurezza (`auth.py`)
Creiamo un modulo dedicato esclusivamente alla sicurezza: `backend/auth.py`. Qui configureremo l'algoritmo di hashing e la creazione dei token.

```python
# backend/auth.py
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer

# 1. Configurazione JWT e Hashing
SECRET_KEY = "cambiami_con_una_chiave_segreta_sicura"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# 2. Funzioni per le Password
def verify_password(plain_password, hashed_password):
    """Controlla se la password inserita corrisponde all'hash salvato nel DB"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Genera un hash sicuro a partire dalla password in chiaro"""
    return pwd_context.hash(password)

# 3. Funzioni per i Token JWT
def create_access_token(data: dict):
    """Crea un token JWT con scadenza di 30 minuti"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

---

## Passo 4: Scrivere gli Endpoint API (`main.py`)
Ora colleghiamo la logica di sicurezza agli endpoint di FastAPI in `backend/main.py`.

### A. La Dipendenza `get_current_user`
Questa funzione verifica se la richiesta che arriva al backend ha un token valido nell'header HTTP `Authorization`. Se il token è valido, restituisce l'utente loggato, altrimenti blocca la richiesta con un errore `401`.

```python
# backend/main.py
import jwt
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
import auth, models

def get_current_user(token: str = Depends(auth.oauth2_scheme), db: Session = Depends(get_db)):
    try:
        # Decodifica il token JWT
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token non valido")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token scaduto o non valido")
    
    user = db.query(models.Utente).filter(models.Utente.Email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    return user
```

### B. L'Endpoint `/login`
Questo endpoint riceve l'email e la password inserite dall'utente, controlla che siano corrette e restituisce il token JWT firmato ed il nome del ruolo dell'utente.

```python
from fastapi import Response
from fastapi.security import OAuth2PasswordRequestForm

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 1. Trova l'utente nel DB
    user = db.query(models.Utente).filter(models.Utente.Email == form_data.username).first()
    
    # 2. Verifica la password
    if not user or not auth.verify_password(form_data.password, user.Password):
        raise HTTPException(status_code=401, detail="Credenziali errate")
    
    # 3. Crea il token JWT
    access_token = auth.create_access_token(data={"sub": user.Email})
    
    # 4. Ottiene il nome del ruolo (es: "super_admin")
    ruolo_nome = user.ruolo.Nome if user.ruolo else "studente"
    
    # 5. Ritorna il token e il ruolo al frontend
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "ruolo": ruolo_nome
    }
```

---

## Passo 5: Gestire l'Autenticazione nel Frontend (`app.js`)
Nel frontend, dobbiamo salvare il token ricevuto dopo il login e inserirlo in ogni chiamata successiva che richiede autenticazione.

### A. Salvare il token dopo il login
Quando il form di login viene inviato, facciamo una chiamata `POST` al backend e salviamo il token nel `localStorage`:

```javascript
// frontend/app.js
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });

    if (response.ok) {
        const data = await response.json();
        // Salviamo il token e il ruolo nel browser dell'utente
        localStorage.setItem('jwt_token', data.access_token);
        localStorage.setItem('user_role', data.ruolo);
        
        // Mostriamo l'applicazione principale e nascondiamo il login
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
    } else {
        alert('Credenziali non valide!');
    }
});
```

### B. Effettuare chiamate protette (Funzione Wrapper)
Per inviare richieste ad API protette (es. per caricare dati privati dal server), dobbiamo passare il token nell'header HTTP `Authorization: Bearer <token>`:

```javascript
async function fetchAutenticata(url, opzioni = {}) {
    // Recupera il token salvato precedentemente
    let token = localStorage.getItem('jwt_token');
    
    if (!opzioni.headers) opzioni.headers = {};
    if (token) {
        // Aggiunge il token all'intestazione della chiamata
        opzioni.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return await fetch(url, opzioni);
}
```
