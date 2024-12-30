FROM denoland/deno:alpine

WORKDIR /app

COPY . .

RUN deno compile --allow-net --output index index.ts

EXPOSE 8000


CMD ["./index"]
