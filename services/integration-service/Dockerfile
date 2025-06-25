# Usar Node.js 18 Alpine para imagen más liviana
FROM node:18-alpine

# Información del maintainer
LABEL maintainer="luca.belotti@ml-ecosystem.com"
LABEL service="integration-service"
LABEL version="1.0.0"

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json primero (para cache de Docker layers)
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Crear directorio para logs con permisos correctos
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Copiar código fuente
COPY --chown=nodejs:nodejs . .

# Cambiar a usuario no-root
USER nodejs

# Exponer puerto
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3002

# Usar dumb-init para manejo correcto de señales
ENTRYPOINT ["dumb-init", "--"]

# Comando por defecto
CMD ["node", "src/server.js"]