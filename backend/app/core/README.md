# core
`errors.py`: `AppError` (client-safe code and message) and the handlers that turn every error into `{"error": {code, message, details}}` without stack traces. `ratelimit.py`: in-memory sliding-window limiter, one per app, used on model-calling routes.
