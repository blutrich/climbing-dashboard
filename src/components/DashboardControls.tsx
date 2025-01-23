import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface User {
  email: string;
  firstName: string;
  lastName: string;
}

interface DashboardControlsProps {
  locations: string[];
  users: User[];
  onDateRangeChange: (startDate: Date | null, endDate: Date | null) => void;
  onLocationChange: (location: string) => void;
  onUserChange: (email: string) => void;
  onExportData: () => void;
  selectedUser: string;
  isAdmin: boolean;
}

const DashboardControls = ({
  locations,
  users,
  onDateRangeChange,
  onLocationChange,
  onUserChange,
  onExportData,
  selectedUser,
  isAdmin
}: DashboardControlsProps) => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  const handleDateChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(start);
    setEndDate(end);
    onDateRangeChange(start, end);
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const location = e.target.value;
    setSelectedLocation(location);
    onLocationChange(location);
  };

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUserChange(e.target.value);
  };

  return (
    <div className="dashboard-controls">
      {isAdmin && (
        <div className="control-group">
          <label>User</label>
          <select 
            value={selectedUser}
            onChange={handleUserChange}
            className="user-select"
          >
            <option value="all">All Users</option>
            {users.map(user => (
              <option key={user.email} value={user.email}>
                {user.firstName} {user.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="control-group">
        <label>Date Range</label>
        <DatePicker
          selectsRange
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
          className="date-picker"
          placeholderText="Select date range"
          dateFormat="yyyy/MM/dd"
        />
      </div>

      <div className="control-group">
        <label>Location</label>
        <select 
          value={selectedLocation}
          onChange={handleLocationChange}
          className="location-filter"
        >
          <option value="all">All Locations</option>
          {locations.map(location => (
            <option key={location} value={location}>{location}</option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <button 
          onClick={onExportData}
          className="export-btn"
        >
          Export Data
        </button>
      </div>
    </div>
  );
};

export default DashboardControls; 