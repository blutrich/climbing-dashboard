import React from 'react';
import { useMemo } from 'react';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area
} from 'recharts';

interface AnalyticsProps {
  monthlyData: Array<{ month: string; sessions: number; users: number }>;
  locationData: Array<{ location: string; sessions: number }>;
}

const AdvancedAnalytics = ({ monthlyData, locationData }: AnalyticsProps) => {
  // Calculate growth rates and trends
  const trends = useMemo(() => {
    const growthRates = monthlyData.slice(1).map((curr, index) => ({
      month: curr.month,
      sessionGrowth: ((curr.sessions - monthlyData[index].sessions) / monthlyData[index].sessions) * 100,
      userGrowth: ((curr.users - monthlyData[index].users) / monthlyData[index].users) * 100,
      id: `${curr.month}-growth`
    }));

    return growthRates;
  }, [monthlyData]);

  // Calculate user engagement metrics
  const engagementMetrics = useMemo(() => {
    return monthlyData.map(month => ({
      month: month.month,
      sessionsPerUser: month.users ? month.sessions / month.users : 0,
      totalSessions: month.sessions,
      activeUsers: month.users,
      id: `${month.month}-engagement`
    }));
  }, [monthlyData]);

  // Calculate location utilization
  const locationUtilization = useMemo(() => {
    const totalSessions = locationData.reduce((sum, loc) => sum + loc.sessions, 0);
    return locationData.map(loc => ({
      location: loc.location,
      sessions: loc.sessions,
      utilizationRate: (loc.sessions / totalSessions) * 100,
      id: `${loc.location}-utilization`
    }));
  }, [locationData]);

  // Key Insights Section
  const averageSessionsPerUser = engagementMetrics.length > 0 
    ? (engagementMetrics.reduce((sum, m) => sum + m.sessionsPerUser, 0) / engagementMetrics.length).toFixed(1)
    : '0.0';

  const mostUtilizedLocation = locationData.length > 0
    ? locationData.reduce((prev, curr) => prev.sessions > curr.sessions ? prev : curr).location
    : 'N/A';

  const latestGrowthTrend = trends.length > 0
    ? trends[trends.length - 1]?.sessionGrowth.toFixed(1)
    : '0.0';

  return (
    <div className="advanced-analytics">
      <h2>Advanced Analytics</h2>
      
      <div className="analytics-grid">
        {/* Growth Trends */}
        <div className="chart-container">
          <h3>Monthly Growth Rates</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis label={{ value: 'Growth Rate (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sessionGrowth" fill="#8884d8" name="Session Growth %" key="sessionGrowth" />
              <Bar dataKey="userGrowth" fill="#82ca9d" name="User Growth %" key="userGrowth" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* User Engagement Analysis */}
        <div className="chart-container">
          <h3>User Engagement Metrics</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={engagementMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="left" label={{ value: 'Sessions', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Sessions per User', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="totalSessions" fill="#8884d8" stroke="#8884d8" name="Total Sessions" key="totalSessions" />
              <Bar yAxisId="right" dataKey="sessionsPerUser" fill="#ff7300" name="Sessions per User" key="sessionsPerUser" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Location Analysis */}
        <div className="chart-container">
          <h3>Location Utilization Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={locationUtilization}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="location" angle={-45} textAnchor="end" height={100} />
              <YAxis label={{ value: 'Utilization Rate (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="utilizationRate" fill="#82ca9d" name="Utilization Rate %" key="utilizationRate" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Session Distribution */}
        <div className="chart-container">
          <h3>Sessions vs Users Correlation</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={engagementMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="activeUsers" name="Active Users" 
                     label={{ value: 'Active Users', position: 'bottom' }} />
              <YAxis dataKey="totalSessions" name="Total Sessions"
                     label={{ value: 'Total Sessions', angle: -90, position: 'insideLeft' }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Legend />
              <Bar dataKey="totalSessions" name="Monthly Distribution" fill="#8884d8" key="monthlyDistribution" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Key Insights Section */}
      <div className="insights-section">
        <h3>Key Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>Growth Trends</h4>
            <p>
              {Number(latestGrowthTrend) > 0 
                ? `Positive growth of ${latestGrowthTrend}% in recent sessions`
                : 'No growth trend available'}
            </p>
          </div>
          <div className="insight-card">
            <h4>User Engagement</h4>
            <p>
              Average sessions per user: {averageSessionsPerUser}
            </p>
          </div>
          <div className="insight-card">
            <h4>Location Insights</h4>
            <p>
              Most utilized location: {mostUtilizedLocation}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedAnalytics; 