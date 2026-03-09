"""Base ETL worker class with common functionality."""
import os
import httpx
import pandas as pd
from abc import ABC, abstractmethod
from datetime import datetime
from tenacity import retry, stop_after_attempt, wait_exponential
from typing import Optional, List, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BaseETLWorker(ABC):
    """Base class for all ETL workers."""

    def __init__(self, source_name: str, base_url: str):
        self.source_name = source_name
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=60.0, follow_redirects=True)
        self.logger = logging.getLogger(f"etl.{source_name}")

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
    async def fetch(self, endpoint: str, params: Optional[Dict] = None, method: str = "GET", json_data: Optional[Dict] = None) -> Dict:
        """Make HTTP request with retry logic."""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == "POST":
                response = await self.client.post(url, json=json_data, params=params)
            else:
                response = await self.client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            self.logger.error(f"HTTP error {e.response.status_code} for {url}: {e}")
            raise
        except httpx.RequestError as e:
            self.logger.error(f"Request error for {url}: {e}")
            raise

    @abstractmethod
    async def extract(self, **kwargs) -> List[Dict]:
        """Extract data from source."""
        pass

    @abstractmethod
    async def transform(self, data: List[Dict]) -> pd.DataFrame:
        """Transform raw data to normalized format."""
        pass

    @abstractmethod
    async def load(self, df: pd.DataFrame) -> int:
        """Load data to databases. Returns count of records loaded."""
        pass

    async def run(self, **kwargs) -> Dict[str, Any]:
        """Execute full ETL pipeline."""
        start_time = datetime.utcnow()
        self.logger.info(f"Starting ETL for {self.source_name}")

        try:
            # Extract
            raw_data = await self.extract(**kwargs)
            self.logger.info(f"Extracted {len(raw_data)} records")

            # Transform
            df = await self.transform(raw_data)
            self.logger.info(f"Transformed to {len(df)} records")

            # Load
            count = await self.load(df)

            duration = (datetime.utcnow() - start_time).total_seconds()
            self.logger.info(f"ETL completed: {count} records in {duration:.2f}s")

            return {
                "success": True,
                "source": self.source_name,
                "records_processed": count,
                "duration_seconds": duration,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            self.logger.error(f"ETL failed: {e}")
            return {
                "success": False,
                "source": self.source_name,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        finally:
            await self.client.aclose()

    def normalize_entity_name(self, name: str) -> str:
        """Normalize entity name for deduplication."""
        if not name:
            return ""
        return (name.upper()
                .replace("INC.", "")
                .replace("LLC", "")
                .replace("CORP.", "")
                .replace("CORPORATION", "")
                .replace("  ", " ")
                .strip())
