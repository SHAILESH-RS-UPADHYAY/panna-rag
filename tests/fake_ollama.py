"""A stand-in that speaks Ollama's API, for testing the app where Ollama is not installed.

It is NOT a language model. It repeats the first sentence of the first passage, so it can only
prove the plumbing works. Its model name starts with `stand-in`, and five_questions.py refuses it.
    python tests/fake_ollama.py   then start the app with OLLAMA_HOST=http://127.0.0.1:11999
"""
import json
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(json.dumps({"models": [{"name": "stand-in:test"}]}).encode())

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        self.send_response(200)
        self.end_headers()
        final = body["messages"][-1]["content"]
        match = re.search(r"\[1\] \(.*?\)\n(.+?[.!?])(\s|$)", final, re.S)
        answer = f"{match.group(1).strip()} [1]" if match else "I could not find this in the document."
        for word in re.findall(r"\S+\s*", answer):
            self.wfile.write(json.dumps({"message": {"content": word}, "done": False}).encode() + b"\n")
            self.wfile.flush()
            time.sleep(0.04)
        done = {"done": True, "eval_count": 30, "eval_duration": 1_000_000_000, "prompt_eval_count": 200}
        self.wfile.write(json.dumps(done).encode() + b"\n")


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 11999), Handler).serve_forever()
