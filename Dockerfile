FROM denoland/deno:alpine

WORKDIR /app

COPY . .



EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env",  "index.ts"]
