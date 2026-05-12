FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app

ENV PORT=3000
RUN npm install -g serve

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
