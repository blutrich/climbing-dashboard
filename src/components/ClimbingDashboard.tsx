import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart,
  RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar
} from 'recharts';
import DashboardControls from './DashboardControls';
import AdvancedAnalytics from './AdvancedAnalytics';
import { fetchSheetData } from '../utils/googleSheets';
import EmailLogin from './EmailLogin';

interface User {
  email: string;
  firstName: string;
  lastName: string;
}

interface Training {
  email: string;
  date: string;
  where: string;
  type: string;
}

interface Coach {
  email: string;
  firstName: string;
  lastName: string;
  specialties: string[];
  athletes: string[];
}

interface TrainingData {
  monthly_sessions: { month: string; sessions: number }[];
  monthly_active_users: { month: string; users: number }[];
  top_locations: { location: string; sessions: number }[];
  raw_data: {
    users: User[];
    trainings: Training[];
    assessments: Assessment[];
    coaches: Coach[];
  };
}

interface StatCard {
  title: string;
  value: string | number;
  change?: string;
  icon?: string;
}

interface FrequencyMetric {
  userEmail: string;
  userName: string;
  sessionsPerMonth: number;
  totalSessions: number;
  mostActiveDay: string;
  mostActiveTime: string;
  consistencyScore: number;
}

interface CohortMetrics {
  fingerStrength: number[];
  pullUps: number[];
  pushUps: number[];
  toeToBar: number[];
  legSpread: number[];
  sessions: number[];
}

interface MetricKey {
  fingerStrength: string;
  pullUps: string;
  pushUps: string;
  toeToBar: string;
  legSpread: string;
}

interface Metric {
  raw: number;
  normalized: number;
  weight: number;
}

interface Metrics {
  fingerStrength: Metric;
  pullUps: Metric;
  pushUps: Metric;
  toeToBar: Metric;
  legSpread: Metric;
}

interface Assessment {
  email: string;
  date: string;
  type: string;
  score: number;
  notes?: string;
  metrics?: Metrics;
  bodyWeight: number;
  height: number;
}

interface GradeDistribution {
  grade: string;
  count: number;
  percentage: string;
}

interface UserMetrics {
  email: string;
  firstName: string;
  lastName: string;
  currentGrade: string;
  totalSessions: number;
  monthlyTrainings: Record<string, number>;
  lastTrainingDate?: string;
  churnRisk: {
    level: 'low' | 'medium' | 'high';
    reason: string;
  };
  adherenceRate: number;
  progressRate: number;
}

