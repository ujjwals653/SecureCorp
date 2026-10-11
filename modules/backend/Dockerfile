FROM python:3.12-slim

WORKDIR /backend

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

EXPOSE 5000

# Run with gunicorn in production; Flask dev server used locally via run.py
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "run:app"]
