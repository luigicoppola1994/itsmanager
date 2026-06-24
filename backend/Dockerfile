FROM python:3.10-slim

WORKDIR /app

# Installiamo le dipendenze
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiamo il codice
COPY . .

# Esponiamo la porta 8000
EXPOSE 8000

# Avviamo l'applicazione FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
