// script_render_and_serve.ts
import { launch } from 'https://deno.land/x/puppeteer@19.2.1/src/puppeteer.ts'; // Menggunakan versi dan path yang berbeda
import { serve } from 'https://deno.land/std@0.224.0/http/mod.ts'; // Menggunakan modul serve dari std

// URL target Anda
const targetUrl = 'https://cloud.hownetwork.xyz/video.php?id=Lh09YywNWiYqPgQ4bgJmanBVPisnHRseGg5OfSIAb2p1TQ';

// Port untuk server HTTP lokal
const serverPort = 8080;

let renderedHtmlContent: string | null = null;

async function fetchAndRenderPage() {
  console.log(`[Puppeteer] Membuka browser dan menavigasi ke ${targetUrl}...`);

  const browser = await launch({ headless: true }); // Jalankan dalam mode headless
  const page = await browser.newPage();

  try {
    // Navigasi ke URL
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    console.log('[Puppeteer] Halaman awal dimuat.');

    // Menunggu hingga elemen iframe muncul. Ini menandakan JavaScript sudah berjalan.
    console.log('[Puppeteer] Menunggu elemen iframe muncul...');
    await page.waitForSelector('iframe', { timeout: 60000 }); // Tunggu hingga 60 detik
    console.log('[Puppeteer] Elemen iframe ditemukan atau timeout tercapai.');

    // Beri sedikit waktu tambahan untuk rendering (opsional, terkadang membantu)
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[Puppeteer] Menunggu 2 detik tambahan.');

    // Mengambil konten HTML dari halaman setelah rendering
    renderedHtmlContent = await page.content();
    console.log('[Puppeteer] Konten HTML halaman berhasil diambil.');

  } catch (error) {
    console.error(`[Puppeteer] Terjadi kesalahan saat mengambil halaman: ${error}`);
    renderedHtmlContent = `<h1>Error rendering page</h1><p>${error.message}</p>`;
  } finally {
    // Menutup browser
    await browser.close();
    console.log('[Puppeteer] Browser ditutup.');
  }
}

// Fungsi handler untuk server HTTP
async function handler(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname;

  if (pathname === '/' && renderedHtmlContent !== null) {
    // Sajikan konten HTML yang sudah diambil
    return new Response(renderedHtmlContent, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
      },
    });
  } else if (renderedHtmlContent === null) {
     // Beri tahu pengguna bahwa konten masih diambil
     return new Response("Konten halaman sedang diambil oleh Puppeteer. Silakan coba refresh sebentar lagi.", {
       status: 202, // Accepted
       headers: {
         'content-type': 'text/plain; charset=utf-8',
       },
     });
  } else {
    // Respon untuk path lain
    return new Response('Halaman tidak ditemukan', { status: 404 });
  }
}

// Jalankan fungsi fetch dan render, lalu mulai server
async function main() {
  await fetchAndRenderPage(); // Tunggu sampai Puppeteer selesai

  if (renderedHtmlContent !== null) {
     console.log(`[Server] Konten siap disajikan.`);
  } else {
     console.log(`[Server] Konten tidak berhasil diambil oleh Puppeteer.`);
  }

  console.log(`[Server] Server berjalan di http://localhost:${serverPort}/`);
  await serve(handler, { port: serverPort });
}

main();
