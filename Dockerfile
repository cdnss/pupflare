FROM denoland/deno:latest
 
# Set direktori ker
WORKDIR /app

# Instal dependensi sistem: git, dan ca-certificates
# ca-certificates diperlukan untuk verifikasi sertifikat SSL saat git clone
# Gunakan --no-install-recommends untuk menjaga ukuran image tetap kecil
RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/* # Bersihkan cache apt

# Clone repositori sonto
RUN git clone https://github.com/cdnss/sonto /app/sonto

# Cache dependensi Deno untuk script deno.ts
#RUN deno cache /app/sonto/deno.ts

# (Opsional) Expose port jika deno.ts adalah server
 EXPOSE 8080

# Perintah default
CMD ["deno", "run", "-A", "--reload", "/app/sonto/deno.ts"]
