import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area
} from 'recharts';

interface Assessment {
  date: string;
  type: string;
  score: number;
}

interface Plan {
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  adherenceRate: number;
  successRate: number;
}

interface UserProgressProps {
  userName: string;
  assessmentHistory: Assessment[];
  completedPlans: Plan[];
  assessmentProgress: {
    beforePlan: number;
    afterPlan: number;
    improvement: number;
  };
}

const UserProgress: React.FC<UserProgressProps> = ({
  userName,
  assessmentHistory,
  completedPlans,
  assessmentProgress
}) => {
  // Group assessments by type for progress tracking
  const assessmentsByType = assessmentHistory.reduce((acc: { [key: string]: Assessment[] }, assessment) => {
    if (!acc[assessment.type]) {
      acc[assessment.type] = [];
    }
    acc[assessment.type].push(assessment);
    return acc;
  }, {});

  // Calculate improvement percentages for each assessment type
  const improvementData = Object.entries(assessmentsByType).map(([type, assessments]) => {
    const sorted = assessments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = sorted[0]?.score || 0;
    const last = sorted[sorted.length - 1]?.score || 0;
    const improvement = first ? ((last - first) / first) * 100 : 0;

    return {
      type,
      improvement,
      assessments: sorted
    };
  });

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 100) return '#22c55e'; // Excellent
    if (rate >= 75) return '#3b82f6';  // Good
    if (rate >= 50) return '#eab308';  // Moderate
    if (rate >= 25) return '#f97316';  // Minimal
    return '#ef4444';                  // No improvement
  };

  return (
    <div className="user-progress">
      <h2>{userName}'s Progress Dashboard</h2>
      
      {/* Assessment Progress Over Time */}
      <div className="progress-section">
        <h3>Assessment Progress</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={assessmentHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              {Object.keys(assessmentsByType).map((type, index) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey="score"
                  data={assessmentsByType[type]}
                  name={type}
                  stroke={`hsl(${index * 60}, 70%, 50%)`}
                  dot={{ r: 4 }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Improvement Summary */}
      <div className="improvement-section">
        <h3>Improvement Summary</h3>
        <div className="improvement-grid">
          {improvementData.map(({ type, improvement }) => (
            <div key={type} className="improvement-card">
              <h4>{type}</h4>
              <div className="improvement-value" style={{ color: getSuccessRateColor(improvement) }}>
                {improvement.toFixed(1)}%
              </div>
              <div className="improvement-bar">
                <div 
                  className="improvement-fill"
                  style={{ 
                    width: `${Math.min(Math.max(improvement, 0), 100)}%`,
                    backgroundColor: getSuccessRateColor(improvement)
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Training Plans History */}
      <div className="plans-section">
        <h3>Training Plans History</h3>
        <div className="plans-grid">
          {completedPlans.map((plan, index) => (
            <div key={index} className="plan-card">
              <div className="plan-header">
                <h4>{plan.type}</h4>
                <span className="plan-dates">
                  {new Date(plan.startDate).toLocaleDateString()} - {new Date(plan.endDate).toLocaleDateString()}
                </span>
              </div>
              <div className="plan-metrics">
                <div className="metric">
                  <label>Adherence Rate</label>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${plan.adherenceRate}%`,
                        backgroundColor: getSuccessRateColor(plan.adherenceRate)
                      }}
                    />
                    <span>{plan.adherenceRate.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="metric">
                  <label>Success Rate</label>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${plan.successRate}%`,
                        backgroundColor: getSuccessRateColor(plan.successRate)
                      }}
                    />
                    <span>{plan.successRate}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overall Progress Summary */}
      <div className="summary-section">
        <h3>Overall Progress</h3>
        <div className="summary-grid">
          <div className="summary-card">
            <h4>Before Plan</h4>
            <div className="summary-value">{assessmentProgress.beforePlan}</div>
          </div>
          <div className="summary-card">
            <h4>After Plan</h4>
            <div className="summary-value">{assessmentProgress.afterPlan}</div>
          </div>
          <div className="summary-card">
            <h4>Total Improvement</h4>
            <div 
              className="summary-value"
              style={{ color: getSuccessRateColor(assessmentProgress.improvement) }}
            >
              {assessmentProgress.improvement.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProgress; 