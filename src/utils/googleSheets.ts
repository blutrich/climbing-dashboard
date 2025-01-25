const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

interface Training {
  email: string;
  date: string;
  where: string;
  type: string;
}

interface Plan {
  email: string;
  date: string;
  type: string;
  status: string;
  completion_rate?: number;
  schedule?: { [day: string]: string };
}

interface Assessment {
  email: string;
  date: string;
  type: string;
  score: number;
  notes?: string;
  metrics?: {
    fingerStrength: { raw: number; normalized: number; weight: number };
    pullUps: { raw: number; normalized: number; weight: number };
    pushUps: { raw: number; normalized: number; weight: number };
    toeToBar: { raw: number; normalized: number; weight: number };
    legSpread: { raw: number; normalized: number; weight: number };
  };
  bodyWeight: number;
  height: number;
}

interface User {
  email: string;
  firstName: string;
  lastName: string;
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

export const fetchSheetData = async (): Promise<TrainingData> => {
  if (!SHEET_ID || !API_KEY) {
    throw new Error('Google Sheets configuration missing');
  }

  console.log('Fetching data from Google Sheets...');
  
  try {
    const sheetsAPI = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`;
    const ranges = [
      'Users!A:Z',
      'Trainings!A:Z',
      'Copy of Trainings!A:Z',  // Add second training sheet
      'Assessments!A:Z',
      'Coaches!A:Z'
    ];

    const responses = await Promise.all(
      ranges.map(range => 
        fetch(`${sheetsAPI}/${range}?key=${API_KEY}`)
          .then(response => response.json())
      )
    );

    const [usersData, trainings1Data, trainings2Data, assessmentsData, coachesData] = responses.map(r => r.values || []);

    const users = transformUsers(usersData);
    const trainings1 = transformTrainings(trainings1Data);
    const trainings2 = transformTrainings(trainings2Data);
    const trainings = [...trainings1, ...trainings2].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const assessments = transformAssessments(assessmentsData);
    const coaches = transformCoaches(coachesData);

    console.log(`Loaded ${trainings1.length} trainings from sheet 1 and ${trainings2.length} trainings from sheet 2`);
    return transformData(trainings, users, assessments, coaches);
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
};

const transformUsers = (data: any[]): User[] => {
  if (data.length < 2) return [];
  const [headers, ...rows] = data;
  
  return rows.map(row => {
    const record: any = {};
    headers.forEach((header: string, index: number) => {
      const key = header.replace(/🔒\s?/g, '').trim();
      record[key] = row[index];
    });
    return {
      email: record['Email']?.toLowerCase().trim() || '',
      firstName: record['First Name'] || '',
      lastName: record['Last Name'] || ''
    };
  }).filter(user => user.email);
};

const transformTrainings = (data: any[]): Training[] => {
  if (data.length < 2) return [];
  const [headers, ...rows] = data;
  
  return rows.map(row => {
    const record: any = {};
    headers.forEach((header: string, index: number) => {
      const key = header.replace(/🔒\s?/g, '').trim();
      record[key] = row[index];
    });
    return {
      email: record['Email']?.toLowerCase().trim() || '',
      date: record['Date'] || '',
      where: record['Where'] || '',
      type: record['Completed'] || ''  // Using 'Completed' as type
    };
  }).filter(training => training.email && training.date);
};

const transformPlans = (data: any[]): Plan[] => {
  if (data.length < 2) return [];
  const [headers, ...rows] = data;
  
  return rows.map(row => {
    const record: any = {};
    headers.forEach((header: string, index: number) => {
      const key = header.replace(/🔒\s?/g, '').trim();
      record[key] = row[index];
    });

    // Get the weekly schedule
    const weeklySchedule = {
      Sunday: record['Sunday'] || '',
      Monday: record['Monday'] || '',
      Tuesday: record['Tuesday'] || '',
      Wednesday: record['Wednesday'] || '',
      Thursday: record['Thursday'] || '',
      Friday: record['Friday'] || '',
      Saturday: record['Saturday'] || ''
    };

    // Calculate completion rate based on filled days
    const totalDays = Object.values(weeklySchedule).filter(day => day && day !== '-').length;
    const completionRate = (totalDays / 7) * 100;

    // Generate plan type based on the activities scheduled
    const activities = new Set(Object.values(weeklySchedule).filter(day => day && day !== '-'));
    const planType = Array.from(activities).join(', ');

    return {
      email: record['Email']?.toLowerCase().trim() || '',
      date: record['Plan_Date'] || '',
      type: planType || 'Rest Week',
      status: record['is_authorized_plan'] === 'true' ? 'Authorized' : 'Pending',
      completion_rate: completionRate,
      schedule: weeklySchedule  // Adding schedule to the plan data
    };
  }).filter(plan => plan.email && plan.date);
};

const transformAssessments = (data: any[]): Assessment[] => {
  if (data.length < 2) return [];
  const [headers, ...rows] = data;
  
  return rows.map(row => {
    const record: any = {};
    headers.forEach((header: string, index: number) => {
      const key = header.replace(/🔒\s?/g, '').trim();
      record[key] = row[index];
    });

    // Parse raw values with proper defaults
    const fingerStrengthWeight = parseFloat(record['Finger Strength Weight']) || 0;
    const bodyWeight = parseFloat(record['Weight']) || 70; // Default weight if not provided
    const height = parseFloat(record['Height']) || 170; // Default height in cm if not provided
    const pullUps = parseFloat(record['Pull Up Repetitions']) || 0;
    const pushUps = parseFloat(record['Push Up Repetitions']) || 0;
    const toeToBar = parseFloat(record['Toe To bar Repetitions']) || 0;
    const legSpread = parseFloat(record['Legs Spread']) || 0;

    // Ensure we have valid values before normalization
    const validBodyWeight = bodyWeight > 0 ? bodyWeight : 70;
    const validHeight = height > 0 ? height : 170;

    // Normalize values according to body weight and height
    // Finger Strength: (Weight Added + Body Weight) / Body Weight
    // If no added weight, use 0.5 as minimum normalized value (able to hang own body weight)
    const normalizedFingerStrength = fingerStrengthWeight === 0 ? 
      0.5 : (fingerStrengthWeight + validBodyWeight) / validBodyWeight;
    
    // Upper body strength metrics normalized to body weight
    // Minimum values: able to do at least 1 rep
    const normalizedPullUps = Math.max(0.01, pullUps / validBodyWeight);
    const normalizedPushUps = Math.max(0.02, pushUps / validBodyWeight);
    
    // Core strength normalized to body weight
    // Minimum value: able to do at least 1 rep
    const normalizedToeToBar = Math.max(0.01, toeToBar / validBodyWeight);
    
    // Flexibility normalized to height
    // Minimum value: able to spread legs at least 30% of height
    const normalizedLegSpread = Math.max(0.3, legSpread / validHeight);

    // Calculate composite score with proper weights
    // Weights are adjusted based on importance in climbing performance
    const compositeScore = 
      (0.45 * normalizedFingerStrength) +  // Finger strength is most important
      (0.20 * normalizedPullUps) +         // Pull-ups second most important
      (0.10 * normalizedPushUps) +         // Push-ups for antagonist balance
      (0.15 * normalizedToeToBar) +        // Core strength
      (0.10 * normalizedLegSpread);        // Flexibility

    // Store raw and normalized values for detailed analysis
    const metrics = {
      fingerStrength: {
        raw: fingerStrengthWeight,
        normalized: normalizedFingerStrength,
        weight: 0.45
      },
      pullUps: {
        raw: pullUps,
        normalized: normalizedPullUps,
        weight: 0.20
      },
      pushUps: {
        raw: pushUps,
        normalized: normalizedPushUps,
        weight: 0.10
      },
      toeToBar: {
        raw: toeToBar,
        normalized: normalizedToeToBar,
        weight: 0.15
      },
      legSpread: {
        raw: legSpread,
        normalized: normalizedLegSpread,
        weight: 0.10
      }
    };

    // Determine grade based on composite score
    let grade = 'V4';
    if (compositeScore > 1.45) grade = 'V12';
    else if (compositeScore > 1.3) grade = 'V11';
    else if (compositeScore > 1.15) grade = 'V10';
    else if (compositeScore > 1.05) grade = 'V9';
    else if (compositeScore > 0.95) grade = 'V8';
    else if (compositeScore > 0.85) grade = 'V7';
    else if (compositeScore > 0.75) grade = 'V6';
    else if (compositeScore > 0.65) grade = 'V5';

    // Generate training recommendations based on normalized values
    const weaknesses = [];
    if (normalizedFingerStrength < 0.8) weaknesses.push('Finger strength needs improvement');
    if (normalizedPullUps < 0.4) weaknesses.push('Upper body strength needs work');
    if (normalizedToeToBar < 0.3) weaknesses.push('Core strength could be improved');
    if (normalizedLegSpread < 0.5) weaknesses.push('Flexibility should be increased');

    return {
      email: record['Email']?.toLowerCase().trim() || '',
      date: record['Assessment Date'] || '',
      type: grade,
      score: compositeScore,
      metrics: metrics, // Include detailed metrics in the assessment
      bodyWeight: bodyWeight,
      height: height,
      notes: `Grade: ${grade}. Composite Score: ${compositeScore.toFixed(2)}. ${weaknesses.join('. ')}`
    };
  }).filter(assessment => assessment.email && assessment.date);
};

const transformCoaches = (data: any[]): Coach[] => {
  if (data.length < 2) return [];
  const [headers, ...rows] = data;
  
  return rows.map(row => {
    const record: any = {};
    headers.forEach((header: string, index: number) => {
      const key = header.replace(/🔒\s?/g, '').trim();
      record[key] = row[index];
    });
    
    return {
      email: record['Email']?.toLowerCase().trim() || '',
      firstName: record['First Name'] || '',
      lastName: record['Last Name'] || '',
      specialties: (record['Specialties'] || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      athletes: (record['Athletes'] || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    };
  }).filter(coach => coach.email);
};

const transformData = (
  trainings: Training[],
  users: User[],
  assessments: Assessment[],
  coaches: Coach[]
): TrainingData => {
  // Group sessions by month
  const monthlySessionsMap = new Map<string, number>();
  const monthlyUsersMap = new Map<string, Set<string>>();
  const locationMap = new Map<string, number>();

  trainings.forEach(training => {
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

  // Convert maps to sorted arrays
  const monthly_sessions = Array.from(monthlySessionsMap.entries())
    .map(([month, sessions]) => ({ month, sessions }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const monthly_active_users = Array.from(monthlyUsersMap.entries())
    .map(([month, usersSet]) => ({ month, users: usersSet.size }))
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
      coaches
    }
  };
}; 