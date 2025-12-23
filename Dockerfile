FROM golang:1.20-alpine AS builder

WORKDIR /build

# Install dependencies
RUN apk add --no-cache git make gcc musl-dev linux-headers

# Clone and build go-ethereum (Geth)
RUN git clone https://github.com/ethereum/go-ethereum.git . && \
    git checkout v1.13.5

# Copy custom consensus code
COPY consensus/ ./consensus/

# Build geth with custom modifications
RUN make geth

FROM alpine:3.18

# Install runtime dependencies
RUN apk add --no-cache ca-certificates curl jq

# Create ethereum user and data directory
RUN adduser -D -s /bin/sh ethereum && \
    mkdir -p /home/ethereum/.ethereum && \
    chown -R ethereum:ethereum /home/ethereum/.ethereum

# Copy geth binary from builder
COPY --from=builder /build/build/bin/geth /usr/local/bin/geth

# Copy genesis file
COPY genesis.json /home/ethereum/genesis.json

# Copy startup script
COPY docker/start.sh /home/ethereum/start.sh
RUN chmod +x /home/ethereum/start.sh && \
    chown ethereum:ethereum /home/ethereum/start.sh /home/ethereum/genesis.json

USER ethereum
WORKDIR /home/ethereum

# Initialize blockchain with genesis
RUN geth --datadir /home/ethereum/.ethereum init /home/ethereum/genesis.json

# Expose ports
EXPOSE 8545 8546 30303

# Set default command
CMD ["/home/ethereum/start.sh"]