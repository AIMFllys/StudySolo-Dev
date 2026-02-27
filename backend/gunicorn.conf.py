"""Gunicorn configuration for StudySolo Backend."""

bind = "0.0.0.0:2038"
workers = 2
worker_class = "uvicorn.workers.UvicornWorker"
