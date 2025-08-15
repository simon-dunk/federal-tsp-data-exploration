// Global variables and configuration
const API_BASE_URL = 'http://localhost:5000/api';
let chart = null;
let selectedFunds = new Set(['GFund', 'FFund', 'CFund', 'SFund', 'IFund']);
let dataLoaded = { prices: false, returns: false };

// Fund colors
const fundColors = {
    'GFund': '#2196f3',
    'FFund': '#4caf50',
    'CFund': '#ff9800',
    'SFund': '#f44336',
    'IFund': '#9c27b0'
};

// Initialize the application
function init() {
    setupFileUploads();
    setupFundSelection();
    initializeChart();
    setupEventListeners();
    refreshDataInfo();
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('dataType').addEventListener('change', updateChart);
    document.getElementById('startDate').addEventListener('change', updateChart);
    document.getElementById('endDate').addEventListener('change', updateChart);
    document.getElementById('chartType').addEventListener('change', updateChart);
}

// Setup file upload handlers
function setupFileUploads() {
    setupFileUpload('pricesFile', 'pricesUpload', uploadPricesFile);
    setupFileUpload('returnsFile', 'returnsUpload', uploadReturnsFile);
}

function setupFileUpload(fileInputId, uploadAreaId, handler) {
    const fileInput = document.getElementById(fileInputId);
    const uploadArea = document.getElementById(uploadAreaId);

    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handler(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handler(e.target.files[0]);
        }
    });
}

// API Functions
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        showLoading(true);
        
        const options = {
            method: method,
            headers: {}
        };

        if (data instanceof FormData) {
            options.body = data;
        } else if (data) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'API request failed');
        }
        
        return result;
    } catch (error) {
        showNotification(`Error: ${error.message}`, 'error');
        throw error;
    } finally {
        showLoading(false);
    }
}

