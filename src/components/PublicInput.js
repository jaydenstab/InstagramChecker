import React from 'react';
import './PublicInput.css';

const PublicInput = ({ username, onUsernameChange }) => {
  return (
    <div className="public-input">
      <label htmlFor="username">Instagram Username:</label>
      <input
        type="text"
        id="username"
        name="username"
        value={username}
        onChange={(e) => onUsernameChange(e.target.value)}
        placeholder="e.g., your.username"
        required
      />
    </div>
  );
};

export default PublicInput;
