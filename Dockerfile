FROM node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9 AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY frontend frontend
RUN npm run build

FROM rust:1.99.1-bookworm@sha256:e6f2cff35d0f309acf8433b4f05878ed77092602c5065cc81801177da0bb3a9c AS backend
WORKDIR /build
ENV CARGO_BUILD_JOBS=2
COPY backend backend
RUN cargo build --release --locked --manifest-path backend/Cargo.toml

FROM debian:bookworm-slim@sha256:734a72b3d6142a71993b4bc580ca01d8ca687f77a2c422d96a961d3376b179bc
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates gosu \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --no-create-home app \
    && install -d -o app -g app /data
WORKDIR /app
COPY --from=frontend /build/frontend/dist /app/public
COPY --from=backend /build/backend/target/release/okoshko-backend /usr/local/bin/okoshko-backend
COPY --chmod=755 scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
ENV PORT=3000 STATIC_DIR=/app/public DATABASE_PATH=/data/okoshko.sqlite3
USER 10001:10001
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint"]
CMD ["/usr/local/bin/okoshko-backend"]
