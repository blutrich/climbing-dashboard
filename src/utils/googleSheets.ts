const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const API_KEY = 'YOUR_GOOGLE_API_KEY';

interface SheetData {
  range: string;
  values: any[][];
}

export const fetchSheetData = async () => {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/A1:Z1000?key=${API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch data from Google Sheets');
    }

    const data: SheetData = await response.json();
    return transformSheetData(data.values);
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
};

const transformSheetData = (values: any[][]) => {
  const [headers, ...rows] = values;
  
  // Group sessions by month
  const monthlySessionsMap = new Map();
  const monthlyUsersMap = new Map();
  const locationMap = new Map();

  rows.forEach(row => {
    const rowData = headers.reduce((obj: any, header: string, index: number) => {
      obj[header.toLowerCase()] = row[index];
      return obj;
    }, {});

    // Extract month from date
    const date = new Date(rowData.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    // Count sessions per month
    monthlySessionsMap.set(monthKey, (monthlySessionsMap.get(monthKey) || 0) + 1);

    // Count unique users per month
    if (!monthlyUsersMap.has(monthKey)) {
      monthlyUsersMap.set(monthKey, new Set());
    }
    monthlyUsersMap.get(monthKey).add(rowData.email);

    // Count sessions per location
    if (rowData.where) {
      locationMap.set(rowData.where, (locationMap.get(rowData.where) || 0) + 1);
    }
  });

  // Transform data into the format expected by the dashboard
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
    top_locations
  };
}; 