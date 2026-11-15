#!/usr/bin/env python3
"""
Servidor Web del Panel Administrador de PiccoliField (Puerto 3000)
- Sirve los archivos estáticos del panel (index.html, dashboard.html, css/, js/, assets/).
- Reenvía de forma transparente cualquier petición /api/* y /uploads/* hacia el backend real en Render
  (https://piccolifield-api-smkc.onrender.com) inyectando cabeceras CORS completas.
- No accede a base de datos ni implementa lógica ni endpoints propios.
"""

import http.server
import socketserver
import urllib.request
import urllib.error
import ssl
import sys
import os

PORT = int(os.environ.get("PORT", 3000))
REMOTE_API_ORIGIN = "https://piccolifield-api-smkc.onrender.com"
WEB_DIR = os.path.dirname(os.path.abspath(__file__))

ssl_ctx = ssl.create_default_context()


class PiccoliWebHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, format, *args):
        sys.stdout.write("%s - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), format % args))
        sys.stdout.flush()

    def end_headers(self):
        origin = self.headers.get("Origin") or "*"
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, Accept, If-None-Match, X-Operation-Id"
        )
        self.send_header("Access-Control-Expose-Headers", "ETag, Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Max-Age", "86400")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()

    def _is_proxied_path(self):
        return self.path.startswith("/api/") or self.path == "/api" or self.path.startswith("/uploads/")

    def _proxy_to_render(self, method):
        target_url = f"{REMOTE_API_ORIGIN}{self.path}"

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        forward_headers = {
            "User-Agent": "PiccoliField-WebAdmin/1.0",
            "Accept": self.headers.get("Accept", "application/json"),
            "Accept-Encoding": "identity",
        }
        for h in ("Content-Type", "Authorization", "If-None-Match", "X-Operation-Id"):
            val = self.headers.get(h)
            if val:
                forward_headers[h] = val

        req = urllib.request.Request(target_url, data=body, headers=forward_headers, method=method)

        try:
            with urllib.request.urlopen(req, context=ssl_ctx, timeout=45) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    kl = k.lower()
                    if kl in ("content-type", "etag", "cache-control", "last-modified"):
                        self.send_header(k, v)
                self.send_header("Content-Length", str(len(resp_body)))
                self.send_header("Connection", "close")
                self.end_headers()
                self.wfile.write(resp_body)

        except urllib.error.HTTPError as e:
            err_body = e.read()
            self.send_response(e.code)
            ct = e.headers.get("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Type", ct)
            self.send_header("Content-Length", str(len(err_body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(err_body)

        except Exception as ex:
            msg = f'{{"status":false,"message":"Error conectando con Render ({ex})"}}'.encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(msg)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(msg)

    def do_GET(self):
        if self._is_proxied_path():
            return self._proxy_to_render("GET")
        return super().do_GET()

    def do_POST(self):
        if self._is_proxied_path():
            return self._proxy_to_render("POST")
        self.send_error(405, "Method Not Allowed on static resource")

    def do_PUT(self):
        if self._is_proxied_path():
            return self._proxy_to_render("PUT")
        self.send_error(405, "Method Not Allowed on static resource")

    def do_PATCH(self):
        if self._is_proxied_path():
            return self._proxy_to_render("PATCH")
        self.send_error(405, "Method Not Allowed on static resource")

    def do_DELETE(self):
        if self._is_proxied_path():
            return self._proxy_to_render("DELETE")
        self.send_error(405, "Method Not Allowed on static resource")


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with ThreadedHTTPServer(("127.0.0.1", PORT), PiccoliWebHandler) as httpd:
        print("=" * 66, flush=True)
        print(f" PiccoliField - Panel Web del Administrador", flush=True)
        print(f" URL Local   : http://127.0.0.1:{PORT}", flush=True)
        print(f" API Remota  : {REMOTE_API_ORIGIN}/api", flush=True)
        print("=" * 66, flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            sys.exit(0)
