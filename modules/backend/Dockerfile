FROM python:3.12-slim

WORKDIR /app

# Install dependencies for backend and auth module
COPY modules/backend/requirements.txt ./modules/backend/requirements.txt
COPY modules/auth/requirements.txt ./modules/auth/requirements.txt
RUN pip install --no-cache-dir -r modules/backend/requirements.txt -r modules/auth/requirements.txt

# Copy backend, auth, pki, and shared mock resources
COPY shared ./shared
COPY modules/auth ./modules/auth
COPY modules/pki ./modules/pki
COPY modules/backend ./modules/backend

WORKDIR /app/modules/backend
RUN mkdir -p /app/modules/backend/data

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV DB_PATH=/app/modules/backend/data/securecorp.db

EXPOSE 5000

# Run with gunicorn in production; Flask dev server used locally via run.py
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "run:app"]
