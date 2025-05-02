// File: proxy.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// URL target yang akan diproksi
const TARGET_URL = "https://cloud.hownetwork.xyz/api.php?id=Lh09YywNWiYqPgQ4bgJmanBVPisnHRseGg5OfSIAb2p1TQ";

// Port tempat proksi akan berjalan
const PORT = 8080; // Anda bisa mengubah ini jika port 8000 sudah dipakai

async function handler(request: Request): Promise<Response> {
  console.log(`Menerima permintaan: ${request.method} ${request.url}`);

  // Tangani permintaan pre-flight OPTIONS untuk CORS
  if (request.method === "OPTIONS") {
    console.log("Menangani permintaan OPTIONS (pre-flight CORS)");
    return new Response(null, {
      status: 204, // No Content untuk permintaan OPTIONS yang berhasil
      headers: {
        "Access-Control-Allow-Origin": "*", // Izinkan permintaan dari asal manapun
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", // Metode yang diizinkan
        "Access-Control-Allow-Headers": "*", // Header yang diizinkan
        "Access-Control-Max-Age": "86400", // Cache pre-flight request selama 24 jam
      },
    });
  }

  // Tangani permintaan lainnya (GET, POST, dll.)
  try {
    console.log(`Meneruskan permintaan ke: ${TARGET_URL}`);
    // Buat permintaan baru untuk URL target
    // Salin metode, header, dan body dari permintaan asli klien
    const targetRequest = new Request(TARGET_URL, {
      method: request.method,
      headers: request.headers,
      body: request.body, // Body akan null untuk GET/HEAD
      redirect: 'follow', // Secara default Deno akan mengikuti redirect
    });

    // Kirim permintaan ke URL target dan tunggu responsnya
    const targetResponse = await fetch(targetRequest);
    console.log(`Menerima respons dari target dengan status: ${targetResponse.status}`);

    // Buat respons baru untuk dikirim kembali ke klien
    // Salin body, status, dan statusText dari respons target
    const clientResponse = new Response(targetResponse.body, {
      status: targetResponse.status,
      statusText: targetResponse.statusText,
      headers: new Headers(targetResponse.headers), // Salin semua header dari respons target
    });

    // TAMBAHKAN/TIMPA HEADER CORS PENTING
    // Ini adalah bagian kunci yang membuat proksi ini berfungsi sebagai proksi CORS
    clientResponse.headers.set("Access-Control-Allow-Origin", "*"); // Mengizinkan akses dari domain manapun

    // Pastikan header Vary mencakup 'Origin' untuk penanganan cache yang benar pada respons CORS
    const vary = clientResponse.headers.get('Vary');
    if (vary) {
        if (!vary.toLowerCase().includes('origin')) {
             clientResponse.headers.set('Vary', `${vary}, Origin`);
        }
    } else {
        clientResponse.headers.set('Vary', 'Origin');
    }

    // Hapus header hop-by-hop yang mungkin disalin tapi tidak seharusnya diteruskan (opsional tapi baik)
    // Deno fetch umumnya sudah menangani ini, tapi eksplisit lebih aman.
    const hopByHopHeaders = [
        'Connection', 'Keep-Alive', 'Proxy-Authenticate', 'Proxy-Authorization',
        'Te', 'Trailers', 'Transfer-Encoding', 'Upgrade'
    ];
     hopByHopHeaders.forEach(header => {
        if (clientResponse.headers.has(header)) {
           // console.log(`Menghapus header hop-by-hop: ${header}`); // Opsional: untuk debugging
           clientResponse.headers.delete(header);
        }
    });


    console.log("Mengirim respons kembali ke klien dengan header CORS");
    return clientResponse;

  } catch (error) {
    console.error("Terjadi kesalahan saat permintaan proksi:", error);
    // Berikan respons error jika terjadi masalah saat mengambil data dari target
    return new Response(`Proxy error: ${error.message}`, { status: 500 });
  }
}

console.log(`Proksi CORS Deno berjalan di http://localhost:${PORT}`);
console.log(`Memproksi permintaan ke: ${TARGET_URL}`);
console.log(`Tekan Ctrl+C untuk menghentikan server.`);

// Jalankan server Deno
serve(handler, { port: PORT });
