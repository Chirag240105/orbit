# ORBIT flow tracing demo repository

Small FastAPI project with deliberately separated route, service, repository,
and storage layers. Use it as a predictable project for ORBIT's project
overview and flow-tracing demos. It contains no credentials or external calls.

From this directory, run `uvicorn app.main:app --reload` after installing
FastAPI and Uvicorn. The sample route is `POST /login`.
