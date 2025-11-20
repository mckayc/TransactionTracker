# Stage 1: Build the frontend application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG API_KEY
ENV API_KEY=$API_KEY
RUN npm run build
# Stage 2: Setup the backend server
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Install only production dependencies (express, etc.)
RUN npm install --omit=dev
COPY server.js .
# Copy the built frontend assets to the 'public' folder
COPY --from=builder /app/dist ./public
# Create the directory for the database volume
RUN mkdir -p /app/data/config
EXPOSE 3000
CMD ["node", "server.js"]