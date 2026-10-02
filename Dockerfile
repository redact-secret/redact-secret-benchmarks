# syntax=docker/dockerfile:1
# Reproducible peer PII runtime-throughput run (#513, docs/specs/peer-pii-runtime-throughput.md).
# Build and run through scripts/run-peer-pii-runtime-throughput-docker.sh, which resolves the
# product ref from benchmarks/pin-manifest.json and supplies the run-time identity.
# Base: node:22.22.2-bookworm, linux/amd64 manifest, pinned by digest (index digest, resolves per --platform).
ARG NODE_IMAGE=node:22.22.2-bookworm@sha256:62e4daa6819762bbd3072af77cc282ab72c631c4aed30dd7980192babaf385b3

FROM --platform=linux/amd64 ${NODE_IMAGE} AS addon
ARG RUST_TOOLCHAIN=1.90.0
ARG REDACT_SECRET_REF
RUN test -n "${REDACT_SECRET_REF}" || (echo "REDACT_SECRET_REF build arg is required" >&2; exit 1)
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo RUSTUP_TOOLCHAIN=${RUST_TOOLCHAIN}
ENV PATH=/opt/cargo/bin:${PATH}
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain ${RUST_TOOLCHAIN}
WORKDIR /product
# Fetch the exact commit; a branch or tag name is rejected so the image cannot drift from a SHA.
RUN echo "${REDACT_SECRET_REF}" | grep -Eq '^[a-f0-9]{40}$' \
 && git init -q . \
 && git remote add origin https://github.com/redact-secret/redact-secret.git \
 && git fetch -q --depth 1 origin "${REDACT_SECRET_REF}" \
 && git checkout -q FETCH_HEAD \
 && test "$(git rev-parse HEAD)" = "${REDACT_SECRET_REF}"
WORKDIR /product/bindings/node
RUN npm install --no-audit --no-fund && npm run build

# `--target published` (#562): the runtime comparison measures the published @redact-secret/core package that npm ci installs from
# the lockfile, so nothing is built from product source. The platform follows the build host: no add-on is native here.
FROM ${NODE_IMAGE} AS published
ARG REDACT_SECRET_REF
ENV REDACT_SECRET_REF=${REDACT_SECRET_REF}
WORKDIR /bench
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
ENTRYPOINT ["npm", "run", "peer-pii-runtime-throughput", "--"]

FROM --platform=linux/amd64 ${NODE_IMAGE}
ARG REDACT_SECRET_REF
ENV REDACT_SECRET_REF=${REDACT_SECRET_REF} REDACT_SECRET_NODE_ADDON_PATH=/addon/redact-secret.linux-x64-gnu.node
WORKDIR /bench
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
COPY --from=addon /product/bindings/node/redact-secret.linux-x64-gnu.node /addon/redact-secret.linux-x64-gnu.node
ENTRYPOINT ["npm", "run", "peer-pii-runtime-throughput", "--"]
