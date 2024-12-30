# Use the official Ubuntu image as the base image.
FROM ubuntu:latest

WORKDIR /app

# Update package lists and install necessary packages.
RUN apt-get update && apt-get install -y \
    unzip \
    curl

# Install Deno
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
ENV DENO_INSTALL="/root/.deno"
ENV PATH="$DENO_INSTALL/bin:$PATH"

COPY . .

EXPOSE 8000


CMD ["deno", "run", "--allow-net", "index.ts"]
