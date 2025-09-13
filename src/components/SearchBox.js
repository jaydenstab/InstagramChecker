import React from 'react';
import './SearchBox.css';

const SearchBox = ({ searchTerm, onSearchChange }) => {
  return (
    <input
      type="text"
      className="search-box"
      placeholder="Search username..."
      value={searchTerm}
      onChange={(e) => onSearchChange(e.target.value)}
    />
  );
};

export default SearchBox;
