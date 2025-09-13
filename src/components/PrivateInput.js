import React from 'react';
import './PrivateInput.css';

const PrivateInput = ({ 
  followersFile, 
  followingFile, 
  onFollowersFileChange, 
  onFollowingFileChange 
}) => {
  return (
    <div className="private-inputs">
      <div className="file-input-group">
        <label htmlFor="followers">Upload Followers JSON:</label>
        <input
          type="file"
          id="followers"
          name="followers"
          accept=".json"
          onChange={(e) => onFollowersFileChange(e.target.files[0])}
          required
        />
      </div>
      
      <div className="file-input-group">
        <label htmlFor="following">Upload Following JSON:</label>
        <input
          type="file"
          id="following"
          name="following"
          accept=".json"
          onChange={(e) => onFollowingFileChange(e.target.files[0])}
          required
        />
      </div>
    </div>
  );
};

export default PrivateInput;