// Upload functions
async function uploadPricesFile(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const result = await apiCall('/upload/prices', 'POST', formData);
        
        if (result.success) {
            dataLoaded.prices = true;
            showNotification('Prices data loaded successfully!', 'success');
            await refreshDataInfo();
            await updateChart();
        } else {
            showNotification(`Error loading prices: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error uploading prices file:', error);
    }
}

async function uploadReturnsFile(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const result = await apiCall('/upload/returns', 'POST', formData);
        
        if (result.success) {
            dataLoaded.returns = true;
            showNotification('Returns data loaded successfully!', 'success');
            await refreshDataInfo();
            await updateChart();
        } else {
            showNotification(`Error loading returns: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error uploading returns file:', error);
    }
}

// Load sample data
async function loadSampleData() {
    try {
        const result = await apiCall('/load-sample-data', 'POST');
        
        if (result.success) {
            dataLoaded.prices = true;
            dataLoaded.returns = true;
            showNotification('Sample data loaded successfully!', 'success');
            await refreshDataInfo();
            await updateChart();
        } else {
            showNotification(`Error loading sample data: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error loading sample data:', error);
    }
}

// Refresh data info display
async function refreshDataInfo() {
    try {
        const info = await apiCall('/data-info');
        updateDataInfoDisplay(info);
    } catch (error) {
        console.error('Error refreshing data info:', error);
    }
}

function updateDataInfoDisplay(info) {
    const dataInfoCard = document.getElementById('dataInfoCard');
    const dataInfoGrid = document.getElementById('dataInfoGrid');
    
    if (!info.prices_loaded && !info.returns_loaded) {
        dataInfoCard.style.display = 'none';
        return;
    }
    
    dataInfoCard.style.display = 'block';
    dataInfoGrid.innerHTML = '';
    
    if (info.prices_loaded && info.prices_info) {
        const pricesCard = document.createElement('div');
        pricesCard.className = 'data-info-card';
        pricesCard.innerHTML = `
            <h4>📈 Prices Data</h4>
            <div class="info-item">
                <span class="info-label">Records:</span>
                <span class="info-value">${info.prices_info.record_count}</span>
            </div>
            <div class="info-item">
                <span class="info-label">From:</span>
                <span class="info-value">${new Date(info.prices_info.date_range.start).toLocaleDateString()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">To:</span>
                <span class="info-value">${new Date(info.prices_info.date_range.end).toLocaleDateString()}</span>
            </div>
        `;
        dataInfoGrid.appendChild(pricesCard);
        
        // Update date inputs
        updateDateInputs(info.prices_info.date_range);
    }
    
    if (info.returns_loaded && info.returns_info) {
        const returnsCard = document.createElement('div');
        returnsCard.className = 'data-info-card';
        returnsCard.innerHTML = `
            <h4>📊 Returns Data</h4>
            <div class="info-item">
                <span class="info-label">Records:</span>
                <span class="info-value">${info.returns_info.record_count}</span>
            </div>
            <div class="info-item">
                <span class="info-label">From:</span>
                <span class="info-value">${new Date(info.returns_info.date_range.start).toLocaleDateString()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">To:</span>
                <span class="info-value">${new Date(info.returns_info.date_range.end).toLocaleDateString()}</span>
            </div>
        `;
        dataInfoGrid.appendChild(returnsCard);
    }
}

function updateDateInputs(dateRange) {
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    // Set min/max values
    startDateInput.min = startDate.toISOString().split('T')[0];
    startDateInput.max = endDate.toISOString().split('T')[0];
    endDateInput.min = startDate.toISOString().split('T')[0];
    endDateInput.max = endDate.toISOString().split('T')[0];
    
    // Set default values if not already set
    if (!startDateInput.value) {
        startDateInput.value = startDate.toISOString().split('T')[0];
    }
    if (!endDateInput.value) {
        endDateInput.value = endDate.toISOString().split('T')[0];
    }
}

// Setup fund selection checkboxes
function setupFundSelection() {
    const container = document.getElementById('fundSelection');
    const funds = ['GFund', 'FFund', 'CFund', 'SFund', 'IFund'];
    
    container.innerHTML = '';
    funds.forEach(fund => {
        const label = document.createElement('label');
        label.className = 'fund-checkbox checked';
        label.innerHTML = `
            <input type="checkbox" value="${fund}" checked>
            <span style="color: ${fundColors[fund]}">${fund}</span>
        `;
        
        const checkbox = label.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedFunds.add(fund);
                label.classList.add('checked');
            } else {
                selectedFunds.delete(fund);
                label.classList.remove('checked');
            }
            updateChart();
        });
        
        container.appendChild(label);
    });
}

// Initialize chart
function initializeChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    Chart.defaults.color = '#e0e0e0';
    Chart.defaults.borderColor = '#444';
    
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        color: '#e0e0e0'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(42, 42, 42, 0.95)',
                    titleColor: '#e0e0e0',
                    bodyColor: '#e0e0e0',
                    borderColor: '#444',
                    borderWidth: 1,
                    cornerRadius: 6,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: {
                            day: 'MMM dd',
                            month: 'MMM yyyy'
                        }
                    },
                    grid: {
                        color: '#444'
                    },
                    ticks: {
                        color: '#b0b0b0'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: '#b0b0b0'
                    }
                },
                y: {
                    grid: {
                        color: '#444'
                    },
                    ticks: {
                        color: '#b0b0b0'
                    },
                    title: {
                        display: true,
                        text: 'Value',
                        color: '#b0b0b0'
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Update chart with current data and filters
async function updateChart() {
    try {
        const dataType = document.getElementById('dataType').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const chartType = document.getElementById('chartType').value;
        
        // Check if relevant data is loaded
        if ((dataType === 'prices' && !dataLoaded.prices) || 
            (dataType === 'returns' && !dataLoaded.returns)) {
            showNotification(`No ${dataType} data loaded. Please upload a CSV file first.`, 'warning');
            return;
        }
        
        // Get chart data from API
        const chartData = await apiCall('/chart-data', 'POST', {
            data_type: dataType,
            start_date: startDate,
            end_date: endDate,
            funds: Array.from(selectedFunds)
        });
        
        if (!chartData.success) {
            showNotification(`Error getting chart data: ${chartData.message}`, 'error');
            return;
        }
        
        // Update chart title
        document.getElementById('chartTitle').textContent = 
            `📈 ${dataType === 'prices' ? 'Share Price' : 'Return Rate'} Analysis`;
        
        // Prepare datasets for Chart.js
        const datasets = chartData.data.datasets.map(dataset => ({
            ...dataset,
            fill: chartType === 'area',
            tension: 0.1,
            pointRadius: 2,
            pointHoverRadius: 6,
            borderWidth: 2,
            pointBackgroundColor: dataset.borderColor,
            pointBorderColor: dataset.borderColor
        }));
        
        // Update chart
        chart.data.labels = chartData.data.labels;
        chart.data.datasets = datasets;
        
        // Update Y-axis title
        chart.options.scales.y.title.text = dataType === 'prices' ? 'Price ($)' : 'Return Rate (%)';
        
        chart.update();
        
        // Update statistics
        await updateStatistics();
        
    } catch (error) {
        console.error('Error updating chart:', error);
        showNotification('Error updating chart. Please try again.', 'error');
    }
}

// Update statistics display
async function updateStatistics() {
    try {
        const dataType = document.getElementById('dataType').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        const statsData = await apiCall('/statistics', 'POST', {
            data_type: dataType,
            start_date: startDate,
            end_date: endDate,
            funds: Array.from(selectedFunds)
        });
        
        if (!statsData.success) {
            document.getElementById('statsGrid').innerHTML = 
                '<div class="error">Error loading statistics</div>';
            return;
        }
        
        const statsContainer = document.getElementById('statsGrid');
        statsContainer.innerHTML = '';
        
        if (Object.keys(statsData.statistics).length === 0) {
            statsContainer.innerHTML = '<div class="loading">No data available for selected range</div>';
            return;
        }
        
        // Create stat cards for each fund
        selectedFunds.forEach(fund => {
            if (statsData.statistics[fund]) {
                const stats = statsData.statistics[fund];
                const statCard = document.createElement('div');
                statCard.className = 'stat-card';
                
                const current = stats.current;
                const change = stats.change;
                const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
                const changeSymbol = change > 0 ? '+' : '';
                
                statCard.innerHTML = `
                    <div class="stat-label">${fund}</div>
                    <div class="stat-value" style="color: ${fundColors[fund]}">
                        ${dataType === 'prices' ? '$' + current.toFixed(2) : current.toFixed(2) + '%'}
                    </div>
                    <div class="stat-value ${changeClass}" style="font-size: 0.9em; margin-top: 5px;">
                        ${changeSymbol}${change.toFixed(2)}${dataType === 'prices' ? '' : '%'}
                    </div>
                    <div style="font-size: 0.7em; color: var(--text-muted); margin-top: 5px;">
                        Range: ${stats.min.toFixed(2)} - ${stats.max.toFixed(2)}
                    </div>
                `;
                
                statsContainer.appendChild(statCard);
            }
        });
        
    } catch (error) {
        console.error('Error updating statistics:', error);
        document.getElementById('statsGrid').innerHTML = 
            '<div class="error">Error loading statistics</div>';
    }
}

// Reset all filters
function resetFilters() {
    // Reset fund selection
    selectedFunds = new Set(['GFund', 'FFund', 'CFund', 'SFund', 'IFund']);
    setupFundSelection();
    
    // Reset other controls
    document.getElementById('dataType').value = 'prices';
    document.getElementById('chartType').value = 'line';
    
    // Reset date ranges to full range
    refreshDataInfo().then(() => {
        updateChart();
        showNotification('Filters reset successfully!', 'success');
    });
}

// Export chart as PNG
function exportChart() {
    if (!chart) {
        showNotification('No chart available to export', 'error');
        return;
    }

    try {
        const link = document.createElement('a');
        const dataType = document.getElementById('dataType').value;
        link.download = `${dataType}_chart_${new Date().toISOString().split('T')[0]}.png`;
        link.href = chart.toBase64Image('image/png', 1.0);
        link.click();
        
        showNotification('Chart exported successfully!', 'success');
    } catch (error) {
        console.error('Error exporting chart:', error);
        showNotification('Error exporting chart', 'error');
    }
}

// Export filtered data as CSV
async function exportData() {
    try {
        const dataType = document.getElementById('dataType').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        // Check if relevant data is loaded
        if ((dataType === 'prices' && !dataLoaded.prices) || 
            (dataType === 'returns' && !dataLoaded.returns)) {
            showNotification(`No ${dataType} data loaded to export`, 'warning');
            return;
        }
        
        showLoading(true);
        
        const response = await fetch(`${API_BASE_URL}/export`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data_type: dataType,
                start_date: startDate,
                end_date: endDate,
                funds: Array.from(selectedFunds)
            })
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        // Handle file download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${dataType}_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
        
        showNotification('Data exported successfully!', 'success');
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showNotification('Error exporting data', 'error');
    } finally {
        showLoading(false);
    }
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; margin-left: 10px;">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

// Enhanced statistics update function - Add this to your existing main.js
async function updateStatistics() {
    try {
        const dataType = document.getElementById('dataType').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        const statsData = await apiCall('/statistics', 'POST', {
            data_type: dataType,
            start_date: startDate,
            end_date: endDate,
            funds: Array.from(selectedFunds)
        });
        
        if (!statsData.success) {
            document.getElementById('statsGrid').innerHTML = 
                '<div class="error">Error loading statistics</div>';
            return;
        }
        
        const statsContainer = document.getElementById('statsGrid');
        statsContainer.innerHTML = '';
        
        if (Object.keys(statsData.statistics).length === 0) {
            statsContainer.innerHTML = '<div class="loading">No data available for selected range</div>';
            return;
        }
        
        // Create stat cards for each fund
        selectedFunds.forEach(fund => {
            if (statsData.statistics[fund]) {
                const stats = statsData.statistics[fund];
                const statCard = document.createElement('div');
                statCard.className = 'stat-card';
                
                // Handle null/undefined values for funds with no data
                if (stats.current === null || stats.current === undefined) {
                    statCard.innerHTML = `
                        <div class="stat-label">${fund}</div>
                        <div class="stat-value neutral" style="color: ${fundColors[fund]}">
                            No Data
                        </div>
                        <div style="font-size: 0.7em; color: var(--text-muted); margin-top: 5px;">
                            ${stats.data_coverage}% coverage
                        </div>
                    `;
                } else {
                    const current = stats.current;
                    const change = stats.change || 0;
                    const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
                    const changeSymbol = change > 0 ? '+' : '';
                    
                    statCard.innerHTML = `
                        <div class="stat-label">${fund}</div>
                        <div class="stat-value" style="color: ${fundColors[fund]}">
                            ${dataType === 'prices' ? '$' + current.toFixed(2) : current.toFixed(2) + '%'}
                        </div>
                        <div class="stat-value ${changeClass}" style="font-size: 0.9em; margin-top: 5px;">
                            ${changeSymbol}${change.toFixed(2)}${dataType === 'prices' ? '' : '%'}
                        </div>
                        <div style="font-size: 0.7em; color: var(--text-muted); margin-top: 5px;">
                            Coverage: ${stats.data_coverage}% (${stats.count}/${stats.total_periods})
                        </div>
                        ${stats.min !== null ? `
                        <div style="font-size: 0.7em; color: var(--text-muted); margin-top: 2px;">
                            Range: ${stats.min.toFixed(2)} - ${stats.max.toFixed(2)}
                        </div>
                        ` : ''}
                    `;
                }
                
                statsContainer.appendChild(statCard);
            }
        });
        
    } catch (error) {
        console.error('Error updating statistics:', error);
        document.getElementById('statsGrid').innerHTML = 
            '<div class="error">Error loading statistics</div>';
    }
}

// Enhanced data info display - Add this to your existing main.js
function updateDataInfoDisplay(info) {
    const dataInfoCard = document.getElementById('dataInfoCard');
    const dataInfoGrid = document.getElementById('dataInfoGrid');
    
    if (!info.prices_loaded && !info.returns_loaded) {
        dataInfoCard.style.display = 'none';
        return;
    }
    
    dataInfoCard.style.display = 'block';
    dataInfoGrid.innerHTML = '';
    
    if (info.prices_loaded && info.prices_info) {
        const pricesCard = document.createElement('div');
        pricesCard.className = 'data-info-card';
        
        let fundAvailabilityHTML = '';
        if (info.prices_info.fund_availability) {
            fundAvailabilityHTML = '<div style="margin-top: 10px;"><strong>Fund Coverage:</strong>';
            Object.entries(info.prices_info.fund_availability).forEach(([fund, availability]) => {
                const coverageClass = availability.coverage_percentage >= 80 ? 'success' : 
                                    availability.coverage_percentage >= 50 ? 'warning' : 'error';
                fundAvailabilityHTML += `
                    <div style="display: flex; justify-content: space-between; margin: 2px 0; font-size: 0.8em;">
                        <span style="color: ${fundColors[fund]}">${fund}:</span>
                        <span class="stat-value ${coverageClass}" style="font-size: 0.8em;">
                            ${availability.coverage_percentage}%
                        </span>
                    </div>
                `;
            });
            fundAvailabilityHTML += '</div>';
        }
        
        pricesCard.innerHTML = `
            <h4>📈 Prices Data</h4>
            <div class="info-item">
                <span class="info-label">Records:</span>
                <span class="info-value">${info.prices_info.record_count}</span>
            </div>
            <div class="info-item">
                <span class="info-label">From:</span>
                <span class="info-value">${new Date(info.prices_info.date_range.start).toLocaleDateString()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">To:</span>
                <span class="info-value">${new Date(info.prices_info.date_range.end).toLocaleDateString()}</span>
            </div>
            ${fundAvailabilityHTML}
        `;
        dataInfoGrid.appendChild(pricesCard);
        
        // Update date inputs
        updateDateInputs(info.prices_info.date_range);
    }
    
    if (info.returns_loaded && info.returns_info) {
        const returnsCard = document.createElement('div');
        returnsCard.className = 'data-info-card';
        
        let fundAvailabilityHTML = '';
        if (info.returns_info.fund_availability) {
            fundAvailabilityHTML = '<div style="margin-top: 10px;"><strong>Fund Coverage:</strong>';
            Object.entries(info.returns_info.fund_availability).forEach(([fund, availability]) => {
                const coverageClass = availability.coverage_percentage >= 80 ? 'success' : 
                                    availability.coverage_percentage >= 50 ? 'warning' : 'error';
                
                let dateRangeInfo = '';
                if (availability.first_data_date && availability.last_data_date) {
                    const firstDate = new Date(availability.first_data_date).getFullYear();
                    const lastDate = new Date(availability.last_data_date).getFullYear();
                    dateRangeInfo = ` (${firstDate}-${lastDate})`;
                }
                
                fundAvailabilityHTML += `
                    <div style="display: flex; justify-content: space-between; margin: 2px 0; font-size: 0.8em;">
                        <span style="color: ${fundColors[fund]}">${fund}${dateRangeInfo}:</span>
                        <span class="stat-value ${coverageClass}" style="font-size: 0.8em;">
                            ${availability.coverage_percentage}%
                        </span>
                    </div>
                `;
            });
            fundAvailabilityHTML += '</div>';
        }
        
        returnsCard.innerHTML = `
            <h4>📊 Returns Data</h4>
            <div class="info-item">
                <span class="info-label">Records:</span>
                <span class="info-value">${info.returns_info.record_count}</span>
            </div>
            <div class="info-item">
                <span class="info-label">From:</span>
                <span class="info-value">${new Date(info.returns_info.date_range.start).toLocaleDateString()}</span>
            </div>
            <div class="info-item">
                <span class="info-label">To:</span>
                <span class="info-value">${new Date(info.returns_info.date_range.end).toLocaleDateString()}</span>
            </div>
            ${fundAvailabilityHTML}
        `;
        dataInfoGrid.appendChild(returnsCard);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', function() {
    init();
});
