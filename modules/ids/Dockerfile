FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY modules/ids/requirements.txt ./modules/ids/requirements.txt
RUN pip install --no-cache-dir -r modules/ids/requirements.txt

# Copy shared mocks and ids module
COPY shared ./shared
COPY modules/ids ./modules/ids

WORKDIR /app/modules/ids

ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=5001

EXPOSE 5001

CMD ["python", "dashboard.py", "--host", "0.0.0.0", "--port", "5001"]
