FROM denoland/deno:latest

WORKDIR /app

COPY index.ts .

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-env", "app.ts"]
