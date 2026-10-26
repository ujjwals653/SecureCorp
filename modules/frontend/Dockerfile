FROM node:20-alpine

WORKDIR /workspace

# Copy dependencies first for optimal caching
COPY modules/crypto-core ./modules/crypto-core
COPY modules/frontend/package*.json ./modules/frontend/

WORKDIR /workspace/modules/frontend
RUN npm install

# Copy application source and shared mocks
COPY shared /workspace/shared
COPY modules/frontend /workspace/modules/frontend

EXPOSE 3000

# Start Vite dev server on host 0.0.0.0 port 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
