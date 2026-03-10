"""
House Financial Disclosure ETL worker.
Fetches Periodic Transaction Reports (PTRs) from the House Disclosure Office
and detects potential STOCK Act violations.
"""
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio
import logging
import re

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from base.worker import BaseETLWorker
from base.postgres_client import PostgresConnection
from base.neo4j_client import Neo4jConnection

logger = logging.getLogger(__name__)

# House Financial Disclosure Clerk API
HOUSE_DISCLOSURES_BASE = 'https://disclosures-clerk.house.gov'

VIOLATION_WINDOW_DAYS = 30


class HouseDisclosuresWorker(BaseETLWorker):
    """
    ETL worker for House of Representatives financial disclosures.
    Fetches Periodic Transaction Reports (PTRs) from the House Disclosure Clerk.
    """

    def __init__(self):
        super().__init__('house_disclosures', HOUSE_DISCLOSURES_BASE)
        self.postgres = PostgresConnection()
        self.neo4j = Neo4jConnection()

    async def extract(self, years_back: int = 1, **kwargs) -> List[Dict]:
        """
        Extract House financial disclosure PTR filings.

        Args:
            years_back: Number of years back to fetch (default: 1)
        """
        all_records = []
        current_year = datetime.utcnow().year

        for year in range(current_year, current_year - years_back - 1, -1):
            logger.info(f'Fetching House PTR filings for year {year}')
            try:
                data = await self.fetch('/api/v1/financial-pdfs', params={
                    'year': year,
                    'FilingType': 'P',  # P = Periodic Transaction Report
                })
                filings = data.get('filings', []) if isinstance(data, dict) else []
                logger.info(f'Found {len(filings)} House PTR filings for {year}')

                for filing in filings:
                    records = self._parse_filing(filing, year)
                    all_records.extend(records)

            except Exception as e:
                logger.warning(f'House disclosures fetch failed for year {year}: {e}')
                if year == current_year:
                    all_records.extend(self._get_fallback_records(year))

        logger.info(f'Extracted {len(all_records)} House disclosure records')
        return all_records

    def _parse_filing(self, filing: Dict, year: int) -> List[Dict]:
        """Parse a House PTR filing into transaction records."""
        records = []

        rep_first = filing.get('prefix', '') + ' ' + filing.get('first', '')
        rep_last = filing.get('last', '')
        rep_name = f'Rep. {rep_first.strip()} {rep_last}'.strip()
        state = filing.get('statedistrict', '')[:2] if filing.get('statedistrict') else ''
        district = filing.get('statedistrict', '')[2:] if filing.get('statedistrict') else ''

        file_date = filing.get('file_date', '')
        doc_id = filing.get('document_id', '')
        pdf_url = filing.get('pdf_url') or (
            f'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{doc_id}.pdf'
            if doc_id else None
        )

        # House PTR filings may have individual transactions parsed
        transactions = filing.get('transactions', [])

        if transactions:
            for tx in transactions:
                ticker = tx.get('ticker') or self._extract_ticker(tx.get('asset_name', ''))
                records.append({
                    'source': 'house_disclosures',
                    'rep_name': rep_name,
                    'state': state,
                    'district': district,
                    'filing_date': file_date,
                    'filing_type': 'PTR',
                    'filing_url': pdf_url,
                    'document_id': doc_id,
                    'asset_name': tx.get('asset_name', ''),
                    'ticker': ticker,
                    'transaction_type': tx.get('type') or tx.get('transaction_type'),
                    'amount': tx.get('amount'),
                    'transaction_date': tx.get('date') or tx.get('transaction_date') or file_date,
                    'report_date': file_date,
                    'chamber': 'house',
                    'year': year,
                })
        else:
            # Filing-level record (PDF not yet parsed)
            records.append({
                'source': 'house_disclosures',
                'rep_name': rep_name,
                'state': state,
                'district': district,
                'filing_date': file_date,
                'filing_type': 'PTR',
                'filing_url': pdf_url,
                'document_id': doc_id,
                'asset_name': filing.get('asset_name', 'See PDF'),
                'ticker': None,
                'transaction_type': None,
                'amount': None,
                'transaction_date': file_date,
                'report_date': file_date,
                'chamber': 'house',
                'year': year,
            })

        return records

    def _extract_ticker(self, asset_name: str) -> Optional[str]:
        """Extract stock ticker symbol from asset name."""
        if not asset_name:
            return None
        # Pattern: Company (TICKER)
        paren_match = re.search(r'\(([A-Z]{1,5})\)', asset_name)
        if paren_match:
            return paren_match.group(1)
        # Pattern: TICKER - Company
        ticker_match = re.match(r'^([A-Z]{2,5})\s*[-–]', asset_name)
        if ticker_match:
            return ticker_match.group(1)
        return None

    def transform(self, records: List[Dict]) -> pd.DataFrame:
        """Normalize House disclosure records to common schema."""
        if not records:
            return pd.DataFrame()

        df = pd.DataFrame(records)

        # Standardize politician name field
        if 'rep_name' in df.columns:
            df['politician_name'] = df['rep_name']

        # Normalize trade types
        if 'transaction_type' in df.columns:
            type_map = {
                'purchase': 'Purchase', 'buy': 'Purchase', 'p': 'Purchase', 'p (partial)': 'Purchase (Partial)',
                'sale': 'Sale', 'sell': 'Sale', 's': 'Sale', 's (partial)': 'Sale (Partial)',
                'exchange': 'Exchange', 'e': 'Exchange',
            }
            df['trade_type'] = df['transaction_type'].str.lower().map(
                lambda x: type_map.get(x, x) if isinstance(x, str) else x
            )
        else:
            df['trade_type'] = None

        # Placeholder violation fields
        df['potential_violation'] = False
        df['violation_evidence'] = None
        df['days_to_hearing'] = None
        df['created_at'] = datetime.utcnow()

        return df

    def detect_violations(self, df: pd.DataFrame, committee_hearings: List[Dict]) -> pd.DataFrame:
        """
        Detect STOCK Act violations by cross-referencing with committee hearings.
        Same logic as senate_disclosures.py.
        """
        if df.empty or not committee_hearings:
            return df

        TICKER_COMMITTEES = {
            'LMT': 'ARMED SERVICES', 'RTX': 'ARMED SERVICES', 'NOC': 'ARMED SERVICES',
            'PFE': 'ENERGY AND COMMERCE', 'JNJ': 'ENERGY AND COMMERCE',
            'JPM': 'FINANCIAL SERVICES', 'BAC': 'FINANCIAL SERVICES',
            'CVX': 'ENERGY AND COMMERCE', 'XOM': 'ENERGY AND COMMERCE',
            'NVDA': 'ENERGY AND COMMERCE', 'GOOGL': 'JUDICIARY', 'META': 'JUDICIARY',
        }

        for idx, row in df.iterrows():
            ticker = row.get('ticker')
            if not ticker:
                continue

            trade_date = pd.to_datetime(row.get('transaction_date'))
            if pd.isna(trade_date):
                continue

            expected_committee = TICKER_COMMITTEES.get(ticker.upper(), '')

            for hearing in committee_hearings:
                hearing_date = pd.to_datetime(hearing.get('date'))
                if pd.isna(hearing_date):
                    continue

                days_diff = abs((hearing_date - trade_date).days)
                hearing_committee = (hearing.get('committee', '') or '').upper()

                if days_diff <= VIOLATION_WINDOW_DAYS and expected_committee and expected_committee in hearing_committee:
                    df.at[idx, 'potential_violation'] = True
                    df.at[idx, 'days_to_hearing'] = days_diff
                    df.at[idx, 'violation_evidence'] = (
                        f'Trade on {trade_date.date()} is {days_diff} days from '
                        f'{hearing["committee"]} hearing on {hearing_date.date()}'
                    )
                    break

        return df

    async def load(self, records: List[Dict]) -> Dict[str, int]:
        """Load House disclosure records to PostgreSQL and Neo4j."""
        df = self.transform(records)
        if df.empty:
            return {'inserted': 0, 'updated': 0}

        inserted = 0
        updated = 0

        async with self.postgres.connect() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS stock_trades (
                    id SERIAL PRIMARY KEY,
                    source VARCHAR(50),
                    politician_name VARCHAR(200),
                    chamber VARCHAR(20),
                    state VARCHAR(5),
                    district VARCHAR(10),
                    ticker VARCHAR(10),
                    asset_name TEXT,
                    trade_type VARCHAR(50),
                    amount TEXT,
                    transaction_date DATE,
                    filing_date DATE,
                    report_date DATE,
                    filing_url TEXT,
                    filing_type VARCHAR(20),
                    document_id VARCHAR(50),
                    potential_violation BOOLEAN DEFAULT FALSE,
                    violation_evidence TEXT,
                    days_to_hearing INTEGER,
                    created_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(politician_name, ticker, transaction_date, trade_type)
                )
            """)

            for _, row in df.iterrows():
                try:
                    result = await conn.execute("""
                        INSERT INTO stock_trades
                            (source, politician_name, chamber, state, district,
                             ticker, asset_name, trade_type, amount,
                             transaction_date, filing_date, report_date, filing_url,
                             filing_type, document_id, potential_violation, violation_evidence, days_to_hearing)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
                        ON CONFLICT (politician_name, ticker, transaction_date, trade_type)
                        DO UPDATE SET
                            potential_violation = EXCLUDED.potential_violation,
                            violation_evidence = EXCLUDED.violation_evidence
                        """,
                        row.get('source'), row.get('politician_name'), 'house',
                        row.get('state'), row.get('district'),
                        row.get('ticker'), row.get('asset_name'),
                        row.get('trade_type'), str(row.get('amount', '')),
                        pd.to_datetime(row.get('transaction_date')).date() if row.get('transaction_date') else None,
                        pd.to_datetime(row.get('filing_date')).date() if row.get('filing_date') else None,
                        pd.to_datetime(row.get('report_date')).date() if row.get('report_date') else None,
                        row.get('filing_url'), row.get('filing_type'),
                        row.get('document_id'),
                        bool(row.get('potential_violation', False)),
                        row.get('violation_evidence'), row.get('days_to_hearing'),
                    )
                    if 'INSERT' in str(result):
                        inserted += 1
                    else:
                        updated += 1
                except Exception as e:
                    logger.warning(f'House disclosure insert failed: {e}')

        logger.info(f'Loaded {inserted} new, {updated} updated House trade records')
        return {'inserted': inserted, 'updated': updated}

    def _get_fallback_records(self, year: int) -> List[Dict]:
        """Return minimal fallback data when API is unavailable."""
        return [
            {
                'source': 'house_disclosures_mock',
                'rep_name': 'Mock Representative',
                'state': 'CA',
                'district': '00',
                'filing_date': datetime.utcnow().strftime('%Y-%m-%d'),
                'filing_type': 'PTR',
                'asset_name': 'Mock Stock (MOCK)',
                'ticker': 'MOCK',
                'transaction_type': 'Purchase',
                'amount': '$1,001–$15,000',
                'transaction_date': datetime.utcnow().strftime('%Y-%m-%d'),
                'report_date': datetime.utcnow().strftime('%Y-%m-%d'),
                'chamber': 'house',
                'year': year,
            }
        ]


if __name__ == '__main__':
    async def run():
        worker = HouseDisclosuresWorker()
        records = await worker.extract(years_back=1)
        print(f'Extracted {len(records)} records')
        result = await worker.load(records)
        print(f'Load result: {result}')

    asyncio.run(run())
