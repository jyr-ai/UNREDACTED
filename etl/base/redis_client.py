"""Redis connection and caching utilities."""
import os
import json
import redis
from typing import Optional, Any, Dict
import logging

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CACHE_TTL = int(os.getenv("CACHE_TTL", "3600"))  # Default 1 hour


class RedisConnection:
    """Redis connection manager."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._client = None
        return cls._instance

    def connect(self):
        """Initialize Redis connection."""
        if self._client is None:
            self._client = redis.from_url(REDIS_URL, decode_responses=True)
            try:
                self._client.ping()
                logger.info("Redis connection established")
            except redis.ConnectionError as e:
                logger.error(f"Redis connection failed: {e}")
                raise
        return self

    def get_client(self):
        """Get the Redis client instance."""
        if self._client is None:
            self.connect()
        return self._client

    def get(self, key: str) -> Optional[str]:
        """Get value by key."""
        try:
            return self.get_client().get(key)
        except redis.RedisError as e:
            logger.error(f"Redis get error: {e}")
            return None

    def set(self, key: str, value: str, ttl: Optional[int] = None) -> bool:
        """Set value with optional TTL."""
        try:
            if ttl:
                return self.get_client().setex(key, ttl, value)
            return self.get_client().set(key, value)
        except redis.RedisError as e:
            logger.error(f"Redis set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Delete a key."""
        try:
            return self.get_client().delete(key) > 0
        except redis.RedisError as e:
            logger.error(f"Redis delete error: {e}")
            return False

    def get_json(self, key: str) -> Optional[Dict]:
        """Get and parse JSON value."""
        data = self.get(key)
        if data:
            try:
                return json.loads(data)
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error for key {key}: {e}")
        return None

    def set_json(self, key: str, value: Dict, ttl: Optional[int] = None) -> bool:
        """Serialize and store JSON value."""
        try:
            return self.set(key, json.dumps(value), ttl)
        except (TypeError, ValueError) as e:
            logger.error(f"JSON encode error: {e}")
            return False

    def cache_api_response(self, endpoint: str, params: Dict, response: Dict, ttl: int = CACHE_TTL) -> bool:
        """Cache API response."""
        cache_key = f"api:{endpoint}:{hash(str(sorted(params.items())))}"
        return self.set_json(cache_key, response, ttl)

    def get_cached_api_response(self, endpoint: str, params: Dict) -> Optional[Dict]:
        """Retrieve cached API response."""
        cache_key = f"api:{endpoint}:{hash(str(sorted(params.items())))}"
        return self.get_json(cache_key)

    def lock_job(self, job_name: str, timeout: int = 300) -> bool:
        """Acquire a lock for a job to prevent concurrent runs."""
        lock_key = f"lock:{job_name}"
        try:
            return self.get_client().set(lock_key, "1", nx=True, ex=timeout) is not None
        except redis.RedisError as e:
            logger.error(f"Lock error: {e}")
            return False

    def unlock_job(self, job_name: str) -> bool:
        """Release a job lock."""
        lock_key = f"lock:{job_name}"
        return self.delete(lock_key)

    def is_job_locked(self, job_name: str) -> bool:
        """Check if a job is currently locked."""
        lock_key = f"lock:{job_name}"
        return self.get(lock_key) is not None

    def close(self):
        """Close Redis connection."""
        if self._client:
            self._client.close()
            self._client = None