type ChurnRiskLevel = 'low' | 'medium' | 'high';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const ClimbingDashboard = () => {
  const [data, setData] = useState<TrainingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filteredData, setFilteredData] = useState<TrainingData | null>(null);
  const [compareData, setCompareData] = useState<TrainingData | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('userEmail'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [frequencyMetrics, setFrequencyMetrics] = useState<FrequencyMetric[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const sheetData = await fetchSheetData();
        console.log('Loaded sheet data:', sheetData);
        setData(sheetData);
        setFilteredData(sheetData);
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
    if (!data || !email) return;
    console.log('Checking stats for user:', email);

    // For non-admin users, always filter to their own data
    const userToFilter = isAdmin ? email : userEmail;
    if (!userToFilter) return;

    const filtered = {
      ...data,
      raw_data: {
        ...data.raw_data,
        trainings: data.raw_data.trainings.filter(t => 
          email === 'all' ? true : t.email === userToFilter
        ),
        assessments: data.raw_data.assessments.filter(a => 
          email === 'all' ? true : a.email === userToFilter
        )
      }
    };

    // Recalculate monthly sessions and active users
    const monthlySessionsMap = new Map<string, number>();
    const monthlyUsersMap = new Map<string, Set<string>>();
    const locationMap = new Map<string, number>();

    filtered.raw_data.trainings.forEach(training => {
      if (!training.date) return;

      const date = new Date(training.date);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlySessionsMap.set(monthKey, (monthlySessionsMap.get(monthKey) || 0) + 1);

      const usersSet = monthlyUsersMap.get(monthKey) || new Set();
      usersSet.add(training.email);
      monthlyUsersMap.set(monthKey, usersSet);

      if (training.where) {
        locationMap.set(training.where, (locationMap.get(training.where) || 0) + 1);
      }
    });

    filtered.monthly_sessions = Array.from(monthlySessionsMap.entries())
      .map(([month, sessions]) => ({ month, sessions }))
      .sort((a, b) => a.month.localeCompare(b.month));

    filtered.monthly_active_users = Array.from(monthlyUsersMap.entries())
      .map(([month, users]) => ({ month, users: users.size }))
      .sort((a, b) => a.month.localeCompare(b.month));

    filtered.top_locations = Array.from(locationMap.entries())
      .map(([location, sessions]) => ({ location, sessions }))
      .sort((a, b) => b.sessions - a.sessions);

    setFilteredData(filtered);
  };

  const handleDateRangeChange = (startDate: Date | null, endDate: Date | null) => {
    if (!data) return;

    // If no dates selected, show all data
    if (!startDate || !endDate) {
      console.log('No date range selected, showing all data');
      setFilteredData(data);
      return;
    }

    const filtered = {
      ...data,
      raw_data: {
        ...data.raw_data,
        trainings: data.raw_data.trainings.filter(t => {
          const trainingDate = new Date(t.date);
          return trainingDate >= startDate && trainingDate <= endDate;
        }),
        assessments: data.raw_data.assessments.filter(a => {
          const assessmentDate = new Date(a.date);
          return assessmentDate >= startDate && assessmentDate <= endDate;
        })
      }
    };

    // Recalculate monthly sessions and active users
    const monthlySessionsMap = new Map<string, number>();
    const monthlyUsersMap = new Map<string, Set<string>>();
    const locationMap = new Map<string, number>();

    filtered.raw_data.trainings.forEach(training => {
      if (!training.date) return;

      const date = new Date(training.date);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlySessionsMap.set(monthKey, (monthlySessionsMap.get(monthKey) || 0) + 1);

      const usersSet = monthlyUsersMap.get(monthKey) || new Set();
      usersSet.add(training.email);
      monthlyUsersMap.set(monthKey, usersSet);

      if (training.where) {
        locationMap.set(training.where, (locationMap.get(training.where) || 0) + 1);
      }
    });

    filtered.monthly_sessions = Array.from(monthlySessionsMap.entries())
      .map(([month, sessions]) => ({ month, sessions }))
      .sort((a, b) => a.month.localeCompare(b.month));

    filtered.monthly_active_users = Array.from(monthlyUsersMap.entries())
      .map(([month, users]) => ({ month, users: users.size }))
      .sort((a, b) => a.month.localeCompare(b.month));

    filtered.top_locations = Array.from(locationMap.entries())
      .map(([location, sessions]) => ({ location, sessions }))
      .sort((a, b) => b.sessions - a.sessions);

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

  const handleLogin = (email: string) => {
    console.log('Attempting login with email:', email);
    if (!data?.raw_data?.users) {
      console.log('No user data available');
      return;
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    const user = data.raw_data.users.find(u => u.email.toLowerCase() === normalizedEmail);
    
    if (user) {
      console.log('User found:', user);
      setUserEmail(email);
      setIsAuthenticated(true);
      // Set admin role for blutrich@gmail.com
      setIsAdmin(normalizedEmail === 'blutrich@gmail.com');
      localStorage.setItem('userEmail', email);
      handleUserChange(email);
    } else {
      console.log('User not found. Available users:', data.raw_data.users.map(u => u.email));
      setError('Email not found. Please try again.');
    }
  };

  const getUserName = (email: string): string => {
    const user = filteredData?.raw_data?.users.find((u: User) => u.email === email);
    return user ? `${user.firstName} ${user.lastName}` : email;
  };

  const getFrequencyMetrics = (): FrequencyMetric[] => {
    if (!filteredData?.raw_data?.users || !filteredData?.raw_data?.trainings) return [];

    return filteredData.raw_data.users.map((user: User) => {
      const userTrainings = filteredData.raw_data.trainings.filter(t => t.email === user.email);
      const sessionsPerMonth = userTrainings.length / 12; // Simplified calculation
      const totalSessions = userTrainings.length;
      
      // Default values for now
      return {
        userEmail: user.email,
        userName: `${user.firstName} ${user.lastName}`,
        sessionsPerMonth: Math.round(sessionsPerMonth),
        totalSessions,
        mostActiveDay: 'Monday', // Would need actual calculation
        mostActiveTime: 'Evening', // Would need actual calculation
        consistencyScore: Math.round((sessionsPerMonth / 12) * 100) // Simplified score
      };
    });
  };

  useEffect(() => {
    if (data?.raw_data) {
      const metrics = getFrequencyMetrics();
      setFrequencyMetrics(metrics);
    }
  }, [data]);

  const handleLogout = () => {
    setSelectedUser(null);
    // Clear any stored user data
    localStorage.removeItem('selectedUser');
    window.location.reload(); // Refresh to show login screen
  };

  const renderUserDashboard = () => {
    if (!filteredData?.raw_data?.assessments) return null;

    // Get user's assessment history
    const userAssessments: Assessment[] = filteredData.raw_data.assessments
      .filter(a => a.email === userEmail)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const latestAssessment = userAssessments[userAssessments.length - 1];
    if (!latestAssessment) return null;

    // Get cohort data (users at the same grade)
    const cohortAssessments = filteredData.raw_data.assessments
      .filter(a => {
        console.log('Checking assessment:', a.type, 'against', latestAssessment.type);
        return a.type === latestAssessment.type && a.email !== userEmail && a.metrics;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log('Cohort assessments:', cohortAssessments);

    // Calculate cohort metrics
    const calculateCohortStats = (metric: keyof Metrics) => {
      const values = cohortAssessments
        .map(a => {
          const value = a.metrics?.[metric]?.normalized || 0;
          console.log(`${metric} value for ${a.email}:`, value);
          return value;
        })
        .filter(v => v > 0); // Only consider valid measurements
      
      console.log(`${metric} values:`, values);
      
      if (values.length === 0) {
        return {
          avg: 0,
          median: 0,
          max: 0,
          count: 0,
          percentile: (value: number) => 0
        };
      }

      const sorted = [...values].sort((a, b) => a - b);
      return {
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        median: sorted[Math.floor(sorted.length / 2)],
        max: Math.max(...values),
        count: values.length,
        percentile: (value: number) => {
          if (value <= 0) return 0;
          return Math.round((values.filter(v => v <= value).length / values.length) * 100);
        }
      };
    };

    const cohortStats = {
      fingerStrength: calculateCohortStats('fingerStrength'),
      pullUps: calculateCohortStats('pullUps'),
      pushUps: calculateCohortStats('pushUps'),
      toeToBar: calculateCohortStats('toeToBar'),
      legSpread: calculateCohortStats('legSpread')
    };

    console.log('Cohort stats:', cohortStats);

    // Get user's training data
    const userTrainings: Training[] = filteredData.raw_data.trainings
      .filter(t => t.email === userEmail)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate training frequency
    const trainingsByMonth = new Map<string, number>();
    userTrainings.forEach(training => {
      const month = training.date.substring(0, 7); // YYYY-MM
      trainingsByMonth.set(month, (trainingsByMonth.get(month) || 0) + 1);
    });

    // Calculate adherence rate
    const monthlyAdherence = Array.from(trainingsByMonth.entries()).map(([month, sessions]) => ({
      month,
      sessions,
      adherenceRate: Math.min((sessions / 12) * 100, 100) // Assuming 12 sessions per month is ideal
    }));

    // Prepare assessment metrics over time
    const assessmentMetrics = userAssessments.map(assessment => ({
      date: new Date(assessment.date).toLocaleDateString(),
      fingerStrength: assessment.metrics?.fingerStrength.normalized || 0,
      pullUps: assessment.metrics?.pullUps.normalized || 0,
      pushUps: assessment.metrics?.pushUps.normalized || 0,
      toeToBar: assessment.metrics?.toeToBar.normalized || 0,
      legSpread: assessment.metrics?.legSpread.normalized || 0,
      grade: assessment.type
    }));

    // Calculate improvement rates
    const calculateImprovement = (metric: keyof Metrics) => {
      if (userAssessments.length < 2) return 0;
      const first = userAssessments[0].metrics?.[metric]?.normalized || 0;
      const last = latestAssessment.metrics?.[metric]?.normalized || 0;
      return first > 0 ? ((last - first) / first) * 100 : 0;
    };

    const improvements = {
      fingerStrength: calculateImprovement('fingerStrength'),
      pullUps: calculateImprovement('pullUps'),
      pushUps: calculateImprovement('pushUps'),
      toeToBar: calculateImprovement('toeToBar'),
      legSpread: calculateImprovement('legSpread')
    };

    // Calculate training location distribution
    const locationStats = new Map<string, number>();
    userTrainings.forEach(training => {
      locationStats.set(training.where, (locationStats.get(training.where) || 0) + 1);
    });

    const topLocations = Array.from(locationStats.entries())
      .map(([location, count]) => ({
        location,
        sessions: count,
        percentage: (count / userTrainings.length) * 100
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    // Get user's coach information
    const userCoach = filteredData.raw_data.coaches.find(coach => 
      coach.athletes.includes(userEmail || '')
    );

    return (
      <div className="user-dashboard">
        <h2>Your Training Progress</h2>
        
        {/* Coach Information */}
        {userCoach && (
          <div className="coach-info">
            <h3>Your Coach</h3>
            <div className="coach-card">
              <div className="coach-name">
                {userCoach.firstName} {userCoach.lastName}
              </div>
              <div className="coach-specialties">
                <h4>Specialties:</h4>
                <div className="specialty-tags">
                  {userCoach.specialties.map((specialty, index) => (
                    <span key={index} className="specialty-tag">{specialty}</span>
                  ))}
                </div>
              </div>
              <div className="coach-contact">
                <a href={`mailto:${userCoach.email}`}>Contact Coach</a>
              </div>
            </div>
          </div>
        )}

        {/* Current Grade and Stats */}
        <div className="stats-overview">
          <div className="stat-card">
            <h3>Current Grade</h3>
            <div className="stat-value">{latestAssessment.type}</div>
            <div className="stat-detail">Last assessed: {new Date(latestAssessment.date).toLocaleDateString()}</div>
          </div>
          <div className="stat-card">
            <h3>Total Sessions</h3>
            <div className="stat-value">{userTrainings.length}</div>
            <div className="stat-detail">Lifetime total</div>
          </div>
          <div className="stat-card">
            <h3>Monthly Average</h3>
            <div className="stat-value">
              {(monthlyAdherence.reduce((sum, m) => sum + m.sessions, 0) / monthlyAdherence.length || 0).toFixed(1)}
            </div>
            <div className="stat-detail">Sessions per month</div>
          </div>
          <div className="stat-card">
            <h3>Favorite Location</h3>
            <div className="stat-value">{topLocations[0]?.location || 'N/A'}</div>
            <div className="stat-detail">{topLocations[0]?.percentage.toFixed(1)}% of sessions</div>
          </div>
        </div>

        {/* Assessment Progress Chart */}
        <div className="assessment-progress">
          <h3>Assessment Progress Over Time</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={assessmentMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => value.toFixed(2)}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="fingerStrength" 
                  name="Finger Strength" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="pullUps" 
                  name="Pull-ups" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="pushUps" 
                  name="Push-ups" 
                  stroke="#ffc658" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="toeToBar" 
                  name="Toe-to-bar" 
                  stroke="#ff7300" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="legSpread" 
                  name="Leg Spread" 
                  stroke="#a4de6c" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Grade Progress Chart */}
        <div className="grade-progress">
          <h3>Grade Progression</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userAssessments.map(assessment => ({
                date: new Date(assessment.date).toLocaleDateString(),
                grade: assessment.type,
                score: assessment.score
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="stepAfter" 
                  dataKey="grade" 
                  name="Climbing Grade" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  name="Assessment Score" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Training Adherence */}
        <div className="adherence-section">
          <h3>Training Adherence</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={monthlyAdherence}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" label={{ value: 'Sessions', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Adherence %', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="sessions" fill="#8884d8" name="Sessions" />
                <Line yAxisId="right" type="monotone" dataKey="adherenceRate" stroke="#82ca9d" name="Adherence Rate" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Improvement Summary */}
        <div className="improvement-summary">
          <h3>Improvement Since First Assessment</h3>
          <div className="improvement-grid">
            {Object.entries(improvements).map(([metric, improvement]) => (
              <div key={metric} className="improvement-card">
                <h4>{metric.replace(/([A-Z])/g, ' $1').trim()}</h4>
                <div className="improvement-value" style={{ color: improvement >= 0 ? '#22c55e' : '#ef4444' }}>
                  {improvement.toFixed(1)}%
                </div>
                <div className="improvement-bar">
                  <div 
                    className="improvement-fill"
                    style={{ 
                      width: `${Math.min(Math.max(improvement, 0), 100)}%`,
                      backgroundColor: improvement >= 0 ? '#22c55e' : '#ef4444'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Training Locations */}
        <div className="locations-section">
          <h3>Your Training Locations</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topLocations} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="location" type="category" />
                <Tooltip />
                <Legend />
                <Bar dataKey="sessions" fill="#8884d8" name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Training Notes */}
        <div className="training-notes">
          <h3>Latest Assessment Notes</h3>
          <div className="notes-card">
            {latestAssessment.notes}
          </div>
        </div>

        {/* Assessment Comparisons */}
        {userAssessments.length > 1 && (
          <div className="assessment-comparison">
            <h3>Assessment Progress</h3>
            <div className="comparison-grid">
              <div className="comparison-card">
                <h4>First Assessment ({new Date(userAssessments[0].date).toLocaleDateString()})</h4>
                <div className="grade">{userAssessments[0].type}</div>
                <div className="metrics">
                  <div>Finger Strength: {userAssessments[0].metrics?.fingerStrength.normalized.toFixed(2)}</div>
                  <div>Pull-ups: {userAssessments[0].metrics?.pullUps.normalized.toFixed(2)}</div>
                  <div>Push-ups: {userAssessments[0].metrics?.pushUps.normalized.toFixed(2)}</div>
                  <div>Toe-to-bar: {userAssessments[0].metrics?.toeToBar.normalized.toFixed(2)}</div>
                  <div>Leg Spread: {userAssessments[0].metrics?.legSpread.normalized.toFixed(2)}</div>
                </div>
              </div>
              <div className="comparison-card latest">
                <h4>Latest Assessment ({new Date(latestAssessment.date).toLocaleDateString()})</h4>
                <div className="grade">{latestAssessment.type}</div>
                <div className="metrics">
                  <div>Finger Strength: {latestAssessment.metrics?.fingerStrength.normalized.toFixed(2)}</div>
                  <div>Pull-ups: {latestAssessment.metrics?.pullUps.normalized.toFixed(2)}</div>
                  <div>Push-ups: {latestAssessment.metrics?.pushUps.normalized.toFixed(2)}</div>
                  <div>Toe-to-bar: {latestAssessment.metrics?.toeToBar.normalized.toFixed(2)}</div>
                  <div>Leg Spread: {latestAssessment.metrics?.legSpread.normalized.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cohort Comparison */}
        <div className="cohort-comparison">
          <h3>How You Compare - {latestAssessment.type} Grade Climbers</h3>
          <p className="cohort-info">
            {cohortAssessments.length > 0 
              ? `Comparing your metrics with ${cohortAssessments.length} other climbers at your grade`
              : 'No other climbers at your grade level yet for comparison'}
          </p>
          
          {/* Bar Chart for Visual Comparison */}
          <div className="chart-container" style={{ marginBottom: '2rem' }}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={Object.entries(cohortStats).map(([metric, stats]) => {
                  const userValue = latestAssessment.metrics?.[metric as keyof Metrics]?.normalized || 0;
                  const avgValue = stats.avg;
                  const maxValue = stats.max;
                  return {
                    metric: metric.replace(/([A-Z])/g, ' $1').trim(),
                    "Your Score": userValue,
                    "Grade Average": avgValue,
                    "Grade Best": maxValue
                  };
                })}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" angle={-45} textAnchor="end" height={100} />
                <YAxis label={{ value: 'Score', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Your Score" fill="#8884d8" />
                <Bar dataKey="Grade Average" fill="#82ca9d" />
                <Bar dataKey="Grade Best" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="metrics-table">
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Your Score</th>
                  <th>Grade Average</th>
                  <th>Grade Best</th>
                  <th>Your Percentile</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cohortStats).map(([metric, stats]) => {
                  const userValue = latestAssessment.metrics?.[metric as keyof Metrics]?.normalized || 0;
                  const percentile = stats.percentile(userValue);
                  const metricName = metric.replace(/([A-Z])/g, ' $1').trim();
                  return (
                    <tr key={metric}>
                      <td>{metricName}</td>
                      <td>{userValue > 0 ? userValue.toFixed(2) : 'N/A'}</td>
                      <td>{stats.count > 0 ? stats.avg.toFixed(2) : 'N/A'}</td>
                      <td>{stats.count > 0 ? stats.max.toFixed(2) : 'N/A'}</td>
                      <td>
                        {stats.count > 0 ? (
                          <div className="percentile-bar">
                            <div 
                              className="percentile-fill"
                              style={{ 
                                width: `${percentile}%`,
                                backgroundColor: percentile > 75 ? '#22c55e' : 
                                               percentile > 50 ? '#3b82f6' : 
                                               percentile > 25 ? '#f59e0b' : '#ef4444'
                              }}
                            />
                            <span>{percentile}%</span>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAdminDashboard = () => {
    if (!filteredData?.raw_data) return null;

    // Get coach data if the admin is also a coach
    const coachData = filteredData.raw_data.coaches.find(coach => coach.email === userEmail);
    const athleteEmails = coachData ? coachData.athletes : [];

    // Process athletes data with churn risk calculation
    const athletesData: UserMetrics[] = filteredData.raw_data.users
      .filter(user => coachData ? athleteEmails.includes(user.email) : true)
      .map(user => {
        const assessments = filteredData.raw_data.assessments
          .filter(a => a.email === user.email)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const trainings = filteredData.raw_data.trainings
          .filter(t => t.email === user.email)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const latestAssessment = assessments[0];
        const lastTraining = trainings[0];

        // Calculate monthly adherence
        const monthlyTrainings = trainings.reduce((acc, t) => {
          const month = t.date.substring(0, 7);
          acc[month] = (acc[month] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        // Calculate adherence rate (last 3 months)
        const last3Months = Array.from({ length: 3 }, (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - i);
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        });

        const adherenceRate = last3Months.reduce((sum, month) => 
          sum + (monthlyTrainings[month] || 0), 0) / (3 * 12) * 100; // Assuming 12 sessions per month is ideal

        // Calculate progress rate
        const progressRate = assessments.length >= 2 
          ? ((assessments[0].score - assessments[assessments.length - 1].score) / 
             assessments[assessments.length - 1].score) * 100
          : 0;

        // Calculate churn risk
        const lastTrainingDate = lastTraining?.date;
        const daysSinceLastTraining = lastTrainingDate 
          ? Math.floor((new Date().getTime() - new Date(lastTrainingDate).getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;

        let churnRisk: { level: ChurnRiskLevel; reason: string } = {
          level: 'low',
          reason: 'Regular training pattern'
        };

        if (daysSinceLastTraining > 14) {
          churnRisk = {
            level: 'high',
            reason: `No training in ${daysSinceLastTraining} days`
          };
        } else if (adherenceRate < 50) {
          churnRisk = {
            level: 'medium',
            reason: 'Low training adherence'
          };
        } else if (progressRate < 0) {
          churnRisk = {
            level: 'medium',
            reason: 'Negative progress trend'
          };
        }

        return {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          currentGrade: latestAssessment?.type || 'N/A',
          totalSessions: trainings.length,
          monthlyTrainings,
          lastTrainingDate,
          churnRisk,
          adherenceRate,
          progressRate
        };
      });

    // Calculate monthly adherence trends
    const allMonths = new Set<string>();
    athletesData.forEach(athlete => {
      Object.keys(athlete.monthlyTrainings).forEach(month => allMonths.add(month));
    });

    const monthlyAdherenceTrends = Array.from(allMonths)
      .sort()
      .map(month => {
        const activeAthletes = athletesData.filter(a => a.monthlyTrainings[month]).length;
        const avgSessions = athletesData.reduce((sum, a) => sum + (a.monthlyTrainings[month] || 0), 0) / athletesData.length;
        const adherenceRate = (activeAthletes / athletesData.length) * 100;
        
        return {
          month,
          activeAthletes,
          avgSessions,
          adherenceRate,
          totalAthletes: athletesData.length
        };
      });

    // Calculate grade distribution
    interface GradeStats {
      grade: string;
      count: number;
      percentage: string;
    }

    const gradeDistribution = athletesData.reduce((acc, athlete) => {
      if (athlete.currentGrade === 'N/A') return acc;
      acc[athlete.currentGrade] = (acc[athlete.currentGrade] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const gradeChartData: GradeStats[] = (Object.entries(gradeDistribution) as [string, number][])
      .map(([grade, count]) => ({
        grade,
        count,
        percentage: ((count / athletesData.filter(a => a.currentGrade !== 'N/A').length) * 100).toFixed(1)
      }))
      .sort((a: GradeStats, b: GradeStats) => b.count - a.count);

    return (
      <div className="admin-dashboard">
        <div className="dashboard-summary">
          <h2>Program Overview</h2>
          <div className="stats-overview">
            <div className="stat-card">
              <h3>Total Athletes</h3>
              <div className="stat-value">{athletesData.length}</div>
            </div>
            <div className="stat-card">
              <h3>Total Sessions</h3>
              <div className="stat-value">
                {filteredData.raw_data.trainings.length}
              </div>
            </div>
            <div className="stat-card">
              <h3>Avg Sessions/Month</h3>
              <div className="stat-value">
                {(monthlyAdherenceTrends.reduce((sum, m) => sum + m.avgSessions, 0) / 
                  Math.max(monthlyAdherenceTrends.length, 1)).toFixed(1)}
              </div>
            </div>
            <div className="stat-card">
              <h3>Churn Risk</h3>
              <div className="stat-value" style={{ color: '#ef4444' }}>
                {athletesData.filter(a => a.churnRisk.level === 'high').length}
              </div>
              <div className="stat-detail">athletes at risk</div>
            </div>
          </div>

          <div className="charts-container">
            <div className="chart-section">
              <h3>Training Activity Over Time</h3>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={monthlyAdherenceTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" label={{ value: 'Sessions', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Active Athletes', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="avgSessions" fill="#8884d8" name="Avg Sessions per Athlete" />
                  <Line yAxisId="right" type="monotone" dataKey="activeAthletes" stroke="#82ca9d" name="Active Athletes" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-section">
              <h3>Grade Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gradeChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="grade" />
                  <YAxis yAxisId="left" orientation="left" label={{ value: 'Athletes', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'Percentage', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Athletes" />
                  <Line yAxisId="right" type="monotone" dataKey="percentage" stroke="#82ca9d" name="Percentage" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Athletes Table */}
          <div className="athletes-overview">
            <h3>Athletes Overview</h3>
            <div className="athletes-table">
              <table>
                <thead>
                  <tr>
                    <th>Athlete</th>
                    <th>Grade</th>
                    <th>Last Training</th>
                    <th>Monthly Sessions</th>
                    <th>Adherence</th>
                    <th>Progress</th>
                    <th>Churn Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {athletesData.map((athlete, index) => (
                    <tr 
                      key={`${athlete.email}-${index}`}
                      className={athlete.churnRisk.level === 'high' ? 'high-risk' : 
                                athlete.churnRisk.level === 'medium' ? 'medium-risk' : ''}
                    >
                      <td>{athlete.firstName} {athlete.lastName}</td>
                      <td>{athlete.currentGrade}</td>
                      <td>
                        {athlete.lastTrainingDate 
                          ? formatDate(athlete.lastTrainingDate)
                          : 'Never'}
                      </td>
                      <td>
                        {(Object.values(athlete.monthlyTrainings).reduce((a, b) => a + b, 0) / 
                          Math.max(Object.keys(athlete.monthlyTrainings).length, 1)).toFixed(1)}
                      </td>
                      <td>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ 
                              width: `${Math.min(athlete.adherenceRate, 100)}%`,
                              backgroundColor: athlete.adherenceRate >= 75 ? '#22c55e' : 
                                             athlete.adherenceRate >= 50 ? '#eab308' : '#ef4444'
                            }}
                          />
                          <span>{athlete.adherenceRate.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ 
                          color: athlete.progressRate > 0 ? '#22c55e' : 
                                 athlete.progressRate < 0 ? '#ef4444' : '#666'
                        }}>
                          {athlete.progressRate > 0 ? '+' : ''}{athlete.progressRate.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <div className={`risk-badge ${athlete.churnRisk.level}-risk`}>
                          {athlete.churnRisk.level}
                          <span className="risk-tooltip">{athlete.churnRisk.reason}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <h2>Access Your Climbing Data</h2>
        <EmailLogin onSubmit={handleLogin} error={error} />
      </div>
    );
  }

  if (error) return <div className="error">Error loading data: {error}</div>;
  if (!data || !filteredData) return <div className="loading">Loading...</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Climbing Training Dashboard</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      {isAdmin ? (
        <>
          <header className="dashboard-header">
            <h1>Climbing Statistics 2024</h1>
            <DashboardControls
              locations={filteredData?.top_locations.map(l => l.location) || []}
              users={filteredData?.raw_data?.users || []}
              onDateRangeChange={handleDateRangeChange}
              onLocationChange={handleLocationChange}
              onUserChange={handleUserChange}
              onExportData={handleExportData}
              selectedUser={userEmail || 'all'}
              isAdmin={isAdmin}
            />
          </header>
          {renderAdminDashboard()}
        </>
      ) : (
        renderUserDashboard()
      )}
    </div>
  );
};

export default ClimbingDashboard; 