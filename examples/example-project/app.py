"""Tiny demo project for ORBIT. `.env` next to this file is never listed or readable."""


def greet(name: str) -> str:
    return f"Hello, {name}!"


API_TOKEN = "demo-token-not-a-real-secret-1234"  # ORBIT redacts this before any external send

if __name__ == "__main__":
    print(greet("ORBIT"))
