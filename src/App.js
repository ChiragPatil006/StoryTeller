import AnalyticsPage from './AnalyticsPage.jsx';

// The main App function now only renders the AnalyticsPage component.
function App() {
  return (
    // You can optionally wrap it in a Fragment if needed, but returning the component is fine.
    <AnalyticsPage />
  );
}

// Export the main App component
export default App;