# ── Imagen oficial de Playwright con Chromium incluido ───────────────────────
# Incluye Chromium, sus dependencias del sistema y Python 3.11
FROM mcr.microsoft.com/playwright/python:v1.45.0-jammy

WORKDIR /app

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN playwright install chromium --with-deps

COPY app.py .

# Variables de entorno con valores por defecto
ENV FRONTEND_URL=http://web-frontend \
    CONCURRENT_USERS=2 \
    THINK_TIME_MIN=1.5 \
    THINK_TIME_MAX=4.0 \
    LOOP_FOREVER=true \
    HEADLESS=true \
    ACTION_TIMEOUT_MS=20000 \
    NAV_TIMEOUT_MS=30000

CMD ["python", "-u", "app.py"]
