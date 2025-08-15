from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import io
import json
import numpy as np
import pandas as pd
from data_processor import DataProcessor

# Custom JSON encoder to handle numpy/pandas types
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
        elif isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif pd.isna(obj):
            return None
        elif isinstance(obj, pd.Timestamp):
            return obj.isoformat()
        return super().default(obj)

app = Flask(__name__)
app.json_encoder = CustomJSONEncoder  # Set custom JSON encoder
CORS(app)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Global data processor instance
data_processor = DataProcessor()

def allowed_file(filename):
    return filename.lower().endswith('.csv')

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Share Price Analyzer API is running'
    })

@app.route('/api/upload/prices', methods=['POST'])
def upload_prices():
    """Upload prices CSV file"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'success': False, 'message': 'Invalid file'}), 400
        
        # Process file directly from memory
        csv_content = file.read().decode('utf-8')
        result = data_processor.load_prices_data_from_string(csv_content)
        
        return jsonify(result)
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/upload/returns', methods=['POST'])
def upload_returns():
    """Upload returns CSV file"""
    try:
        if 'file' not in request.files:
            return jsonify({'success': False, 'message': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'success': False, 'message': 'Invalid file'}), 400
        
        # Process file directly from memory
        csv_content = file.read().decode('utf-8')
        result = data_processor.load_returns_data_from_string(csv_content)
        
        return jsonify(result)
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/chart-data', methods=['POST'])
def get_chart_data():
    """Get chart data with filters"""
    try:
        data = request.json
        data_type = data.get('data_type', 'prices')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        funds = data.get('funds')
        
        result = data_processor.get_chart_data(data_type, start_date, end_date, funds)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/statistics', methods=['POST'])
def get_statistics():
    """Get statistics for the data"""
    try:
        data = request.json
        data_type = data.get('data_type', 'prices')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        funds = data.get('funds')

        result = data_processor.get_statistics(data_type, start_date, end_date, funds)
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/data-info', methods=['GET'])
def get_data_info():
    """Get information about loaded datasets"""
    try:
        info = data_processor.get_data_info()
        return jsonify(info)
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/export', methods=['POST'])
def export_data():
    """Export filtered data as CSV"""
    try:
        data = request.json
        data_type = data.get('data_type', 'prices')
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        funds = data.get('funds')
        
        result = data_processor.export_filtered_data(data_type, start_date, end_date, funds)
        
        if result['success']:
            csv_bytes = io.BytesIO(result['csv_data'].encode('utf-8'))
            
            return send_file(
                csv_bytes,
                mimetype='text/csv',
                as_attachment=True,
                download_name=result['filename']
            )
        else:
            return jsonify(result), 400
            
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/load-sample-data', methods=['POST'])
def load_sample_data():
    """Load sample data with realistic NaN values for demonstration"""
    try:
        # Sample prices data - some early NaN values for newer funds
        sample_prices = """GFund,FFund,CFund,SFund,IFund,Date
10.02,9.97,NaN,NaN,NaN,2003-07-01
10.02,9.97,NaN,NaN,NaN,2003-07-02
10.02,9.94,10.24,NaN,NaN,2003-07-03
10.05,9.99,10.45,10.55,NaN,2003-07-04
10.08,10.02,10.38,10.48,10.58,2003-07-05
10.12,10.05,10.52,10.61,10.71,2003-07-06
10.15,10.08,10.47,10.56,10.66,2003-07-07
10.18,10.11,10.59,10.69,10.79,2003-07-08
10.21,10.14,10.54,10.64,10.74,2003-07-09
10.24,10.17,10.66,10.76,10.86,2003-07-10"""

        # Sample returns data - realistic scenario where newer funds have NaN in early years
        sample_returns = """Year,Month,GFund,FFund,CFund,SFund,IFund,Date
2020,January,0.35,0.85,NaN,NaN,NaN,2020-01-01
2020,February,0.37,1.12,NaN,NaN,NaN,2020-02-01
2020,March,0.39,0.98,2.12,NaN,NaN,2020-03-01
2020,April,0.36,1.25,2.67,NaN,NaN,2020-04-01
2020,May,0.38,1.45,3.45,3.23,NaN,2020-05-01
2020,June,0.34,0.67,1.98,2.34,NaN,2020-06-01
2020,July,0.41,1.78,4.23,6.12,4.34,2020-07-01
2020,August,0.39,1.34,3.67,4.89,4.23,2020-08-01
2021,January,0.42,1.23,2.89,3.67,2.45,2021-01-01
2021,February,0.38,0.98,3.45,4.12,3.67,2021-02-01
2021,March,0.41,1.67,4.23,5.89,5.12,2021-03-01
2021,April,0.39,1.45,3.78,4.56,4.34,2021-04-01
2022,January,0.36,1.14,2.87,3.97,2.01,2022-01-01
2022,February,0.38,0.89,3.23,4.45,3.78,2022-02-01
2023,January,0.35,1.34,4.56,6.78,5.89,2023-01-01
2023,February,0.37,1.12,3.89,5.23,4.67,2023-02-01
2024,January,0.35,0.85,2.45,3.21,1.87,2024-01-01
2024,February,0.37,1.12,1.89,2.76,2.34,2024-02-01
2024,March,0.39,0.98,3.12,4.45,3.21,2024-03-01
2024,April,0.36,1.25,2.67,3.89,2.78,2024-04-01
2024,May,0.38,1.45,3.45,5.23,4.12,2024-05-01
2024,June,0.34,0.67,1.98,2.34,1.56,2024-06-01
2024,July,0.41,1.78,4.23,6.12,5.34,2024-07-01
2024,August,0.39,1.34,3.67,4.89,4.23,2024-08-01
2024,September,0.37,0.89,2.34,3.45,2.67,2024-09-01
2024,October,0.42,1.89,4.56,6.78,5.89,2024-10-01
2024,November,0.36,1.14,5.87,11.97,-0.01,2024-11-01
2024,December,0.36,-1.71,-2.39,-7.05,-2.83,2024-12-01"""

        # Load the sample data
        prices_result = data_processor.load_prices_data_from_string(sample_prices)
        returns_result = data_processor.load_returns_data_from_string(sample_returns)

        return jsonify({
            'success': True,
            'message': 'Sample data with NaN values loaded successfully',
            'prices_result': prices_result,
            'returns_result': returns_result
        })

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting Share Price Analyzer API...")
    print("📊 Backend running on: http://localhost:5000")
    print("🌐 Frontend should be served on: http://localhost:8000")
    print("💡 Enhanced with NaN handling and JSON serialization fixes")
    print("💡 Install requirements: pip install flask flask-cors pandas numpy python-dateutil")
    app.run(debug=True, host='0.0.0.0', port=5000)
