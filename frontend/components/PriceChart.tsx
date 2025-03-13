'use client';

import React, { useEffect, useState } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';

interface PriceHistoryPoint {
  timestamp: string;
  priceUSD: number;
  change24h: number;
  volume24h: number;
  marketCapUSD: number;
  source: string;
}

interface PriceHistoryData {
  symbol: string;
  chainId: number;
  chainName: string;
  history: PriceHistoryPoint[];
}

interface PriceChartProps {
  symbol: string;
  chainId: number;
  days?: number;
}

const PriceChart: React.FC<PriceChartProps> = ({ symbol, chainId, days = 7 }) => {
  const [priceData, setPriceData] = useState<PriceHistoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/tokenPriceHistory?symbol=${symbol.toLowerCase()}&chainId=${chainId}&days=${days}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch price history: ${response.statusText}`);
        }
        
        const data = await response.json();
        setPriceData(data);
      } catch (err) {
        console.error('Error fetching price history:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch price history');
      } finally {
        setLoading(false);
      }
    };

    if (symbol && chainId) {
      fetchPriceHistory();
    }
  }, [symbol, chainId, days]);

  // Format data for the chart
  const formatChartData = (data: PriceHistoryData | null) => {
    if (!data || !data.history || data.history.length === 0) {
      return [];
    }

    return data.history.map(point => ({
      date: format(new Date(point.timestamp), 'MMM dd'),
      price: point.priceUSD,
      volume: point.volume24h / 1000000, // Convert to millions for display
      timestamp: point.timestamp,
      fullPrice: point.priceUSD.toFixed(6),
      fullVolume: point.volume24h.toLocaleString(),
      change: point.change24h,
    })).reverse(); // Reverse to show oldest to newest
  };

  const chartData = formatChartData(priceData);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded shadow-lg border border-gray-700">
          <p className="text-gray-300">{`${label}`}</p>
          <p className="text-green-400">{`Price: $${payload[0].payload.fullPrice}`}</p>
          {payload[0].payload.fullVolume && (
            <p className="text-blue-400">{`Volume: $${payload[0].payload.fullVolume}`}</p>
          )}
          {payload[0].payload.change && (
            <p className={payload[0].payload.change >= 0 ? "text-green-400" : "text-red-400"}>
              {`24h Change: ${payload[0].payload.change.toFixed(2)}%`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  if (!priceData || !priceData.history || priceData.history.length === 0) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">No data: </strong>
        <span className="block sm:inline">No price history available for this token.</span>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 p-4 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-white mb-4">
        {priceData.symbol.toUpperCase()} Price Chart ({priceData.chainName})
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="date" stroke="#999" />
            <YAxis 
              stroke="#999"
              domain={['auto', 'auto']}
              tickFormatter={(value) => `$${value.toFixed(2)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="price" 
              name="Price (USD)" 
              stroke="#10b981" 
              activeDot={{ r: 8 }} 
              strokeWidth={2}
            />
            {chartData[0]?.volume && (
              <Line 
                type="monotone" 
                dataKey="volume" 
                name="Volume (M)" 
                stroke="#3b82f6" 
                strokeWidth={1} 
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between mt-4">
        <div className="text-white">
          <span className="text-gray-400">Current Price: </span>
          <span className="font-bold">${chartData[chartData.length - 1]?.fullPrice || 'N/A'}</span>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => days !== 7 && window.location.search = `?days=7`}
            className={`px-2 py-1 rounded ${days === 7 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            7D
          </button>
          <button 
            onClick={() => days !== 30 && window.location.search = `?days=30`}
            className={`px-2 py-1 rounded ${days === 30 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            30D
          </button>
          <button 
            onClick={() => days !== 90 && window.location.search = `?days=90`}
            className={`px-2 py-1 rounded ${days === 90 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            90D
          </button>
        </div>
      </div>
    </div>
  );
};

export default PriceChart; 