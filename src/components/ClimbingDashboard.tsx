import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import DashboardControls from './DashboardControls';
import AdvancedAnalytics from './AdvancedAnalytics';
import { fetchLocalData } from '../utils/localData';
import EmailLogin from './EmailLogin';

interface User {
  email: string;
  firstName: string;
  lastName: string;
}

interface TrainingData {
  monthly_sessions: Array<{ month: string; sessions: number }>;
  top_locations: Array<{ location: string; sessions: number }>;
  monthly_active_users: Array<{ month: string; users: number }>;
  raw_data?: {
    users: User[];
    trainings: any[];
  };
}

interface StatCard {
  title: string;
  value: string | number;
  change?: string;
  icon?: string;
}

interface FrequencyMetrics {
  userEmail: string;
  userName: string;
  sessionsPerMonth: number;
  totalSessions: number;
  mostActiveDay: string;
  mostActiveTime: string;
  consistencyScore: number;
  dayFrequency: { [key: string]: number };
  timeFrequency: { [key: string]: number };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const ClimbingDashboard = () => {
  const [data, setData] = useState<TrainingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filteredData, setFilteredData] = useState<TrainingData | null>(null);
  const [compareData, setCompareData] = useState<TrainingData | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [frequencyMetrics, setFrequencyMetrics] = useState<FrequencyMetrics[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const localData = await fetchLocalData();
        setData(localData);
        setFilteredData(localData);
      } catch (error) {
        console.error('Error loading data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load data');
      }
    };

    loadData();
  }, []);

  const locations = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.top_locations.map(item => item.location)));
  }, [data]);

  const users = useMemo(() => {
    if (!data?.raw_data?.users) return [];
    return data.raw_data.users;
  }, [data]);

  const filterDataByUser = (email: string, baseData: TrainingData) => {
    if (email === 'all') return baseData;

    const userTrainings = baseData.raw_data?.trainings.filter(t => t.email === email) || [];
    
    // Group sessions by month
    const monthlySessionsMap = new Map();
    const locationMap = new Map();

    userTrainings.forEach(training => {
      if (!training.date) return;

      const date = new Date(training.date);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlySessionsMap.set(monthKey, (monthlySessionsMap.get(monthKey) || 0) + 1);

      if (training.where) {
        locationMap.set(training.where, (locationMap.get(training.where) || 0) + 1);
      }
    });

    return {
      ...baseData,
      monthly_sessions: Array.from(monthlySessionsMap.entries())
        .map(([month, sessions]) => ({ month, sessions }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      top_locations: Array.from(locationMap.entries())
        .map(([location, sessions]) => ({ location, sessions }))
        .sort((a, b) => b.sessions - a.sessions),
      monthly_active_users: Array.from(monthlySessionsMap.entries())
        .map(([month]) => ({ month, users: 1 }))
    };
  };

  const handleUserChange = (email: string) => {
    setSelectedUser(email);
    if (!data) return;
    
    const filtered = filterDataByUser(email, data);
    setFilteredData(filtered);
  };

  const handleDateRangeChange = (startDate: Date | null, endDate: Date | null) => {
    if (!data || !startDate || !endDate) {
      setFilteredData(data);
      return;
    }

    const filtered = {
      ...data,
      monthly_sessions: data.monthly_sessions.filter(item => {
        const itemDate = new Date(item.month);
        return itemDate >= startDate && itemDate <= endDate;
      }),
      monthly_active_users: data.monthly_active_users.filter(item => {
        const itemDate = new Date(item.month);
        return itemDate >= startDate && itemDate <= endDate;
      })
    };
    setFilteredData(filtered);
  };

  const handleLocationChange = (location: string) => {
    if (!data || location === 'all') {
      setFilteredData(data);
      return;
    }

    const filtered = {
      ...data,
      top_locations: data.top_locations.filter(item => item.location === location)
    };
    setFilteredData(filtered);
  };

  const handleExportData = () => {
    if (!filteredData) return;

    const csvData = [
      ['Month', 'Sessions', 'Active Users'],
      ...filteredData.monthly_sessions.map((item, index) => [
        item.month,
        item.sessions,
        filteredData.monthly_active_users[index]?.users || 0
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'climbing_stats.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleEmailSubmit = (email: string) => {
    console.log('Attempting login with email:', email);
    
    if (!data?.raw_data?.users) {
      console.log('No user data available');
      setError('Unable to verify email at this time. Please try again later.');
      return;
    }

    // Log the first few users to check data structure
    console.log('Sample users:', data.raw_data.users.slice(0, 3));

    // Check if the email exists in users data
    const userExists = data.raw_data.users.some(user => {
      if (!user || !user.email) {
        console.log('Invalid user object:', user);
        return false;
      }
      const matches = user.email.toLowerCase() === email.toLowerCase();
      console.log(`Comparing ${user.email} with ${email}: ${matches}`);
      return matches;
    });

    if (userExists) {
      console.log('User found, authenticating...');
      setUserEmail(email);
      setIsAuthenticated(true);
      setError(null);
      handleUserChange(email); // Automatically filter data for this user
    } else {
      console.log('User not found');
      setError('Email not found. Please try again.');
    }
  };

  const calculateFrequencyMetrics = (trainings: any[], users: User[]): FrequencyMetrics[] => {
    const metrics: { [key: string]: FrequencyMetrics } = {};
    
    trainings.forEach(training => {
      if (!training.email || !training.date) return;
      
      if (!metrics[training.email]) {
        const user = users.find(u => u.email === training.email);
        metrics[training.email] = {
          userEmail: training.email,
          userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          sessionsPerMonth: 0,
          totalSessions: 0,
          mostActiveDay: '',
          mostActiveTime: '',
          consistencyScore: 0,
          dayFrequency: {},
          timeFrequency: {},
        };
      }
      
      const date = new Date(training.date);
      if (isNaN(date.getTime())) return;
      
      metrics[training.email].totalSessions++;
      
      // Track day and time frequency
      const day = date.toLocaleDateString('en-US', { weekday: 'long' });
      const hour = date.getHours();
      const timeSlot = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
      
      metrics[training.email].dayFrequency[day] = (metrics[training.email].dayFrequency[day] || 0) + 1;
      metrics[training.email].timeFrequency[timeSlot] = (metrics[training.email].timeFrequency[timeSlot] || 0) + 1;
    });
    
    // Calculate final metrics
    return Object.values(metrics).map(metric => {
      const monthsActive = new Set(
        trainings
          .filter(t => t.email === metric.userEmail)
          .map(t => new Date(t.date).toISOString().slice(0, 7))
      ).size;
      
      return {
        ...metric,
        sessionsPerMonth: monthsActive ? +(metric.totalSessions / monthsActive).toFixed(1) : 0,
        mostActiveDay: Object.entries(metric.dayFrequency || {})
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        mostActiveTime: Object.entries(metric.timeFrequency || {})
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A',
        consistencyScore: calculateConsistencyScore(metric.totalSessions, monthsActive),
      };
    });
  };

  const calculateConsistencyScore = (totalSessions: number, monthsActive: number): number => {
    if (!monthsActive) return 0;
    // Score based on average sessions per month (0-100)
    const avgSessionsPerMonth = totalSessions / monthsActive;
    return Math.min(Math.round((avgSessionsPerMonth / 12) * 100), 100); // Assuming 12 sessions/month is ideal
  };

  useEffect(() => {
    if (data?.raw_data) {
      const metrics = calculateFrequencyMetrics(data.raw_data.trainings, data.raw_data.users);
      setFrequencyMetrics(metrics);
    }
  }, [data]);

  const handleLogout = () => {
    setSelectedUser(null);
    // Clear any stored user data
    localStorage.removeItem('selectedUser');
    window.location.reload(); // Refresh to show login screen
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <h2>Access Your Climbing Data</h2>
        <EmailLogin onSubmit={handleEmailSubmit} error={error} />
      </div>
    );
  }

  // Restrict user selection if not an admin
  const isAdmin = userEmail === 'blutrich@gmail.com';
  const allowedUsers = isAdmin ? users : users.filter(user => user.email === userEmail);

  if (error) return <div className="error">Error loading data: {error}</div>;
  if (!data || !filteredData) return <div className="loading">Loading...</div>;

  const totalSessions = filteredData.monthly_sessions.reduce((acc, curr) => acc + curr.sessions, 0);
  const totalUsers = filteredData.monthly_active_users.reduce((acc, curr) => Math.max(acc, curr.users), 0);
  const avgSessionsPerMonth = Math.round(totalSessions / filteredData.monthly_sessions.length);

  const statCards: StatCard[] = [
    {
      title: 'Total Sessions',
      value: totalSessions,
      change: '+12% vs last year'
    },
    {
      title: 'Active Users',
      value: totalUsers,
      change: '+8% vs last year'
    },
    {
      title: 'Avg Sessions/Month',
      value: avgSessionsPerMonth
    },
    {
      title: 'Most Popular Location',
      value: filteredData.top_locations[0]?.location || 'N/A'
    }
  ];

  const renderAdminSection = () => {
    if (!isAdmin) return null;

    return (
      <div className="admin-section">
        <h2>Admin Dashboard</h2>
        <div className="frequency-metrics-table">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Sessions/Month</th>
                <th>Total Sessions</th>
                <th>Most Active Day</th>
                <th>Preferred Time</th>
                <th>Consistency Score</th>
              </tr>
            </thead>
            <tbody>
              {frequencyMetrics.map((metric) => (
                <tr key={metric.userEmail}>
                  <td>{metric.userName}</td>
                  <td>{metric.sessionsPerMonth}</td>
                  <td>{metric.totalSessions}</td>
                  <td>{metric.mostActiveDay}</td>
                  <td>{metric.mostActiveTime}</td>
                  <td>
                    <div className="consistency-score">
                      <div 
                        className="score-bar" 
                        style={{ width: `${metric.consistencyScore}%` }}
                      />
                      <span>{metric.consistencyScore}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Climbing Training Dashboard</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
      <header className="dashboard-header">
        <h1>Climbing Statistics 2024</h1>
        <DashboardControls
          locations={locations}
          users={allowedUsers}
          onDateRangeChange={handleDateRangeChange}
          onLocationChange={handleLocationChange}
          onUserChange={handleUserChange}
          onExportData={handleExportData}
          selectedUser={selectedUser}
          isAdmin={isAdmin}
        />
      </header>

      <div className="stat-cards">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card">
            <h3>{card.title}</h3>
            <div className="stat-value">{card.value}</div>
            {card.change && <div className="stat-change">{card.change}</div>}
          </div>
        ))}
      </div>
      
      <div className="charts-grid">
        <div className="chart-container">
          <h2>Monthly Training Sessions</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredData.monthly_sessions}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="sessions"
                stroke="#8884d8"
                name="Training Sessions"
              />
              {compareData && (
                <Line
                  type="monotone"
                  data={compareData.monthly_sessions}
                  dataKey="sessions"
                  stroke="#82ca9d"
                  name="Comparison User"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h2>Training Locations Distribution</h2>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={filteredData.top_locations.slice(0, 5)}
                dataKey="sessions"
                nameKey="location"
                cx="50%"
                cy="50%"
                outerRadius={150}
                label
              >
                {filteredData.top_locations.slice(0, 5).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h2>Top Training Locations</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={filteredData.top_locations} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="location" type="category" width={150} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="sessions"
                fill="#82ca9d"
                name="Training Sessions"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h2>Monthly Active Users</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredData.monthly_active_users}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="users"
                stroke="#ff7300"
                name="Active Users"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {renderAdminSection()}

      {/* Advanced Analytics Section */}
      <AdvancedAnalytics
        monthlyData={filteredData.monthly_sessions.map((item, index) => ({
          month: item.month,
          sessions: item.sessions,
          users: filteredData.monthly_active_users[index]?.users || 0
        }))}
        locationData={filteredData.top_locations}
      />
    </div>
  );
};

export default ClimbingDashboard; 