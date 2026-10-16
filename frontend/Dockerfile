# ChessMaster web app: build the React app, then serve it with nginx.
# nginx also proxies /api to the backend container, so the browser talks to a
# single origin and no CORS setup is needed.

# --- build stage -------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Empty by default = call /api on the same origin (handled by nginx below).
# Set it only if the API lives on a different domain.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- serve stage -------------------------------------------------------------
FROM nginx:1.27-alpine

# Templates in this folder are run through envsubst at startup, so
# BACKEND_URL can be changed without rebuilding the image.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV BACKEND_URL=http://backend:3001
EXPOSE 80
