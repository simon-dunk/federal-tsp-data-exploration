import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional
import io
import json

class DataProcessor:
    def __init__(self):
        self.prices_df = None
        self.returns_df = None
        self.fund_columns = ['GFund', 'FFund', 'CFund', 'SFund', 'IFund']
    
    def _convert_to_serializable(self, obj):
        """Convert pandas/numpy data types to JSON serializable types"""
        if pd.isna(obj):
            return None
        elif isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
        elif isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        elif isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, dict):
            return {key: self._convert_to_serializable(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_to_serializable(item) for item in obj]
        else:
            return obj
    
    def _prepare_sample_data(self, df, num_rows=3):
        """Prepare sample data for JSON serialization"""
        sample = df.head(num_rows).copy()
        
        # Convert all columns to appropriate types
        for col in sample.columns:
            if col == 'Date':
                sample[col] = sample[col].dt.strftime('%Y-%m-%d')
            elif col in self.fund_columns:
                sample[col] = sample[col].apply(lambda x: None if pd.isna(x) else float(x))
            else:
                # Handle other columns (Year, Month, etc.)
                sample[col] = sample[col].apply(lambda x: None if pd.isna(x) else 
                                               int(x) if isinstance(x, (np.integer, np.int64)) else 
                                               str(x))
        
        return sample.to_dict('records')
    
    def load_prices_data_from_string(self, csv_content: str) -> Dict:
        """Load and validate prices data from CSV string"""
        try:
            # Read CSV from string
            df = pd.read_csv(io.StringIO(csv_content))
            
            # Validate required columns
            required_cols = self.fund_columns + ['Date']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                raise ValueError(f"Missing required columns: {missing_cols}")
            
            # Convert Date column to datetime
            df['Date'] = pd.to_datetime(df['Date'])
            
            # Convert fund columns to numeric, allowing NaN
            for col in self.fund_columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # Remove rows with invalid dates, but keep rows with some NaN fund values
            df = df.dropna(subset=['Date'])
            
            # Only remove rows where ALL fund values are NaN
            df = df.dropna(subset=self.fund_columns, how='all')
            
            # Sort by date
            df = df.sort_values('Date')
            
            self.prices_df = df
            
            # Calculate statistics about NaN values
            nan_stats = {}
            for col in self.fund_columns:
                total_rows = len(df)
                nan_count = int(df[col].isna().sum())  # Convert to int
                valid_count = total_rows - nan_count
                nan_stats[col] = {
                    'total': int(total_rows),
                    'valid': int(valid_count),
                    'missing': int(nan_count),
                    'missing_percentage': round(float(nan_count / total_rows) * 100, 1) if total_rows > 0 else 0.0
                }
            
            return {
                'success': True,
                'message': f'Loaded {len(df)} price records',
                'date_range': {
                    'start': df['Date'].min().strftime('%Y-%m-%d'),
                    'end': df['Date'].max().strftime('%Y-%m-%d')
                },
                'columns': list(df.columns),
                'sample_data': self._prepare_sample_data(df),
                'nan_statistics': nan_stats
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Error loading prices data: {str(e)}'
            }
    
    def load_returns_data_from_string(self, csv_content: str) -> Dict:
        """Load and validate returns data from CSV string - Enhanced NaN handling"""
        try:
            # Read CSV from string
            df = pd.read_csv(io.StringIO(csv_content))
            
            # Validate required columns
            required_cols = self.fund_columns + ['Date']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                raise ValueError(f"Missing required columns: {missing_cols}")
            
            # Convert Date column to datetime
            df['Date'] = pd.to_datetime(df['Date'])
            
            # Convert fund columns to numeric, explicitly handling various NaN representations
            for col in self.fund_columns:
                # First convert to string to handle mixed types
                df[col] = df[col].astype(str)
                # Replace common NaN representations
                df[col] = df[col].replace(['', 'NaN', 'nan', 'NULL', 'null', 'N/A', 'n/a', '#N/A'], np.nan)
                # Convert to numeric
                df[col] = pd.to_numeric(df[col], errors='coerce')
            
            # Remove rows with invalid dates, but keep rows with NaN fund values
            df = df.dropna(subset=['Date'])
            
            # Only remove rows where ALL fund values are NaN
            df = df.dropna(subset=self.fund_columns, how='all')
            
            # Sort by date
            df = df.sort_values('Date')
            
            self.returns_df = df
            
            # Calculate detailed statistics about NaN values
            nan_stats = {}
            for col in self.fund_columns:
                total_rows = len(df)
                nan_count = int(df[col].isna().sum())
                valid_count = total_rows - nan_count
                
                # Find first and last valid dates for each fund
                valid_data = df[df[col].notna()]
                first_valid = valid_data['Date'].min() if len(valid_data) > 0 else None
                last_valid = valid_data['Date'].max() if len(valid_data) > 0 else None
                
                nan_stats[col] = {
                    'total': int(total_rows),
                    'valid': int(valid_count),
                    'missing': int(nan_count),
                    'missing_percentage': round(float(nan_count / total_rows) * 100, 1) if total_rows > 0 else 0.0,
                    'first_valid_date': first_valid.strftime('%Y-%m-%d') if first_valid else None,
                    'last_valid_date': last_valid.strftime('%Y-%m-%d') if last_valid else None,
                    'data_available': bool(valid_count > 0)
                }
            
            return {
                'success': True,
                'message': f'Loaded {len(df)} return records (with NaN handling)',
                'date_range': {
                    'start': df['Date'].min().strftime('%Y-%m-%d'),
                    'end': df['Date'].max().strftime('%Y-%m-%d')
                },
                'columns': list(df.columns),
                'sample_data': self._prepare_sample_data(df),
                'nan_statistics': nan_stats
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Error loading returns data: {str(e)}'
            }
    
    def get_chart_data(self, data_type: str, start_date: str = None, 
                      end_date: str = None, funds: List[str] = None) -> Dict:
        """Get filtered chart data - Enhanced NaN handling"""
        try:
            # Select appropriate dataframe
            if data_type == 'prices':
                df = self.prices_df
            elif data_type == 'returns':
                df = self.returns_df
            else:
                raise ValueError("data_type must be 'prices' or 'returns'")
            
            if df is None:
                raise ValueError(f"No {data_type} data loaded")
            
            # Create a copy for filtering
            filtered_df = df.copy()
            
            # Filter by date range
            if start_date:
                start_dt = pd.to_datetime(start_date)
                filtered_df = filtered_df[filtered_df['Date'] >= start_dt]
            
            if end_date:
                end_dt = pd.to_datetime(end_date)
                filtered_df = filtered_df[filtered_df['Date'] <= end_dt]
            
            # Filter by funds
            if funds:
                available_funds = [f for f in funds if f in self.fund_columns]
                if not available_funds:
                    raise ValueError("No valid funds specified")
            else:
                available_funds = self.fund_columns
            
            # Prepare chart data
            chart_data = {
                'labels': [date.strftime('%Y-%m-%d') for date in filtered_df['Date']],
                'datasets': []
            }
            
            fund_colors = {
                'GFund': '#2196f3',
                'FFund': '#4caf50', 
                'CFund': '#ff9800',
                'SFund': '#f44336',
                'IFund': '#9c27b0'
            }
            
            for fund in available_funds:
                if fund in filtered_df.columns:
                    # Convert NaN to null for JSON serialization, keep as NaN for chart gaps
                    data_values = []
                    for value in filtered_df[fund]:
                        if pd.isna(value):
                            data_values.append(None)
                        else:
                            data_values.append(float(value))
                    
                    chart_data['datasets'].append({
                        'label': fund,
                        'data': data_values,
                        'borderColor': fund_colors.get(fund, '#888'),
                        'backgroundColor': fund_colors.get(fund, '#888') + '20',
                        'spanGaps': False,  # This creates gaps in the line for missing data
                        'pointRadius': 1,
                        'pointHoverRadius': 4
                    })
            
            return {
                'success': True,
                'data': chart_data,
                'record_count': int(len(filtered_df))
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Error getting chart data: {str(e)}'
            }
    
    def get_statistics(self, data_type: str, start_date: str = None, 
                      end_date: str = None, funds: List[str] = None) -> Dict:
        """Calculate statistics - Enhanced NaN handling"""
        try:
            # Select appropriate dataframe
            if data_type == 'prices':
                df = self.prices_df.copy() if self.prices_df is not None else None
            else:
                df = self.returns_df.copy() if self.returns_df is not None else None
            
            if df is None:
                raise ValueError(f"No {data_type} data loaded")
            
            # Apply filters
            if start_date:
                df = df[df['Date'] >= pd.to_datetime(start_date)]
            if end_date:
                df = df[df['Date'] <= pd.to_datetime(end_date)]
            
            if funds:
                available_funds = [f for f in funds if f in self.fund_columns]
            else:
                available_funds = self.fund_columns
            
            stats = {}
            for fund in available_funds:
                if fund in df.columns and len(df) > 0:
                    # Get only non-NaN values for calculations
                    values = df[fund].dropna()
                    
                    if len(values) > 0:
                        current = float(values.iloc[-1])
                        previous = float(values.iloc[0])
                        change = current - previous
                        
                        # Calculate additional NaN-aware statistics
                        total_periods = int(len(df))
                        valid_periods = int(len(values))
                        missing_periods = total_periods - valid_periods
                        
                        stats[fund] = {
                            'current': current,
                            'previous': previous,
                            'change': change,
                            'min': float(values.min()),
                            'max': float(values.max()),
                            'mean': float(values.mean()),
                            'std': float(values.std()) if len(values) > 1 else 0.0,
                            'count': valid_periods,
                            'total_periods': total_periods,
                            'missing_periods': missing_periods,
                            'data_coverage': round(float(valid_periods / total_periods) * 100, 1) if total_periods > 0 else 0.0
                        }
                    else:
                        # Fund has no valid data in the selected range
                        stats[fund] = {
                            'current': None,
                            'previous': None,
                            'change': None,
                            'min': None,
                            'max': None,
                            'mean': None,
                            'std': None,
                            'count': 0,
                            'total_periods': int(len(df)),
                            'missing_periods': int(len(df)),
                            'data_coverage': 0.0
                        }
            
            return {
                'success': True,
                'statistics': stats
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Error calculating statistics: {str(e)}'
            }
    
    def get_data_info(self) -> Dict:
        """Get information about loaded datasets - Enhanced with NaN info"""
        info = {
            'prices_loaded': bool(self.prices_df is not None),
            'returns_loaded': bool(self.returns_df is not None),
            'available_funds': list(self.fund_columns)
        }
        
        if self.prices_df is not None:
            # Calculate data availability for each fund
            fund_availability = {}
            for fund in self.fund_columns:
                valid_count = int(self.prices_df[fund].notna().sum())
                total_count = int(len(self.prices_df))
                fund_availability[fund] = {
                    'valid_records': valid_count,
                    'total_records': total_count,
                    'coverage_percentage': round(float(valid_count / total_count) * 100, 1) if total_count > 0 else 0.0
                }
            
            info['prices_info'] = {
                'record_count': int(len(self.prices_df)),
                'date_range': {
                    'start': self.prices_df['Date'].min().strftime('%Y-%m-%d'),
                    'end': self.prices_df['Date'].max().strftime('%Y-%m-%d')
                },
                'fund_availability': fund_availability
            }
        
        if self.returns_df is not None:
            # Calculate data availability for each fund
            fund_availability = {}
            for fund in self.fund_columns:
                valid_data = self.returns_df[self.returns_df[fund].notna()]
                valid_count = int(len(valid_data))
                total_count = int(len(self.returns_df))
                
                fund_availability[fund] = {
                    'valid_records': valid_count,
                    'total_records': total_count,
                    'coverage_percentage': round(float(valid_count / total_count) * 100, 1) if total_count > 0 else 0.0,
                    'first_data_date': valid_data['Date'].min().strftime('%Y-%m-%d') if valid_count > 0 else None,
                    'last_data_date': valid_data['Date'].max().strftime('%Y-%m-%d') if valid_count > 0 else None
                }
            
            info['returns_info'] = {
                'record_count': int(len(self.returns_df)),
                'date_range': {
                    'start': self.returns_df['Date'].min().strftime('%Y-%m-%d'),
                    'end': self.returns_df['Date'].max().strftime('%Y-%m-%d')
                },
                'fund_availability': fund_availability
            }
        
        return info
    
    def export_filtered_data(self, data_type: str, start_date: str = None, 
                           end_date: str = None, funds: List[str] = None) -> Dict:
        """Export filtered data as CSV - Preserves NaN values"""
        try:
            if data_type == 'prices':
                df = self.prices_df.copy() if self.prices_df is not None else None
            else:
                df = self.returns_df.copy() if self.returns_df is not None else None
            
            if df is None:
                raise ValueError(f"No {data_type} data loaded")
            
            # Apply filters
            if start_date:
                df = df[df['Date'] >= pd.to_datetime(start_date)]
            if end_date:
                df = df[df['Date'] <= pd.to_datetime(end_date)]
            
            if funds:
                columns_to_keep = ['Date'] + [f for f in funds if f in df.columns]
                df = df[columns_to_keep]
            
            # Convert to CSV, preserving NaN values
            csv_data = df.to_csv(index=False, na_rep='NaN')
            
            return {
                'success': True,
                'csv_data': csv_data,
                'filename': f'{data_type}_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f'Error exporting data: {str(e)}'
            }
