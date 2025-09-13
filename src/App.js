import React, { useState } from 'react';
import Form from './components/Form.js';
import Results from './components/Results.js';
import Loading from './components/Loading.js';
import './styles/App.css';

function App() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFormSubmit = (data, error) => {
    setLoading(false);
    
    if (error) {
      setError(error);
      setResults(null);
    } else {
      setError(null);
      setResults(data);
    }
  };

  const handleLoadingChange = (isLoading) => {
    setLoading(isLoading);
    if (isLoading) {
      setError(null);
      setResults(null);
    }
  };

  return (
    <div className="App">
      <h1>Instagram Follow-Back Checker</h1>
      
      <Form onSubmit={handleFormSubmit} onLoadingChange={handleLoadingChange} />
      
      {loading && <Loading />}
      
      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}
      
      {results && <Results data={results} />}
    </div>
  );
}

export default App;
