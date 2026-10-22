import importlib.util
import os
from pathlib import Path
import socket
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


path = Path(__file__).resolve().parents[1] / "tools" / "protect-key.py"
spec = importlib.util.spec_from_file_location("deep_dive_key_setup", path)
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class ExclusiveSetupPortTests(unittest.TestCase):
    def test_setup_does_not_enable_address_reuse(self):
        self.assertFalse(setup.SetupServer.allow_reuse_address)

    def test_second_setup_cannot_bind_the_same_loopback_port(self):
        with setup.SetupServer(("127.0.0.1", 0), "test-key-not-a-credential") as first:
            with self.assertRaises(OSError):
                with setup.SetupServer(("127.0.0.1", first.server_port), "test-key-not-a-credential"):
                    self.fail("A second owner setup server shared the listening port")

    def test_setup_refuses_a_port_owned_by_an_existing_game_server(self):
        with ThreadingHTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler) as game:
            with self.assertRaises(OSError):
                with setup.SetupServer(("127.0.0.1", game.server_port), "test-key-not-a-credential"):
                    self.fail("Owner setup shared a port with an existing game server")

    def test_a_reusable_game_socket_cannot_share_the_setup_port(self):
        with setup.SetupServer(("127.0.0.1", 0), "test-key-not-a-credential") as owner:
            with self.assertRaises(OSError):
                with ThreadingHTTPServer(("127.0.0.1", owner.server_port), BaseHTTPRequestHandler):
                    self.fail("A game server shared the owner setup port")

    @unittest.skipUnless(os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"), "Windows exclusive socket option")
    def test_windows_setup_socket_uses_exclusive_address_ownership(self):
        with setup.SetupServer(("127.0.0.1", 0), "test-key-not-a-credential") as server:
            self.assertEqual(server.socket.getsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE), 1)


if __name__ == "__main__":
    unittest.main()
