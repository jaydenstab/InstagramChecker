import React, { useState } from 'react';
import PublicInput from './PublicInput.js';
import PrivateInput from './PrivateInput.js';
import SortSelector from './SortSelector.js';
import './Form.css';

const Form = ({ onSubmit, onLoadingChange }) => {
  const [accountType, setAccountType] = useState('public');
  const [username, setUsername] = useState('');
  const [followersFile, setFollowersFile] = useState(null);
  const [followingFile, setFollowingFile] = useState(null);
  const [sort, setSort] = useState('');

  const handleAccountTypeChange = (e) => {
    setAccountType(e.target.value);
    // Reset form data when switching account types
    setUsername('');
    setFollowersFile(null);
    setFollowingFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (accountType === 'public' && !username.trim()) {
      alert('Please enter a username for public accounts.');
      return;
    }

    if (accountType === 'private' && (!followersFile || !followingFile)) {
      alert('Please upload both JSON files for private accounts.');
      return;
    }

    // Set loading state
    onLoadingChange(true);

    // Create FormData
    const formData = new FormData();
    formData.append('accountType', accountType);
    
    if (accountType === 'public') {
      formData.append('username', username);
    } else {
      formData.append('followers', followersFile);
      formData.append('following', followingFile);
    }

    // Add sort parameter to URL if specified
    const url = sort ? `/upload?sort=${sort}` : '/upload';
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred');
      }

      onSubmit(data);
    } catch (err) {
      onSubmit(null, err.message);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="account-type-section">
        <label>Account Type:</label>
        <div className="radio-group">
          <label className="radio-label">
            <input 
              type="radio" 
              name="accountType" 
              value="public" 
              checked={accountType === 'public'}
              onChange={handleAccountTypeChange}
            />
            Public
          </label>
          <label className="radio-label">
            <input 
              type="radio" 
              name="accountType" 
              value="private"
              checked={accountType === 'private'}
              onChange={handleAccountTypeChange}
            />
            Private
          </label>
        </div>
      </div>

      {accountType === 'public' ? (
        <div>
          <PublicInput 
            username={username}
            onUsernameChange={setUsername}
          />
          <div className="notice-box">
            <p><strong>⚠️ Note:</strong> Public account scraping may return limited or mock data due to Instagram's anti-automation measures. For accurate results, use the private account option with JSON files.</p>
          </div>
        </div>
      ) : (
        <PrivateInput 
          followersFile={followersFile}
          followingFile={followingFile}
          onFollowersFileChange={setFollowersFile}
          onFollowingFileChange={setFollowingFile}
        />
      )}

      <SortSelector 
        sort={sort}
        onSortChange={setSort}
      />

      <button type="submit" className="submit-button">
        Check Follow-Back
      </button>
    </form>
  );
};

export default Form;
