FROM denoland/deno:alpine

WORKDIR /app

COPY . .

RUN deno cache index.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env",  "index.ts"]
