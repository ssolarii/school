"""Create an encrypted, publishable API-key vault without sending its password to Python.

Run from any directory: python tools/protect-key.py
OPENROUTER_API_KEY can be set in this process's environment, or entered privately
in the owner form. Open only the private setup URL printed here. The browser
performs PBKDF2/AES-GCM encryption.
"""
from __future__ import annotations

import argparse
import base64
import binascii
import hmac
import json
import os
from pathlib import Path
import secrets
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ROOT = Path(__file__).resolve().parents[1]
VAULT_PATH = ROOT / "ai-key.vault.json"
CRYPTO_PATH = ROOT / "vault-crypto.js"
MAX_BODY = 20_000


PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Protect the Deep Dive API key</title>
<style nonce="__NONCE__">
*{box-sizing:border-box}body{margin:0;background:#111820;color:#eef2f5;font:18px/1.5 system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:32px}main{width:min(100%,580px)}h1{font-size:32px;line-height:1.15;margin:0 0 20px}p{color:#bdc9d3}label{display:block;margin-top:24px;font-weight:600}input{display:block;width:100%;font:inherit;color:inherit;background:#1d2935;border:1px solid #6f8496;border-radius:6px;padding:12px;margin-top:8px}button{font:inherit;font-weight:650;background:#d9f4de;color:#123321;border:0;border-radius:6px;padding:14px 20px;margin-top:28px;min-height:54px;cursor:pointer}button:disabled{opacity:.65;cursor:wait}:focus-visible{outline:3px solid #b6e1ff;outline-offset:4px}#status{min-height:54px;margin-bottom:0}small{font-size:15px;color:#bdc9d3}
</style></head><body><main>
<h1>Protect the Deep Dive API key</h1>
<p>Choose a staff passphrase with at least 14 characters. Staff will use it to unlock answer checking on another device.</p>
<p>Your browser encrypts the key. Only the encrypted vault is saved; the passphrase is never sent to this setup server.</p>
<form id="setup-form">
<label for="replacement-key">Replacement API key <small>(optional)</small><input id="replacement-key" type="password" maxlength="264" autocomplete="off" spellcheck="false"></label>
<small>Leave blank to protect the key already configured on this computer. A replacement key stays in this browser until encrypted.</small>
<label for="password">Staff passphrase<input id="password" type="password" minlength="14" maxlength="256" autocomplete="new-password" required></label>
<label for="confirm">Confirm passphrase<input id="confirm" type="password" minlength="14" maxlength="256" autocomplete="new-password" required></label>
<small>Keep this passphrase privately. Anyone with it can use the protected API key.</small>
<button id="save" type="submit">Encrypt and save</button>
<p id="status" role="status" aria-live="polite"></p>
</form></main>
<script src="/vault-crypto.js"></script>
<script nonce="__NONCE__">
(() => {
  'use strict';
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  history.replaceState(null, '', location.pathname);
  const form = document.getElementById('setup-form');
  const replacementInput = document.getElementById('replacement-key');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
  const button = document.getElementById('save');
  const status = document.getElementById('status');
  if (!token || !window.DeepDiveVaultCrypto?.encryptKey || !window.DeepDiveVaultCrypto?.decryptKey) {
    button.disabled = true;
    status.textContent = 'Open the complete private setup URL printed by the setup helper. Make sure vault-crypto.js is present.';
    return;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
    let password = passwordInput.value;
    if (Array.from(password).length < 14) {
      status.textContent = 'Use a passphrase with at least 14 characters.';
      passwordInput.focus();
      return;
    }
    if (password !== confirmInput.value) {
      status.textContent = 'The passphrases do not match.';
      confirmInput.focus();
      return;
    }
    let key = '';
    button.disabled = true;
    status.textContent = 'Encrypting the key in your browser…';
    try {
      key = replacementInput.value.trim();
      if (!key) {
        const response = await fetch('/api/key', {headers:{'X-Setup-Token':token}, cache:'no-store', credentials:'omit'});
        if (!response.ok) throw Error('No configured key is available. Enter the key in the replacement field, or restart the helper.');
        const data = await response.json();
        key = data.key;
        data.key = '';
      }
      if (typeof key !== 'string' || !key) throw Error('The server did not provide a key.');
      const vault = await window.DeepDiveVaultCrypto.encryptKey(key, password);
      if (await window.DeepDiveVaultCrypto.decryptKey(vault, password) !== key) {
        throw Error('The encryption check failed. No vault was saved.');
      }
      key = '';
      password = '';
      passwordInput.value = '';
      confirmInput.value = '';
      replacementInput.value = '';
      const saved = await fetch('/api/save', {method:'POST', headers:{'Content-Type':'application/json','X-Setup-Token':token}, body:JSON.stringify(vault), credentials:'omit'});
      if (!saved.ok) {
        let detail;
        try { detail = await saved.json(); } catch {}
        throw Error(detail?.error || 'The encrypted vault could not be saved.');
      }
      passwordInput.disabled = true;
      confirmInput.disabled = true;
      replacementInput.disabled = true;
      button.textContent = 'Vault saved';
      status.textContent = 'Saved ai-key.vault.json. You can close this page and stop the helper. Keep the staff passphrase private.';
    } catch (error) {
      status.textContent = error?.message || 'Setup could not finish. Please try again.';
      button.disabled = false;
    } finally {
      key = '';
      password = '';
      passwordInput.value = '';
      confirmInput.value = '';
      replacementInput.value = '';
    }
  });
})();
</script></body></html>"""


def decode_field(value, name, minimum, maximum):
    if not isinstance(value, str):
        raise ValueError(f"Invalid {name}")
    try:
        decoded = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"Invalid {name}") from exc
    if not minimum <= len(decoded) <= maximum:
        raise ValueError(f"Invalid {name}")


def validate_vault(vault):
    """Accept only the published crypto contract, with no plaintext extra fields."""
    if not isinstance(vault, dict) or set(vault) != {"version", "kdf", "cipher", "ciphertext"}:
        raise ValueError("Invalid vault format")
    if type(vault["version"]) is not int or vault["version"] != 1:
        raise ValueError("Unsupported vault version")
    kdf, cipher = vault["kdf"], vault["cipher"]
    if not isinstance(kdf, dict) or set(kdf) != {"name", "hash", "iterations", "salt"}:
        raise ValueError("Invalid key derivation settings")
    if kdf["name"] != "PBKDF2" or kdf["hash"] != "SHA-256" or type(kdf["iterations"]) is not int or kdf["iterations"] != 600_000:
        raise ValueError("The vault must use PBKDF2 SHA-256 with 600000 iterations")
    if not isinstance(cipher, dict) or set(cipher) != {"name", "iv"} or cipher["name"] != "AES-GCM":
        raise ValueError("The vault must use AES-GCM")
    decode_field(kdf["salt"], "salt", 16, 16)
    decode_field(cipher["iv"], "IV", 12, 12)
    decode_field(vault["ciphertext"], "ciphertext", 48, 1024)
    return vault


class SetupServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def server_bind(self):
        # SO_REUSEADDR can silently share a listener with an older server on Windows.
        # Claim the owner setup port exclusively before binding instead.
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()

    def __init__(self, address, key):
        super().__init__(address, SetupHandler)
        self.setup_key = key
        self.setup_token = secrets.token_urlsafe(32)
        self.saved = False
        self.save_lock = threading.Lock()

    @property
    def origin(self):
        return f"http://127.0.0.1:{self.server_port}"


class SetupHandler(BaseHTTPRequestHandler):
    server: SetupServer

    def log_message(self, *_args):
        # Never log the owner token, key, request body, or password.
        pass

    def reply(self, code, body, content_type="application/json; charset=utf-8", *, nonce=None):
        if not isinstance(body, bytes):
            body = json.dumps(body).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        if nonce:
            self.send_header("Content-Security-Policy", f"default-src 'none'; script-src 'self' 'nonce-{nonce}'; style-src 'nonce-{nonce}'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def trusted_request(self):
        if self.headers.get("Host") != f"127.0.0.1:{self.server.server_port}":
            self.reply(403, {"error": "Use the private loopback setup URL"})
            return False
        origin = self.headers.get("Origin")
        if origin is not None and origin != self.server.origin:
            self.reply(403, {"error": "Origin not allowed"})
            return False
        return True

    def authorized(self):
        received = self.headers.get("X-Setup-Token", "")
        if not hmac.compare_digest(received.encode("utf-8"), self.server.setup_token.encode("utf-8")):
            self.reply(403, {"error": "Private setup token required"})
            return False
        return True

    def do_GET(self):
        if not self.trusted_request():
            return
        if self.path == "/":
            nonce = secrets.token_urlsafe(24)
            self.reply(200, PAGE.replace("__NONCE__", nonce).encode("utf-8"), "text/html; charset=utf-8", nonce=nonce)
        elif self.path == "/vault-crypto.js":
            try:
                source = CRYPTO_PATH.read_bytes()
            except OSError:
                self.reply(503, {"error": "vault-crypto.js is unavailable"})
                return
            self.reply(200, source, "text/javascript; charset=utf-8")
        elif self.path == "/api/key":
            if not self.authorized():
                return
            if self.server.saved:
                self.reply(410, {"error": "This setup session has already saved its vault"})
                return
            if not self.server.setup_key:
                self.reply(404, {"error": "No environment key is configured. Enter a key in the owner form."})
                return
            self.reply(200, {"key": self.server.setup_key})
        else:
            self.reply(404, {"error": "Not found"})

    def do_OPTIONS(self):
        self.reply(403, {"error": "Cross-origin setup is not allowed"})

    def do_POST(self):
        if not self.trusted_request():
            return
        if self.path != "/api/save":
            self.reply(404, {"error": "Not found"})
            return
        if self.headers.get("Origin") != self.server.origin:
            self.reply(403, {"error": "Save from the private setup page"})
            return
        if not self.authorized():
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 1 <= length <= MAX_BODY or self.headers.get_content_type() != "application/json":
                raise ValueError("Invalid encrypted vault request")
            self.connection.settimeout(10)
            vault = validate_vault(json.loads(self.rfile.read(length)))
        except (ValueError, TypeError, UnicodeError, OSError):
            self.reply(400, {"error": "Invalid encrypted vault. No key was saved."})
            return
        with self.server.save_lock:
            if self.server.saved or VAULT_PATH.exists():
                self.reply(409, {"error": "A vault already exists. It will not be overwritten."})
                return
            created = False
            try:
                descriptor = os.open(VAULT_PATH, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                created = True
                with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
                    json.dump(vault, output, indent=2)
                    output.write("\n")
                self.server.saved = True
                self.server.setup_key = ""
            except FileExistsError:
                self.reply(409, {"error": "A vault already exists. It will not be overwritten."})
                return
            except OSError:
                if created:
                    VAULT_PATH.unlink(missing_ok=True)
                self.reply(500, {"error": "Could not save the encrypted vault. Check folder permissions."})
                return
        self.reply(201, {"saved": True, "filename": VAULT_PATH.name})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8767)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("The port must be between 1 and 65535")
    if VAULT_PATH.exists():
        parser.error("ai-key.vault.json already exists. Back it up and remove it explicitly before creating a replacement.")
    if not CRYPTO_PATH.is_file():
        parser.error("vault-crypto.js must be present in the Deep Dive folder")
    key = os.getenv("OPENROUTER_API_KEY", "").strip()
    with SetupServer(("127.0.0.1", args.port), key) as server:
        if not key:
            print("No environment key is configured. Enter your API key privately in the setup form.", flush=True)
        key = ""
        print("Open this private setup URL on this computer:", flush=True)
        print(f"{server.origin}/#token={server.setup_token}", flush=True)
        print("Keep the URL private. Press Ctrl+C when setup is complete.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.setup_key = ""


if __name__ == "__main__":
    main()
