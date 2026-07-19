# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
**[private vulnerability reporting](https://github.com/klucilla/teddytravolta/security/advisories/new)**
("Report a vulnerability" button on the repository's Security tab).

Do not open public issues for security problems.

## Scope notes

- This project is designed to run **locally** on the streamer's machine.
  The overlay server binds to `127.0.0.1` by default and should not be exposed
  to the internet.
- Never expose the OBS WebSocket (port 4455) beyond your local machine.
- Keep your `.env` file private — it contains your OBS WebSocket password.
