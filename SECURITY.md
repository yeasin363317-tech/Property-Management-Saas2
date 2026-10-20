# Security policy

Report vulnerabilities privately to the maintainer (set your contact address here: `security@YOUR-DOMAIN`) — do not open public issues. Include steps to reproduce and impact; expect an acknowledgement within a few business days.

Operators: see docs/security.md for the production hardening checklist. Never commit `.env`; rotate `POSTGRES_PASSWORD` and SMTP credentials if exposed; keep dependencies patched (`npm audit --omit=dev`).
