import React from 'react';
import './SortSelector.css';

const SortSelector = ({ sort, onSortChange }) => {
  return (
    <div className="sort-selector">
      <label htmlFor="sort">Sort Not Following Back:</label>
      <select
        id="sort"
        name="sort"
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
      >
        <option value="">Default</option>
        <option value="asc">A → Z</option>
        <option value="desc">Z → A</option>
        <option value="earliest">Earliest</option>
        <option value="latest">Latest</option>
      </select>
    </div>
  );
};

export default SortSelector;
