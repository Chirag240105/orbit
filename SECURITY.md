# Security policy

ORBIT is a hackathon-stage project, not production software. See `docs/SECURITY_MODEL.md` for what is and isn't implemented and `docs/THREAT_MODEL.md` for the model.

Report vulnerabilities privately to the maintainers (Chirag, Charanjeet) rather than in a public issue. Do not include real secrets or personal files in reports.

Key rules for contributors: the API key stays in the backend; every workspace path goes through `resolve_inside()`; no shell or subprocess execution; model output and retrieved content are untrusted data.
