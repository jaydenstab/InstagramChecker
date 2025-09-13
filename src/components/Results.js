import React, { useState, useMemo } from 'react';
import SearchBox from './SearchBox.js';
import './Results.css';

const Results = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = useMemo(() => {
    if (!data?.notFollowingBack) return [];
    
    if (!searchTerm) return data.notFollowingBack;
    
    return data.notFollowingBack.filter(user =>
      user.value.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data?.notFollowingBack, searchTerm]);

  if (!data) return null;

  return (
    <div className="results">
      <p className="counts">
        Total Not Following Back: {data.total || 0}
      </p>
      
      <SearchBox 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />
      
      <ul className="user-list">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user, index) => (
            <li key={index} className="user-item">
              <a
                href={user.href || `https://www.instagram.com/${user.value}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="user-link"
              >
                {user.value}
              </a>
            </li>
          ))
        ) : (
          <li className="no-results">
            {searchTerm ? 'No users found matching your search.' : 'No users found or error occurred.'}
          </li>
        )}
      </ul>
    </div>
  );
};

export default Results;
