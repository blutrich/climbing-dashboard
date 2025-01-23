import Papa from 'papaparse';

interface User {
  email: string;
  firstName: string;
  lastName: string;
}

interface Training {
  email: string;
  date: string;
  where: string;
  [key: string]: any;
}

interface Assessment {
  email: string;
  date: string;
  type: string;
  score: number;
  [key: string]: any;
}

interface Plan {
  email: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  [key: string]: any;
}

interface UserPlanMetrics {
  activePlan: Plan | null;
  completedPlans: Plan[];
  adherenceRate: number;
  successRate: number;
  assessmentProgress: {
    beforePlan: number;
    afterPlan: number;
    improvement: number;
  };
}

export const fetchLocalData = async () => {
  try {
    console.log('Fetching local data...');
    
    const fileNames = {
      users: encodeURIComponent('[Glide] ClimbingPill App - Users (1).csv'),
      trainings1: encodeURIComponent('[Glide] ClimbingPill App - Copy of Trainings.csv'),
      trainings2: encodeURIComponent('[Glide] ClimbingPill App - Trainings (2).csv'),
      assessments: encodeURIComponent('[Glide] ClimbingPill App - Assessments (1).csv'),
      plans: encodeURIComponent('[Glide] ClimbingPill App - Plans (1).csv')
    };

    // Fetch all CSV files
    const [usersResponse, trainings1Response, trainings2Response, assessmentsResponse, plansResponse] = await Promise.all([
      fetch(`/${fileNames.users}`),
      fetch(`/${fileNames.trainings1}`),
      fetch(`/${fileNames.trainings2}`),
      fetch(`/${fileNames.assessments}`),
      fetch(`/${fileNames.plans}`)
    ]);

    if (!usersResponse.ok) {
      throw new Error(`Failed to fetch users data: ${usersResponse.statusText}`);
    }

    console.log('CSV responses received:', {
      users: usersResponse.ok,
      trainings1: trainings1Response.ok,
      trainings2: trainings2Response.ok,
      assessments: assessmentsResponse.ok,
      plans: plansResponse.ok
    });

    const [usersText, trainings1Text, trainings2Text, assessmentsText, plansText] = await Promise.all([
      usersResponse.text(),
      trainings1Response.text(),
      trainings2Response.text(),
      assessmentsResponse.text(),
      plansResponse.text()
    ]);

    // Parse CSV files with better error handling
    const parseOptions = {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        // Remove any special characters and convert to camelCase
        return header
          .replace(/🔒\s?/g, '')  // Remove lock emoji
          .trim()
          .toLowerCase()
          .replace(/\s+(.)/g, (_, c) => c.toUpperCase());
      }
    };

    const users = Papa.parse(usersText, parseOptions).data
      .filter((user: any) => user && user.email) // Only keep users with valid email
      .map((user: any) => ({
        email: user.email?.trim(),
        firstName: user.firstName || user.firstname || '',
        lastName: user.lastName || user.lastname || ''
      }));

    console.log('Parsed users:', users.slice(0, 5));  // Log first 5 users

    const trainings1 = Papa.parse(trainings1Text, parseOptions).data as Training[];
    const trainings2 = Papa.parse(trainings2Text, parseOptions).data as Training[];
    const assessments = Papa.parse(assessmentsText, parseOptions).data as Assessment[];
    const plans = Papa.parse(plansText, parseOptions).data as Plan[];

    // Combine training data
    const trainings = [...trainings1, ...trainings2].filter(t => t.date && t.email);

    // Process data
    const monthlySessionsMap = new Map<string, number>();
    const monthlyUsersMap = new Map<string, Set<string>>();
    const locationMap = new Map<string, number>();
    const userAssessments = new Map<string, {
      latest: Assessment | null;
      history: Assessment[];
      progress: { [key: string]: { current: number; change: number } };
    }>();
    const userPlans = new Map<string, UserPlanMetrics>();

    // Process plans first
    plans.forEach(plan => {
      if (!plan.email || !plan.startDate || !plan.endDate) return;

      const userEmail = plan.email;
      if (!userPlans.has(userEmail)) {
        userPlans.set(userEmail, {
          activePlan: null,
          completedPlans: [],
          adherenceRate: 0,
          successRate: 0,
          assessmentProgress: {
            beforePlan: 0,
            afterPlan: 0,
            improvement: 0
          }
        });
      }

      const planData = userPlans.get(userEmail)!;
      const planEndDate = new Date(plan.endDate);
      const now = new Date();

      if (planEndDate > now && (!planData.activePlan || new Date(plan.startDate) > new Date(planData.activePlan.startDate))) {
        planData.activePlan = plan;
      } else if (planEndDate <= now) {
        planData.completedPlans.push(plan);
      }
    });

    // Process assessments
    assessments.forEach(assessment => {
      if (!assessment.email || !assessment.date) return;

      const userEmail = assessment.email;
      if (!userAssessments.has(userEmail)) {
        userAssessments.set(userEmail, {
          latest: null,
          history: [],
          progress: {}
        });
      }

      const userAssessmentData = userAssessments.get(userEmail)!;
      userAssessmentData.history.push(assessment);

      // Update latest assessment
      if (!userAssessmentData.latest || new Date(assessment.date) > new Date(userAssessmentData.latest.date)) {
        userAssessmentData.latest = assessment;
      }

      // Calculate progress
      if (assessment.type && assessment.score) {
        const prevScore = userAssessmentData.progress[assessment.type]?.current || 0;
        userAssessmentData.progress[assessment.type] = {
          current: assessment.score,
          change: assessment.score - prevScore
        };
      }

      // Update plan assessment progress
      const userPlanData = userPlans.get(userEmail);
      if (userPlanData && userPlanData.completedPlans.length > 0) {
        const relevantPlan = userPlanData.completedPlans[userPlanData.completedPlans.length - 1];
        const assessmentDate = new Date(assessment.date);
        const planStartDate = new Date(relevantPlan.startDate);
        const planEndDate = new Date(relevantPlan.endDate);

        if (assessmentDate < planStartDate) {
          userPlanData.assessmentProgress.beforePlan = assessment.score;
        } else if (assessmentDate > planEndDate) {
          userPlanData.assessmentProgress.afterPlan = assessment.score;
          userPlanData.assessmentProgress.improvement = 
            ((userPlanData.assessmentProgress.afterPlan - userPlanData.assessmentProgress.beforePlan) / 
            userPlanData.assessmentProgress.beforePlan) * 100;
        }
      }
    });

    // Process training data and calculate plan adherence
    trainings.forEach(training => {
      const date = new Date(training.date);
      if (isNaN(date.getTime())) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      monthlySessionsMap.set(monthKey, (monthlySessionsMap.get(monthKey) || 0) + 1);
      
      if (!monthlyUsersMap.has(monthKey)) {
        monthlyUsersMap.set(monthKey, new Set());
      }
      monthlyUsersMap.get(monthKey)?.add(training.email);

      if (training.where) {
        locationMap.set(training.where, (locationMap.get(training.where) || 0) + 1);
      }

      // Calculate plan adherence
      const userPlanData = userPlans.get(training.email);
      if (userPlanData && userPlanData.completedPlans.length > 0) {
        userPlanData.completedPlans.forEach(plan => {
          const planStartDate = new Date(plan.startDate);
          const planEndDate = new Date(plan.endDate);
          
          if (date >= planStartDate && date <= planEndDate) {
            userPlanData.adherenceRate = calculateAdherenceRate(trainings, plan);
            userPlanData.successRate = calculateSuccessRate(userPlanData.assessmentProgress.improvement);
          }
        });
      }
    });

    // Convert maps to sorted arrays
    const monthly_sessions = Array.from(monthlySessionsMap.entries())
      .map(([month, sessions]) => ({ month, sessions }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const monthly_active_users = Array.from(monthlyUsersMap.entries())
      .map(([month, users]) => ({ month, users: users.size }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const top_locations = Array.from(locationMap.entries())
      .map(([location, sessions]) => ({ location, sessions }))
      .sort((a, b) => b.sessions - a.sessions);

    return {
      monthly_sessions,
      monthly_active_users,
      top_locations,
      raw_data: {
        users,
        trainings,
        assessments,
        plans
      },
      user_assessments: Object.fromEntries(userAssessments),
      user_plans: Object.fromEntries(userPlans)
    };
  } catch (error) {
    console.error('Error loading data:', error);
    throw new Error('Failed to load data');
  }
};

function calculateAdherenceRate(trainings: Training[], plan: Plan): number {
  const planStartDate = new Date(plan.startDate);
  const planEndDate = new Date(plan.endDate);
  
  const planDuration = Math.ceil((planEndDate.getTime() - planStartDate.getTime()) / (1000 * 60 * 60 * 24));
  const expectedSessions = Math.floor(planDuration / 7) * 3; // Assuming 3 sessions per week is ideal
  
  const actualSessions = trainings.filter(t => {
    const trainingDate = new Date(t.date);
    return trainingDate >= planStartDate && trainingDate <= planEndDate && t.email === plan.email;
  }).length;

  return Math.min((actualSessions / expectedSessions) * 100, 100);
}

function calculateSuccessRate(improvement: number): number {
  // Simple success rate based on improvement
  if (improvement >= 20) return 100; // Excellent improvement
  if (improvement >= 10) return 75;  // Good improvement
  if (improvement >= 5) return 50;   // Moderate improvement
  if (improvement >= 0) return 25;   // Minimal improvement
  return 0;                          // No improvement or decline
} 